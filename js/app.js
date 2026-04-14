// 主入口
(function () {
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


    // 自动关闭的提示弹框（3秒后自动关闭）
    function showAutoCloseDialog(options) {
        return new Promise((resolve) => {
            const { title, message, autoClose = 3000, confirmColor = '#22c55e' } = options;

            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay auto-close-dialog';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog auto-close-dialog-inner';

            dialog.innerHTML = `
				<div class="dialog-icon">✅</div>
				<div class="dialog-title" style="color: ${confirmColor}">${title}</div>
				<div class="dialog-message">${message}</div>
				<div class="auto-close-timer">
					<div class="timer-bar"></div>
					<div class="timer-text">${Math.ceil(autoClose / 1000)}秒后自动关闭</div>
				</div>
			`;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 添加进度条动画
            const timerBar = dialog.querySelector('.timer-bar');
            if (timerBar) {
                timerBar.style.animation = `shrink ${autoClose / 1000}s linear forwards`;
            }

            // 自动关闭
            const timeoutId = setTimeout(() => {
                close();
            }, autoClose);

            const close = () => {
                clearTimeout(timeoutId);
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    overlay.remove();
                    resolve(true);
                }, 200);
            };

            // 点击弹框可以提前关闭
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
                close();
            });

            // 点击遮罩不关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    // 遮罩点击不关闭，只能等自动关闭或点弹框
                    return;
                }
            });
        });
    }

    // DOM 元素
    const elements = {
        startTime: document.getElementById('startTime'),
        endTime: document.getElementById('endTime'),
        intervalMinutes: document.getElementById('intervalMinutes'),
        lockMinutes: document.getElementById('lockMinutes'),
        forceLockToggle: document.getElementById('forceLockToggle'),
        soundToggle: document.getElementById('soundToggle'),
        notificationToggle: document.getElementById('notificationToggle'),
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        statusBadge: document.getElementById('statusBadge'),
        nextReminderDiv: document.getElementById('nextReminder'),
        nextTimeText: document.getElementById('nextTimeText'),
        lockOverlay: document.getElementById('lockOverlay'),
        countdownSpan: document.getElementById('countdownSeconds'),
        unlockBtn: document.getElementById('unlockBtn'),
        timerRing: document.getElementById('timerRing'),
        intervalError: document.getElementById('intervalError'),
        lockError: document.getElementById('lockError'),
        todayCount: document.getElementById('todayCount'),
        continuousDays: document.getElementById('continuousDays'),
        weeklyRate: document.getElementById('weeklyRate'),
        resetStatsBtn: document.getElementById('resetStatsBtn'),
        testNotifyBtn: document.getElementById('testNotifyBtn')
    };

    // 初始化各模块
    Config.setElements(elements);
    ReminderModule.setElements({
        timerRing: elements.timerRing,
        countdownSpan: elements.countdownSpan,
        unlockBtn: elements.unlockBtn,
        lockOverlay: elements.lockOverlay
    });
    UIModule.setElements(elements);

    // 注入 Config 和 AudioModule 到 ReminderModule
    ReminderModule.setModules(Config, AudioModule);

    // 设置回调
    ReminderModule.setCallbacks({
        onReminderTrigger: async () => {
            // 记录活动统计
            StatsModule.recordActivity();

            // 发送桌面通知
            if (Config.get('notificationEnabled')) {
                await NotificationModule.sendReminder();
            }
        },
        onLockClose: () => {
            // 锁屏关闭后，重新调度下一次提醒
            if (ReminderModule.isReminderRunning()) {
                const now = new Date();
                const config = Config.load();
                const next = ReminderModule.calculateNextReminder(now, config);
                ReminderModule.setNextReminderTime(next.getTime());
                UIModule.updateNextReminderDisplay(next.getTime());
            }
        }
    });

    // 设置音频模块的 locked getter
    AudioModule.setLockedGetter(() => ReminderModule.isCurrentlyLocked());

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../sw.js')
            .then(reg => {
                console.log('Service Worker registered:', reg);

                // 注册后台同步（可选）
                if ('sync' in reg) {
                    reg.sync.register('reminder-sync');
                }
            })
            .catch(err => console.log('Service Worker registration failed:', err));
    }

    // 校验和修正函数
    function validateAndShowErrors() {
        let isValid = true;
        const intervalValue = elements.intervalMinutes.value || 40;
        const intervalMin = elements.intervalMinutes.min || 10;
        const intervalMax = elements.intervalMinutes.max || 300;
        const lockValue = elements.lockMinutes.value || 5;
        const lockMin = elements.lockMinutes.min || 1;
        const lockMax = elements.lockMinutes.max || 30;

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

    function fixValues() {
        const intervalValue = elements.intervalMinutes.value || 40;
        const intervalMin = elements.intervalMinutes.min || 10;
        const intervalMax = elements.intervalMinutes.max || 300;
        const intervalStep = elements.intervalMinutes.step || 5;
        const lockValue = elements.lockMinutes.value || 5;
        const lockMin = elements.lockMinutes.min || 1;
        const lockMax = elements.lockMinutes.max || 30;
        const fixedInterval = Config.fixIntervalValue(intervalValue, intervalMin, intervalMax, intervalStep);
        const fixedLock = Config.fixLockValue(lockValue, lockMin, lockMax);
        elements.intervalMinutes.value = fixedInterval;
        elements.lockMinutes.value = fixedLock;
        validateAndShowErrors();
    }

    // 主检查循环
    let mainInterval = null;

    function checkAndRemind() {
        if (!ReminderModule.isReminderRunning()) return;
        if (ReminderModule.isCurrentlyLocked()) return;

        const now = Date.now();
        const nextTime = ReminderModule.getNextReminderTime();
        if (nextTime && now >= nextTime) {
            console.log('Time to remind!');
            const config = Config.load();
            ReminderModule.trigger(config, AudioModule);
        }
    }

    // 启动闹铃
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

        if (ReminderModule.isReminderRunning()) {
            console.log('Already running');
            return;
        }

        // 初始化音频和通知
        await AudioModule.resume();
        await NotificationModule.init();

        Config.save();

        const now = new Date();
        const config = Config.load();
        console.log('Config loaded for start:', config);

        const next = ReminderModule.calculateNextReminder(now, config);
        ReminderModule.setNextReminderTime(next.getTime());

        // 启动提醒模块
        ReminderModule.start(config);

        // 启动检查循环
        ReminderModule.startCheckLoop();

        UIModule.updateUI(true);
        UIModule.updateNextReminderDisplay(next.getTime());

        console.log('Alarm started, next reminder at:', new Date(next.getTime()));
        console.log('Lock minutes from config:', config.lockMinutes);
    }

    // 停止闹铃
    function stopAlarm() {
        console.log('stopAlarm called');
        ReminderModule.stop(AudioModule);
        if (mainInterval) {
            clearInterval(mainInterval);
            mainInterval = null;
        }
        UIModule.updateUI(false);
        UIModule.updateNextReminderDisplay(null);
    }


    // 解锁处理
    async function onUnlock() {
        console.log('onUnlock called');
        if (!ReminderModule.isCurrentlyLocked()) return;

        const forceLock = Config.get('forceLock');
        const unlocked = ReminderModule.unlock(forceLock);

        if (!unlocked && !forceLock) {
            const confirmed = await showConfirmDialog({
                title: '提前结束提醒',
                message: '活动时间还没到，提前结束可能会影响健康习惯。\n确定要提前结束吗？',
                confirmText: '提前结束',
                cancelText: '继续活动',
                confirmColor: '#f59e0b'
            });

            if (confirmed) {
                ReminderModule.closeLockScreen();
                AudioModule.stopContinuous();
            }
        }
    }

    // 重置统计
    async function resetStats() {
        const confirmed = await showConfirmDialog({
            title: '重置今日统计',
            message: '确定要重置今日的活动记录吗？',
            confirmText: '重置',
            cancelText: '取消',
            confirmColor: '#ef4444'
        });

        if (confirmed) {
            StatsModule.resetToday();
            UIModule.updateStatsDisplay(StatsModule.load());
        }
    }

    // 测试通知
    async function testNotification() {
        if (Config.get('notificationEnabled')) {
            const sent = await NotificationModule.sendTest();
            if (!sent) {
                await showConfirmDialog({
                    title: '通知权限',
                    message: '请允许浏览器通知权限，以便接收提醒。',
                    confirmText: '知道了',
                    cancelText: '',
                    confirmColor: '#667eea'
                });
            }
        } else {
            await showConfirmDialog({
                title: '通知未开启',
                message: '请在设置中开启桌面通知功能。',
                confirmText: '知道了',
                cancelText: '',
                confirmColor: '#667eea'
            });
        }
    }

    // 事件绑定
    elements.intervalMinutes.addEventListener('blur', () => {
        fixValues();
        if (ReminderModule.isReminderRunning()) {
            const now = new Date();
            const config = Config.load();
            const next = ReminderModule.calculateNextReminder(now, config);
            ReminderModule.setNextReminderTime(next.getTime());
            UIModule.updateNextReminderDisplay(next.getTime());
        }
    });

    elements.lockMinutes.addEventListener('blur', fixValues);

    elements.startTime.addEventListener('change', () => {
        Config.save();
        if (ReminderModule.isReminderRunning()) {
            const now = new Date();
            const config = Config.load();
            const next = ReminderModule.calculateNextReminder(now, config);
            ReminderModule.setNextReminderTime(next.getTime());
            UIModule.updateNextReminderDisplay(next.getTime());
        }
    });

    elements.endTime.addEventListener('change', () => {
        Config.save();
        if (ReminderModule.isReminderRunning()) {
            const now = new Date();
            const config = Config.load();
            const next = ReminderModule.calculateNextReminder(now, config);
            ReminderModule.setNextReminderTime(next.getTime());
            UIModule.updateNextReminderDisplay(next.getTime());
        }
    });

    elements.soundToggle.addEventListener('change', () => {
        Config.save();
        AudioModule.setEnabled(elements.soundToggle.checked);
    });

    elements.notificationToggle.addEventListener('change', () => {
        Config.save();
        NotificationModule.setEnabled(elements.notificationToggle.checked);
        if (elements.notificationToggle.checked) {
            NotificationModule.initWithoutWait();
        }
    });


    /*
    // 数据管理相关元素
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    const autoBackupToggle = document.getElementById('autoBackupToggle');
    const dataSizeInfo = document.getElementById('dataSizeInfo');

    // 更新数据大小显示
    function updateDataSizeInfo() {
        if (dataSizeInfo) {
            const size = StorageModule.getDataSize();
            dataSizeInfo.textContent = `数据大小: ${size} KB`;
        }
    }

    // 导出数据
    exportDataBtn.addEventListener('click', () => {
        StorageModule.exportData();
        showAutoCloseDialog({
            title: '导出成功',
            message: '备份文件已保存到下载目录',
            autoClose: 2000,
            confirmColor: '#22c55e'
        });
    });

    // 导入数据
    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const confirmed = await showConfirmDialog({
            title: '确认导入',
            message: '导入数据将覆盖当前所有设置和记录，确定要继续吗？',
            confirmText: '确认导入',
            cancelText: '取消',
            confirmColor: '#f59e0b'
        });

        if (confirmed) {
            try {
                await StorageModule.importData(file);
                // 重新加载配置和统计
                Config.load();
                fixValues();
                UIModule.initStatsSubscription();
                UIModule.updateStatsDisplay(StatsModule.load());
                updateDataSizeInfo();

                showAutoCloseDialog({
                    title: '导入成功',
                    message: '数据已恢复，请刷新页面查看',
                    autoClose: 2000,
                    confirmColor: '#22c55e'
                });
            } catch (err) {
                showConfirmDialog({
                    title: '导入失败',
                    message: '文件格式错误或数据损坏',
                    confirmText: '知道了',
                    cancelText: '',
                    confirmColor: '#ef4444'
                });
            }
        }
        importFileInput.value = '';
    });

    // 自动备份开关
    let autoBackupEnabled = localStorage.getItem('autoBackupEnabled') !== 'false';
    if (autoBackupEnabled) {
        StorageModule.startAutoBackup();
        autoBackupToggle.textContent = '⏰ 自动备份: 开启';
        autoBackupToggle.classList.add('active');
    } else {
        StorageModule.setEnabled(false);
        autoBackupToggle.textContent = '⏰ 自动备份: 关闭';
        autoBackupToggle.classList.remove('active');
    }

    autoBackupToggle.addEventListener('click', () => {
        autoBackupEnabled = !autoBackupEnabled;
        localStorage.setItem('autoBackupEnabled', autoBackupEnabled);

        if (autoBackupEnabled) {
            StorageModule.startAutoBackup();
            autoBackupToggle.textContent = '⏰ 自动备份: 开启';
            autoBackupToggle.classList.add('active');
        } else {
            StorageModule.stopAutoBackup();
            autoBackupToggle.textContent = '⏰ 自动备份: 关闭';
            autoBackupToggle.classList.remove('active');
        }
    });

    // 更新数据大小
    updateDataSizeInfo();
    setInterval(updateDataSizeInfo, 60000); // 每分钟更新一次
*/

    elements.forceLockToggle.addEventListener('change', () => Config.save());
    elements.startBtn.addEventListener('click', startAlarm);
    elements.stopBtn.addEventListener('click', stopAlarm);
    elements.unlockBtn.addEventListener('click', onUnlock);
    elements.resetStatsBtn.addEventListener('click', resetStats);
    if (elements.testNotifyBtn) {
        elements.testNotifyBtn.addEventListener('click', testNotification);
    }

    // 初始化
    Config.load();
    fixValues();
    UIModule.initStatsSubscription();
    UIModule.updateUI(false);
    ReminderModule.closeLockScreen();
    NotificationModule.initWithoutWait();

    console.log('App initialized');

    // 页面关闭提醒
    window.addEventListener('beforeunload', (e) => {
        if (ReminderModule.isReminderRunning()) {
            e.preventDefault();
            e.returnValue = '闹铃正在运行，确定要离开吗？';
        }
    });
})();