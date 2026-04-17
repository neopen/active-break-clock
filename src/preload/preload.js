const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 通知相关
    showNotification: (options) => ipcRenderer.send('show-notification-async', options),
    onNotificationPermissionResult: (callback) => ipcRenderer.on('notification-permission-result', callback),
    
    // 锁屏相关
    showLock: (duration, forceLock) => ipcRenderer.send('show-lock', duration, forceLock),
    hideLock: () => ipcRenderer.send('hide-lock'),
    onLockClosed: (callback) => ipcRenderer.on('lock-closed', callback),
    
    // 声音相关
    onStopSound: (callback) => ipcRenderer.on('stop-sound', callback),
    
    // 用户数据
    getUserDataPath: () => ipcRenderer.sendSync('get-user-data-path')
});