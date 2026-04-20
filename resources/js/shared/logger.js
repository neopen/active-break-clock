/**
 * 日志系统 (Logger)
 * 功能：格式化日志、控制台输出、自动写入本地文件
 * 适配：Neutralino v6 (使用官方 filesystem API，兼容纯浏览器环境)
 * 路径：项目根目录 /logs/ 文件夹
 */
const Logger = (function () {
    const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    let currentLevel = LOG_LEVELS.INFO;
    let logDir = './logs';
    let logFilePath = null;
    let logBuffer = [];
    let flushTimer = null;

    /**
     * 初始化日志目录与文件路径（异步）
     * 在 Neutralino 环境下创建 ./logs 文件夹，失败则降级为仅控制台输出
     */
    async function initLogPath() {
        if (typeof Neutralino === 'undefined') return;
        try {
            // 创建 logs 目录（若已存在会抛异常，安全忽略）
            try { await Neutralino.filesystem.createDirectory(logDir); } catch (e) { }

            const today = new Date().toISOString().split('T')[0];
            logFilePath = `${logDir}/HealthClock_${today}.log`;
        } catch (err) {
            console.error('[Logger] 初始化日志路径失败:', err);
        }
    }

    /**
     * 防抖批量写入日志（1秒合并一次，避免频繁磁盘 IO 阻塞主线程）
     */
    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(async () => {
            flushTimer = null;
            if (logBuffer.length === 0 || !logFilePath) return;

            const content = logBuffer.join('\n') + '\n';
            logBuffer = [];

            try {
                // Neutralino 官方追加写入 API
                await Neutralino.filesystem.appendFile(logFilePath, content);
            } catch (e) {
                console.error('[Logger] 写入日志文件失败:', e);
            }
        }, 1000);
    }

    /**
     * 格式化日志字符串
     */
    function format(level, moduleName, message, args) {
        const ts = new Date().toISOString();
        const lvl = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'INFO';
        const mod = moduleName ? `[${moduleName}]` : '';
        const argStr = args.length > 0
            ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
            : '';
        return `${ts} ${lvl} ${mod} ${message}${argStr}`;
    }

    /**
     * 核心日志分发
     */
    function log(level, moduleName, message, ...args) {
        if (level < currentLevel) return;
        const formatted = format(level, moduleName, message, args);

        // 1. 输出到控制台
        if (level >= LOG_LEVELS.ERROR) console.error(formatted);
        else if (level >= LOG_LEVELS.WARN) console.warn(formatted);
        else console.log(formatted);

        // 2. 写入本地文件（仅 Neutralino 环境生效）
        if (typeof Neutralino !== 'undefined' && logFilePath) {
            logBuffer.push(formatted);
            scheduleFlush();
        }
    }

    /**
     * 创建模块专属日志实例
     */
    function createLogger(moduleName) {
        return {
            debug: (m, ...a) => log(LOG_LEVELS.DEBUG, moduleName, m, ...a),
            info: (m, ...a) => log(LOG_LEVELS.INFO, moduleName, m, ...a),
            warn: (m, ...a) => log(LOG_LEVELS.WARN, moduleName, m, ...a),
            error: (m, ...a) => log(LOG_LEVELS.ERROR, moduleName, m, ...a)
        };
    }

    // 模块加载时自动初始化路径
    initLogPath();

    return { createLogger };
})();

// UMD 导出：兼容 CommonJS 与浏览器全局变量
if (typeof module !== 'undefined' && module.exports) module.exports = Logger;
if (typeof window !== 'undefined') window.Logger = Logger;