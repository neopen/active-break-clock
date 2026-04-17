const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const windowManager = require('./windowManager');
const { initIpcHandlers } = require('./ipcHandlers');

// ========== 日志系统 ==========

let logDir, logFile;
let logBuffer = [];
let logWriteTimer = null;
const LOG_FLUSH_INTERVAL = 1000;

function flushLogBuffer() {
    if (logBuffer.length === 0 || !logFile) return;
    const messages = logBuffer.join('');
    logBuffer = [];
    fs.writeFile(logFile, messages, { flag: 'a' }, (err) => {
        if (err) console.error('Error writing to log file:', err);
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
        fs.mkdirSync(logDir, { recursive: true });
        logFile = path.join(logDir, `HealthClock_${new Date().toISOString().split('T')[0]}.log`);
    } catch (error) {
        console.error('[MAIN] Error initializing log directory:', error);
    }
}

// 重写 console 方法以写入日志
const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = `${new Date().toISOString()} - ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ')}\n`;
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
    ).join(' ')}\n`;
    originalConsoleError(...args);
    if (logFile) {
        logBuffer.push(message);
        scheduleLogFlush();
    }
};

// ========== 应用生命周期 ==========

app.quitting = false;

// 单例模式
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        console.log('[MAIN] App ready');
        initLogDir();
        initIpcHandlers();
        windowManager.createMainWindow();
        windowManager.createTray();
    });
}

app.on('window-all-closed', () => {
    console.log('[MAIN] All windows closed');
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
    }
});