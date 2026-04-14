// 提醒核心逻辑模块
const ReminderModule = (function () {
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

    let onReminderTrigger = null;
    let onLockClose = null;

    // 模块引用（将在初始化时注入）
    let ConfigModule = null;
    let AudioModule = null;

    function setModules(config, audio) {
        ConfigModule = config;
        AudioModule = audio;
    }

    function setElements(elements) {
        timerRing = elements.timerRing;
        countdownSpan = elements.countdownSpan;
        unlockBtn = elements.unlockBtn;
        lockOverlay = elements.lockOverlay;
    }

    function setCallbacks(callbacks) {
        onReminderTrigger = callbacks.onReminderTrigger;
        onLockClose = callbacks.onLockClose;
    }

    function getCallbacks() {
        return {
            onReminderTrigger,
            onLockClose
        };
    }

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
        if (endAdjusted <= start) {
            endAdjusted.setDate(endAdjusted.getDate() + 1);
        }
        return now >= start && now <= endAdjusted;
    }

    function calculateNextReminder(now, config) {
        console.log('calculateNextReminder called with config:', config);
        if (!config) {
            console.error('No config provided');
            return new Date(now.getTime() + 30 * 60 * 1000);
        }

        const startTime = config.startTime || '08:00';
        const endTime = config.endTime || '18:00';
        const intervalMinutes = config.intervalMinutes || 40;

        const start = getTodayTime(startTime);
        const end = getTodayTime(endTime);
        let endAdjusted = new Date(end);
        if (endAdjusted <= start) {
            endAdjusted.setDate(endAdjusted.getDate() + 1);
        }

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

        if (now < start) {
            return new Date(start.getTime() + intervalMs);
        } else {
            let tomorrowStart = new Date(start);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            return new Date(tomorrowStart.getTime() + intervalMs);
        }
    }

    function updateProgressCircle(remainingSeconds, totalSeconds) {
        if (!progressCircle && timerRing) {
            progressCircle = document.createElement('div');
            progressCircle.className = 'timer-circle-progress';
            const timerCenter = timerRing.querySelector('.timer-center');
            if (timerCenter) {
                timerRing.insertBefore(progressCircle, timerCenter);
            }
        }
        if (progressCircle) {
            const percent = (totalSeconds - remainingSeconds) / totalSeconds;
            const angle = percent * 360;
            progressCircle.style.background = `conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa ${angle}deg, rgba(255, 255, 255, 0.1) ${angle}deg)`;
        }
    }

    function closeLockScreen() {
        console.log('closeLockScreen called');

        // 先停止声音！
        if (AudioModule) {
            console.log('[REMINDER] Stopping continuous sound');
            AudioModule.stopContinuous();
        }

        // 检测是否在 Electron 环境中
        if (typeof window !== 'undefined' && window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                console.log('[REMINDER] Sending hide-lock to main process');
                ipcRenderer.send('hide-lock');
            } catch (e) {
                console.error('[REMINDER] Failed to send hide-lock:', e);
            }
        }

        if (lockTimerInterval) {
            clearInterval(lockTimerInterval);
            lockTimerInterval = null;
        }

        // 恢复页面滚动
        document.body.classList.remove('lock-active');

        if (lockOverlay) {
            lockOverlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                lockOverlay.classList.add('hidden');
                lockOverlay.style.animation = '';
                isLocked = false;
                pendingLock = false;
                isCreatingLock = false;
                currentLockEndTime = null;
                if (onLockClose) onLockClose();
            }, 300);
        } else {
            isLocked = false;
            pendingLock = false;
            isCreatingLock = false;
            currentLockEndTime = null;
            if (onLockClose) onLockClose();
        }
    }

    let isCreatingLock = false;

    function showLockScreen(minutes, forceLock, onComplete) {
        console.log('showLockScreen called, minutes:', minutes, 'isLocked:', isLocked, 'isCreatingLock:', isCreatingLock);

        if (isLocked) {
            console.log('Already locked, skip');
            return;
        }

        if (isCreatingLock) {
            console.log('Already creating lock, skip');
            return;
        }

        isCreatingLock = true;

        // 将分钟转换为秒
        const totalSeconds = minutes * 60;
        console.log('[REMINDER] Converting', minutes, 'minutes to', totalSeconds, 'seconds');

        // 检测是否在 Electron 环境中
        if (typeof window !== 'undefined' && window.require) {
            try {
                const { ipcRenderer } = window.require('electron');

                console.log('[REMINDER] Setting isLocked to true');
                isLocked = true;
                // 传递秒数给主进程
                console.log('[REMINDER] Sending show-lock to main process, durationSeconds:', totalSeconds, 'forceLock:', forceLock);
                ipcRenderer.send('show-lock', totalSeconds, forceLock);

                // 注意：在 Electron 环境中，我们不在这里监听事件
                // 而是在 app.js 中通过 ipcRenderer.on('lock-closed') 来处理
                // 因为 lock-complete 事件是从 lock.html 发送的，不同窗口间无法直接通信
                console.log('[REMINDER] Electron environment: lock-closed event will be handled in app.js');
                return;
            } catch (e) {
                console.error('[REMINDER] Failed to send show-lock:', e);
                console.log('[REMINDER] Resetting states after error: isLocked=false, isCreatingLock=false, pendingLock=false');
                isLocked = false;
                isCreatingLock = false;
                pendingLock = false;
            }
        }

        // 非 Electron 环境的处理
        isLocked = true;
        isCreatingLock = false;
        const endTime = Date.now() + (totalSeconds * 1000);
        currentLockEndTime = endTime;

        // 防止页面滚动
        document.body.classList.add('lock-active');

        if (progressCircle) {
            progressCircle.style.background = 'conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa 0deg, rgba(255, 255, 255, 0.1) 0deg)';
        }

        if (lockOverlay) {
            lockOverlay.classList.remove('hidden');
            lockOverlay.style.animation = 'fadeIn 0.3s ease';

            // 确保全屏覆盖，移除任何可能的关闭按钮
            const existingCloseBtn = lockOverlay.querySelector('.close-btn, .close-button, [data-close]');
            if (existingCloseBtn) {
                existingCloseBtn.remove();
            }
        }

        if (lockTimerInterval) clearInterval(lockTimerInterval);

        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((currentLockEndTime - now) / 1000));
            if (countdownSpan) countdownSpan.innerText = remaining;
            updateProgressCircle(remaining, totalSeconds);

            if (remaining <= 0) {
                clearInterval(lockTimerInterval);
                lockTimerInterval = null;
                // 倒计时结束，关闭锁屏（会停止声音）
                closeLockScreen();
                if (onComplete) onComplete();
            } else if (unlockBtn) {
                unlockBtn.innerText = `⏳ 请活动 ${remaining} 秒`;
                if (forceLock) {
                    unlockBtn.classList.add('disabled');
                    unlockBtn.disabled = true;
                } else {
                    unlockBtn.classList.remove('disabled');
                    unlockBtn.disabled = false;
                }
            }
        };

        updateTimer();
        lockTimerInterval = setInterval(updateTimer, 100);
    }

    function trigger(config) {
        console.log('[REMINDER] trigger called, isRunning:', isRunning, 'isLocked:', isLocked, 'pendingLock:', pendingLock);
        console.log('[REMINDER] config received:', config);

        if (!isRunning) {
            console.log('[REMINDER] Not running, skip trigger');
            return;
        }
        if (isLocked) {
            console.log('[REMINDER] Already locked, skip trigger');
            return;
        }
        if (pendingLock) {
            console.log('[REMINDER] Pending lock, skip trigger');
            return;
        }

        // 修复：正确获取 lockMinutes
        let lockMins = 5; // 默认值
        if (config && config.lockMinutes) {
            lockMins = parseInt(config.lockMinutes);
        } else if (ConfigModule) {
            const currentConfig = ConfigModule.load();
            lockMins = currentConfig.lockMinutes || 5;
        }

        lockMins = Math.min(30, Math.max(1, lockMins));

        const forceLock = (config && config.forceLock) || false;
        const soundEnabled = (config && config.soundEnabled) !== undefined ? config.soundEnabled : true;

        console.log('[REMINDER] Triggering lock screen with duration:', lockMins, 'minutes (', lockMins * 60, 'seconds)', 'forceLock:', forceLock, 'soundEnabled:', soundEnabled);

        // 触发提醒回调（记录统计、发送通知）
        if (onReminderTrigger) onReminderTrigger();

        pendingLock = true;

        // 先播放声音，再显示锁屏
        if (soundEnabled && AudioModule) {
            console.log('[REMINDER] Playing alert sound');
            AudioModule.playAlert();
            AudioModule.startContinuous();
        }

        showLockScreen(lockMins, forceLock, () => {
            console.log('[REMINDER] Lock screen completed callback');
            isLocked = false;
            pendingLock = false;
            isCreatingLock = false;
            // 确保声音停止（二次保险）
            if (AudioModule) {
                AudioModule.stopContinuous();
            }
            if (onLockClose) onLockClose();
        });
    }

    function start(config) {
        console.log('ReminderModule.start called, config:', config);
        isRunning = true;
        pendingLock = false;
        isLocked = false;
        isCreatingLock = false;
        console.log('[REMINDER] Start state:', { isRunning, pendingLock, isLocked, isCreatingLock });
    }

    function stop() {
        console.log('[REMINDER] stop called, isRunning:', isRunning, 'isLocked:', isLocked);
        isRunning = false;

        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }

        // 停止声音
        if (AudioModule) {
            AudioModule.stopContinuous();
        }

        if (isLocked) {
            console.log('[REMINDER] Lock active, sending hide-lock');
            if (typeof window !== 'undefined' && window.require) {
                try {
                    const { ipcRenderer } = window.require('electron');
                    ipcRenderer.send('hide-lock');
                } catch (e) {
                    console.error('[REMINDER] Failed to send hide-lock:', e);
                }
            }
            isLocked = false;
            pendingLock = false;
            isCreatingLock = false;
        }

        // 注意：不要重置 nextReminderTimestamp，否则会导致下一次提醒无法触发
        // nextReminderTimestamp = null;
    }

    let mainIntervalId = null;

    function setMainInterval(fn, interval) {
        if (mainIntervalId) clearInterval(mainIntervalId);
        if (!isRunning) return;
        mainIntervalId = setInterval(fn, interval);
    }

    function clearMainInterval() {
        if (mainIntervalId) {
            clearInterval(mainIntervalId);
            mainIntervalId = null;
        }
    }

    function unlock(forceLock) {
        if (!isLocked) return true;

        const now = Date.now();

        if (currentLockEndTime && now >= currentLockEndTime) {
            closeLockScreen();
            return true;
        } else if (!forceLock) {
            return false;
        }
        return true;
    }

    function manualCloseLockScreen() {
        closeLockScreen();
    }

    function resetLockStates() {
        console.log('[REMINDER] resetLockStates called');
        isLocked = false;
        pendingLock = false;
        isCreatingLock = false;
        console.log('[REMINDER] Lock states reset:', { isLocked, pendingLock, isCreatingLock });
    }

    // 主检查循环
    function checkAndRemind() {
        if (!isRunning) {
            console.log('[REMINDER] Check skipped: not running');
            return;
        }
        if (isLocked) {
            console.log('[REMINDER] Check skipped: locked');
            return;
        }
        if (pendingLock) {
            console.log('[REMINDER] Check skipped: pending lock');
            return;
        }

        const now = Date.now();
        // if (nextReminderTimestamp) {
        //     console.log('[REMINDER] Time difference:', (nextReminderTimestamp - now) / 1000, 'seconds');
        // }
        
        if (nextReminderTimestamp && now >= nextReminderTimestamp) {
            console.log('[REMINDER] Time to remind!');
            if (ConfigModule) {
                const config = ConfigModule.load();
                trigger(config);
            } else {
                console.error('[REMINDER] ConfigModule not available');
                trigger({ lockMinutes: 5, forceLock: false, soundEnabled: true });
            }
        }
    }

    // 启动检查循环
    function startCheckLoop() {
        if (mainIntervalId) {
            console.log('[REMINDER] Clearing existing interval:', mainIntervalId);
            clearInterval(mainIntervalId);
            mainIntervalId = null;
        }
        if (!isRunning) {
            console.log('[REMINDER] Not running, skipping startCheckLoop');
            return;
        }
        mainIntervalId = setInterval(() => checkAndRemind(), 500);
    }

    return {
        setModules,
        setElements,
        setCallbacks,
        getCallbacks,
        isReminderRunning,
        isCurrentlyLocked,
        getNextReminderTime,
        setNextReminderTime,
        calculateNextReminder,
        trigger,
        start,
        stop,
        setMainInterval,
        clearMainInterval,
        startCheckLoop,
        resetLockStates,
        unlock,
        closeLockScreen: manualCloseLockScreen,
        checkAndRemind
    };
})();