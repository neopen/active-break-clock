const { app } = require('electron');
const path = require('path');

let globalBlocker = null;
let isBlocking = false;

// 音量键列表
const volumeKeys = [
    'VolumeUp', 'VolumeDown', 'VolumeMute',
    'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute',
    'MediaVolumeUp', 'MediaVolumeDown', 'MediaVolumeMute'
];

// 判断是否是音量键
function isVolumeKey(keyName) {
    if (!keyName) return false;
    const keyLower = keyName.toLowerCase();
    return volumeKeys.some(vk => vk.toLowerCase() === keyLower) ||
        keyLower.includes('volume') ||
        keyLower.includes('audio');
}

// Windows 平台使用 node-global-key-listener
async function initWindowsBlocker() {
    try {
        const { GlobalKeyboardListener } = require('node-global-key-listener');
        globalBlocker = new GlobalKeyboardListener();

        globalBlocker.addListener((event, down) => {
            if (!isBlocking) return event;

            const keyName = event.name || '';

            // 音量键放行
            if (isVolumeKey(keyName)) {
                console.log('[KeyboardBlocker] Volume key allowed:', keyName);
                return event;
            }

            // 阻止所有其他按键
            console.log('[KeyboardBlocker] Blocked key:', keyName);
            return null; // 返回 null 表示吞掉这个事件
        });

        console.log('[KeyboardBlocker] Windows global blocker initialized');
        return true;
    } catch (error) {
        console.error('[KeyboardBlocker] Failed to initialize Windows blocker:', error);
        return false;
    }
}

// macOS 平台提示
function initMacOSBlocker() {
    console.warn('[KeyboardBlocker] macOS requires native module with Accessibility permissions');
    console.warn('[KeyboardBlocker] Falling back to before-input-event (limited)');
    return false;
}

// Linux 平台提示
function initLinuxBlocker() {
    console.warn('[KeyboardBlocker] Linux global keyboard blocking not fully supported');
    return false;
}

// 启动全局拦截
async function startBlocking() {
    if (isBlocking) {
        console.log('[KeyboardBlocker] Already blocking');
        return true;
    }

    console.log('[KeyboardBlocker] Starting global keyboard blocking...');

    let success = false;
    switch (process.platform) {
        case 'win32':
            success = await initWindowsBlocker();
            break;
        case 'darwin':
            success = initMacOSBlocker();
            break;
        case 'linux':
            success = initLinuxBlocker();
            break;
        default:
            console.log('[KeyboardBlocker] Unsupported platform:', process.platform);
    }

    if (success) {
        isBlocking = true;
        console.log('[KeyboardBlocker] Global blocking ACTIVE');
    } else {
        console.log('[KeyboardBlocker] Global blocking FAILED, using fallback');
    }

    return success;
}

// 停止全局拦截
function stopBlocking() {
    if (!isBlocking) {
        console.log('[KeyboardBlocker] Not blocking');
        return;
    }

    console.log('[KeyboardBlocker] Stopping global keyboard blocking...');

    if (globalBlocker && typeof globalBlocker.stop === 'function') {
        globalBlocker.stop();
    }

    globalBlocker = null;
    isBlocking = false;
    console.log('[KeyboardBlocker] Global blocking STOPPED');
}

// 获取拦截状态
function isActive() {
    return isBlocking;
}

module.exports = {
    startBlocking,
    stopBlocking,
    isActive
};