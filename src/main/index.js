const { app, window, os, filesystem, process, events, debug } = require('@neutralinojs/lib');

let logDir = null;
let logFile = null;
let logBuffer = [];
let logWriteTimer = null;
const LOG_FLUSH_INTERVAL = 1000;

let mainWindowId = 'main';
let lockWindowId = 'lock';
let isLockWindowShowing = false;
let lockTimer = null;

async function flushLogBuffer() {
    if (logBuffer.length === 0 || !logFile) return;
    const messages = logBuffer.join('');
    logBuffer = [];
    try {
        await filesystem.writeFile(logFile, messages, { append: true });
    } catch (err) {
        console.error('Error writing to log file:', err);
    }
}

function scheduleLogFlush() {
    if (logWriteTimer) return;
    logWriteTimer = setTimeout(() => {
        logWriteTimer = null;
        flushLogBuffer();
    }, LOG_FLUSH_INTERVAL);
}

async function initLogDir() {
    try {
        logDir = await app.getDataPath();
        logDir = logDir.replace(/\\/g, '/') + '/Logs';
        const dirExists = await filesystem.exists(logDir);
        if (!dirExists) {
            await filesystem.createDirectory(logDir);
        }
        const today = new Date().toISOString().split('T')[0];
        logFile = `${logDir}/HealthClock_${today}.log`;
        console.log('[MAIN] Log initialized at:', logFile);
    } catch (error) {
        console.error('[MAIN] Error initializing log directory:', error);
    }
}

function log(level, ...args) {
    const message = `${new Date().toISOString()} - ${level} - ${args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ')}\n`;
    console.log(message.trim());
    if (logFile) {
        logBuffer.push(message);
        scheduleLogFlush();
    }
}

console.log = (...args) => log('INFO', ...args);
console.error = (...args) => log('ERROR', ...args);
console.warn = (...args) => log('WARN', ...args);
console.info = (...args) => log('INFO', ...args);

async function setAutoLaunch(enable) {
    try {
        await os.setStartup({
            name: 'HealthClock',
            command: execPath.executablePath,
            // path: process.argv[0],
            args: enable ? '--hidden' : '',
            enabled: enable
        });
        console.log('[MAIN] Auto launch set to:', enable);
        return true;
    } catch (e) {
        console.error('[MAIN] Failed to set auto launch:', e);
        return false;
    }
}

async function getAutoLaunchState() {
    try {
        const settings = await os.getStartupSettings();
        return settings.enabled || false;
    } catch (e) {
        console.error('[MAIN] Failed to get auto launch state:', e);
        return false;
    }
}

async function createMainWindow() {
    console.log('[WindowManager] Creating main window');
    try {
        await window.create(mainWindowId, {
            width: 500,
            height: 750,
            minWidth: 400,
            minHeight: 600,
            resizable: true,
            fullscreen: false,
            alwaysOnTop: false,
            center: true,
            icon: 'src/renderer/icons/icon-256.png',
            title: '起来走走 - 拒绝久坐',
            label: 'main'
        });
        await window.loadURL(mainWindowId, 'src/renderer/index.html');
        console.log('[WindowManager] Main window created');
    } catch (error) {
        console.error('[WindowManager] Failed to create main window:', error);
    }
}

async function showMainWindow() {
    try {
        await window.show(mainWindowId);
        await window.setFocus(mainWindowId);
    } catch (error) {
        console.error('[WindowManager] Failed to show main window:', error);
    }
}

async function hideMainWindow() {
    try {
        await window.hide(mainWindowId);
    } catch (error) {
        console.error('[WindowManager] Failed to hide main window:', error);
    }
}

async function focusMainWindow() {
    try {
        await window.setFocus(mainWindowId);
    } catch (error) {
        console.error('[WindowManager] Failed to focus main window:', error);
    }
}

async function createLockWindow(durationSeconds, forceLock) {
    console.log('[WindowManager] Creating lock window:', durationSeconds, 's, forceLock:', forceLock);

    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    let validDuration = parseInt(durationSeconds);
    if (isNaN(validDuration) || validDuration < 10) {
        validDuration = 60;
    }

    try {
        await window.create(lockWindowId, {
            width: 1920,
            height: 1080,
            resizable: false,
            fullscreen: true,
            alwaysOnTop: true,
            center: false,
            icon: 'src/renderer/icons/icon-256.png',
            title: '起来走走 - 锁屏',
            label: 'lock',
            transparent: false,
            shadow: false
        });

        await window.loadURL(lockWindowId, `src/renderer/lock.html?duration=${validDuration}&forceLock=${forceLock ? 'true' : 'false'}`);
        await window.setFullScreen(lockWindowId, true);
        await window.setAlwaysOnTop(lockWindowId, true, 'screen-saver');

        isLockWindowShowing = true;

        await events.dispatch('lock-window-opened', { duration: validDuration, forceLock });

        lockTimer = setTimeout(async () => {
            console.log('[WindowManager] Lock window timeout, force closing');
            await closeLockWindow();
        }, validDuration * 1000 + 3000);

        console.log('[WindowManager] Lock window created');
    } catch (error) {
        console.error('[WindowManager] Failed to create lock window:', error);
    }
}

async function closeLockWindow() {
    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }

    if (!isLockWindowShowing) return;

    isLockWindowShowing = false;

    try {
        const winExists = await window.exists(lockWindowId);
        if (winExists) {
            await window.destroy(lockWindowId);
        }
        await events.dispatch('lock-closed');
        await showMainWindow();
        console.log('[WindowManager] Lock window closed');
    } catch (error) {
        console.error('[WindowManager] Failed to close lock window:', error);
    }
}

async function showNotification(options) {
    try {
        await os.showNotification(options.title || '别坐了', options.body || '', options.icon);
        return true;
    } catch (e) {
        console.error('[MAIN] Notification failed:', e);
        return false;
    }
}

async function getUserDataPath() {
    try {
        return await app.getDataPath();
    } catch (e) {
        console.error('[MAIN] Error getting userData path:', e);
        return null;
    }
}

function setupEventHandlers() {
    events.on('show-lock', async (data) => {
        console.log('[IPC] show-lock:', data.duration, data.forceLock);
        await hideMainWindow();
        await createLockWindow(data.duration, data.forceLock);
    });

    events.on('lock-complete', async () => {
        console.log('[IPC] lock-complete');
        await events.dispatch('stop-sound');
        await closeLockWindow();
    });

    events.on('hide-lock', async () => {
        console.log('[IPC] hide-lock');
        await events.dispatch('stop-sound');
        await closeLockWindow();
    });

    events.on('stop-sound-request', async () => {
        console.log('[IPC] stop-sound-request');
        await events.dispatch('stop-sound');
    });

    events.on('get-user-data-path', async (event) => {
        event.reply('user-data-path', await getUserDataPath());
    });

    events.on('get-auto-launch', async (event) => {
        event.reply('auto-launch-state', await getAutoLaunchState());
    });

    events.on('set-auto-launch', async (event, enable) => {
        const result = await setAutoLaunch(enable);
        event.reply('auto-launch-set', result);
    });

    events.on('show-notification', async (event, options) => {
        console.log('[IPC] show-notification:', options?.title);
        const result = await showNotification(options);
        event.reply('notification-result', result);
    });

    events.on('show-notification-async', async (event, options) => {
        console.log('[IPC] show-notification-async:', options?.title);
        await showNotification(options);
        setTimeout(async () => {
            event.reply('notification-closed', true);
        }, 5000);
    });

    events.on('request-notification-permission', async (event) => {
        console.log('[IPC] request-notification-permission');
        event.reply('notification-permission-result', true);
    });

    console.log('[IPC] All event handlers initialized');
}

async function main() {
    console.log('[MAIN] HealthClock starting...');

    await Neutralino.init();
    
    await initLogDir();
    setupEventHandlers();
    await createMainWindow();

    const isAutoLaunch = await getAutoLaunchState();
    console.log('[MAIN] Auto launch enabled:', isAutoLaunch);

    console.log('[MAIN] HealthClock ready');
}

main().catch(console.error);
