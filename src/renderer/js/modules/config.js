const Config = (function () {
    const logger = (typeof window !== 'undefined' && window.Logger && window.Logger.createLogger)
        ? window.Logger.createLogger('Config')
        : console;
    let _config = null;
    let _elements = {};
    let _listeners = [];

    function isNeutralino() { return typeof Neutralino !== 'undefined' && Neutralino.init; }
    function setElements(elements) { _elements = elements; }

    async function load() {
        // 安全默认值（避免 CONFIG 未定义时报错）
        const defaults = {
            startTime: '08:00', endTime: '18:00',
            intervalMinutes: (typeof CONFIG !== 'undefined' ? CONFIG.TIME.DEFAULT_INTERVAL : 40),
            lockMinutes: (typeof CONFIG !== 'undefined' ? CONFIG.TIME.DEFAULT_LOCK : 5),
            forceLock: false, soundEnabled: true,
            notificationType: (typeof CONFIG !== 'undefined' ? CONFIG.NOTIFICATION_TYPE.DESKTOP : 'desktop'),
            doNotDisturb: {
                enabled: false,
                lunchBreak: {
                    start: (typeof CONFIG !== 'undefined' ? CONFIG.DO_NOT_DISTURB.DEFAULT_LUNCH_START : '12:00'),
                    end: (typeof CONFIG !== 'undefined' ? CONFIG.DO_NOT_DISTURB.DEFAULT_LUNCH_END : '14:00')
                },
                customBreaks: []
            }
        };

        let saved = null;
        if (isNeutralino()) {
            try {
                const data = await Neutralino.storage.getData('config');
                if (data) { saved = JSON.parse(data); logger.info('Config loaded from Neutralino storage'); }
            } catch (e) { if (e.code !== 'NE_ST_NOSTKEX') logger.warn('Failed to load from Neutralino storage:', e); }
        }
        if (!saved) {
            const localStorageData = localStorage.getItem('healthAlarmConfig');
            if (localStorageData) {
                try { saved = JSON.parse(localStorageData); logger.info('Config loaded from localStorage'); }
                catch (e) { logger.warn('Failed to parse localStorage data:', e); }
            }
        }

        if (saved) {
            _config = { ...defaults, ...saved };
            if (_config.notificationEnabled !== undefined) {
                if (!_config.notificationType) _config.notificationType = _config.notificationEnabled ? 'desktop' : 'lock';
                delete _config.notificationEnabled;
            }
        } else {
            _config = { ...defaults };
        }

        // 同步到DOM
        if (_elements.startTime) _elements.startTime.value = _config.startTime;
        if (_elements.endTime) _elements.endTime.value = _config.endTime;
        if (_elements.intervalMinutes) _elements.intervalMinutes.value = _config.intervalMinutes;
        if (_elements.lockMinutes) _elements.lockMinutes.value = _config.lockMinutes;
        if (_elements.forceLockToggle) _elements.forceLockToggle.checked = _config.forceLock;
        if (_elements.soundToggle) _elements.soundToggle.checked = _config.soundEnabled;
        if (_elements.desktopNotification && _elements.lockNotification) {
            _elements.desktopNotification.checked = (_config.notificationType === 'desktop');
            _elements.lockNotification.checked = (_config.notificationType === 'lock');
            updateNotificationHint(_config.notificationType);
            if (typeof window.toggleLockSettings === 'function') window.toggleLockSettings(_config.notificationType);
        }
        logger.info('Config loaded:', _config);
        return { ..._config };
    }

    async function save() {
        if (!_config) _config = {};
        if (_elements.startTime) _config.startTime = _elements.startTime.value;
        if (_elements.endTime) _config.endTime = _elements.endTime.value;
        if (_elements.intervalMinutes) _config.intervalMinutes = parseInt(_elements.intervalMinutes.value) || 40;
        if (_elements.lockMinutes) _config.lockMinutes = parseInt(_elements.lockMinutes.value) || 5;
        if (_elements.forceLockToggle) _config.forceLock = _elements.forceLockToggle.checked;
        if (_elements.soundToggle) _config.soundEnabled = _elements.soundToggle.checked;
        if (_elements.desktopNotification && _elements.desktopNotification.checked) _config.notificationType = 'desktop';
        else if (_elements.lockNotification && _elements.lockNotification.checked) _config.notificationType = 'lock';

        localStorage.setItem('healthAlarmConfig', JSON.stringify(_config));
        if (isNeutralino()) {
            try {
                await Neutralino.storage.setData('config', JSON.stringify(_config));
                logger.info('Config saved to Neutralino storage');
            } catch (e) { logger.error('Failed to save to Neutralino storage:', e); }
        }
        logger.info('Config saved');
        _listeners.forEach(fn => fn({ ..._config }));

        // 触发全局事件，通知其他模块配置已更新
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('config-updated', {
                detail: { ..._config }
            }));
        }
        return { ..._config };
    }

    function updateNotificationHint(type) {
        const hintEl = document.getElementById('notificationHint');
        if (hintEl) {
            // 移除图标，使用纯文本
            hintEl.innerHTML = type === 'desktop'
                ? '提示：桌面通知模式，仅弹窗提醒（需开启系统通知权限）'
                : '提示：锁屏通知模式，全屏锁屏，强制休息';
        }
    }

    function get(key) { return _config ? _config[key] : null; }
    function set(key, value) { if (_config) { _config[key] = value; save(); } }
    function subscribe(listener) {
        _listeners.push(listener);
        return () => { _listeners = _listeners.filter(l => l !== listener); };
    }

    function validateInterval(value, min, max) {
        const num = parseInt(value);
        const defaultMin = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MIN_INTERVAL : 10;
        const defaultMax = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MAX_INTERVAL : 300;
        const finalMin = min !== undefined ? min : defaultMin;
        const finalMax = max !== undefined ? max : defaultMax;
        return !isNaN(num) && num >= finalMin && num <= finalMax;
    }

    function validateLockMinutes(value, min, max) {
        const num = parseInt(value);
        const defaultMin = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MIN_LOCK : 1;
        const defaultMax = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MAX_LOCK : 30;
        const finalMin = min !== undefined ? min : defaultMin;
        const finalMax = max !== undefined ? max : defaultMax;
        return !isNaN(num) && num >= finalMin && num <= finalMax;
    }

    function fixIntervalValue(value, min, max, step) {
        let num = parseInt(value);
        const defaultMin = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MIN_INTERVAL : 10;
        const defaultMax = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MAX_INTERVAL : 300;
        const defaultInterval = typeof CONFIG !== 'undefined' ? CONFIG.TIME.DEFAULT_INTERVAL : 40;
        const finalMin = min !== undefined ? min : defaultMin;
        const finalMax = max !== undefined ? max : defaultMax;
        const finalStep = step !== undefined ? step : 5;
        if (isNaN(num)) return defaultInterval;
        if (num < finalMin) return finalMin;
        if (num > finalMax) return finalMax;
        return Math.round(num / finalStep) * finalStep;
    }

    function fixLockValue(value, min, max) {
        let num = parseInt(value);
        const defaultMin = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MIN_LOCK : 1;
        const defaultMax = typeof CONFIG !== 'undefined' ? CONFIG.TIME.MAX_LOCK : 30;
        const defaultLock = typeof CONFIG !== 'undefined' ? CONFIG.TIME.DEFAULT_LOCK : 5;
        const finalMin = min !== undefined ? min : defaultMin;
        const finalMax = max !== undefined ? max : defaultMax;
        if (isNaN(num)) return defaultLock;
        if (num < finalMin) return finalMin;
        if (num > finalMax) return finalMax;
        return num;
    }

    function getConfig() {
        return _config ? { ..._config } : null;
    }

    return {
        setElements, load, save, get, set, subscribe,
        getConfig,
        validateInterval, validateLockMinutes,
        fixIntervalValue, fixLockValue, updateNotificationHint
    };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Config;
if (typeof window !== 'undefined') window.Config = Config;