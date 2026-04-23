const { BrowserWindow, screen, Menu, Tray, app } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const FaviconManager = require('./utils/favicon.js');

// 窗口引用
let mainWindow = null;
let lockWindow = null;
let lockTimer = null;
let tray = null;
let isLockWindowClosing = false;
let isRestoringMain = false;
let wasMainWindowVisible = true; // 保存主窗口的可见状态

// 调用系统锁屏
function lockSystem() {
    try {
        console.log('[WindowManager] Locking system');

        switch (process.platform) {
            case 'win32': // Windows
                execSync('rundll32.exe user32.dll,LockWorkStation');
                break;
            case 'darwin': // macOS
                execSync('pmset displaysleepnow');
                break;
            case 'linux': // Linux (GNOME)
                execSync('gnome-screensaver-command -l');
                break;
            default:
                console.log('[WindowManager] System lock not supported on this platform:', process.platform);
        }

        console.log('[WindowManager] System locked successfully');
    } catch (error) {
        console.error('[WindowManager] Failed to lock system:', error.message);
    }
}

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
            // 真正退出应用，让窗口关闭
            // mainWindow.destroy();
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

    // 保存主窗口的可见状态
    if (mainWindow && !mainWindow.isDestroyed()) {
        wasMainWindowVisible = mainWindow.isVisible();
        console.log('[WindowManager] Main window was visible:', wasMainWindowVisible);
    } else {
        wasMainWindowVisible = false;
    }

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
            contextIsolation: false,
            nodeIntegration: true,
            sandbox: false,
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

    lockWindow.loadFile('dist/renderer/lock.html', {
        query: { duration: validDuration, forceLock: forceLock ? 'true' : 'false' }
    });

    lockWindow.once('ready-to-show', () => {
        if (process.platform === 'win32') {
            lockWindow.setVisibleOnAllWorkspaces(true);
            lockWindow.setContentProtection(true);
        }

        lockWindow.setAlwaysOnTop(true, 'screen-saver');
        lockWindow.setSkipTaskbar(true);
        lockWindow.setMovable(false);
        lockWindow.setResizable(false);
        lockWindow.setOpacity(1.0);
        lockWindow.setIgnoreMouseEvents(false);
        lockWindow.setMenu(null);

        // ========== 优化的键盘拦截逻辑 ==========
        // 音量键列表（注意：这些键在 Windows/macOS 上可能无法被捕获）
        const volumeKeys = [
            'VolumeUp', 'VolumeDown', 'VolumeMute',
            'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute',
            // 某些系统的替代键名
            'MediaVolumeUp', 'MediaVolumeDown', 'MediaVolumeMute'
        ];

        // 允许通过的修饰键组合（音量键可能带修饰键）
        const isVolumeKeyCombination = (input) => {
            // 检查主键是否为音量键
            if (volumeKeys.includes(input.key)) {
                return true;
            }
            // 某些系统音量键可能以不同方式报告
            const keyLower = input.key.toLowerCase();
            if (keyLower.includes('volume') || keyLower.includes('audio')) {
                return true;
            }
            return false;
        };

        // 主拦截器 - 阻止所有非音量键
        lockWindow.webContents.on('before-input-event', (event, input) => {
            // 调试日志（生产环境可注释）
            console.log('[LOCK] before-input-event:', {
                key: input.key,
                code: input.code,
                type: input.type,
                alt: input.alt,
                ctrl: input.control,
                shift: input.shift,
                meta: input.meta
            });

            // 允许音量键通过（不影响系统音量控制）
            if (isVolumeKeyCombination(input)) {
                console.log('[LOCK] Volume key allowed:', input.key);
                return; // 不阻止，让系统处理音量
            }

            // 阻止所有其他按键
            // 注意：某些系统级组合键（如 Alt+F4, Ctrl+Alt+Del）仍然无法阻止
            console.log('[LOCK] Blocked key:', input.key);
            event.preventDefault();
        });

        // 额外的安全措施：阻止右键菜单
        lockWindow.webContents.on('context-menu', (event) => {
            console.log('[LOCK] Context menu blocked');
            event.preventDefault();
        });

        // 可选：注入渲染进程的额外防护（双重保险）
        lockWindow.webContents.executeJavaScript(`
            // 渲染进程层面的额外拦截（作为备用）
            (function() {
                // 音量键列表
                const volumeKeys = [
                    'VolumeUp', 'VolumeDown', 'VolumeMute',
                    'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute',
                    'MediaVolumeUp', 'MediaVolumeDown', 'MediaVolumeMute'
                ];
                
                // 在渲染进程也拦截一次（主进程已经拦截，这是双重保险）
                document.addEventListener('keydown', (e) => {
                    // 如果是音量键，放行
                    if (volumeKeys.includes(e.key)) {
                        console.log('[LOCK Renderer] Volume key allowed:', e.key);
                        return true;
                    }
                    
                    // 阻止所有其他按键
                    console.log('[LOCK Renderer] Blocked key:', e.key);
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }, { capture: true });
                
                document.addEventListener('keyup', (e) => {
                    if (!volumeKeys.includes(e.key)) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                }, { capture: true });
                
                console.log('[LOCK Renderer] Keyboard lock active');
            })();
        `);

        // 传递参数到渲染进程
        lockWindow.webContents.executeJavaScript(`
            window.__LOCK_PARAMS__ = { duration: ${validDuration}, forceLock: ${forceLock} };
        `);

        lockWindow.show();
        lockWindow.focus();
        lockWindow.moveTop();

        // 持续确保全屏和焦点（移除了有问题的 document.hasFocus 检查）
        const fullscreenInterval = setInterval(() => {
            if (lockWindow && !lockWindow.isDestroyed()) {
                lockWindow.setKiosk(true);
                lockWindow.setFullScreen(true);
                lockWindow.setAlwaysOnTop(true, 'screen-saver');
                if (process.platform === 'win32') {
                    lockWindow.setSkipTaskbar(true);
                }
                // 确保窗口获得焦点（只使用 Electron API）
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
            // 延迟重新聚焦，避免与系统对话框冲突
            // setTimeout(() => {
            //     if (lockWindow && !lockWindow.isDestroyed() && !isLockWindowClosing) {
            //         lockWindow.focus();
            //         lockWindow.moveTop();
            //     }
            // }, 50);
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

    // 备用定时器触发，属于自动关闭，需要系统锁屏
    lockSystem();

    if (lockWindow && !lockWindow.isDestroyed()) {
        lockWindow.destroy();
        lockWindow = null;
    }

    isLockWindowClosing = false;
    return { lockClosed: true };
}

// 关闭锁屏窗口
// autoClose: 是否是自动关闭（倒计时完成）
function closeLockWindow(autoClose = true) {
    if (isLockWindowClosing || !lockWindow || lockWindow.isDestroyed()) {
        restoreMainWindow();
        return;
    }

    isLockWindowClosing = true;

    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    // 只有自动关闭时才调用系统锁屏
    if (autoClose) {
        // 倒计时完成后调用系统锁屏
        lockSystem();
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
        mainWindow.setAlwaysOnTop(false);

        // 只在主窗口之前是可见的时候才显示它
        if (wasMainWindowVisible) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.moveTop();
            console.log('[WindowManager] Restored main window (was visible)');
        } else {
            console.log('[WindowManager] Main window remains hidden (was not visible)');
        }
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