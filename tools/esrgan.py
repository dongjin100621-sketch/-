"""Real-ESRGAN CPU 업스케일러 — 구조만 담은 최소 구현.
가중치 (Real-ESRGAN 릴리스):
  캐릭터(애니풍) 4배: v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth   → Upscaler(path)
  배경(회화)   2배: v0.2.1/RealESRGAN_x2plus.pth              → Upscaler(path, scale=2, nb=23)
  범용 4배(질감 보존): v0.2.5.0/realesr-general-x4v3.pth + realesr-general-wdn-x4v3.pth
                       → Upscaler(path, compact=32, wdn=wdn_path, denoise=.5)
"""
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from PIL import Image


class RDB(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        return self.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = RDB(nf, gc), RDB(nf, gc), RDB(nf, gc)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, nb=6, nf=64, gc=32, scale=4):
        super().__init__()
        self.scale = scale
        self.conv_first = nn.Conv2d(3 * (16 // scale // scale), nf, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        if self.scale < 4:  # 2배 모델은 먼저 해상도를 줄여 채널로 접는다
            x = F.pixel_unshuffle(x, 4 // self.scale)
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


class SRVGGNetCompact(nn.Module):
    """realesr-general-x4v3 / realesr-animevideov3 구조 (가벼운 VGG식 네트워크)"""
    def __init__(self, nf=64, nc=32, scale=4):
        super().__init__()
        self.scale = scale
        body = [nn.Conv2d(3, nf, 3, 1, 1), nn.PReLU(nf)]
        for _ in range(nc):
            body += [nn.Conv2d(nf, nf, 3, 1, 1), nn.PReLU(nf)]
        body.append(nn.Conv2d(nf, 3 * scale * scale, 3, 1, 1))
        self.body = nn.ModuleList(body)
        self.up = nn.PixelShuffle(scale)

    def forward(self, x):
        out = x
        for m in self.body:
            out = m(out)
        return self.up(out) + F.interpolate(x, scale_factor=self.scale, mode='nearest')


def _sd(path):
    sd = torch.load(path, map_location='cpu', weights_only=True)
    return sd.get('params_ema', sd.get('params', sd))


class Upscaler:
    def __init__(self, weights, tile=320, pad=16, scale=4, nb=6, compact=0, wdn=None, denoise=.5):
        """compact>0: SRVGGNetCompact(합성곱 compact개). wdn: 잡음 제거를 덜 하는 짝 가중치 —
        denoise(0~1) 비율로 두 가중치를 섞는다 (0 이면 원본 질감을 가장 많이 남긴다)."""
        self.net = SRVGGNetCompact(nc=compact, scale=scale) if compact else RRDBNet(nb=nb, scale=scale)
        self.k = scale
        sd = _sd(weights)
        if wdn:
            sw = _sd(wdn)
            sd = {k: denoise * v + (1 - denoise) * sw[k] for k, v in sd.items()}
        self.net.load_state_dict(sd)
        self.net.eval()
        self.tile, self.pad = tile, pad

    @torch.inference_mode()
    def __call__(self, im):
        """PIL RGB 이미지를 k배로 키운다 (겹치는 타일로 나눠 메모리를 아낀다)."""
        x = torch.from_numpy(np.asarray(im.convert('RGB'), np.float32) / 255).permute(2, 0, 1)[None]
        _, _, H0, W0 = x.shape
        k = self.k
        if k < 4 and (H0 % 2 or W0 % 2):
            x = F.pad(x, (0, W0 % 2, 0, H0 % 2), mode='replicate')
        _, _, h, w = x.shape
        out = torch.zeros(1, 3, h * k, w * k)
        t, p = self.tile, self.pad
        for y0 in range(0, h, t):
            for x0 in range(0, w, t):
                y1, x1 = min(y0 + t, h), min(x0 + t, w)
                py0, px0, py1, px1 = max(0, y0 - p), max(0, x0 - p), min(h, y1 + p), min(w, x1 + p)
                if k < 4:  # 접기(pixel_unshuffle)가 되도록 짝수 크기로 맞춘다
                    py0 -= py0 % 2; px0 -= px0 % 2
                    py1 -= (py1 - py0) % 2; px1 -= (px1 - px0) % 2
                o = self.net(x[:, :, py0:py1, px0:px1])
                out[:, :, y0 * k:y1 * k, x0 * k:x1 * k] = o[:, :, (y0 - py0) * k:(y1 - py0) * k, (x0 - px0) * k:(x1 - px0) * k]
        out = out[:, :, :H0 * k, :W0 * k]
        a = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + .5).astype(np.uint8)
        return Image.fromarray(a)
