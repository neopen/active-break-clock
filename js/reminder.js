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

    let onReminderTrigger = null;
    let onLockClose = null;

    // 将应用窗口带到前台（PakePlus/Electron 环境）
    function bringWindowToFront() {
        console.log('bringWindowToFront called');

        // 方式1: PakePlus API
        if (typeof window.pake !== 'undefined') {
            try {
                if (window.pake.focus) window.pake.focus();
                if (window.pake.setAlwaysOnTop) window.pake.setAlwaysOnTop(true);
                console.log('PakePlus: window brought to front');
            } catch (e) {
                console.warn('PakePlus focus error:', e);
            }
        }

        // 方式2: Electron API
        if (typeof window.require !== 'undefined') {
            try {
                const { remote } = window.require('electron');
                const win = remote.getCurrentWindow();
                win.setAlwaysOnTop(true, 'floating');
                win.focus();
                console.log('Electron: window brought to front');

                // 设置定时器，提醒结束后取消置顶
                if (currentLockEndTime) {
                    const duration = currentLockEndTime - Date.now();
                    if (duration > 0) {
                        setTimeout(() => {
                            win.setAlwaysOnTop(false);
                            console.log('Electron: always on top disabled');
                        }, duration);
                    }
                }
            } catch (e) {
                console.warn('Electron focus error:', e);
            }
        }

        // 方式3: 普通浏览器环境 - 尝试聚焦窗口
        if (typeof window !== 'undefined') {
            try {
                window.focus();
                // 尝试请求全屏
                const docEl = document.documentElement;
                if (docEl.requestFullscreen && !document.fullscreenElement) {
                    docEl.requestFullscreen().catch(e => console.warn('Fullscreen request failed:', e));
                }
            } catch (e) { }
        }
    }

    // 恢复窗口状态
    function restoreWindowState() {
        console.log('restoreWindowState called');

        if (typeof window.require !== 'undefined') {
            try {
                const { remote } = window.require('electron');
                const win = remote.getCurrentWindow();
                win.setAlwaysOnTop(false);
            } catch (e) { }
        }

        if (typeof window.pake !== 'undefined') {
            try {
                if (window.pake.setAlwaysOnTop) window.pake.setAlwaysOnTop(false);
            } catch (e) { }
        }

        // 退出全屏
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            document.exitFullscreen?.() || document.webkitExitFullscreen?.();
        }
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

        if (lockTimerInterval) {
            clearInterval(lockTimerInterval);
            lockTimerInterval = null;
        }

        // 恢复窗口状态
        restoreWindowState();

        // 恢复页面滚动
        document.body.classList.remove('lock-active');

        if (lockOverlay) {
            lockOverlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                lockOverlay.classList.add('hidden');
                lockOverlay.style.animation = '';
                isLocked = false;
                currentLockEndTime = null;
                if (onLockClose) onLockClose();
            }, 300);
        }
    }

    function showLockScreen(minutes, forceLock, onComplete) {
        if (isLocked) return;

        // ========== 将窗口带到前台 ==========
        bringWindowToFront();
        // =================================

        isLocked = true;
        const totalSeconds = minutes * 60;
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

            // 确保全屏覆盖
            lockOverlay.style.position = 'fixed';
            lockOverlay.style.top = '0';
            lockOverlay.style.left = '0';
            lockOverlay.style.right = '0';
            lockOverlay.style.bottom = '0';
            lockOverlay.style.width = '100%';
            lockOverlay.style.height = '100%';
            lockOverlay.style.zIndex = '2147483647';

            // 移除任何可能的关闭按钮
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

    function trigger(config, audioModule) {
        if (!isRunning || isLocked) return;

        const lockMins = Math.min(30, Math.max(1, config.lockMinutes || 5));

        // 播放声音
        if (config.soundEnabled && audioModule) {
            audioModule.playAlert();
            audioModule.startContinuous();
        }

        // 触发回调（用于统计和通知）
        if (onReminderTrigger) onReminderTrigger();

        showLockScreen(lockMins, config.forceLock || false, () => {
            if (audioModule) audioModule.stopContinuous();
        });
    }

    function start() {
        console.log('ReminderModule.start called');
        isRunning = true;
    }

    function stop(audioModule) {
        console.log('ReminderModule.stop called');
        isRunning = false;

        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }

        if (isLocked) {
            closeLockScreen();
            if (audioModule) audioModule.stopContinuous();
        }

        nextReminderTimestamp = null;

        // 恢复窗口状态
        restoreWindowState();
    }

    function setMainInterval(fn, interval) {
        if (checkInterval) clearInterval(checkInterval);
        if (!isRunning) return;
        checkInterval = setInterval(fn, interval);
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

    return {
        setElements,
        setCallbacks,
        isReminderRunning,
        isCurrentlyLocked,
        getNextReminderTime,
        setNextReminderTime,
        calculateNextReminder,
        trigger,
        start,
        stop,
        setMainInterval,
        unlock,
        closeLockScreen: manualCloseLockScreen
    };
})();