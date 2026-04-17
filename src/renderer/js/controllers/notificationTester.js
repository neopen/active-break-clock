/**
 * 通知测试模块
 */
const NotificationTester = (function() {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('NotificationTester') : console;
    
    /**
     * 测试通知
     */
    async function test() {
        const notificationType = Config.get('notificationType');
        logger.info('Testing notification, type:', notificationType);
        
        if (notificationType === 'desktop') {
            const sent = await NotificationModule.sendTest();
            if (!sent) {
                await ConfirmDialog.show({
                    title: '通知发送失败',
                    message: '请检查 Windows 通知设置，确保已允许此应用发送通知。',
                    confirmText: '知道了',
                    cancelText: '',
                    confirmColor: '#667eea'
                });
            } else {
                AutoCloseDialog.show({
                    title: '通知测试成功',
                    message: '桌面通知已开启，您将收到提醒',
                    autoClose: 2000,
                    confirmColor: '#22c55e'
                });
            }
        } else {
            AutoCloseDialog.show({
                title: '锁屏通知模式',
                message: '当前为锁屏通知模式，提醒时将全屏锁屏',
                autoClose: 2000,
                confirmColor: '#667eea'
            });
        }
    }
    
    return { test };
})();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationTester;
}
if (typeof window !== 'undefined') {
    window.NotificationTester = NotificationTester;
}