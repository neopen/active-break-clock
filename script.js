// DOM 元素
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const intervalMinutesInput = document.getElementById('intervalMinutes');
const lockMinutesInput = document.getElementById('lockMinutes');
const forceLockToggle = document.getElementById('forceLockToggle');
const soundToggle = document.getElementById('soundToggle');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusBadge = document.getElementById('statusBadge');
const nextReminderDiv = document.getElementById('nextReminder');
const nextTimeText = document.getElementById('nextTimeText');
const lockOverlay = document.getElementById('lockOverlay');
const countdownSpan = document.getElementById('countdownSeconds');
const unlockBtn = document.getElementById('unlockBtn');
const timerRing = document.getElementById('timerRing');
const intervalError = document.getElementById('intervalError');
const lockError = document.getElementById('lockError');

// 音频相关
let audioContext = null;
let isSoundEnabled = true;
let currentSoundInterval = null;

// 全局状态
let isRunning = false;
let checkInterval = null;
let nextReminderTimestamp = null;
let currentLockEndTime = null;
let lockTimerInterval = null;
let isLocked = false;
let progressCircle = null;

// 初始化音频上下文
function initAudioContext() {
    if (audioContext) return audioContext;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return audioContext;
    } catch (e) {
        console.warn('Web Audio API not supported');
        return null;
    }
}

// 播放提示音
function playBeep(frequency = 880, duration = 0.3, type = 'sine') {
    if (!isSoundEnabled) return;
    
    try {
        const ctx = initAudioContext();
        if (!ctx) return;
        
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        oscillator.start();
        oscillator.stop(now + duration);
    } catch (e) {
        console.warn('Cannot play sound:', e);
    }
}

// 播放提醒音效序列
function playAlertSound() {
    if (!isSoundEnabled) return;
    
    playBeep(660, 0.2, 'sine');
    setTimeout(() => playBeep(880, 0.2, 'sine'), 200);
    setTimeout(() => playBeep(1046, 0.3, 'sine'), 400);
}

// 停止持续音效
function stopContinuousSound() {
    if (currentSoundInterval) {
        clearInterval(currentSoundInterval);
        currentSoundInterval = null;
    }
}

// 开始持续播放提醒音
function startContinuousAlert() {
    if (!isSoundEnabled) return;
    
    playAlertSound();
    
    if (currentSoundInterval) clearInterval(currentSoundInterval);
    currentSoundInterval = setInterval(() => {
        if (isLocked && isSoundEnabled) {
            playAlertSound();
        }
    }, 3000);
}

// 校验函数
function validateInterval(value) {
    const num = parseInt(value);
    if (isNaN(num)) return false;
    return num >= 10 && num <= 300;
}

function validateLockMinutes(value) {
    const num = parseInt(value);
    if (isNaN(num)) return false;
    return num >= 1 && num <= 30;
}

function validateAndShowErrors() {
    let isValid = true;
    
    if (!validateInterval(intervalMinutesInput.value)) {
        intervalError.textContent = '提醒频率范围：10 ~ 300 分钟（步长10分钟）';
        intervalError.classList.remove('hidden');
        intervalMinutesInput.classList.add('input-error');
        isValid = false;
    } else {
        intervalError.classList.add('hidden');
        intervalMinutesInput.classList.remove('input-error');
    }
    
    if (!validateLockMinutes(lockMinutesInput.value)) {
        lockError.textContent = '锁屏时长范围：1 ~ 30 分钟';
        lockError.classList.remove('hidden');
        lockMinutesInput.classList.add('input-error');
        isValid = false;
    } else {
        lockError.classList.add('hidden');
        lockMinutesInput.classList.remove('input-error');
    }
    
    return isValid;
}

function fixIntervalValue() {
    let value = parseInt(intervalMinutesInput.value);
    if (isNaN(value)) {
        intervalMinutesInput.value = 40;
    } else if (value < 10) {
        intervalMinutesInput.value = 10;
    } else if (value > 300) {
        intervalMinutesInput.value = 300;
    } else {
        const rounded = Math.round(value / 10) * 10;
        intervalMinutesInput.value = rounded;
    }
    validateAndShowErrors();
}

function fixLockValue() {
    let value = parseInt(lockMinutesInput.value);
    if (isNaN(value)) {
        lockMinutesInput.value = 5;
    } else if (value < 1) {
        lockMinutesInput.value = 1;
    } else if (value > 30) {
        lockMinutesInput.value = 30;
    }
    validateAndShowErrors();
}

// 自定义确认弹框
function showConfirmDialog(options) {
    return new Promise((resolve) => {
        const { title, message, confirmText = '确定', cancelText = '取消', confirmColor = '#ef4444' } = options;
        
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'custom-dialog';
        
        dialog.innerHTML = `
            <div class="dialog-icon">⚠️</div>
            <div class="dialog-title">${title}</div>
            <div class="dialog-message">${message}</div>
            <div class="dialog-buttons">
                ${cancelText ? `<button class="dialog-btn dialog-btn-cancel">${cancelText}</button>` : ''}
                <button class="dialog-btn dialog-btn-confirm" style="color: ${confirmColor}">${confirmText}</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        const cancelBtn = cancelText ? dialog.querySelector('.dialog-btn-cancel') : null;
        const confirmBtn = dialog.querySelector('.dialog-btn-confirm');
        
        const close = (result) => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };
        
        if (cancelBtn) cancelBtn.onclick = () => close(false);
        confirmBtn.onclick = () => close(true);
    });
}

// 保存配置
function saveConfig() {
    if (!validateAndShowErrors()) return false;
    
    const config = {
        startTime: startTimeInput.value,
        endTime: endTimeInput.value,
        intervalMinutes: parseInt(intervalMinutesInput.value),
        lockMinutes: parseInt(lockMinutesInput.value),
        forceLock: forceLockToggle.checked,
        soundEnabled: soundToggle.checked
    };
    localStorage.setItem('healthAlarmConfig', JSON.stringify(config));
    return true;
}

function loadConfig() {
    const saved = localStorage.getItem('healthAlarmConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            startTimeInput.value = config.startTime || '08:00';
            endTimeInput.value = config.endTime || '18:00';
            intervalMinutesInput.value = config.intervalMinutes || 40;
            lockMinutesInput.value = config.lockMinutes || 5;
            forceLockToggle.checked = config.forceLock || false;
            soundToggle.checked = config.soundEnabled !== undefined ? config.soundEnabled : true;
        } catch(e) {}
    }
    isSoundEnabled = soundToggle.checked;
    fixIntervalValue();
    fixLockValue();
}

function getTodayTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    return target;
}

function isWithinPeriod(now) {
    const start = getTodayTime(startTimeInput.value);
    const end = getTodayTime(endTimeInput.value);
    let endAdjusted = new Date(end);
    if (endAdjusted <= start) {
        endAdjusted.setDate(endAdjusted.getDate() + 1);
    }
    return now >= start && now <= endAdjusted;
}

function calculateNextReminder(now) {
    const start = getTodayTime(startTimeInput.value);
    const end = getTodayTime(endTimeInput.value);
    let endAdjusted = new Date(end);
    if (endAdjusted <= start) {
        endAdjusted.setDate(endAdjusted.getDate() + 1);
    }

    const intervalMs = parseInt(intervalMinutesInput.value) * 60 * 1000;

    if (isWithinPeriod(now)) {
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

function updateNextReminderDisplay() {
    if (!isRunning || !nextReminderTimestamp) {
        nextReminderDiv.classList.add('hidden');
        return;
    }
    const date = new Date(nextReminderTimestamp);
    const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}:${date.getSeconds().toString().padStart(2,'0')}`;
    nextTimeText.innerText = timeStr;
    nextReminderDiv.classList.remove('hidden');
}

function updateProgressCircle(remainingSeconds, totalSeconds) {
    if (!progressCircle) {
        progressCircle = document.createElement('div');
        progressCircle.className = 'timer-circle-progress';
        timerRing.insertBefore(progressCircle, timerRing.querySelector('.timer-center'));
    }
    const percent = (totalSeconds - remainingSeconds) / totalSeconds;
    const angle = percent * 360;
    progressCircle.style.background = `conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa ${angle}deg, rgba(255, 255, 255, 0.1) ${angle}deg)`;
}

function closeLockScreen() {
    if (lockTimerInterval) {
        clearInterval(lockTimerInterval);
        lockTimerInterval = null;
    }
    
    stopContinuousSound();
    
    lockOverlay.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
        lockOverlay.classList.add('hidden');
        lockOverlay.style.animation = '';
        isLocked = false;
        currentLockEndTime = null;
        
        if (isRunning) {
            const now = new Date();
            const next = calculateNextReminder(now);
            nextReminderTimestamp = next.getTime();
            updateNextReminderDisplay();
        }
    }, 300);
}

function showLockScreen(minutes, forceLock) {
    if (isLocked) return;
    
    isLocked = true;
    const totalSeconds = minutes * 60;
    const endTime = Date.now() + (totalSeconds * 1000);
    currentLockEndTime = endTime;
    
    if (progressCircle) {
        progressCircle.style.background = 'conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa 0deg, rgba(255, 255, 255, 0.1) 0deg)';
    }
    
    lockOverlay.classList.remove('hidden');
    lockOverlay.style.animation = 'fadeIn 0.3s ease';
    
    if (isSoundEnabled) {
        playAlertSound();
        startContinuousAlert();
    }
    
    if (lockTimerInterval) clearInterval(lockTimerInterval);
    
    function updateTimer() {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((currentLockEndTime - now) / 1000));
        countdownSpan.innerText = remaining;
        updateProgressCircle(remaining, totalSeconds);
        
        if (remaining <= 0) {
            clearInterval(lockTimerInterval);
            lockTimerInterval = null;
            closeLockScreen();
        } else {
            unlockBtn.innerText = `⏳ 请活动 ${remaining} 秒`;
            if (forceLock) {
                unlockBtn.classList.add('disabled');
                unlockBtn.disabled = true;
            } else {
                unlockBtn.classList.remove('disabled');
                unlockBtn.disabled = false;
            }
        }
    }
    
    updateTimer();
    lockTimerInterval = setInterval(updateTimer, 100);
}

function triggerReminder() {
    if (!isRunning || isLocked) return;
    
    let lockMins = parseInt(lockMinutesInput.value);
    if (isNaN(lockMins) || lockMins < 1) lockMins = 5;
    if (lockMins > 30) lockMins = 30;
    
    const forceLock = forceLockToggle.checked;
    showLockScreen(lockMins, forceLock);
}

async function onUnlock() {
    if (!isLocked) return;
    
    const now = Date.now();
    const forceLock = forceLockToggle.checked;
    
    if (currentLockEndTime && now >= currentLockEndTime) {
        if (isLocked) {
            closeLockScreen();
        }
    } else if (!forceLock) {
        const confirmed = await showConfirmDialog({
            title: '提前结束提醒',
            message: '活动时间还没到，提前结束可能会影响健康习惯。\n确定要提前结束吗？',
            confirmText: '提前结束',
            cancelText: '继续活动',
            confirmColor: '#f59e0b'
        });
        
        if (confirmed) {
            closeLockScreen();
        }
    }
}

function checkAndRemind() {
    if (!isRunning) return;
    if (isLocked) return;
    
    const now = Date.now();
    if (nextReminderTimestamp && now >= nextReminderTimestamp) {
        triggerReminder();
    }
}

function rescheduleMainLoop() {
    if (checkInterval) clearInterval(checkInterval);
    if (!isRunning) return;
    checkInterval = setInterval(checkAndRemind, 500);
}

async function startAlarm() {
    console.log('startAlarm called');
    
    if (!validateAndShowErrors()) {
        await showConfirmDialog({
            title: '配置无效',
            message: '请先修正上面的错误设置后再启动闹铃。',
            confirmText: '知道了',
            cancelText: '',
            confirmColor: '#667eea'
        });
        return;
    }
    
    if (isRunning) {
        console.log('Already running');
        return;
    }
    
    // 初始化音频
    try {
        const ctx = initAudioContext();
        if (ctx && ctx.state === 'suspended') {
            await ctx.resume();
        }
    } catch(e) {
        console.warn('Audio init failed:', e);
    }
    
    if (!saveConfig()) return;
    
    const now = new Date();
    const next = calculateNextReminder(now);
    nextReminderTimestamp = next.getTime();
    
    isRunning = true;
    updateNextReminderDisplay();
    rescheduleMainLoop();
    updateUI();
    
    console.log('Alarm started, next reminder at:', new Date(nextReminderTimestamp));
}

function stopAlarm() {
    console.log('stopAlarm called');
    isRunning = false;
    
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    
    if (isLocked) {
        closeLockScreen();
    }
    
    nextReminderTimestamp = null;
    updateUI();
    nextReminderDiv.classList.add('hidden');
}

function updateUI() {
    if (isRunning) {
        statusBadge.innerHTML = '🟢 闹铃运行中 · 将在时间段内自动提醒';
        statusBadge.className = 'status-badge status-active';
        startBtn.disabled = true;
        startBtn.style.opacity = '0.6';
        stopBtn.style.background = '#ef4444';
    } else {
        statusBadge.innerHTML = '⚪ 闹铃未启动';
        statusBadge.className = 'status-badge status-inactive';
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
        stopBtn.style.background = '#ef4444';
    }
}

function initProgressCircle() {
    if (timerRing && !progressCircle) {
        progressCircle = document.createElement('div');
        progressCircle.className = 'timer-circle-progress';
        timerRing.insertBefore(progressCircle, timerRing.querySelector('.timer-center'));
        progressCircle.style.background = 'conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa 0deg, rgba(255, 255, 255, 0.1) 0deg)';
    }
}

// 声音开关事件
soundToggle.addEventListener('change', () => {
    isSoundEnabled = soundToggle.checked;
    saveConfig();
});

// 输入事件绑定
intervalMinutesInput.addEventListener('input', () => {
    fixIntervalValue();
    if (isRunning) {
        const now = new Date();
        const next = calculateNextReminder(now);
        nextReminderTimestamp = next.getTime();
        updateNextReminderDisplay();
        rescheduleMainLoop();
    }
});

lockMinutesInput.addEventListener('input', fixLockValue);

startTimeInput.addEventListener('change', () => {
    saveConfig();
    if (isRunning) {
        const now = new Date();
        const next = calculateNextReminder(now);
        nextReminderTimestamp = next.getTime();
        updateNextReminderDisplay();
    }
});

endTimeInput.addEventListener('change', () => {
    saveConfig();
    if (isRunning) {
        const now = new Date();
        const next = calculateNextReminder(now);
        nextReminderTimestamp = next.getTime();
        updateNextReminderDisplay();
    }
});

forceLockToggle.addEventListener('change', saveConfig);

startBtn.addEventListener('click', startAlarm);
stopBtn.addEventListener('click', stopAlarm);
unlockBtn.addEventListener('click', onUnlock);

// 初始化
loadConfig();
updateUI();
initProgressCircle();
lockOverlay.classList.add('hidden');
isLocked = false;
isRunning = false;

console.log('App initialized');

// 页面关闭提醒
window.addEventListener('beforeunload', (e) => {
    if (isRunning) {
        e.preventDefault();
        e.returnValue = '闹铃正在运行，确定要离开吗？';
    }
});