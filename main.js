const { app, BrowserWindow, screen, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const FaviconManager = require('./js/favicon.js');

// 确保日志目录存在
let logDir;
let logFile;

// 延迟初始化日志目录，确保 app 已就绪
function initLogDir() {
    try {
        logDir = path.join(app.getPath('userData'), 'logs');
        console.log('[MAIN] Log directory:', logDir);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
            console.log('[MAIN] Log directory created');
        }
        // 日志文件路径
        logFile = path.join(logDir, `HealthClock_${new Date().toISOString().split('T')[0]}.log`);
        console.log('[MAIN] Log file:', logFile);
    } catch (error) {
        console.error('[MAIN] Error initializing log directory:', error);
    }
}

// 重定向 console.log 到文件
const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = `${new Date().toISOString()} - ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ')}
`;
    originalConsoleLog(...args);
    try {
        if (logFile) {
            fs.appendFileSync(logFile, message);
        }
    } catch (e) {
        originalConsoleLog('Error writing to log file:', e);
    }
};

// 重定向 console.error 到文件
const originalConsoleError = console.error;
console.error = function(...args) {
    const message = `${new Date().toISOString()} - ERROR - ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ')}
`;
    originalConsoleError(...args);
    try {
        if (logFile) {
            fs.appendFileSync(logFile, message);
        }
    } catch (e) {
        originalConsoleError('Error writing to log file:', e);
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

    mainWindow.loadFile('index.html');

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

    // 获取整个屏幕的大小，包括任务栏
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.size;

    // 创建全屏窗口 - 使用最高级别的置顶和锁定
    lockWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        // 初始设置为全屏
        fullscreen: true,
        fullscreenable: true,
        // 启用 kiosk 模式
        kiosk: true,
        // 初始设置为置顶
        alwaysOnTop: true,
        frame: false,
        transparent: false,
        resizable: false,
        closable: false,
        minimizable: false,
        maximizable: false,
        // 跳过任务栏
        skipTaskbar: true,
        focusable: true,
        autoHideMenuBar: true,
        show: false, // 先隐藏，设置好后再显示
        // 禁用所有默认菜单
        menuBarVisible: false,
        // 启用无框模式
        titleBarStyle: 'hidden',
        // 禁用窗口动画
        disableAutoHideCursor: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    // 通过 URL 参数传递数据
    lockWindow.loadFile('lock.html', {
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
        
        // 设置最高级别的置顶，覆盖所有其他窗口，包括全屏应用
        // 使用 'screen-saver' 级别，这是最高级别
        lockWindow.setAlwaysOnTop(true, 'screen-saver');
        
        // 确保窗口属性
        lockWindow.setMovable(false);
        lockWindow.setResizable(false);
        lockWindow.setOpacity(1.0); // 确保完全不透明
        lockWindow.setIgnoreMouseEvents(false); // 确保捕获鼠标事件
        
        // 禁用所有键盘快捷键
        lockWindow.webContents.on('before-input-event', (event, input) => {
            console.log('[MAIN] Blocking keyboard input:', input.key);
            event.preventDefault();
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
        lockWindow.moveTop(); // 确保在最顶层
        
        // 显示窗口
        lockWindow.show();
        console.log('[MAIN] Lock window shown');
        
        // 再次确认全屏状态
        setTimeout(() => {
            console.log('[MAIN] Reconfirming fullscreen state');
            lockWindow.setKiosk(true);
            lockWindow.setFullScreen(true);
            lockWindow.setAlwaysOnTop(true, 'screen-saver');
            lockWindow.focus();
            lockWindow.moveTop();
        }, 100);
        
        // 持续确保全屏状态
        setInterval(() => {
            if (lockWindow && !lockWindow.isDestroyed()) {
                lockWindow.setKiosk(true);
                lockWindow.setFullScreen(true);
                lockWindow.setAlwaysOnTop(true, 'screen-saver');
                lockWindow.focus();
                lockWindow.moveTop();
            }
        }, 1000);
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