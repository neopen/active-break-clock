const { app, BrowserWindow, Notification, screen, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const FaviconManager = require('./utils/favicon.js');

let logDir;
let logFile;
let logBuffer = [];
let logWriteTimer = null;
const LOG_FLUSH_INTERVAL = 1000;

function flushLogBuffer() {
    if (logBuffer.length === 0 || !logFile) return;
    
    const messages = logBuffer.join('');
    logBuffer = [];
    
    fs.writeFile(logFile, messages, { flag: 'a' }, (err) => {
        if (err) {
            const originalConsoleLog = console.log;
            originalConsoleLog('Error writing to log file:', err);
        }
    });
}

function scheduleLogFlush() {
    if (logWriteTimer) return;
    logWriteTimer = setTimeout(() => {
        logWriteTimer = null;
        flushLogBuffer();
    }, LOG_FLUSH_INTERVAL);
}

function initLogDir() {
    try {
        logDir = path.join(app.getPath('userData'), 'Logs');
        try {
            // 直接尝试创建目录，如果目录已存在会抛出异常
            fs.mkdirSync(logDir, { recursive: true });
        } catch (e) {
            // 目录可能已存在，或者创建失败
            // 检查错误代码，如果是目录已存在，则忽略
            if (e.code !== 'EEXIST') {
                console.error('[MAIN] Error creating log directory:', e);
            }
        }
        logFile = path.join(logDir, `HealthClock_${new Date().toISOString().split('T')[0]}.log`);
    } catch (error) {
        console.error('[MAIN] Error initializing log directory:', error);
    }
}

const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = `${new Date().toISOString()} - ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ')}
`;
    originalConsoleLog(...args);
    if (logFile) {
        logBuffer.push(message);
        scheduleLogFlush();
    }
};

const originalConsoleError = console.error;
console.error = function(...args) {
    const message = `${new Date().toISOString()} - ERROR - ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ')}
`;
    originalConsoleError(...args);
    if (logFile) {
        logBuffer.push(message);
        scheduleLogFlush();
    }
};

let mainWindow = null;
let lockWindow = null;
let lockTimer = null;
let isLockWindowClosing = false;
let isRestoringMain = false;
let tray = null;
// 标记应用是否正在退出
app.quitting = false;

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

    mainWindow.loadFile('src/renderer/index.html');

    // 加载完成后设置缩放
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(0.75);
        // zoomLevel: 0 = 100%, -0.5 = 约 85%, -1.0 = 约 80%
        mainWindow.webContents.setZoomLevel(-1.0);  // -0.7 ≈ 85%
    });

    // 当用户点击关闭按钮时，最小化到托盘
    mainWindow.on('close', (event) => {
        console.log('[MAIN] Main window close event, app.quitting:', app.quitting);
        if (app.quitting) {
            console.log('[MAIN] App is quitting, allowing window to close');
            mainWindow = null;
        } else {
            console.log('[MAIN] Preventing window close, minimizing to tray');
            event.preventDefault();
            mainWindow.hide();
            console.log('[MAIN] Main window minimized to tray');
        }
    });

    mainWindow.on('closed', () => {
        console.log('[MAIN] Main window closed');
        mainWindow = null;
    });
}

function createTray() {
    console.log('[MAIN] Creating tray icon');
    try {
        // 使用 FaviconManager 创建托盘图标
        tray = FaviconManager.createTrayIcon(__dirname);
        
        if (!tray) {
            console.log('[MAIN] Tray creation failed, but app will continue');
            return;
        }
        
        // 创建托盘菜单
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示主窗口',
                click: () => {
                    console.log('[MAIN] Showing main window from tray');
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
                    console.log('[MAIN] Exiting app from tray');
                    app.quitting = true;
                    app.quit();
                }
            }
        ]);
        
        // 设置托盘图标悬停文本
        tray.setToolTip('起来走走 - 拒绝久坐');
        
        // 设置托盘菜单
        tray.setContextMenu(contextMenu);
        
        // 点击托盘图标显示/隐藏主窗口
        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            } else {
                createMainWindow();
            }
        });
        
        console.log('[MAIN] Tray created successfully');
    } catch (error) {
        console.error('[MAIN] Error creating tray:', error);
        console.error('[MAIN] Error stack:', error.stack);
        // 即使创建托盘失败，应用也能正常运行
    }
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

    // 获取主显示器
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.bounds;  // 使用 bounds 而不是 size，包含任务栏区域
    const { workArea } = display;  // 工作区域（不包含任务栏）

    console.log('[MAIN] Display bounds:', width, 'x', height);
    console.log('[MAIN] Work area:', workArea.width, 'x', workArea.height);

    // 创建全屏窗口 - 使用最高级别的置顶和锁定
    lockWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        // 全屏设置
        fullscreen: true,
        fullscreenable: true,
        // kiosk 模式
        kiosk: true,
        // 始终置顶 - 使用最高级别
        alwaysOnTop: true,
        // 窗口样式
        frame: false,
        transparent: false,
        // 禁止调整大小
        resizable: false,
        // 禁止关闭、最小化、最大化
        closable: false,
        minimizable: false,
        maximizable: false,
        // 关键：跳过任务栏
        skipTaskbar: true,
        // 不显示在任务栏
        showInTaskbar: false,  // 添加这一行
        // 可聚焦
        focusable: true,
        // 自动隐藏菜单栏
        autoHideMenuBar: true,
        // 先隐藏，设置好后再显示
        show: false,
        // 禁用菜单
        menuBarVisible: false,
        // 隐藏标题栏
        titleBarStyle: 'hidden',
        // 禁用光标自动隐藏
        disableAutoHideCursor: true,
        // 厚框
        thickFrame: false,
        // 使用内容大小
        useContentSize: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            // 添加以下设置
            enableRemoteModule: true,
            spellcheck: false
        }
    });

    // 在 Windows 上，设置窗口为工具窗口可以隐藏任务栏图标
    if (process.platform === 'win32') {
        // 设置窗口为工具窗口（不在任务栏显示）
        lockWindow.setSkipTaskbar(true);
        
        // 设置窗口在所有桌面可见
        lockWindow.setVisibleOnAllWorkspaces(true);
        
        // 尝试使用原生 Windows API 设置
        try {
            const win = lockWindow;
            // 设置窗口扩展样式
            const HWND = win.getNativeWindowHandle();
            if (HWND) {
                console.log('[MAIN] Native window handle obtained');
            }
        } catch (e) {
            console.warn('[MAIN] Could not set native window properties:', e);
        }
    }

    // macOS 特定设置
    if (process.platform === 'darwin') {
        lockWindow.setVisibleOnAllWorkspaces(true);
        lockWindow.setFullScreenable(true);
    }

    // 通过 URL 参数传递数据
    lockWindow.loadFile('src/renderer/lock.html', {
        query: {
            duration: validDuration,
            forceLock: forceLock ? 'true' : 'false'
        }
    });

    // 窗口准备好后再显示
    lockWindow.once('ready-to-show', () => {
        console.log('[MAIN] Lock window ready to show');
        
        // 关键步骤：设置为 kiosk 模式
        lockWindow.setKiosk(true);
        
        // 确保全屏
        lockWindow.setFullScreen(true);
        
        // 设置最高级别的置顶
        lockWindow.setAlwaysOnTop(true, 'screen-saver');
        
        // 在 Windows 上额外设置
        if (process.platform === 'win32') {
            // 确保不在任务栏显示
            lockWindow.setSkipTaskbar(true);
            // 在所有工作区可见
            lockWindow.setVisibleOnAllWorkspaces(true);
        }
        
        // 确保窗口属性
        lockWindow.setMovable(false);
        lockWindow.setResizable(false);
        lockWindow.setOpacity(1.0);
        lockWindow.setIgnoreMouseEvents(false);
        
        // 禁用所有键盘快捷键
        lockWindow.webContents.on('before-input-event', (event, input) => {
            // 阻止所有键盘输入，除了必要的
            const allowedKeys = []; // 不允许任何按键
            if (!allowedKeys.includes(input.key)) {
                console.log('[MAIN] Blocking keyboard input:', input.key);
                event.preventDefault();
            }
        });
        
        // 禁用右键菜单
        lockWindow.webContents.on('context-menu', (event) => {
            event.preventDefault();
        });
        
        // 禁用所有默认菜单
        lockWindow.setMenu(null);
        
        // 注入参数到页面
        lockWindow.webContents.executeJavaScript(`
            window.__LOCK_PARAMS__ = {
                duration: ${validDuration},
                forceLock: ${forceLock}
            };
            console.log('[LOCK] Injected params via executeJavaScript:', window.__LOCK_PARAMS__);
        `);
        
        // 确保窗口获得焦点
        lockWindow.focus();
        lockWindow.moveTop();
        
        // 显示窗口
        lockWindow.show();
        
        // 对于 Windows，使用 setContentProtection 防止被其他窗口覆盖
        if (process.platform === 'win32') {
            lockWindow.setContentProtection(true);
        }
        
        console.log('[MAIN] Lock window shown');
        
        // 持续确保全屏状态
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
        }, 500);  // 降低频率到 500ms，避免过度消耗
        
        // 保存 interval ID 以便清理
        lockWindow._fullscreenInterval = fullscreenInterval;
    });

    lockWindow.on('closed', () => {
        console.log('[MAIN] Lock window closed event');
        // 清理 interval
        if (lockWindow && lockWindow._fullscreenInterval) {
            clearInterval(lockWindow._fullscreenInterval);
        }
        lockWindow = null;
        isLockWindowClosing = false;
        restoreMainWindow();
    });
    
    // 窗口失去焦点时重新获取焦点
    lockWindow.on('blur', () => {
        if (lockWindow && !lockWindow.isDestroyed() && !isLockWindowClosing) {
            console.log('[MAIN] Lock window lost focus, refocusing');
            lockWindow.focus();
            lockWindow.moveTop();
        }
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

// 请求通知权限（同步）
ipcMain.on('request-notification-permission', (event) => {
    console.log('[MAIN] request-notification-permission received');
    
    if (Notification.isSupported()) {
        const granted = Notification.isSupported() && 
            process.platform !== 'linux' ? true : false;  // Linux 可能需要额外处理
        
        console.log('[MAIN] Notification permission result:', granted);
        event.returnValue = true;  // Electron 主进程默认有权限
    } else {
        console.log('[MAIN] Notifications not supported');
        event.returnValue = false;
    }
});

// 请求通知权限（异步）
ipcMain.on('request-notification-permission-async', (event) => {
    console.log('[MAIN] request-notification-permission-async received');
    
    if (Notification.isSupported()) {
        event.reply('notification-permission-result', true);
    } else {
        event.reply('notification-permission-result', false);
    }
});

// 显示通知
ipcMain.on('show-notification', (event, options) => {
    console.log('[MAIN] show-notification received:', options);
    
    if (!Notification.isSupported()) {
        console.log('[MAIN] Notifications not supported');
        event.returnValue = false;
        return;
    }
    
    try {
        const notification = new Notification({
            title: options.title || '提醒',
            body: options.body || '',
            icon: options.icon ? path.join(__dirname, '../../renderer', options.icon) : undefined,
            silent: options.silent || false,
            requireInteraction: options.requireInteraction || false,
            timeoutType: options.requireInteraction ? 'never' : 'default'
        });
        
        notification.on('click', () => {
            console.log('[MAIN] Notification clicked');
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
        
        notification.show();
        console.log('[MAIN] Notification shown successfully');
        event.returnValue = true;
    } catch (e) {
        console.error('[MAIN] Failed to show notification:', e);
        event.returnValue = false;
    }
});

// 异步显示通知（不会阻塞渲染进程）
ipcMain.on('show-notification-async', (event, options) => {
    console.log('[MAIN] show-notification-async received:', options);
    
    if (!Notification.isSupported()) {
        console.log('[MAIN] Notifications not supported');
        return;
    }
    
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
            console.log('[MAIN] Notification clicked');
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
        
        notification.on('show', () => {
            console.log('[MAIN] Notification shown');
        });
        
        notification.on('failed', (event, error) => {
            console.error('[MAIN] Notification failed:', error);
        });
        
        notification.show();
        console.log('[MAIN] Notification show() called');
    } catch (e) {
        console.error('[MAIN] Failed to show notification:', e);
    }
});

// 同步显示通知（如果需要返回值）
ipcMain.on('show-notification', (event, options) => {
    console.log('[MAIN] show-notification received:', options);
    
    if (!Notification.isSupported()) {
        console.log('[MAIN] Notifications not supported');
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
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
        
        notification.show();
        console.log('[MAIN] Notification shown');
        event.returnValue = true;
    } catch (e) {
        console.error('[MAIN] Failed to show notification:', e);
        event.returnValue = false;
    }
});

// 获取 userData 路径
ipcMain.on('get-user-data-path', (event) => {
    console.log('[MAIN] get-user-data-path request received');
    try {
        const userDataPath = app.getPath('userData');
        console.log('[MAIN] Returning userData path:', userDataPath);
        event.returnValue = userDataPath;
    } catch (e) {
        console.error('[MAIN] Error getting userData path:', e);
        event.returnValue = null;
    }
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
        // 初始化日志目录
        initLogDir();
        createMainWindow();
        createTray();
    });
}

// 多例模式：确保多个应用实例运行，每个实例都有自己的窗口和状态
// app.whenReady().then(() => {
//     console.log('[MAIN] App ready');
//     createMainWindow();
// });

app.on('window-all-closed', () => {
    console.log('[MAIN] All windows closed');
    // 不退出应用，保持后台运行
    // if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    console.log('[MAIN] App activate');
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});