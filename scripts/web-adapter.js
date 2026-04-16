// Web 适配层 - 模拟 Electron 环境
(function() {
    console.log('[Web Adapter] Initializing...');
    
    // ========== 1. 模拟 require 函数 ==========
    // 返回一个包含模拟 API 的对象，而不是 null
    window.require = function(module) {
        console.log('[Web Adapter] require called for:', module);
        
        if (module === 'electron') {
            // 返回模拟的 electron 对象
            return {
                ipcRenderer: {
                    send: function(channel, ...args) {
                        console.log('[Web Adapter] ipcRenderer.send:', channel, args);
                        // Web 环境下不执行实际操作
                    },
                    sendSync: function(channel, ...args) {
                        console.log('[Web Adapter] ipcRenderer.sendSync:', channel, args);
                        // 根据不同通道返回模拟数据
                        if (channel === 'get-user-data-path') {
                            return null;
                        }
                        return null;
                    },
                    on: function(channel, callback) {
                        console.log('[Web Adapter] ipcRenderer.on:', channel);
                        // 不实际注册监听器
                    },
                    once: function(channel, callback) {
                        console.log('[Web Adapter] ipcRenderer.once:', channel);
                    },
                    removeListener: function(channel, callback) {
                        console.log('[Web Adapter] ipcRenderer.removeListener:', channel);
                    }
                },
                remote: {
                    app: {
                        getPath: function(name) {
                            console.log('[Web Adapter] app.getPath:', name);
                            return null;
                        }
                    }
                },
                app: {
                    getPath: function(name) {
                        console.log('[Web Adapter] app.getPath:', name);
                        return null;
                    }
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
            // 返回真实的 path 模块（浏览器环境没有，但可以模拟基本功能）
            return {
                join: function(...args) {
                    return args.join('/').replace(/\/+/g, '/');
                },
                dirname: function(p) {
                    return p.split('/').slice(0, -1).join('/');
                },
                basename: function(p) {
                    return p.split('/').pop();
                },
                resolve: function(...args) {
                    return args.join('/');
                },
                normalize: function(p) {
                    return p.replace(/\/+/g, '/');
                }
            };
        }
        
        // 其他模块返回空对象
        return {};
    };
    
    // ========== 2. 模拟 FileSystemManager ==========
    if (!window.FileSystemManager || typeof window.FileSystemManager.init !== 'function') {
        window.FileSystemManager = {
            init: function() { 
                console.log('[Web Adapter] FileSystemManager.init');
                return false; 
            },
            getDataPath: function() { return null; },
            isUsingLocalFile: function() { return false; },
            getFileSystemUtil: function() { return null; },
            buildFilePath: function() { return null; },
            fileExists: function() { return false; }
        };
    }
    
    // ========== 3. 模拟 FileSystemUtil ==========
    if (!window.FileSystemUtil || typeof window.FileSystemUtil.init !== 'function') {
        window.FileSystemUtil = {
            init: function() { 
                console.log('[Web Adapter] FileSystemUtil.init');
                return false; 
            },
            getRootPath: function() { return null; },
            ensureDir: function() { return false; },
            ensureRootDir: function() { return false; },
            ensureSubDir: function() { return false; },
            readFile: function() { return null; },
            writeFile: function() { return false; }
        };
    }
    
    // ========== 4. 模拟 NotificationModule ==========
    if (!window.NotificationModule) {
        window.NotificationModule = {
            init: function() { 
                console.log('[Web Adapter] NotificationModule.init');
                return Promise.resolve(false); 
            },
            initWithoutWait: function() {
                console.log('[Web Adapter] NotificationModule.initWithoutWait');
            },
            setEnabled: function(enabled) {
                console.log('[Web Adapter] NotificationModule.setEnabled:', enabled);
            },
            send: function(title, options) { 
                console.log('[Web Adapter] NotificationModule.send:', title);
                // 尝试使用浏览器通知
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(title, options);
                    return Promise.resolve(true);
                }
                return Promise.resolve(false); 
            },
            sendReminder: function() { 
                return this.send('🧘 该活动啦！', { body: '站起来走走，伸个懒腰' }); 
            },
            sendTest: function() { 
                return this.send('🔔 测试通知', { body: 'Web 演示版通知' }); 
            }
        };
    }
    
    // ========== 5. 模拟 AudioModule ==========
    if (!window.AudioModule) {
        window.AudioModule = {
            setEnabled: function() {},
            setLockedGetter: function() {},
            playAlert: function() {
                console.log('[Web Adapter] AudioModule.playAlert');
            },
            startContinuous: function() {},
            stopContinuous: function() {},
            resume: function() { return Promise.resolve(); }
        };
    }
    
    // ========== 6. 模拟 Config 的缺失方法 ==========
    if (window.Config && !window.Config.updateNotificationHint) {
        window.Config.updateNotificationHint = function(type) {
            console.log('[Web Adapter] Config.updateNotificationHint:', type);
            var hintEl = document.getElementById('notificationHint');
            if (hintEl) {
                hintEl.innerHTML = type === 'desktop' 
                    ? '💡 桌面通知：仅弹窗提醒，不锁屏' 
                    : '💡 锁屏通知：全屏锁屏，强制休息';
            }
        };
    }
    
    // ========== 7. 修复 ReminderModule 的问题 ==========
    if (window.ReminderModule) {
        // 保存原始方法
        var originalCloseLockScreen = window.ReminderModule.closeLockScreen;
        var originalShowLockScreen = window.ReminderModule.showLockScreen;
        
        // 重写 closeLockScreen 以处理 Web 环境
        window.ReminderModule.closeLockScreen = function() {
            console.log('[Web Adapter] ReminderModule.closeLockScreen');
            try {
                // 尝试调用原始方法
                if (originalCloseLockScreen) {
                    return originalCloseLockScreen.call(this);
                }
            } catch (e) {
                console.warn('[Web Adapter] closeLockScreen error:', e);
            }
            
            // Web 版：直接隐藏锁屏
            var overlay = document.getElementById('lockOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
            
            // 停止声音
            if (window.AudioModule) {
                window.AudioModule.stopContinuous();
            }
        };
        
        // 重写 isCurrentlyLocked
        var originalIsCurrentlyLocked = window.ReminderModule.isCurrentlyLocked;
        window.ReminderModule.isCurrentlyLocked = function() {
            if (originalIsCurrentlyLocked) {
                return originalIsCurrentlyLocked.call(this);
            }
            var overlay = document.getElementById('lockOverlay');
            return overlay && !overlay.classList.contains('hidden');
        };
        
        // 重写 resetLockStates
        var originalResetLockStates = window.ReminderModule.resetLockStates;
        window.ReminderModule.resetLockStates = function() {
            console.log('[Web Adapter] ReminderModule.resetLockStates');
            if (originalResetLockStates) {
                try {
                    return originalResetLockStates.call(this);
                } catch (e) {}
            }
        };
    }
    
    // ========== 8. 禁用 Service Worker ==========
    if ('serviceWorker' in navigator) {
        var originalRegister = navigator.serviceWorker.register;
        navigator.serviceWorker.register = function() {
            console.log('[Web Adapter] Service Worker disabled for web demo');
            return Promise.reject(new Error('Service Worker disabled in web demo'));
        };
    }
    
    // ========== 9. 处理模块导出 ==========
    // 确保所有模块都挂载到 window
    var modules = [
        'CONFIG', 'Logger', 'ErrorHandler', 'FileSystemManager', 'FileSystemUtil',
        'StorageModule', 'Config', 'AudioModule', 'NotificationModule', 
        'StatsModule', 'ReminderModule', 'UIModule'
    ];
    
    modules.forEach(function(name) {
        if (typeof window[name] === 'undefined') {
            console.log('[Web Adapter] Creating placeholder for:', name);
            window[name] = {};
        }
    });
    
    console.log('[Web Adapter] Initialization complete');
    console.log('[Web Adapter] Available modules:', 
        Object.keys(window).filter(function(k) { 
            return k.includes('Module') || k.includes('Config') || k === 'Logger'; 
        })
    );
})();