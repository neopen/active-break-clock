/**
 * 应用主入口 - 负责初始化和协调各模块
 */
(function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('App') : console;

    logger.info('=== App Initialization ===');

    // 手动初始化文件系统
    if (typeof FileSystemManager !== 'undefined') {
        FileSystemManager.init();
        logger.info('FileSystemManager initialized, using local file:', FileSystemManager.isUsingLocalFile());
    }

    // DOM 元素收集
    const elements = {
        startTime: document.getElementById('startTime'),
        endTime: document.getElementById('endTime'),
        intervalMinutes: document.getElementById('intervalMinutes'),
        lockMinutes: document.getElementById('lockMinutes'),
        forceLockToggle: document.getElementById('forceLockToggle'),
        soundToggle: document.getElementById('soundToggle'),
        desktopNotification: document.getElementById('desktopNotification'),
        lockNotification: document.getElementById('lockNotification'),
        lockSettingsTitle: document.getElementById('lockSettingsTitle'),
        lockSettingsContent: document.getElementById('lockSettingsContent'),
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
    ReminderModule.setModules(Config, AudioModule);

    // 设置提醒回调
    ReminderModule.setCallbacks({
        onReminderTrigger: async (notificationType) => {
            logger.info('Reminder triggered, type:', notificationType);
            const result = StatsModule.recordActivity();
            console.log('[App] StatsModule.recordActivity result:', result);

            if (notificationType === 'desktop') {
                await NotificationModule.sendReminder();
            }
        },
        onLockClose: () => {
            logger.info('Lock closed, rescheduling');
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

    AudioModule.setLockedGetter(() => ReminderModule.isCurrentlyLocked());

    // 初始化 UI 控制器
    UIController.init(elements);

    // 绑定按钮事件
    elements.startBtn?.addEventListener('click', () => AlarmController.start());
    elements.stopBtn?.addEventListener('click', () => AlarmController.stop());
    elements.unlockBtn?.addEventListener('click', () => LockController.unlock());
    elements.resetStatsBtn?.addEventListener('click', () => StatsController.reset());
    elements.testNotifyBtn?.addEventListener('click', () => NotificationTester.test());

    // 注册 Service Worker（非 Electron 环境）
    if ('serviceWorker' in navigator && !window.require) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => logger.info('Service Worker registered:', reg))
            .catch(err => logger.error('Service Worker registration failed:', err));
    }

    // 加载配置和统计数据
    Config.load();
    Config.save();
    StatsModule.load();
    StatsModule.save();
    StatsModule.fixContinuousDays();

    // 根据当前通知类型设置锁屏设置显示状态
    UIController.toggleLockSettings(Config.get('notificationType'));

    // 初始化 UI
    UIController.fixValues();
    UIModule.initStatsSubscription();
    UIModule.updateUI(false);
    ReminderModule.closeLockScreen();
    NotificationModule.initWithoutWait();

    // 页面关闭提醒
    window.addEventListener('beforeunload', (e) => {
        if (ReminderModule.isReminderRunning()) {
            e.preventDefault();
            e.returnValue = '闹铃正在运行，确定要离开吗？';
        }
    });

    // 监听统计更新事件
    window.addEventListener('stats-updated', (event) => {
        logger.info('stats-updated event received:', event.detail);
        UIModule.updateStatsDisplay(event.detail);
    });

    // Electron IPC 监听
    if (window.require) {
        try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('stop-sound', () => AudioModule.stopContinuous());
            ipcRenderer.on('lock-closed', () => {
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
            logger.error('Failed to setup IPC listener:', e);
        }
    }

    logger.info('App initialized successfully');
})();