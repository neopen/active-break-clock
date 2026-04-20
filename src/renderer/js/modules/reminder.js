// 提醒核心逻辑模块
const ReminderModule = (function () {
    const logger = (typeof window !== 'undefined' && window.Logger && window.Logger.createLogger)
        ? window.Logger.createLogger('Reminder')
        : console;
    let isRunning = false;
    let checkInterval = null;
    let nextReminderTimestamp = null;
    let currentLockEndTime = null;
    let lockTimerInterval = null;
    let isLocked = false;
    let progressCircle = null;
    let timerRing = null;
    let countdownSpan = null;
    let unlockBtn = null;
    let lockOverlay = null;
    let pendingLock = false;
    let isCreatingLock = false;
    let onReminderTrigger = null;
    let onLockClose = null;
    let ConfigModule = null;
    let AudioModule = null;

    function setModules(config, audio) { ConfigModule = config; AudioModule = audio; }
    function setElements(elements) {
        timerRing = elements.timerRing;
        countdownSpan = elements.countdownSpan;
        unlockBtn = elements.unlockBtn;
        lockOverlay = elements.lockOverlay;
    }
    function setCallbacks(callbacks) { onReminderTrigger = callbacks.onReminderTrigger; onLockClose = callbacks.onLockClose; }
    function getCallbacks() { return { onReminderTrigger, onLockClose }; }
    function isReminderRunning() { return isRunning; }
    function isCurrentlyLocked() { return isLocked; }
    function getNextReminderTime() { return nextReminderTimestamp; }
    function setNextReminderTime(timestamp) { nextReminderTimestamp = timestamp; }

    function getTodayTime(timeStr) {
        if (!timeStr) return new Date();
        const [hours, minutes] = timeStr.split(':').map(Number);
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    }

    function isWithinPeriod(now, config) {
        if (!config || !config.startTime || !config.endTime) return true;
        const start = getTodayTime(config.startTime);
        const end = getTodayTime(config.endTime);
        let endAdjusted = new Date(end);
        if (endAdjusted <= start) endAdjusted.setDate(endAdjusted.getDate() + 1);
        return now >= start && now <= endAdjusted;
    }

    function calculateNextReminder(now, config) {
        if (!config) {
            logger.error('No config provided for calculateNextReminder');
            return new Date(now.getTime() + 30 * 60 * 1000);
        }
        const startTime = config.startTime || '08:00';
        const endTime = config.endTime || '18:00';
        const intervalMinutes = config.intervalMinutes || 40;
        const start = getTodayTime(startTime);
        const end = getTodayTime(endTime);
        let endAdjusted = new Date(end);
        if (endAdjusted <= start) endAdjusted.setDate(endAdjusted.getDate() + 1);
        const intervalMs = intervalMinutes * 60 * 1000;

        if (isWithinPeriod(now, config)) {
            let candidate = new Date(now.getTime() + intervalMs);
            if (candidate > endAdjusted) {
                let nextStart = new Date(start);
                nextStart.setDate(nextStart.getDate() + 1);
                return new Date(nextStart.getTime() + intervalMs);
            }
            return candidate;
        }
        if (now < start) return new Date(start.getTime() + intervalMs);
        let tomorrowStart = new Date(start);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        return new Date(tomorrowStart.getTime() + intervalMs);
    }

    function updateProgressCircle(remainingSeconds, totalSeconds) {
        if (!progressCircle && timerRing) {
            progressCircle = document.createElement('div');
            progressCircle.className = 'timer-circle-progress';
            const timerCenter = timerRing.querySelector('.timer-center');
            if (timerCenter) timerRing.insertBefore(progressCircle, timerCenter);
        }
        if (progressCircle) {
            const percent = (totalSeconds - remainingSeconds) / totalSeconds;
            const angle = percent * 360;
            progressCircle.style.background = `conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa ${angle}deg, rgba(255, 255, 255, 0.1) ${angle}deg)`;
        }
    }

    function closeLockScreen() {
        logger.info('closeLockScreen called');
        if (AudioModule) {
            logger.info('[REMINDER] Stopping continuous sound');
            AudioModule.stopContinuous();
        }
        if (typeof Neutralino !== 'undefined') {
            try {
                logger.info('[REMINDER] Sending hide-lock via Neutralino events');
                Neutralino.events.dispatch('hide-lock');
            } catch (e) { logger.error('[REMINDER] Failed to send hide-lock via Neutralino:', e); }
        } else if (typeof window !== 'undefined' && window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                logger.info('[REMINDER] Sending hide-lock to main process');
                ipcRenderer.send('hide-lock');
            } catch (e) { logger.error('[REMINDER] Failed to send hide-lock:', e); }
        }
        if (lockTimerInterval) { clearInterval(lockTimerInterval); lockTimerInterval = null; }
        document.body.classList.remove('lock-active');
        if (lockOverlay) {
            lockOverlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                lockOverlay.classList.add('hidden');
                lockOverlay.style.animation = '';
                isLocked = false; pendingLock = false; isCreatingLock = false; currentLockEndTime = null;
                if (onLockClose) onLockClose();
            }, 300);
        } else {
            isLocked = false; pendingLock = false; isCreatingLock = false; currentLockEndTime = null;
            if (onLockClose) onLockClose();
        }
    }

    function showLockScreen(minutes, forceLock, onComplete) {
        logger.info('showLockScreen called, minutes:', minutes, 'isLocked:', isLocked, 'isCreatingLock:', isCreatingLock);
        if (isLocked || isCreatingLock) return;
        isCreatingLock = true;
        const totalSeconds = minutes * 60;
        logger.info('[REMINDER] Converting', minutes, 'minutes to', totalSeconds, 'seconds');

        if (typeof Neutralino !== 'undefined') {
            try {
                isLocked = true;
                Neutralino.events.dispatch('show-lock', { duration: totalSeconds, forceLock: forceLock });
                return;
            } catch (e) {
                logger.error('[REMINDER] Failed to send show-lock via Neutralino:', e);
                isLocked = false; isCreatingLock = false; pendingLock = false;
            }
        } else if (typeof window !== 'undefined' && window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                isLocked = true;
                ipcRenderer.send('show-lock', totalSeconds, forceLock);
                return;
            } catch (e) {
                logger.error('[REMINDER] Failed to send show-lock:', e);
                isLocked = false; isCreatingLock = false; pendingLock = false;
            }
        }

        isLocked = true; isCreatingLock = false;
        currentLockEndTime = Date.now() + (totalSeconds * 1000);
        document.body.classList.add('lock-active');
        if (progressCircle) progressCircle.style.background = 'conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa 0deg, rgba(255, 255, 255, 0.1) 0deg)';
        if (lockOverlay) {
            lockOverlay.classList.remove('hidden');
            lockOverlay.style.animation = 'fadeIn 0.3s ease';
            const existingCloseBtn = lockOverlay.querySelector('.close-btn, .close-button, [data-close]');
            if (existingCloseBtn) existingCloseBtn.remove();
        }
        if (lockTimerInterval) clearInterval(lockTimerInterval);
        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((currentLockEndTime - now) / 1000));
            if (countdownSpan) countdownSpan.innerText = remaining;
            updateProgressCircle(remaining, totalSeconds);
            if (remaining <= 0) {
                clearInterval(lockTimerInterval); lockTimerInterval = null;
                closeLockScreen(); if (onComplete) onComplete();
            } else if (unlockBtn) {
                unlockBtn.innerText = `剩余 ${remaining} 秒`; // 移除 Emoji
                if (forceLock) { unlockBtn.classList.add('disabled'); unlockBtn.disabled = true; }
                else { unlockBtn.classList.remove('disabled'); unlockBtn.disabled = false; }
            }
        };
        updateTimer();
        lockTimerInterval = setInterval(updateTimer, 100);
    }

    function trigger(config) {
        logger.info('[REMINDER] ========== TRIGGER START ==========');
        logger.info('[REMINDER] Received config:', JSON.stringify(config));
        logger.info('[REMINDER] isRunning:', isRunning, 'isLocked:', isLocked, 'pendingLock:', pendingLock);

        if (!isRunning || isLocked || pendingLock) {
            logger.info('[REMINDER] Skipping trigger - not running or already locked');
            return;
        }

        if (isInDoNotDisturbMode(config)) {
            logger.info('[REMINDER] In Do Not Disturb mode, skipping reminder');
            const callbacks = getCallbacks();
            if (callbacks.onLockClose) callbacks.onLockClose();
            return;
        }

        // 🔧 强制从 Config 模块重新获取最新配置
        let freshConfig = config;
        if (ConfigModule) {
            const freshLockMinutes = ConfigModule.get('lockMinutes');
            const freshForceLock = ConfigModule.get('forceLock');
            const freshSoundEnabled = ConfigModule.get('soundEnabled');
            const freshNotificationType = ConfigModule.get('notificationType');

            logger.info('[REMINDER] Fresh values from ConfigModule:', {
                lockMinutes: freshLockMinutes,
                forceLock: freshForceLock,
                soundEnabled: freshSoundEnabled,
                notificationType: freshNotificationType
            });

            freshConfig = {
                ...config,
                lockMinutes: freshLockMinutes !== null ? freshLockMinutes : (config.lockMinutes || 5),
                forceLock: freshForceLock !== null ? freshForceLock : (config.forceLock || false),
                soundEnabled: freshSoundEnabled !== null ? freshSoundEnabled : (config.soundEnabled !== false),
                notificationType: freshNotificationType || config.notificationType || 'desktop'
            };
        }

        const notificationType = freshConfig.notificationType || 'desktop';
        let lockMins = parseInt(freshConfig.lockMinutes) || 5;
        lockMins = Math.min(30, Math.max(1, lockMins));
        const forceLock = freshConfig.forceLock === true;
        const soundEnabled = freshConfig.soundEnabled !== false;

        logger.info('[REMINDER] Final trigger values - lockMins:', lockMins, 'forceLock:', forceLock, 'notificationType:', notificationType);

        const callbacks = getCallbacks();
        if (callbacks.onReminderTrigger) callbacks.onReminderTrigger(notificationType);

        if (notificationType === 'desktop') {
            logger.info('[REMINDER] Desktop notification mode, NOT showing lock screen');
            if (soundEnabled && AudioModule) AudioModule.playAlert();
            pendingLock = false;
            isLocked = false;
            isCreatingLock = false;
            if (callbacks.onLockClose) callbacks.onLockClose();
            return;
        }

        // 锁屏模式
        logger.info('[REMINDER] Lock screen mode, showing lock with duration:', lockMins, 'minutes');
        pendingLock = true;
        if (soundEnabled && AudioModule) {
            AudioModule.playAlert();
            AudioModule.startContinuous();
        }
        showLockScreen(lockMins, forceLock, () => {
            logger.info('[REMINDER] Lock screen completed callback');
            isLocked = false;
            pendingLock = false;
            isCreatingLock = false;
            if (AudioModule) AudioModule.stopContinuous();
            if (callbacks.onLockClose) callbacks.onLockClose();
        });
    }

    function start(config) {
        isRunning = true; pendingLock = false; isLocked = false; isCreatingLock = false;
    }
    function stop() {
        isRunning = false;
        if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
        if (AudioModule) AudioModule.stopContinuous();
        if (isLocked) {
            if (typeof Neutralino !== 'undefined') Neutralino.events.dispatch('hide-lock');
            else if (typeof window !== 'undefined' && window.require) {
                try { window.require('electron').ipcRenderer.send('hide-lock'); } catch (e) { }
            }
            isLocked = false; pendingLock = false; isCreatingLock = false;
        }
    }

    let mainIntervalId = null;
    function setMainInterval(fn, interval) { if (mainIntervalId) clearInterval(mainIntervalId); if (!isRunning) return; mainIntervalId = setInterval(fn, interval); }
    function clearMainInterval() { if (mainIntervalId) { clearInterval(mainIntervalId); mainIntervalId = null; } }

    function unlock(forceLock) {
        if (!isLocked) return true;
        const now = Date.now();
        if (currentLockEndTime && now >= currentLockEndTime) { closeLockScreen(); return true; }
        return !forceLock;
    }

    function manualCloseLockScreen() { closeLockScreen(); }
    function resetLockStates() {
        isLocked = false; pendingLock = false; isCreatingLock = false;
    }

    function checkAndRemind() {
        if (!isRunning || isLocked || pendingLock) return;
        const now = Date.now();
        if (nextReminderTimestamp && now >= nextReminderTimestamp) {
            logger.info('[REMINDER] Time to remind!');
            //修复：正确获取最新配置，而不是使用缓存的 _config
            let cfg = null;
            if (ConfigModule && typeof ConfigModule.getConfig === 'function') {
                cfg = ConfigModule.getConfig();
            } else if (ConfigModule && typeof ConfigModule.get === 'function') {
                // 逐个获取配置项，确保获取最新值
                cfg = {
                    lockMinutes: ConfigModule.get('lockMinutes') || 5,
                    forceLock: ConfigModule.get('forceLock') || false,
                    soundEnabled: ConfigModule.get('soundEnabled') !== false,
                    notificationType: ConfigModule.get('notificationType') || 'desktop',
                    doNotDisturb: ConfigModule.get('doNotDisturb') || { enabled: false }
                };
            }
            logger.info('[REMINDER] Using config for reminder:', cfg);
            trigger(cfg);
        }
    }

    function startCheckLoop() {
        if (mainIntervalId) { clearInterval(mainIntervalId); mainIntervalId = null; }
        if (!isRunning) return;
        mainIntervalId = setInterval(() => checkAndRemind(), 500);
    }

    function isInDoNotDisturbMode(config) {
        const dnd = config.doNotDisturb;
        if (!dnd || !dnd.enabled) return false;
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (dnd.lunchBreak && dnd.lunchBreak.start && dnd.lunchBreak.end && isTimeInRange(currentTime, dnd.lunchBreak.start, dnd.lunchBreak.end)) return true;
        if (dnd.customBreaks && Array.isArray(dnd.customBreaks)) {
            for (const bt of dnd.customBreaks) {
                if (bt.start && bt.end && isTimeInRange(currentTime, bt.start, bt.end)) return true;
            }
        }
        return false;
    }

    function isTimeInRange(current, start, end) { return start <= end ? (current >= start && current <= end) : (current >= start || current <= end); }

    return {
        setModules, setElements, setCallbacks, getCallbacks, isReminderRunning, isCurrentlyLocked,
        getNextReminderTime, setNextReminderTime, calculateNextReminder, trigger, start, stop,
        setMainInterval, clearMainInterval, startCheckLoop, resetLockStates, unlock,
        closeLockScreen: manualCloseLockScreen, checkAndRemind
    };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ReminderModule;
if (typeof window !== 'undefined') window.ReminderModule = ReminderModule;