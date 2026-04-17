/**
 * UI 控制器 - 处理用户交互和事件绑定
 */
const UIController = (function() {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('UIController') : console;
    
    let _elements = {};
    let _isInitialized = false;
    
    // 切换锁屏设置显示/隐藏
    function toggleLockSettings(notificationType) {
        const titleEl = _elements.lockSettingsTitle;
        const contentEl = _elements.lockSettingsContent;
        
        if (titleEl && contentEl) {
            if (notificationType === 'desktop') {
                titleEl.style.display = 'none';
                contentEl.style.display = 'none';
            } else {
                titleEl.style.display = 'block';
                contentEl.style.display = 'block';
            }
        }
    }
    
    // 校验并显示错误
    function validateAndShowErrors() {
        let isValid = true;
        const intervalValue = _elements.intervalMinutes?.value || 40;
        const intervalMin = parseInt(_elements.intervalMinutes?.min) || 10;
        const intervalMax = parseInt(_elements.intervalMinutes?.max) || 300;
        const lockValue = _elements.lockMinutes?.value || 5;
        const lockMin = parseInt(_elements.lockMinutes?.min) || 1;
        const lockMax = parseInt(_elements.lockMinutes?.max) || 30;
        
        if (!Config.validateInterval(intervalValue, intervalMin, intervalMax)) {
            UIModule.showError('intervalError', '提醒频率范围：10 ~ 300 分钟', true);
            isValid = false;
        } else {
            UIModule.showError('intervalError', '', false);
        }
        
        if (!Config.validateLockMinutes(lockValue, lockMin, lockMax)) {
            UIModule.showError('lockError', '锁屏时长范围：1 ~ 30 分钟', true);
            isValid = false;
        } else {
            UIModule.showError('lockError', '', false);
        }
        
        return isValid;
    }
    
    // 修正输入值
    function fixValues() {
        const intervalValue = _elements.intervalMinutes?.value || 40;
        const intervalMin = parseInt(_elements.intervalMinutes?.min) || 10;
        const intervalMax = parseInt(_elements.intervalMinutes?.max) || 300;
        const intervalStep = parseInt(_elements.intervalMinutes?.step) || 5;
        const lockValue = _elements.lockMinutes?.value || 5;
        const lockMin = parseInt(_elements.lockMinutes?.min) || 1;
        const lockMax = parseInt(_elements.lockMinutes?.max) || 30;
        
        const fixedInterval = Config.fixIntervalValue(intervalValue, intervalMin, intervalMax, intervalStep);
        const fixedLock = Config.fixLockValue(lockValue, lockMin, lockMax);
        
        if (_elements.intervalMinutes) _elements.intervalMinutes.value = fixedInterval;
        if (_elements.lockMinutes) _elements.lockMinutes.value = fixedLock;
        
        validateAndShowErrors();
    }
    
    // 更新下次提醒显示
    function updateNextReminderAfterConfigChange() {
        if (ReminderModule.isReminderRunning()) {
            const now = new Date();
            const config = Config.load();
            const next = ReminderModule.calculateNextReminder(now, config);
            ReminderModule.setNextReminderTime(next.getTime());
            UIModule.updateNextReminderDisplay(next.getTime());
        }
    }
    
    // 绑定事件
    function bindEvents() {
        // 提醒间隔
        _elements.intervalMinutes?.addEventListener('blur', () => {
            fixValues();
            updateNextReminderAfterConfigChange();
        });
        
        // 锁屏时长
        _elements.lockMinutes?.addEventListener('blur', fixValues);
        
        // 开始时间
        _elements.startTime?.addEventListener('change', () => {
            Config.save();
            updateNextReminderAfterConfigChange();
        });
        
        // 结束时间
        _elements.endTime?.addEventListener('change', () => {
            Config.save();
            updateNextReminderAfterConfigChange();
        });
        
        // 声音开关
        _elements.soundToggle?.addEventListener('change', () => {
            Config.save();
            AudioModule.setEnabled(_elements.soundToggle.checked);
        });
        
        // 强制锁屏
        _elements.forceLockToggle?.addEventListener('change', () => Config.save());
        
        // 通知类型切换
        if (_elements.desktopNotification && _elements.lockNotification) {
            _elements.desktopNotification.addEventListener('change', (e) => {
                if (e.target.checked) {
                    Config.updateNotificationHint('desktop');
                    toggleLockSettings('desktop');
                    Config.save();
                }
            });
            
            _elements.lockNotification.addEventListener('change', (e) => {
                if (e.target.checked) {
                    Config.updateNotificationHint('lock');
                    toggleLockSettings('lock');
                    Config.save();
                }
            });
        }
        
        logger.info('Events bound');
    }
    
    // 初始化
    function init(elements) {
        if (_isInitialized) {
            logger.warn('Already initialized');
            return;
        }
        
        _elements = elements;
        
        // 挂载到 window 供 config.js 调用
        window.toggleLockSettings = toggleLockSettings;
        
        bindEvents();
        
        _isInitialized = true;
        logger.info('UIController initialized');
    }
    
    // 获取元素
    function getElements() {
        return _elements;
    }
    
    return {
        init,
        getElements,
        toggleLockSettings,
        validateAndShowErrors,
        fixValues,
        updateNextReminderAfterConfigChange
    };
})();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
if (typeof window !== 'undefined') {
    window.UIController = UIController;
}