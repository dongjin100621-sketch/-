/* 조국과 민족을 위하여 — 데스크톱(Steam) 실행 파일 진입점 */
'use strict';

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

// Steamworks에서 발급받은 App ID로 바꾸세요. 480은 Valve의 테스트용 앱(Spacewar)입니다.
const STEAM_APP_ID = Number(process.env.STEAM_APP_ID) || 480;

let steam = null;
let steamworks = null;
try {
  steamworks = require('steamworks.js');
} catch (e) {
  console.log('[steam] steamworks.js가 설치되지 않아 Steam 기능 없이 실행합니다.');
}

function initSteam() {
  if (!steamworks) return;
  try {
    steam = steamworks.init(STEAM_APP_ID);
    console.log(`[steam] 연결됨: ${steam.localplayer.getName()} (App ${STEAM_APP_ID})`);
  } catch (e) {
    steam = null;
    console.log('[steam] Steam 클라이언트에 연결하지 못했습니다:', e.message);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    useContentSize: true,
    backgroundColor: '#000000',
    title: '조국과 민족을 위하여',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // 외부 링크·새 창 열기를 막는다
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
}

ipcMain.on('quit', () => app.quit());
ipcMain.on('toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setFullScreen(!win.isFullScreen());
});
ipcMain.on('achievement', (event, id) => {
  if (!steam || typeof id !== 'string' || !/^ACH_[A-Z_]+$/.test(id)) return;
  try { steam.achievement.activate(id); } catch (e) { console.log('[steam] 업적 등록 실패:', id, e.message); }
});

app.whenReady().then(() => {
  initSteam();
  createWindow();
});
app.on('window-all-closed', () => app.quit());

if (steamworks) {
  try { steamworks.electronEnableSteamOverlay(); } catch (e) { /* 오버레이 없이 실행 */ }
}
