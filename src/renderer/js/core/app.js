/**
 * 应用主入口 (App)
 * 功能：模块协调、环境适配、事件总线注册、异步初始化流程
 * 兼容：Neutralino / 浏览器 (已屏蔽 Electron 特定逻辑)
 * 优化：修复异步竞态、Promise 误传 UI、Neutralino 事件通道对齐
 */
(function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('App') : console;
    logger.info('=== App Initialization Sequence Started ===');

    // 1. 收集核心 DOM 元素
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

    // 2. 初始化各业务模块
    if (typeof Config !== 'undefined') Config.setElements(elements);
    if (typeof ReminderModule !== 'undefined') {
        ReminderModule.setElements({
            timerRing: elements.timerRing,
            countdownSpan: elements.countdownSpan,
            unlockBtn: elements.unlockBtn,
            lockOverlay: elements.lockOverlay
        });
    }
    if (typeof UIModule !== 'undefined') UIModule.setElements(elements);
    if (typeof ReminderModule !== 'undefined' && typeof Config !== 'undefined' && typeof AudioModule !== 'undefined') {
        ReminderModule.setModules(Config, AudioModule);
    }

    // 3. 设置提醒生命周期回调
    if (typeof ReminderModule !== 'undefined') {
        ReminderModule.setCallbacks({
            onReminderTrigger: async (notificationType) => {
                logger.info('Reminder triggered, type:', notificationType);
                if (typeof StatsModule !== 'undefined') await StatsModule.recordActivity();
                if (notificationType === 'desktop' && typeof NotificationModule !== 'undefined') {
                    await NotificationModule.sendReminder();
                }
            },
            onLockClose: async () => {
                logger.info('Lock closed, rescheduling next reminder');
                if (ReminderModule.isReminderRunning()) {
                    const now = new Date();
                    // 🔧 修复：正确获取最新配置
                    let config = {};
                    if (typeof Config !== 'undefined') {
                        // 方式1：如果有 getConfig 方法
                        if (typeof Config.getConfig === 'function') {
                            config = Config.getConfig();
                        } else {
                            // 方式2：逐个获取配置项
                            config = {
                                startTime: Config.get('startTime') || '08:00',
                                endTime: Config.get('endTime') || '18:00',
                                intervalMinutes: Config.get('intervalMinutes') || 40,
                                lockMinutes: Config.get('lockMinutes') || 5,
                                forceLock: Config.get('forceLock') || false,
                                soundEnabled: Config.get('soundEnabled') !== false,
                                notificationType: Config.get('notificationType') || 'desktop'
                            };
                        }
                    }
                    logger.info('[App] Rescheduling with config:', config);
                    const next = ReminderModule.calculateNextReminder(now, config);
                    ReminderModule.setNextReminderTime(next.getTime());
                    if (typeof UIModule !== 'undefined') UIModule.updateNextReminderDisplay(next.getTime());
                    ReminderModule.startCheckLoop();
                }
                if (typeof AudioModule !== 'undefined') AudioModule.stopContinuous();
            }
        });
    }

    // 4. 音频模块状态绑定
    if (typeof AudioModule !== 'undefined' && typeof ReminderModule !== 'undefined') {
        AudioModule.setLockedGetter(() => ReminderModule.isCurrentlyLocked());
    }

    // 5. 初始化 UI 控制器与免打扰模块
    if (typeof UIController !== 'undefined') UIController.init(elements);
    if (typeof DNDController !== 'undefined') DNDController.init();

    // 6. 绑定顶部按钮事件
    elements.startBtn?.addEventListener('click', () => {
        if (typeof AlarmController !== 'undefined') AlarmController.start();
    });
    elements.stopBtn?.addEventListener('click', () => {
        if (typeof AlarmController !== 'undefined') AlarmController.stop();
    });
    elements.unlockBtn?.addEventListener('click', () => {
        if (typeof LockController !== 'undefined') LockController.unlock();
    });
    elements.resetStatsBtn?.addEventListener('click', () => {
        if (typeof StatsController !== 'undefined') StatsController.reset();
    });
    elements.testNotifyBtn?.addEventListener('click', () => {
        if (typeof NotificationTester !== 'undefined') NotificationTester.test();
    });

    /**
     * 注册 Service Worker（严格限制为 Web 环境）
     */
    async function registerServiceWorker() {
        // Neutralino 与 Electron 为桌面环境，不依赖 SW
        if (typeof Neutralino !== 'undefined') {
            logger.info('Neutralino environment detected, skipping Service Worker');
            return;
        }
        if (!('serviceWorker' in navigator)) {
            logger.info('Browser does not support Service Worker');
            return;
        }
        const protocol = window.location.protocol;
        if (protocol !== 'http:' && protocol !== 'https:') {
            logger.warn('Service Worker skipped: Unsupported protocol', protocol);
            return;
        }
        try {
            await navigator.serviceWorker.register('./sw.js', { scope: './' });
            logger.info('Service Worker registered successfully');
        } catch (error) {
            logger.error('Service Worker registration failed:', error);
        }
    }

    // 延迟注册，避免阻塞首屏渲染
    setTimeout(registerServiceWorker, 1000);

    // 7. 开机自启开关（Neutralino 专属通道）
    const autoLaunchToggle = document.getElementById('autoLaunchToggle');
    if (autoLaunchToggle && typeof Neutralino !== 'undefined') {
        Neutralino.events.on('auto-launch-state', (data) => {
            autoLaunchToggle.checked = data.detail || false;
        });
        Neutralino.events.dispatch('get-auto-launch');

        autoLaunchToggle.addEventListener('change', async () => {
            Neutralino.events.dispatch('set-auto-launch', { enable: autoLaunchToggle.checked });
            logger.info('Auto-launch toggle changed via Neutralino events');
        });
    } else if (autoLaunchToggle) {
        // 非 Neutralino 环境禁用该功能
        autoLaunchToggle.checked = false;
        autoLaunchToggle.disabled = true;
        autoLaunchToggle.title = '仅桌面端支持开机自启设置';
    }

    // 8. 异步初始化核心数据流
    (async () => {
        try {
            if (typeof Config !== 'undefined') {
                await Config.load();
                // 根据配置初始化 UI 状态
                if (typeof UIController !== 'undefined') {
                    UIController.toggleLockSettings(Config.get('notificationType'));
                    UIController.fixValues();
                }
            }

            if (typeof StatsModule !== 'undefined') {
                // 修复：先 await 加载完成，再获取同步摘要传入 UI
                await StatsModule.load();
                StatsModule.fixContinuousDays();
                if (typeof UIModule !== 'undefined') {
                    UIModule.initStatsSubscription();
                    UIModule.updateStatsDisplay(StatsModule.getSummary());
                }
            }

            if (typeof UIModule !== 'undefined') UIModule.updateUI(false);
            if (typeof ReminderModule !== 'undefined') ReminderModule.closeLockScreen();
            if (typeof NotificationModule !== 'undefined') NotificationModule.initWithoutWait();

            logger.info('App initialization completed successfully');
        } catch (err) {
            logger.error('Critical error during app initialization:', err);
        }
    })();

    // 9. 页面关闭保护
    window.addEventListener('beforeunload', (e) => {
        if (typeof ReminderModule !== 'undefined' && ReminderModule.isReminderRunning()) {
            e.preventDefault();
            e.returnValue = '闹铃正在运行，确定要离开吗？';
        }
    });

    // 10. 监听统计更新事件（跨模块通信）
    window.addEventListener('stats-updated', (event) => {
        if (typeof UIModule !== 'undefined') UIModule.updateStatsDisplay(event.detail);
    });

    // 11. 注册 Neutralino 事件总线监听
    if (typeof Neutralino !== 'undefined') {
        Neutralino.events.on('stop-sound', () => {
            if (typeof AudioModule !== 'undefined') AudioModule.stopContinuous();
        });
        Neutralino.events.on('lock-closed', () => {
            if (typeof ReminderModule !== 'undefined') ReminderModule.resetLockStates();
            if (typeof ReminderModule !== 'undefined' && ReminderModule.isReminderRunning()) {
                const now = new Date();
                // 🔧 修复：正确获取最新配置
                let config = {};
                if (typeof Config !== 'undefined') {
                    if (typeof Config.getConfig === 'function') {
                        config = Config.getConfig();
                    } else {
                        config = {
                            startTime: Config.get('startTime') || '08:00',
                            endTime: Config.get('endTime') || '18:00',
                            intervalMinutes: Config.get('intervalMinutes') || 40,
                            lockMinutes: Config.get('lockMinutes') || 5,
                            forceLock: Config.get('forceLock') || false,
                            soundEnabled: Config.get('soundEnabled') !== false,
                            notificationType: Config.get('notificationType') || 'desktop'
                        };
                    }
                }
                logger.info('[App] lock-closed event, rescheduling with config:', config);
                const next = ReminderModule.calculateNextReminder(now, config);
                ReminderModule.setNextReminderTime(next.getTime());
                if (typeof UIModule !== 'undefined') UIModule.updateNextReminderDisplay(next.getTime());
                ReminderModule.startCheckLoop();
            }
            if (typeof AudioModule !== 'undefined') AudioModule.stopContinuous();
            logger.info('Received lock-closed event, rescheduling reminder');
        });
    }

})();