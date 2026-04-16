/**
 * 统计控制器 - 处理统计相关操作
 */
const StatsController = (function() {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('StatsController') : console;
    
    /**
     * 重置统计
     */
    async function reset() {
        const confirmed = await ConfirmDialog.show({
            title: '重置今日统计',
            message: '确定要重置今日的活动记录吗？',
            confirmText: '重置',
            cancelText: '取消',
            confirmColor: '#ef4444'
        });
        
        if (confirmed) {
            StatsModule.resetToday();
            UIModule.updateStatsDisplay(StatsModule.load());
            
            AutoCloseDialog.show({
                title: '重置成功',
                message: '今日统计已重置',
                autoClose: 1500,
                confirmColor: '#22c55e'
            });
        }
    }
    
    return { reset };
})();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsController;
}
if (typeof window !== 'undefined') {
    window.StatsController = StatsController;
}