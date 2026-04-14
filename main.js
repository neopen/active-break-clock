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
        resizable: false,
        frame: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

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
            lockWindow.destroy();  // 直接销毁，不经过 close 事件
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

    // 注入参数到 lock.html
    const lockHtmlPath = path.join(__dirname, 'lock.html');
    let htmlContent = fs.readFileSync(lockHtmlPath, 'utf8');

    // 添加参数注入脚本 - 使用秒数
    const paramScript = `
    <script>
        // 注入参数 - duration 单位是秒
        window.__LOCK_PARAMS__ = {
            duration: ${validDuration},
            forceLock: ${forceLock}
        };
        console.log('[LOCK] Injected params - duration:', ${validDuration}, 'seconds, forceLock:', ${forceLock});
    </script>
    `;

    // 在 body 开始处注入脚本，确保在其他脚本之前执行
    htmlContent = htmlContent.replace('<body>', `<body>${paramScript}`);

    const tempHtmlPath = path.join(__dirname, 'lock_temp.html');
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 创建全屏窗口 - 关键配置
    lockWindow = new BrowserWindow({
        width: width,
        height: height,
        fullscreen: true,
        fullscreenable: false,  // 禁止退出全屏
        alwaysOnTop: true,
        frame: false,
        transparent: false,
        resizable: false,
        closable: false,        // 禁止用户关闭
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        focusable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    lockWindow.loadFile('lock_temp.html');

    // 确保窗口始终在最前
    lockWindow.setAlwaysOnTop(true, 'screen-saver');

    // 锁定窗口位置和大小
    lockWindow.setMovable(false);
    lockWindow.setResizable(false);

    lockWindow.webContents.on('did-finish-load', () => {
        console.log('[MAIN] Lock window finished loading');
        lockWindow.focus();
    });

    lockWindow.on('closed', () => {
        console.log('[MAIN] Lock window closed event');
        try {
            fs.unlinkSync(tempHtmlPath);
        } catch (e) { }
        lockWindow = null;
        isLockWindowClosing = false;
        restoreMainWindow();
    });

    // 备用定时器：根据秒数设置
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

app.whenReady().then(() => {
    console.log('[MAIN] App ready');
    createMainWindow();
});

app.on('window-all-closed', () => {
    console.log('[MAIN] All windows closed');
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    console.log('[MAIN] App activate');
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});