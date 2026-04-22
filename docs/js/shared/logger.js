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

    // 安全地序列化任意值（特别是错误对象）
    function safeStringify(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';

        // 处理 Error 对象
        if (value instanceof Error) {
            return JSON.stringify({
                name: value.name,
                message: value.message,
                stack: value.stack,
                ...value
            }, null, 2);
        }

        // 处理普通对象/数组
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, (key, val) => {
                    // 处理循环引用
                    if (typeof val === 'object' && val !== null) {
                        if (val instanceof Error) {
                            return {
                                name: val.name,
                                message: val.message,
                                stack: val.stack
                            };
                        }
                    }
                    return val;
                }, 2);
            } catch (e) {
                return `[Unable to stringify: ${e.message}]`;
            }
        }

        // 其他类型直接转字符串
        return String(value);
    }

    // 格式化日志消息
    function formatMessage(moduleName, level, message, args) {
        const timestamp = new Date().toISOString();
        const levelStr = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
        const moduleStr = moduleName ? `[${moduleName}]` : '';
        const messageStr = typeof message === 'string' ? message : safeStringify(message);

        let argsStr = '';
        if (args.length > 0) {
            argsStr = ' ' + args.map(arg => {
                if (typeof arg === 'object') {
                    return safeStringify(arg);
                }
                return String(arg);
            }).join(' ');
        }

        return `${timestamp} ${levelStr} ${moduleStr} ${messageStr}${argsStr}`;
    }

    // 调试日志
    function debug(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            const formatted = formatMessage(moduleName, LOG_LEVELS.DEBUG, message, args);
            console.log(formatted);
        }
    }

    // 信息日志
    function info(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.INFO) {
            const formatted = formatMessage(moduleName, LOG_LEVELS.INFO, message, args);
            console.log(formatted);
        }
    }

    // 警告日志
    function warn(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.WARN) {
            const formatted = formatMessage(moduleName, LOG_LEVELS.WARN, message, args);
            console.warn(formatted);
        }
    }

    // 错误日志
    function error(moduleName, message, ...args) {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            const formatted = formatMessage(moduleName, LOG_LEVELS.ERROR, message, args);
            console.error(formatted);
            // 如果是 Error 对象，额外输出堆栈信息
            if (message instanceof Error || args.some(arg => arg instanceof Error)) {
                const errorObj = message instanceof Error ? message : args.find(arg => arg instanceof Error);
                if (errorObj && errorObj.stack) {
                    console.error('Stack trace:', errorObj.stack);
                }
            }
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