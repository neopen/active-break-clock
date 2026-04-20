/**
 * 通知测试模块 (NotificationTester)
 * 功能：验证桌面通知权限与发送链路是否正常
 * 兼容：Neutralino / Electron / 浏览器
 */
const NotificationTester = (function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('NotificationTester') : console;

    /**
     * 执行通知测试
     * 根据当前配置模式选择测试路径（桌面通知 / 锁屏模式）
     */
    async function test() {
        const notificationType = typeof Config !== 'undefined' ? Config.get('notificationType') : 'desktop';
        logger.info('开始测试通知，当前模式:', notificationType);

        if (notificationType === 'desktop') {
            if (typeof NotificationModule === 'undefined') {
                logger.error('NotificationModule 未加载');
                return;
            }
            const sent = await NotificationModule.sendTest();
            if (!sent) {
                logger.warn('通知发送失败，可能被系统拦截或权限未开启');
                if (typeof ConfirmDialog !== 'undefined') {
                    await ConfirmDialog.show({
                        title: '通知发送失败',
                        message: '请检查系统通知设置，确保已允许此应用发送通知。',
                        confirmText: '知道了',
                        confirmColor: '#667eea'
                    });
                }
            } else {
                logger.info('桌面通知测试发送成功');
                if (typeof AutoCloseDialog !== 'undefined') {
                    AutoCloseDialog.show({
                        title: '测试成功',
                        message: '桌面通知已开启，您应已收到提醒',
                        autoClose: 2000,
                        confirmColor: '#22c55e'
                    });
                }
            }
        } else {
            logger.info('当前为锁屏模式，不发送系统通知');
            if (typeof AutoCloseDialog !== 'undefined') {
                AutoCloseDialog.show({
                    title: '锁屏模式',
                    message: '当前为锁屏通知模式，提醒时将全屏阻断操作',
                    autoClose: 2000,
                    confirmColor: '#667eea'
                });
            }
        }
    }

    return { test };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NotificationTester;
if (typeof window !== 'undefined') window.NotificationTester = NotificationTester;