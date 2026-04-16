// 日志系统
const Logger = (function () {
    // 日志级别
    const LOG_LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    };
    
    // 当前日志级别
    let currentLevel = LOG_LEVELS.INFO;
    
    // 检查是否在开发环境
    function isDevelopment() {
        return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
    }
    
    // 初始化日志级别
    function init() {
        if (isDevelopment()) {
            currentLevel = LOG_LEVELS.DEBUG;
        }
    }
    
    // 格式化日志消息
    function formatMessage(moduleName, level, message, args) {
        const timestamp = new Date().toISOString();
        const levelStr = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
        const moduleStr = moduleName ? `[${moduleName}]` : '';
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        
        return `${timestamp} ${levelStr} ${moduleStr} ${messageStr}${args.length > 0 ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ') : ''}`;
    }
    
    // 调试日志
    function debug(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(formatMessage(moduleName, LOG_LEVELS.DEBUG, message, args));
        }
    }
    
    // 信息日志
    function info(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.log(formatMessage(moduleName, LOG_LEVELS.INFO, message, args));
        }
    }
    
    // 警告日志
    function warn(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(formatMessage(moduleName, LOG_LEVELS.WARN, message, args));
        }
    }
    
    // 错误日志
    function error(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            console.error(formatMessage(moduleName, LOG_LEVELS.ERROR, message, args));
        }
    }
    
    // 创建模块日志实例
    function createLogger(moduleName) {
        return {
            debug: (message, ...args) => debug(moduleName, message, ...args),
            info: (message, ...args) => info(moduleName, message, ...args),
            warn: (message, ...args) => warn(moduleName, message, ...args),
            error: (message, ...args) => error(moduleName, message, ...args)
        };
    }
    
    // 初始化
    init();
    
    return {
        createLogger,
        debug,
        info,
        warn,
        error
    };
})();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.Logger = Logger;
}
