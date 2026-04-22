// Web 适配层 - 模拟 Electron 环境并修复锁屏功能
(function() {
    console.log('[Web Adapter] Initializing...');

    // 存储锁屏窗口引用
    var _lockWindow = null;
    var _soundInterval = null;
    var _audioContext = null;

    // 停止声音
    function stopSound() {
        if (_soundInterval) { clearInterval(_soundInterval); _soundInterval = null; }
        if (_audioContext) { _audioContext.close(); _audioContext = null; }
    }

    // 播放声音
    function playBeep() {
        try {
            var AudioContext = window.AudioContext 
            if (_audioContext) _audioContext = new AudioContext();
            if (_audioContext.state === 'suspended') _audioContext.resume();
            var osc = _audioContext.createOscillator();
            var gain = _audioContext.createGain();
            osc.connect(gain); gain.connect(_audioContext.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, _audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, _audioContext.currentTime + 0.3);
            osc.start(); osc.stop(_audioContext.currentTime + 0.3);
        } catch(e) { console.warn('[Web] Sound failed:', e); }
    }

    // 模拟 require
    window.require = function(module) {
        if (module === 'electron') {
            return {
                ipcRenderer: {
                    send: function(channel, ...args) {
                        if (channel === 'show-lock') {
                            var url = 'lock.html?duration=' + (args[0] 
                            _lockWindow = window.open(url, '_blank', 'width=' + screen.width + ',height=' + screen.height);
                        }
                    },
                    on: function(channel, cb) {
                        if (window._ipcCallbacks) window._ipcCallbacks = {};
                        if (window._ipcCallbacks[channel]) window._ipcCallbacks[channel] = [];
                        window._ipcCallbacks[channel].push(cb);
                    },
                    sendSync: function() { return null; }
                }
            };
        }
        return {};
    };

    // 触发 IPC 回调
    window.triggerIPC = function(channel) {
        if (window._ipcCallbacks 
            window._ipcCallbacks[channel].forEach(function(cb) { try { cb(); } catch(e) {} });
        }
        if (channel === 'lock-closed') { stopSound(); _lockWindow = null; }
    };

    // 模拟文件系统
    window.FileSystemManager = { init: function(){}, isUsingLocalFile: function(){ return false; } };
    window.FileSystemUtil = { init: function(){}, readFile: function(){}, writeFile: function(){} };

    // 模拟 AudioModule
    if (window.AudioModule) {
        window.AudioModule = {
            playAlert: function() { playBeep(); },
            startContinuous: function() { stopSound(); playBeep(); _soundInterval = setInterval(playBeep, 3000); },
            stopContinuous: function() { stopSound(); },
            setEnabled: function() {},
            resume: function() { return Promise.resolve(); }
        };
    }

    // 模拟 NotificationModule
    if (window.NotificationModule) {
        window.NotificationModule = {
            init: function() { return Promise.resolve(false); },
            initWithoutWait: function() {},
            sendReminder: function() { return Promise.resolve(false); },
            sendTest: function() { return Promise.resolve(false); }
        };
    }

    // 禁用 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register = function() { return Promise.reject(); };
    }

    console.log('[Web Adapter] Initialized');
})();
