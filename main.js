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

// main.js 中的 createLockWindow 函数
function createLockWindow(durationSeconds, forceLock) {
    console.log('[MAIN] createLockWindow called, durationSeconds:', durationSeconds, 'forceLock:', forceLock);
    console.log('[MAIN] Current state - isLockWindowClosing:', isLockWindowClosing, 'lockWindow exists:', !!lockWindow);

    if (isLockWindowClosing) {
        console.log('[MAIN] Lock window is closing, skip creating new.');
        return;
    }

    if (lockWindow && !lockWindow.isDestroyed()) {
        console.log('[MAIN] Closing existing lock window before creating new.');
        try {
            lockWindow._forceClose = true;
            lockWindow.close();
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

    lockWindow = new BrowserWindow({
        width: width,
        height: height,
        fullscreen: true,
        alwaysOnTop: true,
        frame: false,
        transparent: false,
        resizable: false,
        closable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    lockWindow.loadFile('lock_temp.html');

    lockWindow.webContents.on('did-finish-load', () => {
        console.log('[MAIN] Lock window finished loading');
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

    lockWindow.on('close', (e) => {
        console.log('[MAIN] Lock window close event, _forceClose:', lockWindow._forceClose);
        if (!lockWindow._forceClose) {
            console.log('[MAIN] Close prevented - user cannot close lock window manually');
            e.preventDefault();
            return false;
        }
        console.log('[MAIN] Close allowed');
        return true;
    });

    // 备用定时器：根据秒数设置
    const timeoutMs = validDuration * 1000 + 3000;
    console.log('[MAIN] Setting fallback timer for', timeoutMs, 'ms');
    lockTimer = setTimeout(() => {
        console.log('[MAIN] Fallback timer triggered - forcing lock window close');
        closeLockWindow();
    }, timeoutMs);

    console.log('[MAIN] Lock window created successfully');
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

    try {
        lockWindow._forceClose = true;
        lockWindow.close();
    } catch (e) {
        console.error('[MAIN] Error closing lock window:', e);
        // 如果关闭失败，强制销毁
        try {
            lockWindow.destroy();
        } catch (e2) { }
        lockWindow = null;
        isLockWindowClosing = false;
        restoreMainWindow();
    }
}

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