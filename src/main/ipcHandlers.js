const { ipcMain, app, Notification } = require('electron');
const path = require('path');
const windowManager = require('./windowManager');

// 初始化 IPC 处理器
function initIpcHandlers() {
    
    // ========== 锁屏相关 ==========
    
    ipcMain.on('show-lock', (event, duration, forceLock) => {
        console.log('[IPC] show-lock:', duration, forceLock);
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setEnabled(false);
            mainWindow.setAlwaysOnTop(false);
        }
        windowManager.createLockWindow(duration, forceLock);
    });
    
    ipcMain.on('lock-complete', () => {
        console.log('[IPC] lock-complete');
        const mainWindow = windowManager.getMainWindow();
        const lockClosed = windowManager.forceCloseLockWindow();
        
        if (lockClosed?.lockClosed && mainWindow) {
            mainWindow.webContents.send('lock-closed');
        }
    });
    
    ipcMain.on('hide-lock', () => {
        console.log('[IPC] hide-lock');
        const mainWindow = windowManager.getMainWindow();
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stop-sound');
            mainWindow.webContents.send('lock-closed');
        }
        
        windowManager.closeLockWindow();
    });
    
    // ========== 声音相关 ==========
    
    ipcMain.on('stop-sound-request', () => {
        console.log('[IPC] stop-sound-request');
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stop-sound');
        }
    });
    
    // ========== 用户数据路径 ==========
    
    ipcMain.on('get-user-data-path', (event) => {
        try {
            const userDataPath = app.getPath('userData');
            console.log('[IPC] userData path:', userDataPath);
            event.returnValue = userDataPath;
        } catch (e) {
            console.error('[IPC] Error getting userData path:', e);
            event.returnValue = null;
        }
    });
    
    // ========== 通知相关 ==========
    
    // 请求通知权限（同步）
    ipcMain.on('request-notification-permission', (event) => {
        console.log('[IPC] request-notification-permission');
        event.returnValue = Notification.isSupported();
    });
    
    // 请求通知权限（异步）
    ipcMain.on('request-notification-permission-async', (event) => {
        console.log('[IPC] request-notification-permission-async');
        event.reply('notification-permission-result', Notification.isSupported());
    });
    
    // 显示通知（同步）
    ipcMain.on('show-notification', (event, options) => {
        console.log('[IPC] show-notification:', options?.title);
        
        if (!Notification.isSupported()) {
            event.returnValue = false;
            return;
        }
        
        try {
            const notification = new Notification({
                title: options.title || '别坐了',
                body: options.body || '',
                silent: options.silent || false,
                requireInteraction: options.requireInteraction || false
            });
            
            notification.on('click', () => {
                const mainWindow = windowManager.getMainWindow();
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            });
            
            notification.show();
            event.returnValue = true;
        } catch (e) {
            console.error('[IPC] Notification failed:', e);
            event.returnValue = false;
        }
    });
    
    // 显示通知（异步）
    ipcMain.on('show-notification-async', (event, options) => {
        console.log('[IPC] show-notification-async:', options?.title);
        
        if (!Notification.isSupported()) return;
        
        try {
            const notification = new Notification({
                title: options.title || '别坐了',
                body: options.body || '',
                silent: options.silent || false,
                requireInteraction: options.requireInteraction || false,
                timeoutType: options.requireInteraction ? 'never' : 'default',
                urgency: 'normal'
            });
            
            notification.on('click', () => {
                const mainWindow = windowManager.getMainWindow();
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                }
            });
            
            notification.show();
        } catch (e) {
            console.error('[IPC] Async notification failed:', e);
        }
    });
    
    console.log('[IPC] All handlers initialized');
}

module.exports = { initIpcHandlers };