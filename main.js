const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let lockWindow = null;
let lockTimer = null;
let isLockWindowClosing = false;
let isRestoringMain = false;

function createMainWindow() {
    console.log('[MAIN] Creating main window');
    mainWindow = new BrowserWindow({
        width: 500,
        height: 750,
        resizable: true,
        frame: true,
        // titleBarStyle: 'hidden', 隐藏按钮
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: 0.8
        }
    });

    // 移除默认菜单（保留窗口控制按钮，但移除 File/Edit 等菜单）
    mainWindow.setMenu(null);

    mainWindow.loadFile('index.html');

    // 加载完成后设置缩放
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(0.75);
        // zoomLevel: 0 = 100%, -0.5 = 约 85%, -1.0 = 约 80%
        mainWindow.webContents.setZoomLevel(-1.0);  // -0.7 ≈ 85%
    });

    mainWindow.on('closed', () => {
        console.log('[MAIN] Main window closed');
        mainWindow = null;
    });
}

function createLockWindow(durationSeconds, forceLock) {
    console.log('[MAIN] createLockWindow called, durationSeconds:', durationSeconds, 'forceLock:', forceLock);
    console.log('[MAIN] Current state - isLockWindowClosing:', isLockWindowClosing, 'lockWindow exists:', !!lockWindow);

    // 重置关闭标志，允许创建新窗口
    isLockWindowClosing = false;

    if (lockWindow && !lockWindow.isDestroyed()) {
        console.log('[MAIN] Closing existing lock window before creating new.');
        try {
            lockWindow.destroy();
        } catch (e) { }
        lockWindow = null;
    }

    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    // 确保 durationSeconds 是有效的秒数（至少 10 秒）
    let validDuration = parseInt(durationSeconds);
    if (isNaN(validDuration) || validDuration < 10) {
        console.warn('[MAIN] Invalid duration:', durationSeconds, 'using default 60 seconds');
        validDuration = 60;
    }

    console.log('[MAIN] Using duration:', validDuration, 'seconds (', Math.floor(validDuration / 60), 'minutes)');

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 创建全屏窗口
    lockWindow = new BrowserWindow({
        width: width,
        height: height,
        fullscreen: true,
        fullscreenable: false,
        kiosk: true,
        alwaysOnTop: true,
        frame: false,
        transparent: false,
        resizable: false,
        closable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        focusable: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 通过 URL 参数传递数据，而不是创建临时文件
    const lockHtmlPath = path.join(__dirname, 'lock.html');
    lockWindow.loadFile('lock.html', {
        query: {
            duration: validDuration,
            forceLock: forceLock ? 'true' : 'false'
        }
    });

    lockWindow.setFullScreen(true);
    lockWindow.setAlwaysOnTop(true, 'pop-up-menu');
    // lockWindow.setAlwaysOnTop(true, 'screen-saver');
    lockWindow.setMovable(false);
    lockWindow.setResizable(false);

    // 注入参数到页面（备用方案）
    lockWindow.webContents.on('did-finish-load', () => {
        console.log('[MAIN] Lock window finished loading');
        // 通过 executeJavaScript 注入参数
        lockWindow.webContents.executeJavaScript(`
            window.__LOCK_PARAMS__ = {
                duration: ${validDuration},
                forceLock: ${forceLock}
            };
            console.log('[LOCK] Injected params via executeJavaScript:', window.__LOCK_PARAMS__);
        `);
        lockWindow.focus();

        // 再次确保全屏
        if (process.platform === 'win32') {
            lockWindow.setFullScreen(true);
        }
    });

    lockWindow.on('closed', () => {
        console.log('[MAIN] Lock window closed event');
        lockWindow = null;
        isLockWindowClosing = false;
        restoreMainWindow();
    });

    // 备用定时器
    const timeoutMs = validDuration * 1000 + 3000;
    console.log('[MAIN] Setting fallback timer for', timeoutMs, 'ms');
    lockTimer = setTimeout(() => {
        console.log('[MAIN] Fallback timer triggered - forcing lock window close');
        forceCloseLockWindow();
    }, timeoutMs);

    console.log('[MAIN] Lock window created successfully');
}

// 强制关闭锁屏窗口 - 使用 destroy 方法
function forceCloseLockWindow() {
    console.log('[MAIN] forceCloseLockWindow called');

    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    if (lockWindow && !lockWindow.isDestroyed()) {
        console.log('[MAIN] Force destroying lock window');
        try {
            // 直接销毁窗口，不触发 close 事件
            lockWindow.destroy();
        } catch (e) {
            console.error('[MAIN] Error destroying lock window:', e);
        }
        lockWindow = null;
    }

    isLockWindowClosing = false;
    
    // 通知主窗口锁屏关闭，触发 onLockClose 回调
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[MAIN] Notifying main window that lock is closed (force close)');
        mainWindow.webContents.send('lock-closed');
    }
    
    restoreMainWindow();
}

function closeLockWindow() {
    console.log('[MAIN] closeLockWindow called, isLockWindowClosing:', isLockWindowClosing);
    console.log('[MAIN] lockWindow exists:', !!lockWindow, 'isDestroyed:', lockWindow ? lockWindow.isDestroyed() : 'N/A');

    if (isLockWindowClosing) {
        console.log('[MAIN] Already closing lock window, skip.');
        restoreMainWindow();
        return;
    }

    if (!lockWindow || lockWindow.isDestroyed()) {
        console.log('[MAIN] No valid lock window to close.');
        restoreMainWindow();
        return;
    }

    console.log('[MAIN] Closing lock window now.');
    isLockWindowClosing = true;

    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    // 先恢复主窗口
    restoreMainWindow();

    // 通知主窗口停止声音
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[MAIN] Notifying main window to stop sound');
        mainWindow.webContents.send('stop-sound');
    }

    // 通知主窗口锁屏关闭，触发 onLockClose 回调
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[MAIN] Notifying main window that lock is closed');
        mainWindow.webContents.send('lock-closed');
    }

    // 直接使用 destroy 方法强制关闭全屏窗口
    try {
        lockWindow.destroy();
    } catch (e) {
        console.error('[MAIN] Error destroying lock window:', e);
        lockWindow = null;
        isLockWindowClosing = false;
    }
}

// 添加 IPC 监听停止声音
ipcMain.on('stop-sound-request', () => {
    console.log('[MAIN] IPC stop-sound-request received');
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stop-sound');
    }
});

function restoreMainWindow() {
    if (isRestoringMain) {
        console.log('[MAIN] Already restoring main window');
        return;
    }
    isRestoringMain = true;
    console.log('[MAIN] restoreMainWindow called');

    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[MAIN] Enabling and focusing main window');
        mainWindow.setEnabled(true);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
        mainWindow.moveTop();
    } else {
        console.log('[MAIN] Main window not available for restore');
    }

    setTimeout(() => {
        isRestoringMain = false;
        console.log('[MAIN] Restore flag reset');
    }, 100);
}

// IPC 监听
ipcMain.on('show-lock', (event, duration, forceLock) => {
    console.log('[MAIN] IPC show-lock received:', duration, forceLock);
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[MAIN] Disabling main window');
        mainWindow.setEnabled(false);
        mainWindow.setAlwaysOnTop(false);
    }
    createLockWindow(duration, forceLock);
});

ipcMain.on('lock-complete', () => {
    console.log('[MAIN] IPC lock-complete received');
    closeLockWindow();
});

ipcMain.on('hide-lock', () => {
    console.log('[MAIN] IPC hide-lock received');
    closeLockWindow();
});

// 单例模式：确保只有一个应用实例运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // 如果已有实例运行，则退出当前实例
    app.quit();
} else {
    // 监听第二个实例启动事件
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 有人试图运行第二个实例，聚焦主窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        console.log('[MAIN] App ready');
        createMainWindow();
    });
}

// 多例模式：确保多个应用实例运行，每个实例都有自己的窗口和状态
// app.whenReady().then(() => {
//     console.log('[MAIN] App ready');
//     createMainWindow();
// });

app.on('window-all-closed', () => {
    console.log('[MAIN] All windows closed');
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    console.log('[MAIN] App activate');
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});