/**
 * 统计控制器 (StatsController)
 * 功能：处理统计数据的重置、修正与 UI 刷新
 * 兼容：Neutralino / 浏览器
 * 优化：修复异步 load() 返回值未 await 导致的 UI 显示 Promise 对象问题
 */
const StatsController = (function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('StatsController') : console;

    /**
     * 重置今日与本周统计
     * 流程：二次确认 -> 清空数据 -> 强制刷新 UI -> 显示提示
     */
    async function reset() {
        logger.info('请求重置统计数据...');
        const confirmed = typeof ConfirmDialog !== 'undefined'
            ? await ConfirmDialog.show({ title: '重置今日统计', message: '确定要清空今日与本周的活动记录吗？此操作不可恢复。', confirmText: '重置', cancelText: '取消', confirmColor: '#ef4444' })
            : confirm('确定要清空今日与本周的活动记录吗？');

        if (confirmed) {
            if (typeof StatsModule !== 'undefined') {
                StatsModule.resetToday();
                StatsModule.resetWeek();
                // 修复：await load() 获取真实数据，再传入 UI
                await StatsModule.load();
                if (typeof UIModule !== 'undefined') {
                    UIModule.updateStatsDisplay(StatsModule.getSummary());
                }
                logger.info('统计数据已重置，UI 已更新');
            }
            if (typeof AutoCloseDialog !== 'undefined') {
                AutoCloseDialog.show({ title: '重置成功', message: '今日与本周统计已清空', autoClose: 1500, confirmColor: '#22c55e' });
            }
        } else {
            logger.info('用户取消重置操作');
        }
    }

    return { reset };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = StatsController;
if (typeof window !== 'undefined') window.StatsController = StatsController;