/* 게임 화면(렌더러)에 노출하는 최소한의 기능: 종료, 전체 화면, Steam 업적 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  quit: () => ipcRenderer.send('quit'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  achievement: (id) => ipcRenderer.send('achievement', String(id)),
});
