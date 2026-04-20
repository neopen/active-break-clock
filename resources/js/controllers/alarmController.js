/**
 * 闹铃控制器 (AlarmController)
 * 功能：处理闹铃的启动与停止逻辑，协调配置、提醒、音频与 UI 模块
 * 兼容：Neutralino / Electron / 浏览器
 * 注意：启动音频需依赖用户交互，故使用 async 包装
 */
const AlarmController = (function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('AlarmController') : console;

    /**
     * 启动闹铃
     */
    async function start() {
        logger.info('尝试启动闹铃...');

        // 1. 验证 UI 输入合法性
        if (typeof UIController !== 'undefined' && UIController.validateAndShowErrors) {
            if (!UIController.validateAndShowErrors()) {
                logger.warn('配置验证失败，中止启动流程');
                if (typeof ConfirmDialog !== 'undefined') {
                    await ConfirmDialog.show({ title: '配置无效', message: '请修正错误设置后再启动闹铃。', confirmText: '知道了', confirmColor: '#667eea' });
                }
                return;
            }
        }

        // 2. 防重复启动
        if (ReminderModule.isReminderRunning()) {
            logger.info('闹铃已在运行中，忽略重复触发');
            return;
        }

        const notificationType = typeof Config !== 'undefined' ? Config.get('notificationType') : 'desktop';
        logger.info('当前通知模式:', notificationType);

        // 3. 初始化音频上下文
        if (typeof AudioModule !== 'undefined') {
            await AudioModule.resume();
        }

        // 4. 将 UI 表单值同步至 Config 缓存并持久化
        if (typeof Config !== 'undefined') {
            await Config.save();
        }

        // 5. 计算下次提醒时间并启动核心模块
        const now = new Date();
        const config = typeof Config !== 'undefined' ? (Config.get('_config') || await Config.load()) : {};
        const next = ReminderModule.calculateNextReminder(now, config);
        ReminderModule.setNextReminderTime(next.getTime());

        ReminderModule.start(config);
        ReminderModule.startCheckLoop();

        // 6. 更新 UI 状态
        if (typeof UIModule !== 'undefined') {
            UIModule.updateUI(true);
            UIModule.updateNextReminderDisplay(next.getTime());
        }

        const modeText = notificationType === 'desktop' ? '桌面通知' : '锁屏通知';
        logger.info('闹铃启动成功，下次提醒时间:', next.toLocaleTimeString());

        // 7. 显示成功提示
        if (typeof AutoCloseDialog !== 'undefined') {
            AutoCloseDialog.show({
                title: '启动成功',
                message: `闹铃已启动（${modeText}模式），将在 ${next.toLocaleTimeString()} 开始提醒`,
                autoClose: 3000,
                confirmColor: '#22c55e'
            });
        }
    }

    /**
     * 停止闹铃
     */
    function stop() {
        logger.info('尝试停止闹铃...');
        ReminderModule.stop();

        if (typeof UIModule !== 'undefined') {
            UIModule.updateUI(false);
            UIModule.updateNextReminderDisplay(null);
        }

        logger.info('闹铃已停止');
        if (typeof AutoCloseDialog !== 'undefined') {
            AutoCloseDialog.show({
                title: '闹铃已停止',
                message: '闹铃已关闭，请保持定时活动习惯。',
                autoClose: 2000,
                confirmColor: '#64748b'
            });
        }
    }

    return { start, stop };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AlarmController;
if (typeof window !== 'undefined') window.AlarmController = AlarmController;