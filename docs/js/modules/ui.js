// UI 更新模块
const UIModule = (function () {
    let elements = {};
    let statsUnsubscribe = null;

    function setElements(e) {
        elements = e;
    }

    function updateUI(isRunning) {
        if (isRunning) {
            if (elements.statusBadge) {
                elements.statusBadge.innerHTML = '🟢 闹铃运行中 · 将在时间段内自动提醒';
                elements.statusBadge.className = 'status-badge status-active';
            }
            if (elements.startBtn) {
                elements.startBtn.disabled = true;
                elements.startBtn.style.opacity = '0.6';
                elements.startBtn.style.cursor = 'not-allowed';
            }
            if (elements.stopBtn) {
                elements.stopBtn.disabled = false;  // 确保停止按钮可用
                elements.stopBtn.style.opacity = '1';
                elements.stopBtn.style.cursor = 'pointer';
                elements.stopBtn.style.background = '#ef4444';
            }
        } else {
            if (elements.statusBadge) {
                elements.statusBadge.innerHTML = '⚪ 闹铃未启动';
                elements.statusBadge.className = 'status-badge status-inactive';
            }
            if (elements.startBtn) {
                elements.startBtn.disabled = false;
                elements.startBtn.style.opacity = '1';
                elements.startBtn.style.cursor = 'pointer';
            }
            if (elements.stopBtn) {
                elements.stopBtn.disabled = true;   // 未启动时停止按钮禁用
                elements.stopBtn.style.opacity = '0.5';
                elements.stopBtn.style.cursor = 'not-allowed';
                elements.stopBtn.style.background = '#94a3b8';
            }
        }
    }

    function updateNextReminderDisplay(timestamp) {
        if (!timestamp || !elements.nextReminderDiv) {
            if (elements.nextReminderDiv) elements.nextReminderDiv.classList.add('hidden');
            return;
        }
        const date = new Date(timestamp);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        if (elements.nextTimeText) elements.nextTimeText.innerText = timeStr;
        if (elements.nextReminderDiv) elements.nextReminderDiv.classList.remove('hidden');
    }

    function updateStatsDisplay(stats) {
        if (elements.todayCount) elements.todayCount.innerText = stats.todayCount;
        if (elements.continuousDays) elements.continuousDays.innerText = stats.continuousDays;
        if (elements.weeklyRate) {
            const rate = StatsModule.getWeeklyRate();
            elements.weeklyRate.innerText = `${rate}%`;
        }
    }

    function showError(elementId, message, isError = true) {
        const errorEl = elements[elementId];
        const inputEl = elements[elementId === 'intervalError' ? 'intervalMinutes' : 'lockMinutes'];
        if (errorEl) {
            if (isError) {
                errorEl.textContent = message;
                errorEl.classList.remove('hidden');
                if (inputEl) inputEl.classList.add('input-error');
            } else {
                errorEl.classList.add('hidden');
                if (inputEl) inputEl.classList.remove('input-error');
            }
        }
    }

    function initStatsSubscription() {
        if (statsUnsubscribe) statsUnsubscribe();
        statsUnsubscribe = StatsModule.subscribe((stats) => {
            updateStatsDisplay(stats);
        });
        updateStatsDisplay(StatsModule.load());
    }

    return {
        setElements,
        updateUI,
        updateNextReminderDisplay,
        updateStatsDisplay,
        showError,
        initStatsSubscription
    };
})();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIModule;
}