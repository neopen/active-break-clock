/**
 * 锁屏控制器 (LockController)
 * 功能：处理锁屏界面的交互逻辑（提前解锁/强制锁屏/倒计时结束）
 * 兼容：Neutralino / 浏览器
 * 优化：修复异步对话框阻塞问题，增加安全状态检查
 */
const LockController = (function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('LockController') : console;

    /**
     * 处理用户点击解锁按钮
     * 逻辑：检查锁定状态 -> 判断是否强制锁屏 -> 弹出确认或直接关闭
     */
    async function unlock() {
        logger.info('收到解锁请求...');
        if (!ReminderModule.isCurrentlyLocked()) {
            logger.info('当前未处于锁屏状态，忽略请求');
            return;
        }

        const forceLock = typeof Config !== 'undefined' ? Config.get('forceLock') : false;
        logger.info('强制锁屏状态:', forceLock);

        // 尝试常规解锁
        const unlocked = ReminderModule.unlock(forceLock);
        logger.info('模块解锁返回值:', unlocked);

        if (!unlocked && !forceLock) {
            // 未到期且非强制，弹出二次确认
            logger.info('显示提前结束确认对话框');
            const lockOverlayEl = document.getElementById('lockOverlay');
            const confirmed = typeof LockConfirmDialog !== 'undefined' && lockOverlayEl && !lockOverlayEl.classList.contains('hidden')
                ? await LockConfirmDialog.show({ title: '提前结束提醒', message: '活动时间未到，提前结束可能影响健康习惯。确定要继续吗？', confirmText: '提前结束', cancelText: '继续活动', confirmColor: '#f59e0b' })
                : await (ConfirmDialog?.show({ title: '提前结束提醒', message: '活动时间未到，提前结束可能影响健康习惯。确定要继续吗？', confirmText: '提前结束', cancelText: '继续活动', confirmColor: '#f59e0b' }) || Promise.resolve(false));

            if (confirmed) {
                ReminderModule.closeLockScreen();
                if (typeof AudioModule !== 'undefined') AudioModule.stopContinuous();
                logger.info('用户确认提前结束，已关闭锁屏');
            } else {
                logger.info('用户取消提前结束，保持锁屏状态');
            }
        } else if (unlocked) {
            logger.info('倒计时已到期，自动关闭锁屏');
            ReminderModule.closeLockScreen();
            if (typeof AudioModule !== 'undefined') AudioModule.stopContinuous();
        } else {
            logger.info('强制锁屏已启用，禁止手动提前结束');
        }
    }

    return { unlock };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = LockController;
if (typeof window !== 'undefined') window.LockController = LockController;