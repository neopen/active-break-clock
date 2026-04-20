// 错误处理机制
const ErrorHandler = (function () {
    // 优先绑定本地 Logger，降级到 console（避免 Neutralino 环境下未定义报错）
    const logger = (typeof window !== 'undefined' && window.Logger)
        ? window.Logger.createLogger('ErrorHandler')
        : { error: console.error, warn: console.warn, info: console.info };

    // 处理错误
    function handle(error, context = '') {
        const ctxStr = context ? `[${context}]` : '';
        logger.error(`${ctxStr} 发生异常`, error);
        // 生产环境可在此接入 Sentry 或自研监控服务上报
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

        if (!config || typeof config !== 'object') {
            errors.push('配置对象不能为空');
            return errors;
        }

        // 验证时间设置（强类型拦截，避免 NaN 或浮点数导致逻辑崩溃）
        if (config.intervalMinutes !== undefined) {
            const val = Number(config.intervalMinutes);
            if (!Number.isInteger(val) || val < 1 || val > 300) {
                errors.push('提醒间隔必须在 1-300 分钟之间');
            }
        }

        if (config.lockMinutes !== undefined) {
            const val = Number(config.lockMinutes);
            if (!Number.isInteger(val) || val < 1 || val > 30) {
                errors.push('锁屏时间必须在 1-30 分钟之间');
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
}