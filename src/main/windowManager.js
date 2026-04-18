const { BrowserWindow, screen, Menu, Tray, app } = require('electron');
const path = require('path');
const FaviconManager = require('./utils/favicon.js');

// 窗口引用
let mainWindow = null;
let lockWindow = null;
let lockTimer = null;
let tray = null;
let isLockWindowClosing = false;
let isRestoringMain = false;

// 创建主窗口
function createMainWindow() {
    console.log('[WindowManager] Creating main window');

    mainWindow = new BrowserWindow({
        width: 500,
        height: 750,
        resizable: true,
        frame: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: 0.8
        }
    });

    mainWindow.setMenu(null);
    // mainWindow.loadFile('src/renderer/index.html');
    mainWindow.loadFile('dist/renderer/index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(0.75);
        mainWindow.webContents.setZoomLevel(-1.0);
    });

    mainWindow.on('close', (event) => {
        console.log('[WindowManager] Main window close, quitting:', app.quitting);
        if (app.quitting) {
            mainWindow = null;
        } else {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

// 创建托盘
function createTray() {
    console.log('[WindowManager] Creating tray');

    try {
        tray = FaviconManager.createTrayIcon(__dirname);
        if (!tray) return null;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示主窗口',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    } else {
                        createMainWindow();
                    }
                }
            },
            {
                label: '退出应用',
                click: () => {
                    app.quitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('起来走走 - 拒绝久坐');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
            } else {
                createMainWindow();
            }
        });

        console.log('[WindowManager] Tray created');
        return tray;
    } catch (error) {
        console.error('[WindowManager] Tray creation failed:', error);
        return null;
    }
}

// 创建锁屏窗口
function createLockWindow(durationSeconds, forceLock) {
    console.log('[WindowManager] Creating lock window:', durationSeconds, 's, forceLock:', forceLock);

    isLockWindowClosing = false;

    // 清理现有锁屏窗口
    if (lockWindow && !lockWindow.isDestroyed()) {
        lockWindow.destroy();
        lockWindow = null;
    }
    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    let validDuration = parseInt(durationSeconds);
    if (isNaN(validDuration) || validDuration < 10) {
        validDuration = 60;
    }

    const display = screen.getPrimaryDisplay();
    const { width, height } = display.bounds;

    lockWindow = new BrowserWindow({
        width, height, x: 0, y: 0,
        fullscreen: true,
        fullscreenable: true,
        kiosk: true,
        alwaysOnTop: true,
        frame: false,
        transparent: false,
        resizable: false,
        closable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        showInTaskbar: false,
        focusable: true,
        autoHideMenuBar: true,
        show: false,
        menuBarVisible: false,
        titleBarStyle: 'hidden',
        disableAutoHideCursor: true,
        thickFrame: false,
        useContentSize: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: false,   // 改为 false，允许直接使用 require
            nodeIntegration: true,      // 改为 true，允许使用 Node.js API
            sandbox: false,             // 关闭沙箱
            webSecurity: false,
            spellcheck: false
        }
    });

    // Windows 特定设置
    if (process.platform === 'win32') {
        lockWindow.setSkipTaskbar(true);
        lockWindow.setVisibleOnAllWorkspaces(true);
    }

    // macOS 特定设置
    if (process.platform === 'darwin') {
        lockWindow.setVisibleOnAllWorkspaces(true);
        lockWindow.setFullScreenable(true);
    }

    // lockWindow.loadFile('src/renderer/lock.html', {
    //     query: { duration: validDuration, forceLock: forceLock ? 'true' : 'false' }
    // });
    lockWindow.loadFile('dist/renderer/lock.html', {
        query: { duration: validDuration, forceLock: forceLock ? 'true' : 'false' }
    });

    lockWindow.once('ready-to-show', () => {
        lockWindow.setKiosk(true);
        lockWindow.setFullScreen(true);
        lockWindow.setAlwaysOnTop(true, 'screen-saver');

        if (process.platform === 'win32') {
            lockWindow.setSkipTaskbar(true);
            lockWindow.setVisibleOnAllWorkspaces(true);
            lockWindow.setContentProtection(true);
        }

        lockWindow.setMovable(false);
        lockWindow.setResizable(false);
        lockWindow.setOpacity(1.0);
        lockWindow.setIgnoreMouseEvents(false);
        lockWindow.setMenu(null);

        // 阻止键盘输入
        lockWindow.webContents.on('before-input-event', (event) => event.preventDefault());
        lockWindow.webContents.on('context-menu', (event) => event.preventDefault());

        lockWindow.webContents.executeJavaScript(`
            window.__LOCK_PARAMS__ = { duration: ${validDuration}, forceLock: ${forceLock} };
        `);

        lockWindow.focus();
        lockWindow.moveTop();
        lockWindow.show();

        // 持续确保全屏
        const fullscreenInterval = setInterval(() => {
            if (lockWindow && !lockWindow.isDestroyed()) {
                lockWindow.setKiosk(true);
                lockWindow.setFullScreen(true);
                lockWindow.setAlwaysOnTop(true, 'screen-saver');
                if (process.platform === 'win32') {
                    lockWindow.setSkipTaskbar(true);
                }
                lockWindow.focus();
                lockWindow.moveTop();
            } else {
                clearInterval(fullscreenInterval);
            }
        }, 500);

        lockWindow._fullscreenInterval = fullscreenInterval;
    });

    lockWindow.on('closed', () => {
        if (lockWindow?._fullscreenInterval) {
            clearInterval(lockWindow._fullscreenInterval);
        }
        lockWindow = null;
        isLockWindowClosing = false;
        restoreMainWindow();
    });

    lockWindow.on('blur', () => {
        if (lockWindow && !lockWindow.isDestroyed() && !isLockWindowClosing) {
            lockWindow.focus();
            lockWindow.moveTop();
        }
    });

    // 备用定时器
    lockTimer = setTimeout(() => {
        console.log('[WindowManager] Fallback timer triggered');
        forceCloseLockWindow();
    }, validDuration * 1000 + 3000);

    return lockWindow;
}

// 强制关闭锁屏窗口
function forceCloseLockWindow() {
    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    if (lockWindow && !lockWindow.isDestroyed()) {
        lockWindow.destroy();
        lockWindow = null;
    }

    isLockWindowClosing = false;
    return { lockClosed: true };
}

// 关闭锁屏窗口
function closeLockWindow() {
    if (isLockWindowClosing || !lockWindow || lockWindow.isDestroyed()) {
        restoreMainWindow();
        return;
    }

    isLockWindowClosing = true;

    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    restoreMainWindow();

    try {
        lockWindow.destroy();
    } catch (e) {
        console.error('[WindowManager] Error destroying lock window:', e);
        lockWindow = null;
        isLockWindowClosing = false;
    }
}

// 恢复主窗口
function restoreMainWindow() {
    if (isRestoringMain) return;
    isRestoringMain = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setEnabled(true);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
        mainWindow.moveTop();
    }

    setTimeout(() => { isRestoringMain = false; }, 100);
}

// 获取窗口引用
function getMainWindow() { return mainWindow; }
function getLockWindow() { return lockWindow; }
function getTray() { return tray; }
function isLockWindowClosingState() { return isLockWindowClosing; }

module.exports = {
    createMainWindow,
    createTray,
    createLockWindow,
    forceCloseLockWindow,
    closeLockWindow,
    restoreMainWindow,
    getMainWindow,
    getLockWindow,
    getTray,
    isLockWindowClosingState
};