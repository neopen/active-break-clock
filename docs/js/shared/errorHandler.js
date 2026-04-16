// 错误处理机制
const ErrorHandler = (function () {
    // 处理错误
    function handle(error, context = '') {
        const errorMessage = context ? `[${context}] ` : '';
        console.error(`${errorMessage}Error:`, error);
        
        // 可以在这里添加错误上报逻辑
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
            // 发送到错误监控服务
            // 例如：sendErrorToMonitoringService(error, context);
        }
    }
    
    // 安全执行函数
    function safeExecute(fn, context = '', defaultValue = null) {
        try {
            return fn();
        } catch (error) {
            handle(error, context);
            return defaultValue;
        }
    }
    
    // 异步安全执行函数
    async function safeExecuteAsync(fn, context = '', defaultValue = null) {
        try {
            return await fn();
        } catch (error) {
            handle(error, context);
            return defaultValue;
        }
    }
    
    // 验证配置
    function validateConfig(config) {
        const errors = [];
        
        if (!config) {
            errors.push('配置对象不能为空');
            return errors;
        }
        
        // 验证时间设置
        if (config.intervalMinutes) {
            if (typeof config.intervalMinutes !== 'number' || config.intervalMinutes < 1 || config.intervalMinutes > 300) {
                errors.push('提醒间隔必须在1-300分钟之间');
            }
        }
        
        if (config.lockMinutes) {
            if (typeof config.lockMinutes !== 'number' || config.lockMinutes < 1 || config.lockMinutes > 30) {
                errors.push('锁屏时间必须在1-30分钟之间');
            }
        }
        
        return errors;
    }
    
    return {
        handle,
        safeExecute,
        safeExecuteAsync,
        validateConfig
    };
})();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
