// 应用常量配置
const CONFIG = Object.freeze({
    // 工作时间设置（用于计算）
    WORK_HOURS: Object.freeze({
        START: 8,
        END: 18,
        HOURS_PER_DAY: 10
    }),
    // 目标设置
    TARGETS: Object.freeze({
        PER_DAY: 10,           // 每日目标次数
        PER_WEEK: 50,          // 每周目标次数（5天 * 10次）
        WORK_DAYS_PER_WEEK: 5  // 每周工作天数
    }),
    // 文件配置
    FILES: Object.freeze({
        CONFIG: 'user_clock_config.json',
        STATS: 'user_clock_stats.json',
        USER_DATA_DIR: 'User_Data',
        LOG_DIR: 'Logs'
    }),
    // 时间设置
    TIME: Object.freeze({
        DEFAULT_INTERVAL: 40,   // 默认提醒间隔（分钟）
        DEFAULT_LOCK: 5,        // 默认锁屏时长（分钟）
        MIN_INTERVAL: 10,       // 最小提醒间隔（分钟）
        MAX_INTERVAL: 300,      // 最大提醒间隔（分钟）
        MIN_LOCK: 1,            // 最小锁屏时长（分钟）
        MAX_LOCK: 30            // 最大锁屏时长（分钟）
    }),
    // 免打扰设置
    DO_NOT_DISTURB: Object.freeze({
        DEFAULT_LUNCH_START: '12:00',
        DEFAULT_LUNCH_END: '14:00',
        MAX_CUSTOM_BREAKS: 5
    }),
    // 通知类型
    NOTIFICATION_TYPE: Object.freeze({
        DESKTOP: 'desktop',     // 桌面通知（不锁屏）
        LOCK: 'lock'            // 锁屏通知
    }),
    // 版本信息
    VERSION: '0.6.0'
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}