/**
 * 应用主入口 - 负责初始化和协调各模块
 */
(function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('App') : console;

    logger.info('=== App Initialization ===');

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
            const result = await StatsModule.recordActivity();
            console.log('[App] StatsModule.recordActivity result:', result);

            if (notificationType === 'desktop') {
                await NotificationModule.sendReminder();
            }
        },
        onLockClose: () => {
            logger.info('Lock closed, rescheduling');
            if (ReminderModule.isReminderRunning()) {
                const now = new Date();
                const config = Config.load(); // 同步获取，因为 Config 已缓存
                const next = ReminderModule.calculateNextReminder(now, config);
                ReminderModule.setNextReminderTime(next.getTime());
                UIModule.updateNextReminderDisplay(next.getTime());
                ReminderModule.startCheckLoop();
            }
            AudioModule.stopContinuous();
        }
    });

    // 初始化免打扰设置
    if (typeof UIController !== 'undefined' && UIController.initDoNotDisturb) {
        UIController.initDoNotDisturb();
    }

    AudioModule.setLockedGetter(() => ReminderModule.isCurrentlyLocked());

    // 初始化 UI 控制器
    UIController.init(elements);

    if (typeof DNDController !== 'undefined') {
        DNDController.init();
        logger.info('DNDController initialized');
    }

    // 绑定按钮事件
    elements.startBtn?.addEventListener('click', () => AlarmController.start());
    elements.stopBtn?.addEventListener('click', () => AlarmController.stop());
    elements.unlockBtn?.addEventListener('click', () => LockController.unlock());
    elements.resetStatsBtn?.addEventListener('click', () => StatsController.reset());
    elements.testNotifyBtn?.addEventListener('click', () => NotificationTester.test());

    /**
     * 注册 Service Worker（带环境检测和错误处理）
     */
    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            logger.info('Service Worker not supported by browser');
            return false;
        }

        // Neutralino 和 Electron 环境跳过 Service Worker
        if (typeof Neutralino !== 'undefined' || window.require) {
            logger.info('Running in desktop environment, skipping Service Worker');
            return false;
        }

        const supportedProtocols = ['http:', 'https:'];
        const currentProtocol = window.location.protocol;

        if (!supportedProtocols.includes(currentProtocol)) {
            logger.warn('Service Worker registration skipped: Unsupported protocol');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.register('./sw.js', {
                scope: './'
            });
            logger.info('Service Worker registered successfully');
            return true;
        } catch (error) {
            logger.error('Service Worker registration failed:', error);
            return false;
        }
    }

    // 延迟注册 Service Worker
    setTimeout(() => registerServiceWorker(), 1000);

    // 开机自启动开关
    const autoLaunchToggle = document.getElementById('autoLaunchToggle');
    if (autoLaunchToggle) {
        if (typeof Neutralino !== 'undefined') {
            // 获取状态
            Neutralino.events.on('auto-launch-state', (data) => {
                autoLaunchToggle.checked = data.detail || false;
            });
            Neutralino.events.dispatch('get-auto-launch');

            // 设置状态
            autoLaunchToggle.addEventListener('change', async () => {
                Neutralino.events.dispatch('set-auto-launch', { enable: autoLaunchToggle.checked });
            });
        } else if (window.require) {
            // 兼容 Electron 环境
            const { ipcRenderer } = window.require('electron');
            const isAutoLaunch = ipcRenderer.sendSync('get-auto-launch');
            autoLaunchToggle.checked = isAutoLaunch;

            autoLaunchToggle.addEventListener('change', () => {
                const result = ipcRenderer.sendSync('set-auto-launch', autoLaunchToggle.checked);
                if (!result) {
                    autoLaunchToggle.checked = !autoLaunchToggle.checked;
                    if (typeof AutoCloseDialog !== 'undefined') {
                        AutoCloseDialog.show({
                            title: '设置失败',
                            message: '无法设置开机自启动，请检查权限',
                            autoClose: 2000,
                            confirmColor: '#ef4444'
                        });
                    }
                }
            });
        }
    }

    // 异步初始化主应用
    (async () => {
        // 加载配置和统计数据
        await Config.load();
        await Config.save();
        await StatsModule.load();
        await StatsModule.save();
        StatsModule.fixContinuousDays();

        // 根据当前通知类型设置锁屏设置显示状态
        UIController.toggleLockSettings(Config.get('notificationType'));

        // 初始化 UI
        UIController.fixValues();
        UIModule.initStatsSubscription();
        UIModule.updateUI(false);
        ReminderModule.closeLockScreen();
        NotificationModule.initWithoutWait();

        logger.info('App initialized successfully');
    })();

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

    // 监听事件 (Neutralinojs 或 Electron)
    if (typeof Neutralino !== 'undefined') {
        Neutralino.events.on('stop-sound', () => AudioModule.stopContinuous());
        Neutralino.events.on('lock-closed', () => {
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
    } else if (window.require) {
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
})();