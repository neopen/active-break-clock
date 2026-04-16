// 主入口
(function () {
    // 创建日志实例
    const logger = Logger.createLogger('App') || console;
    
    logger.info('=== App Initialization ===');
    logger.info('FileSystemUtil available:', typeof FileSystemUtil !== 'undefined');
    logger.info('FileSystemManager available:', typeof FileSystemManager !== 'undefined');
    logger.info('Config available:', typeof Config !== 'undefined');
    logger.info('StatsModule available:', typeof StatsModule !== 'undefined');

    // 手动初始化文件系统
    if (typeof FileSystemManager !== 'undefined') {
        logger.info('Manually initializing FileSystemManager...');
        const initResult = FileSystemManager.init();
        logger.info('FileSystemManager init result:', initResult);
        logger.info('isUsingLocalFile:', FileSystemManager.isUsingLocalFile());
        logger.info('getDataPath:', FileSystemManager.getDataPath());
    }
    
    // 简化版确认弹框（不依赖 CSS 类）
    function showConfirmDialog(options) {
        logger.info('showConfirmDialog called', options);
        return new Promise((resolve) => {
            const { title, message, confirmText = '确定', cancelText = '取消', confirmColor = '#f59e0b' } = options;

            // 创建覆盖层
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 100000;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: system-ui, -apple-system, sans-serif;
            `;

            // 创建弹框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 28px;
                width: 300px;
                max-width: 85%;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
                padding: 0;
            `;

            dialog.innerHTML = `
                <div style="padding: 28px 24px 16px 24px; text-align: center;">
                    <div style="font-size: 52px; color: #b8b814; margin-bottom: 12px; display: block;">⚠️</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${title}</div>
                </div>
                <div style="padding: 0 24px 28px 24px; text-align: center;">
                    <div style="font-size: 15px; color: #64748b; line-height: 1.5;">${message}</div>
                </div>
                <div style="display: flex; border-top: 1px solid #e2e8f0;">
                    ${cancelText ? `<button id="dialog-cancel" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: #64748b; cursor: pointer; border-right: 1px solid #e2e8f0;">${cancelText}</button>` : ''}
                    <button id="dialog-confirm" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: ${confirmColor}; cursor: pointer;">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 添加动画样式（如果还没有）
            if (!document.querySelector('#dialog-animation-style')) {
                const style = document.createElement('style');
                style.id = 'dialog-animation-style';
                style.textContent = `
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(30px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `;
                document.head.appendChild(style);
            }

            const cancelBtn = cancelText ? dialog.querySelector('#dialog-cancel') : null;
            const confirmBtn = dialog.querySelector('#dialog-confirm');

            const close = (result) => {
                if (overlay && overlay.remove) {
                    overlay.remove();
                }
                resolve(result);
            };

            if (cancelBtn) cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => close(true);
            
            logger.info('Dialog shown');
        });
    }

    // 在锁屏弹框内部显示的确认弹框
    function showConfirmDialogInsideLock(options) {
        logger.info('showConfirmDialogInsideLock called');
        return new Promise((resolve) => {
            const { title, message, confirmText = '确定', cancelText = '取消', confirmColor = '#f59e0b' } = options;

            // 获取锁屏弹框容器
            const lockOverlayEl = document.getElementById('lockOverlay');
            if (!lockOverlayEl) {
                logger.error('Lock overlay not found');
                resolve(false);
                return;
            }

            // 找到 lock-card 元素
            const lockCard = lockOverlayEl.querySelector('.lock-card');
            if (!lockCard) {
                logger.error('Lock card not found');
                resolve(false);
                return;
            }

            // 移除已存在的确认弹框
            const existingDialog = lockOverlayEl.querySelector('.in-lock-dialog');
            if (existingDialog) {
                existingDialog.remove();
            }

            // 创建确认弹框容器
            const dialogContainer = document.createElement('div');
            dialogContainer.className = 'in-lock-dialog';
            dialogContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
                z-index: 100;
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 56px;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 28px;
                width: 280px;
                max-width: 85%;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                text-align: center;
                padding: 0;
            `;

            // 确保图标颜色可见（白色背景下使用深色图标）
            dialog.innerHTML = `
                <div style="padding: 28px 24px 16px 24px; text-align: center;">
                    <div style="font-size: 52px; color: #b8b814; margin-bottom: 12px; display: block;">⚠️</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${title}</div>
                </div>
                <div style="padding: 0 24px 28px 24px; text-align: center;">
                    <div style="font-size: 15px; color: #64748b; line-height: 1.5;">${message}</div>
                </div>
                <div style="display: flex; border-top: 1px solid #e2e8f0;">
                    ${cancelText ? `<button id="inlock-dialog-cancel" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: #64748b; cursor: pointer; border-right: 1px solid #e2e8f0;">${cancelText}</button>` : ''}
                    <button id="inlock-dialog-confirm" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: ${confirmColor}; cursor: pointer;">${confirmText}</button>
                </div>
            `;

            dialogContainer.appendChild(dialog);
            
            // 保存原始 lock-card 的样式
            const originalPosition = lockCard.style.position;
            lockCard.style.position = 'relative';
            
            lockCard.appendChild(dialogContainer);

            const cancelBtn = cancelText ? dialog.querySelector('#inlock-dialog-cancel') : null;
            const confirmBtn = dialog.querySelector('#inlock-dialog-confirm');

            const close = (result) => {
                console.log('In-lock dialog closing with result:', result);
                if (dialogContainer && dialogContainer.remove) {
                    dialogContainer.remove();
                }
                lockCard.style.position = originalPosition;
                resolve(result);
            };

            if (cancelBtn) cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => close(true);
            
            console.log('In-lock dialog added to lock overlay');
        });
    }

    // 简化版自动关闭提示弹框
    function showAutoCloseDialog(options) {
        console.log('showAutoCloseDialog called', options);
        return new Promise((resolve) => {
            const { title, message, autoClose = 3000, confirmColor = '#22c55e' } = options;

            // 创建覆盖层
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                z-index: 100000;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: system-ui, -apple-system, sans-serif;
            `;

            // 创建弹框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 28px;
                width: 300px;
                max-width: 85%;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                text-align: center;
                animation: slideUp 0.3s ease;
            `;

            dialog.innerHTML = `
                <div style="text-align: center; padding: 32px 24px 16px 24px; font-size: 48px;">✅</div>
                <div style="text-align: center; font-size: 20px; font-weight: 700; color: ${confirmColor}; padding: 0 24px 8px 24px;">${title}</div>
                <div style="text-align: center; font-size: 15px; color: #64748b; padding: 0 24px 24px 24px; line-height: 1.5;">${message}</div>
                <div style="padding: 16px 24px 24px 24px; border-top: 1px solid #e2e8f0;">
                    <div style="height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div id="auto-close-timer-bar" style="width: 100%; height: 100%; background: ${confirmColor}; border-radius: 2px; animation: shrink ${autoClose / 1000}s linear forwards;"></div>
                    </div>
                    <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 8px;">${Math.ceil(autoClose / 1000)}秒后自动关闭</div>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 添加动画样式
            if (!document.querySelector('#dialog-animation-style')) {
                const style = document.createElement('style');
                style.id = 'dialog-animation-style';
                style.textContent = `
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(30px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes shrink {
                        from { width: 100%; }
                        to { width: 0%; }
                    }
                    @keyframes fadeOut {
                        from { opacity: 1; }
                        to { opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }

            let timeoutId = setTimeout(() => {
                close();
            }, autoClose);

            const close = () => {
                clearTimeout(timeoutId);
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    if (overlay && overlay.remove) {
                        overlay.remove();
                    }
                    resolve(true);
                }, 200);
            };

            // 点击弹框可以提前关闭
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
                close();
            });

            console.log('Auto-close dialog shown');
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
        desktopNotification: document.getElementById('desktopNotification'),  // 新增
        lockNotification: document.getElementById('lockNotification'),        // 新增
        lockSettingsTitle: document.getElementById('lockSettingsTitle'),      // 新增
        lockSettingsContent: document.getElementById('lockSettingsContent'), // 新增
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

    // 添加通知类型切换事件
    if (elements.desktopNotification && elements.lockNotification) {
        elements.desktopNotification.addEventListener('change', (e) => {
            if (e.target.checked) {
                Config.updateNotificationHint('desktop');
                Config.save();
            }
        });
        
        elements.lockNotification.addEventListener('change', (e) => {
            if (e.target.checked) {
                Config.updateNotificationHint('lock');
                Config.save();
            }
        });
    }

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
        onReminderTrigger: async (notificationType) => {
            console.log('[APP] onReminderTrigger called, notificationType:', notificationType);
            
            // 记录活动统计
            StatsModule.recordActivity();
    
            // 只有桌面通知模式才发送桌面通知
            if (notificationType === 'desktop') {
                console.log('[APP] Desktop mode - sending notification');
                const sent = await NotificationModule.sendReminder();
                console.log('[APP] Notification sent:', sent);
            } else {
                console.log('[APP] Lock mode - skipping desktop notification');
            }
        },
        onLockClose: () => {
            console.log('[APP] onLockClose called - resetting states');
            // 锁屏关闭后，重新调度下一次提醒
            if (ReminderModule.isReminderRunning()) {
                const now = new Date();
                const config = Config.load();
                const next = ReminderModule.calculateNextReminder(now, config);
                ReminderModule.setNextReminderTime(next.getTime());
                UIModule.updateNextReminderDisplay(next.getTime());
                ReminderModule.startCheckLoop();
            }
            AudioModule.stopContinuous();
        }
    });

    // 设置音频模块的 locked getter
    AudioModule.setLockedGetter(() => ReminderModule.isCurrentlyLocked());

    // 注册 Service Worker
    if ('serviceWorker' in navigator && !window.require) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('Service Worker registered:', reg);
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
        const intervalMin = parseInt(elements.intervalMinutes.min) || 10;
        const intervalMax = parseInt(elements.intervalMinutes.max) || 300;
        const lockValue = elements.lockMinutes.value || 5;
        const lockMin = parseInt(elements.lockMinutes.min) || 1;
        const lockMax = parseInt(elements.lockMinutes.max) || 30;

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
        const intervalMin = parseInt(elements.intervalMinutes.min) || 10;
        const intervalMax = parseInt(elements.intervalMinutes.max) || 300;
        const intervalStep = parseInt(elements.intervalMinutes.step) || 5;
        const lockValue = elements.lockMinutes.value || 5;
        const lockMin = parseInt(elements.lockMinutes.min) || 1;
        const lockMax = parseInt(elements.lockMinutes.max) || 30;
        const fixedInterval = Config.fixIntervalValue(intervalValue, intervalMin, intervalMax, intervalStep);
        const fixedLock = Config.fixLockValue(lockValue, lockMin, lockMax);
        elements.intervalMinutes.value = fixedInterval;
        elements.lockMinutes.value = fixedLock;
        validateAndShowErrors();
    }

    // 切换锁屏设置显示/隐藏
    function toggleLockSettings(notificationType) {
        const titleEl = elements.lockSettingsTitle;
        const contentEl = elements.lockSettingsContent;
        
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

    // 挂载到 window，供 config.js 调用
    window.toggleLockSettings = toggleLockSettings;

    // 添加通知类型切换事件
    if (elements.desktopNotification && elements.lockNotification) {
        elements.desktopNotification.addEventListener('change', (e) => {
            if (e.target.checked) {
                Config.updateNotificationHint('desktop');
                toggleLockSettings('desktop');  // 隐藏锁屏设置
                Config.save();
            }
        });
        
        elements.lockNotification.addEventListener('change', (e) => {
            if (e.target.checked) {
                Config.updateNotificationHint('lock');
                toggleLockSettings('lock');  // 显示锁屏设置
                Config.save();
            }
        });
    }

    // 在启动闹铃时检查通知权限
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
    
        const notificationType = Config.get('notificationType');
        console.log('[APP] Notification type:', notificationType);
        
        // 如果是桌面通知模式，初始化通知模块（非阻塞）
        if (notificationType === 'desktop') {
            // 使用非阻塞初始化，不等待权限请求
            NotificationModule.initWithoutWait();
            console.log('[APP] Notification module initialized (non-blocking)');
        }
    
        // 初始化音频（非阻塞）
        await AudioModule.resume();
    
        Config.save();
    
        const now = new Date();
        const config = Config.load();
        console.log('Config loaded for start:', config);
    
        const next = ReminderModule.calculateNextReminder(now, config);
        ReminderModule.setNextReminderTime(next.getTime());
    
        ReminderModule.start(config);
        ReminderModule.startCheckLoop();
    
        UIModule.updateUI(true);
        UIModule.updateNextReminderDisplay(next.getTime());
    
        const modeText = notificationType === 'desktop' ? '桌面通知' : '锁屏通知';
        showAutoCloseDialog({
            title: '启动成功',
            message: `闹铃已启动（${modeText}模式），将在 ${next.toLocaleTimeString()} 开始提醒`,
            autoClose: 3000,
            confirmColor: '#22c55e'
        });
    
        console.log('Alarm started, next reminder at:', new Date(next.getTime()));
    }


    // 停止闹铃
    function stopAlarm() {
        console.log('stopAlarm called');
        ReminderModule.stop(AudioModule);
        UIModule.updateUI(false);
        UIModule.updateNextReminderDisplay(null);
        
        // 显示停止成功提示
        showAutoCloseDialog({
            title: '闹铃已停止',
            message: '闹铃已关闭，记得定时起来活动哦！',
            autoClose: 2000,
            confirmColor: '#64748b'
        });
    }

    // 解锁处理
    async function onUnlock() {
        console.log('onUnlock called');
        if (!ReminderModule.isCurrentlyLocked()) {
            console.log('Not locked, returning');
            return;
        }

        const forceLock = Config.get('forceLock');
        console.log('forceLock:', forceLock);
        
        // 调用 unlock 方法检查状态
        const unlocked = ReminderModule.unlock(forceLock);
        console.log('unlocked result:', unlocked);
        
        if (!unlocked && !forceLock) {
            // 非强制锁定且时间未到，显示确认对话框
            console.log('Showing confirm dialog inside lock overlay');
            
            // 获取锁屏弹框元素
            const lockOverlayEl = document.getElementById('lockOverlay');
            
            if (lockOverlayEl && lockOverlayEl.classList.contains('hidden') === false) {
                // 在锁屏弹框内部创建确认弹框
                showConfirmDialogInsideLock({
                    title: '提前结束提醒',
                    message: '活动时间还没到，提前结束可能会影响健康习惯。<br>确定要提前结束吗？',
                    confirmText: '提前结束',
                    cancelText: '继续活动',
                    confirmColor: '#f59e0b'
                }).then((confirmed) => {
                    console.log('confirmed:', confirmed);
                    if (confirmed) {
                        console.log('Closing lock screen');
                        ReminderModule.closeLockScreen();
                        AudioModule.stopContinuous();
                    }
                });
            } else {
                // 降级方案：使用普通弹框
                const confirmed = await showConfirmDialog({
                    title: '提前结束提醒',
                    message: '活动时间还没到，提前结束可能会影响健康习惯。<br>确定要提前结束吗？',
                    confirmText: '提前结束',
                    cancelText: '继续活动',
                    confirmColor: '#f59e0b'
                });
                if (confirmed) {
                    ReminderModule.closeLockScreen();
                    AudioModule.stopContinuous();
                }
            }
        } else if (unlocked) {
            // 时间已到，直接关闭
            console.log('Time is up, closing lock screen');
            ReminderModule.closeLockScreen();
            AudioModule.stopContinuous();
        } else {
            console.log('Force lock enabled or cannot unlock early');
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
            
            showAutoCloseDialog({
                title: '重置成功',
                message: '今日统计已重置',
                autoClose: 1500,
                confirmColor: '#22c55e'
            });
        }
    }

    async function testNotification() {
        const notificationType = Config.get('notificationType');
        console.log('[APP] testNotification called, type:', notificationType);
        
        if (notificationType === 'desktop') {
            const sent = await NotificationModule.sendTest();
            if (!sent) {
                await showConfirmDialog({
                    title: '通知发送失败',
                    message: '请检查 Windows 通知设置，确保已允许此应用发送通知。',
                    confirmText: '知道了',
                    cancelText: '',
                    confirmColor: '#667eea'
                });
            } else {
                showAutoCloseDialog({
                    title: '通知测试成功',
                    message: '桌面通知已开启，您将收到提醒',
                    autoClose: 2000,
                    confirmColor: '#22c55e'
                });
            }
        } else {
            // 锁屏模式 - 显示提示
            showAutoCloseDialog({
                title: '锁屏通知模式',
                message: '当前为锁屏通知模式，提醒时将全屏锁屏',
                autoClose: 2000,
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
    Config.save(); // 保存配置，确保配置文件被创建
    StatsModule.load(); // 加载统计数据
    StatsModule.save(); // 保存统计数据，确保统计文件被创建
    // 修复可能的连续打卡数据错误
    StatsModule.fixContinuousDays(); 

    // 根据当前通知类型设置锁屏设置显示状态
    const currentNotificationType = Config.get('notificationType');
    toggleLockSettings(currentNotificationType);

    fixValues();
    UIModule.initStatsSubscription();
    UIModule.updateUI(false);
    ReminderModule.closeLockScreen();
    NotificationModule.initWithoutWait();

    logger.info('App initialized');

    // 页面关闭提醒
    window.addEventListener('beforeunload', (e) => {
        if (ReminderModule.isReminderRunning()) {
            e.preventDefault();
            e.returnValue = '闹铃正在运行，确定要离开吗？';
        }
    });

    if (window.require) {
        try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('stop-sound', () => {
                console.log('[APP] Received stop-sound from main process');
                AudioModule.stopContinuous();
            });
            ipcRenderer.on('lock-closed', () => {
                console.log('[APP] Received lock-closed from main process');
                ReminderModule.resetLockStates();
                
                if (ReminderModule.isReminderRunning()) {
                    const now = new Date();
                    const config = Config.load();
                    const next = ReminderModule.calculateNextReminder(now, config);
                    ReminderModule.setNextReminderTime(next.getTime());
                    UIModule.updateNextReminderDisplay(next.getTime());
                }
                
                ReminderModule.startCheckLoop();
                AudioModule.stopContinuous();
            });
        } catch (e) {
            console.error('[APP] Failed to setup IPC listener:', e);
        }
    }
})();