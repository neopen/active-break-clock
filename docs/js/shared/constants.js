// 应用常量配置
const CONFIG = {
    // 工作时间设置
    WORK_HOURS: {
        START: 8,
        END: 18,
        HOURS_PER_DAY: 10
    },
    
    // 目标设置
    TARGETS: {
        PER_DAY: 8,
        PER_WEEK: 40,
        WORK_DAYS_PER_WEEK: 5
    },
    
    // 文件配置
    FILES: {
        CONFIG: 'user_clock_config.json',
        STATS: 'user_clock_stats.json',
        USER_DATA_DIR: 'User_Data',
        LOG_DIR: 'Logs'
    },
    
    // 时间设置
    TIME: {
        DEFAULT_INTERVAL: 40,
        DEFAULT_LOCK: 5,
        MIN_INTERVAL: 10,      // 修改为10分钟
        MAX_INTERVAL: 300,
        MIN_LOCK: 1,
        MAX_LOCK: 30
    },
    
    // 通知类型
    NOTIFICATION_TYPE: {
        DESKTOP: 'desktop',    // 桌面通知（不锁屏）
        LOCK: 'lock'           // 锁屏通知
    },
    
    // 版本信息
    VERSION: '0.5.0'
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}