"""루미나리아 UI 아이콘(Lucide, ISC 라이선스)을 받아 js/icons.js 로 묶는다.

게임 데이터에 적힌 이모지는 그대로 두고, 화면에 그릴 때 같은 뜻의 선 아이콘으로 바꿔 끼운다.
    python3 tools/luminaria_icons.py
"""
import json, os, re, urllib.request

VER = '0.460.0'
OUT = os.path.join(os.path.dirname(__file__), '..', 'luminaria', 'js', 'icons.js')
# 이모지(이체 선택자 FE0F 제외) → Lucide 아이콘 이름
EMOJI = {
    '📖': 'book-open', '⚔': 'swords', '📚': 'library-big', '⚗': 'flask-conical', '🎪': 'tent', '🧭': 'compass',
    '🕊': 'bird', '⛪': 'church', '🏪': 'store', '🌊': 'waves', '🛏': 'bed-double', '🕯': 'flame',
    '🌟': 'sparkles', '🎒': 'backpack', '💾': 'save', '🖼': 'images', '⚙': 'settings', '🏠': 'house',
    '📜': 'scroll-text', '📅': 'calendar-days', '🌙': 'moon-star', '💌': 'mail', '🏖': 'tree-palm', '💰': 'coins',
    '🔒': 'lock', '🛡': 'shield', '🔮': 'wand-sparkles', '🎭': 'drama', '🤝': 'handshake', '💕': 'heart',
    '🎁': 'gift', '📮': 'pen-line', '🎖': 'medal', '🎐': 'bell', '🌬': 'wind', '👁': 'eye', '💐': 'flower',
    '🍵': 'leaf', '📕': 'book', '🍢': 'drumstick', '🤍': 'flower-2', '🪨': 'sword', '🔩': 'cog', '🗺': 'map',
    '🪶': 'feather', '🍷': 'wine', '✨': 'gem', '🏊': 'waves', '🐚': 'shell', '🔬': 'microscope', '🛠': 'wrench',
    '😪': 'bed-single', '🎯': 'target', '🐟': 'fish', '💪': 'biceps-flexed', '☕': 'coffee', '👻': 'ghost',
    '🔭': 'telescope', '🎆': 'party-popper', '☀': 'sun', '☁': 'cloud', '🌧': 'cloud-rain', '❄': 'snowflake',
    '💞': 'heart-handshake', '💔': 'heart-crack', '💗': 'message-circle-heart',
    '♟': 'crown', '🍬': 'candy', '🔍': 'search',
}
# 이모지 없이 코드에서 직접 쓰는 아이콘
EXTRA = ['music', 'volume-x', 'heart', 'footprints', 'sandwich', 'shopping-bag', 'star', 'x']

names = sorted(set(EMOJI.values()) | set(EXTRA))
symbols = []
for n in names:
    url = f'https://cdn.jsdelivr.net/npm/lucide-static@{VER}/icons/{n}.svg'
    svg = urllib.request.urlopen(url, timeout=30).read().decode('utf8')
    body = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    body = re.sub(r'\s+', ' ', body).strip()
    symbols.append(f'<symbol id="i-{n}" viewBox="0 0 24 24">{body}</symbol>')
    print(n)

js = f"""/* 루미나리아 UI 아이콘 — Lucide {VER} (ISC License, https://lucide.dev) · tools/luminaria_icons.py 로 만든 파일 */
const ICON_MAP = {json.dumps(EMOJI, ensure_ascii=False)};
const ICON_SPRITE = {json.dumps(''.join(symbols), ensure_ascii=False)};
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${{ICON_SPRITE}}</svg>`);
const icon = (n, cls = '') => `<svg class="ico${{cls ? ' ' + cls : ''}}" aria-hidden="true"><use href="#i-${{n}}"/></svg>`;
const ICON_RE = new RegExp(Object.keys(ICON_MAP).map((k) => k + '\\\\uFE0F?').join('|'), 'gu');
/* 글 속 이모지를 선 아이콘으로 (이미 이스케이프한 HTML에 쓴다) */
const iconize = (h) => String(h).replace(ICON_RE, (m) => icon(ICON_MAP[m.replace(/\\uFE0F/g, '')]));
"""
open(OUT, 'w', encoding='utf8').write(js)
print(len(names), 'icons ->', OUT)
