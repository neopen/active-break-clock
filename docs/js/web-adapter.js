// Web 适配层 - 模拟 Electron 环境
(function() {
    console.log('[Web Adapter] Initializing...');
    
    // ========== 1. 模拟 require 函数 ==========
    window.require = function(module) {
        console.log('[Web Adapter] require called for:', module);
        
        if (module === 'electron') {
            return {
                ipcRenderer: {
                    send: function(channel) {
                        console.log('[Web Adapter] ipcRenderer.send:', channel);
                    },
                    sendSync: function(channel) {
                        console.log('[Web Adapter] ipcRenderer.sendSync:', channel);
                        return null;
                    },
                    on: function(channel) {
                        console.log('[Web Adapter] ipcRenderer.on:', channel);
                    },
                    once: function(channel) {
                        console.log('[Web Adapter] ipcRenderer.once:', channel);
                    },
                    removeListener: function(channel) {
                        console.log('[Web Adapter] ipcRenderer.removeListener:', channel);
                    }
                },
                remote: {
                    app: {
                        getPath: function() { return null; }
                    }
                },
                app: {
                    getPath: function() { return null; }
                }
            };
        }
        
        if (module === 'fs') {
            return {
                existsSync: function() { return false; },
                mkdirSync: function() {},
                readFileSync: function() { return null; },
                writeFileSync: function() {},
                readdirSync: function() { return []; }
            };
        }
        
        if (module === 'path') {
            return {
                join: function() {
                    return Array.from(arguments).join('/').replace(/\/+/g, '/');
                },
                dirname: function(p) {
                    return p.split('/').slice(0, -1).join('/');
                },
                basename: function(p) {
                    return p.split('/').pop();
                },
                resolve: function() {
                    return Array.from(arguments).join('/');
                },
                normalize: function(p) {
                    return p.replace(/\/+/g, '/');
                }
            };
        }
        
        return {};
    };
    
    // ========== 2. 模拟模块 ==========
    if (!window.FileSystemManager || typeof window.FileSystemManager.init !== 'function') {
        window.FileSystemManager = {
            init: function() { return false; },
            getDataPath: function() { return null; },
            isUsingLocalFile: function() { return false; },
            getFileSystemUtil: function() { return null; },
            buildFilePath: function() { return null; },
            fileExists: function() { return false; }
        };
    }
    
    if (!window.FileSystemUtil || typeof window.FileSystemUtil.init !== 'function') {
        window.FileSystemUtil = {
            init: function() { return false; },
            getRootPath: function() { return null; },
            ensureDir: function() { return false; },
            ensureRootDir: function() { return false; },
            ensureSubDir: function() { return false; },
            readFile: function() { return null; },
            writeFile: function() { return false; }
        };
    }
    
    if (!window.NotificationModule) {
        window.NotificationModule = {
            init: function() { return Promise.resolve(false); },
            initWithoutWait: function() {},
            setEnabled: function() {},
            send: function(title) {
                console.log('[Web Adapter] Notification:', title);
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(title);
                    return Promise.resolve(true);
                }
                return Promise.resolve(false);
            },
            sendReminder: function() { return this.send('🧘 该活动啦！'); },
            sendTest: function() { return this.send('🔔 测试通知'); }
        };
    }
    
    if (!window.AudioModule) {
        window.AudioModule = {
            setEnabled: function() {},
            setLockedGetter: function() {},
            playAlert: function() {},
            startContinuous: function() {},
            stopContinuous: function() {},
            resume: function() { return Promise.resolve(); }
        };
    }
    
    if (window.Config && !window.Config.updateNotificationHint) {
        window.Config.updateNotificationHint = function(type) {
            var hintEl = document.getElementById('notificationHint');
            if (hintEl) {
                hintEl.innerHTML = type === 'desktop' 
                    ? '💡 桌面通知：仅弹窗提醒，不锁屏' 
                    : '💡 锁屏通知：全屏锁屏，强制休息';
            }
        };
    }
    
    // ========== 3. 修复 ReminderModule ==========
    var fixReminder = function() {
        if (!window.ReminderModule) return;
        
        var originalClose = window.ReminderModule.closeLockScreen;
        window.ReminderModule.closeLockScreen = function() {
            console.log('[Web Adapter] closeLockScreen');
            try {
                if (originalClose) return originalClose.call(this);
            } catch (e) {}
            
            var overlay = document.getElementById('lockOverlay');
            if (overlay) overlay.classList.add('hidden');
            if (window.AudioModule) window.AudioModule.stopContinuous();
        };
        
        var originalIsLocked = window.ReminderModule.isCurrentlyLocked;
        window.ReminderModule.isCurrentlyLocked = function() {
            if (originalIsLocked) return originalIsLocked.call(this);
            var overlay = document.getElementById('lockOverlay');
            return overlay && !overlay.classList.contains('hidden');
        };
        
        var originalReset = window.ReminderModule.resetLockStates;
        window.ReminderModule.resetLockStates = function() {
            if (originalReset) {
                try { return originalReset.call(this); } catch (e) {}
            }
        };
    };
    
    // 立即尝试修复，如果模块还没加载则延迟
    if (window.ReminderModule) {
        fixReminder();
    } else {
        var checkInterval = setInterval(function() {
            if (window.ReminderModule) {
                fixReminder();
                clearInterval(checkInterval);
            }
        }, 100);
        setTimeout(function() { clearInterval(checkInterval); }, 5000);
    }
    
    // ========== 4. 禁用 Service Worker ==========
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register = function() {
            console.log('[Web Adapter] Service Worker disabled');
            return Promise.reject(new Error('Service Worker disabled'));
        };
    }
    
    // ========== 5. 确保模块存在 ==========
    ['CONFIG', 'Logger', 'ErrorHandler', 'StorageModule', 'Config', 
     'StatsModule', 'ReminderModule', 'UIModule'].forEach(function(name) {
        if (typeof window[name] === 'undefined') {
            window[name] = {};
        }
    });
    
    console.log('[Web Adapter] Initialized');
})();