// Web 适配层 - 模拟 Electron 环境
(function() {
    console.log('[Web Adapter] Initializing...');
    
    // 模拟 require 函数
    window.require = function(module) {
        console.log('[Web Adapter] require called for:', module);
        return null;
    };
    
    // 模拟 FileSystemManager
    window.FileSystemManager = window.FileSystemManager || {
        init: function() { return false; },
        getDataPath: function() { return null; },
        isUsingLocalFile: function() { return false; },
        getFileSystemUtil: function() { return null; },
        buildFilePath: function() { return null; },
        fileExists: function() { return false; }
    };
    
    // 模拟 FileSystemUtil
    window.FileSystemUtil = window.FileSystemUtil || {
        init: function() { return false; },
        getRootPath: function() { return null; },
        ensureDir: function() { return false; },
        ensureRootDir: function() { return false; },
        ensureSubDir: function() { return false; },
        readFile: function() { return null; },
        writeFile: function() { return false; }
    };
    
    // 修复 ReminderModule 的 totalSeconds 问题
    if (window.ReminderModule) {
        var originalCloseLockScreen = window.ReminderModule.closeLockScreen;
        if (originalCloseLockScreen) {
            window.ReminderModule.closeLockScreen = function() {
                try {
                    return originalCloseLockScreen.call(this);
                } catch (e) {
                    console.warn('[Web Adapter] closeLockScreen error:', e);
                    // Web 版：直接隐藏锁屏
                    var overlay = document.getElementById('lockOverlay');
                    if (overlay) overlay.classList.add('hidden');
                }
            };
        }
    }
    
    // 修复 NotificationModule
    if (!window.NotificationModule) {
        window.NotificationModule = {
            init: function() { return Promise.resolve(false); },
            initWithoutWait: function() {},
            setEnabled: function() {},
            send: function() { return Promise.resolve(false); },
            sendReminder: function() { return Promise.resolve(false); },
            sendTest: function() { return Promise.resolve(false); }
        };
    }
    
    // 禁用 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register = function() {
            console.log('[Web Adapter] Service Worker disabled for web demo');
            return Promise.reject(new Error('Service Worker disabled'));
        };
    }
    
    console.log('[Web Adapter] Initialized');
})();
