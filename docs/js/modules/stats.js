// src/renderer/js/modules/stats.js
const StatsModule = (function () {
    let _stats = null;
    let _listeners = [];
    let _logger = Logger ? Logger.createLogger('Stats') : console;

    // 从本地文件加载
    function loadFromFile() {
        if (!FileSystemManager || !FileSystemManager.isUsingLocalFile()) return null;
        
        return ErrorHandler.safeExecute(() => {
            const fileSystemUtil = FileSystemManager.getFileSystemUtil();
            if (!fileSystemUtil) return null;
            
            const filePath = FileSystemManager.buildFilePath(CONFIG.FILES.STATS);
            if (!filePath) return null;
            
            const data = fileSystemUtil.readFile(filePath);
            if (data) {
                _logger.info('Loaded from file:', filePath);
                return JSON.parse(data);
            }
            return null;
        }, 'Stats.loadFromFile');
    }

    // 保存到本地文件
    function saveToFile(data) {
        if (!FileSystemManager || !FileSystemManager.isUsingLocalFile()) return false;
        
        return ErrorHandler.safeExecute(() => {
            const fileSystemUtil = FileSystemManager.getFileSystemUtil();
            if (!fileSystemUtil) return false;
            
            const filePath = FileSystemManager.buildFilePath(CONFIG.FILES.STATS);
            if (!filePath) return false;
            
            const result = fileSystemUtil.writeFile(filePath, JSON.stringify(data, null, 2));
            if (result) {
                _logger.info('Saved to file:', filePath);
            }
            return result;
        }, 'Stats.saveToFile', false);
    }

    // 获取默认统计数据
    function getDefaultStats() {
        return {
            todayCount: 0,
            lastActivityDate: null,
            continuousDays: 0,
            weeklyRecords: {}
        };
    }

    // 获取今天日期字符串
    function getTodayStr() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // 获取昨天日期字符串
    function getYesterdayStr() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    }

    // 获取当前周数（ISO周数，周一为一周开始）
    function getWeekNumber(dateStr) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        
        // 获取该年1月1日是星期几（0=周日, 1=周一, ...）
        const firstDayOfYear = new Date(year, 0, 1);
        const firstDayWeekday = firstDayOfYear.getDay();
        
        // 计算当前日期是当年的第几天
        const dayOfYear = Math.floor((date - firstDayOfYear) / (24 * 60 * 60 * 1000));
        
        // 计算周数（周一为一周的开始）
        let weekNum;
        if (firstDayWeekday <= 1) {
            weekNum = Math.floor(dayOfYear / 7) + 1;
        } else {
            const daysToFirstMonday = (8 - firstDayWeekday) % 7;
            if (dayOfYear < daysToFirstMonday) {
                weekNum = 1;
            } else {
                weekNum = Math.floor((dayOfYear - daysToFirstMonday) / 7) + 2;
            }
        }
        
        const weekStr = weekNum < 10 ? `W0${weekNum}` : `W${weekNum}`;
        return `${year}-${weekStr}`;
    }

    // 加载统计数据
    function load() {
        // 初始化文件系统
        if (FileSystemManager) {
            FileSystemManager.init();
        }

        let saved = null;
        
        // 优先从本地文件读取
        if (FileSystemManager && FileSystemManager.isUsingLocalFile()) {
            saved = loadFromFile();
        }
        
        // 回退到 localStorage
        if (!saved) {
            const localStorageData = localStorage.getItem('activeBreakClockStats');
            if (localStorageData) {
                try {
                    saved = JSON.parse(localStorageData);
                    _logger.info('Loaded from localStorage');
                } catch (e) {
                    _logger.warn('Failed to parse localStorage data:', e);
                }
            }
        }

        const today = getTodayStr();
        const yesterday = getYesterdayStr();

        if (saved) {
            try {
                _stats = typeof saved === 'string' ? JSON.parse(saved) : saved;
            } catch (e) {
                _logger.warn('Failed to parse saved data:', e);
                _stats = getDefaultStats();
            }
        } else {
            _stats = getDefaultStats();
        }

        // 确保必要字段存在
        if (!_stats.weeklyRecords) {
            _stats.weeklyRecords = {};
        }
        if (typeof _stats.continuousDays !== 'number') {
            _stats.continuousDays = 0;
        }
        if (typeof _stats.todayCount !== 'number') {
            _stats.todayCount = 0;
        }

        // 检查是否需要处理新的一天
        if (_stats.lastActivityDate !== today) {
            _logger.info('=== New Day Detection ===');
            _logger.info('Last activity date:', _stats.lastActivityDate);
            _logger.info('Today:', today);
            _logger.info('Yesterday:', yesterday);
            _logger.info('Before - continuousDays:', _stats.continuousDays, 'todayCount:', _stats.todayCount);
            
            // 判断是否是连续打卡
            const isConsecutive = (_stats.lastActivityDate === yesterday);
            
            if (_stats.lastActivityDate === null) {
                // 首次使用，不做任何重置
                _logger.info('First time use, no reset needed');
                // continuousDays 保持 0
            } else if (isConsecutive) {
                // 连续打卡：保持 continuousDays 不变（recordActivity 时会增加）
                _logger.info('Consecutive day! Keeping continuousDays at:', _stats.continuousDays);
            } else {
                // 中断打卡：重置连续天数
                _logger.info('Chain broken! Resetting continuousDays from', _stats.continuousDays, 'to 0');
                _stats.continuousDays = 0;
            }
            
            // 重置今日计数（因为新的一天还没有活动）
            _stats.todayCount = 0;
            _stats.lastActivityDate = today;
            
            _logger.info('After - continuousDays:', _stats.continuousDays, 'todayCount:', _stats.todayCount);
            _logger.info('=======================');
            
            // 保存更新后的状态
            save();
        } else {
            _logger.info('Same day, no reset needed. todayCount:', _stats.todayCount);
        }

        _logger.info('Loaded stats:', _stats);
        return { ..._stats };
    }

    // 记录活动
    function recordActivity() {
        if (!_stats) {
            _logger.error('Stats not initialized');
            return null;
        }
        
        const today = getTodayStr();
        const week = getWeekNumber(today);
        const yesterday = getYesterdayStr();
        
        _logger.info('========== RECORD ACTIVITY ==========');
        _logger.info('Today:', today);
        _logger.info('Week:', week);
        _logger.info('Before - todayCount:', _stats.todayCount, 'continuousDays:', _stats.continuousDays);
        _logger.info('Last activity date:', _stats.lastActivityDate);

        // 检查是否是第一次记录活动
        const isFirstActivityEver = (_stats.lastActivityDate === null);
        
        if (_stats.lastActivityDate === today) {
            // 同一天多次活动，只增加今日次数，不改变连续打卡
            _stats.todayCount++;
            _logger.info('Same day, increment todayCount to:', _stats.todayCount);
        } else {
            // 新的一天（或首次使用）
            const isConsecutiveDay = (_stats.lastActivityDate === yesterday);
            
            _logger.info('New day - yesterday:', yesterday, 'lastActivityDate:', _stats.lastActivityDate, 'isConsecutive:', isConsecutiveDay);
            
            // 重置今日计数为 1（本次活动）
            _stats.todayCount = 1;
            
            // 更新连续打卡天数
            if (isFirstActivityEver) {
                // 首次使用，连续打卡从 1 开始
                _stats.continuousDays = 1;
                _logger.info('First activity ever! continuousDays set to 1');
            } else if (isConsecutiveDay) {
                // 连续打卡，增加天数
                _stats.continuousDays++;
                _logger.info('Consecutive day! continuousDays increased to:', _stats.continuousDays);
            } else {
                // 不连续，重置为 1（今天算第一天）
                _stats.continuousDays = 1;
                _logger.info('Chain broken, reset continuousDays to 1');
            }
            
            _stats.lastActivityDate = today;
        }

        // 更新周记录
        if (!_stats.weeklyRecords) {
            _stats.weeklyRecords = {};
        }
        if (!_stats.weeklyRecords[week]) {
            _stats.weeklyRecords[week] = 0;
        }
        _stats.weeklyRecords[week]++;

        _logger.info('After - todayCount:', _stats.todayCount, 'continuousDays:', _stats.continuousDays);
        _logger.info('Weekly record for', week, ':', _stats.weeklyRecords[week]);
        _logger.info('=======================================');
        
        save();
        return { ..._stats };
    }

    // 保存统计数据
    function save() {
        // 保存到 localStorage
        localStorage.setItem('activeBreakClockStats', JSON.stringify(_stats));
        
        // 保存到本地文件
        if (FileSystemManager && FileSystemManager.isUsingLocalFile()) {
            saveToFile(_stats);
        }
        
        _logger.info('Saved stats');
        _listeners.forEach(fn => fn({ ..._stats }));
    }

    // 获取本周完成率（基于固定标准）
    function getWeeklyRate() {
        if (!_stats) {
            _logger.warn('Stats not initialized');
            return 0;
        }
        
        const today = getTodayStr();
        const week = getWeekNumber(today);
        
        if (!_stats.weeklyRecords) {
            _stats.weeklyRecords = {};
        }
        
        const currentCount = _stats.weeklyRecords[week] || 0;
        const weeklyTarget = CONFIG ? CONFIG.TARGETS.PER_WEEK : 40;
        
        // 基于固定标准计算完成率
        let rate = 0;
        if (weeklyTarget > 0) {
            rate = Math.min(100, Math.round((currentCount / weeklyTarget) * 100));
        }
        
        _logger.info('Weekly rate - week:', week, 'count:', currentCount, 'target:', weeklyTarget, 'rate:', rate);
        
        return rate;
    }
    
    // 获取本周目标次数
    function getWeeklyTarget() {
        return CONFIG ? CONFIG.TARGETS.PER_WEEK : 40;
    }
    
    // 获取每日目标次数
    function getDailyTarget() {
        return CONFIG ? CONFIG.TARGETS.PER_DAY : 8;
    }
    
    // 获取本周已活动次数
    function getWeeklyCount() {
        if (!_stats) return 0;
        
        const today = getTodayStr();
        const week = getWeekNumber(today);
        return _stats.weeklyRecords?.[week] || 0;
    }

    // 重置今日统计
    function resetToday() {
        if (!_stats) {
            _logger.error('Stats not initialized');
            return;
        }
        
        _logger.info('Resetting today count from', _stats.todayCount, 'to 0');
        _stats.todayCount = 0;
        save();
    }
    
    // 重置本周统计
    function resetWeek() {
        if (!_stats) {
            _logger.error('Stats not initialized');
            return;
        }
        
        const today = getTodayStr();
        const week = getWeekNumber(today);
        
        _logger.info('Resetting week stats for', week);
        if (_stats.weeklyRecords) {
            _stats.weeklyRecords[week] = 0;
        }
        _stats.todayCount = 0;
        save();
    }

    // 手动修正连续打卡天数（用于修复错误数据）
    function fixContinuousDays() {
        if (!_stats) {
            _logger.error('Stats not initialized');
            return;
        }
        
        const today = getTodayStr();
        const yesterday = getYesterdayStr();
        
        _logger.info('=== Fixing continuous days ===');
        _logger.info('Current continuousDays:', _stats.continuousDays);
        _logger.info('Last activity date:', _stats.lastActivityDate);
        _logger.info('Today:', today);
        _logger.info('Yesterday:', yesterday);
        
        let fixed = false;
        
        // 如果最后活动日期是昨天，说明连续打卡应该至少为 1
        if (_stats.lastActivityDate === yesterday) {
            if (_stats.continuousDays === 0) {
                _logger.info('Fixing: continuousDays should be at least 1, setting to 1');
                _stats.continuousDays = 1;
                fixed = true;
            }
        }
        
        // 如果最后活动日期既不是今天也不是昨天，说明链条已断
        if (_stats.lastActivityDate !== today && _stats.lastActivityDate !== yesterday) {
            if (_stats.lastActivityDate !== null && _stats.continuousDays > 0) {
                _logger.info('Fixing: chain broken, resetting continuousDays to 0');
                _stats.continuousDays = 0;
                fixed = true;
            }
        }
        
        // 如果有今日活动但连续打卡为0，修正为1
        if (_stats.todayCount > 0 && _stats.continuousDays === 0 && _stats.lastActivityDate === today) {
            _logger.info('Fixing: has activity today but continuousDays is 0, setting to 1');
            _stats.continuousDays = 1;
            fixed = true;
        }
        
        if (fixed) {
            save();
            _logger.info('After fix - continuousDays:', _stats.continuousDays);
        } else {
            _logger.info('No fix needed');
        }
        
        _logger.info('===============================');
    }

    // 重置连续打卡天数（调试用）
    function resetContinuousDays() {
        if (!_stats) {
            _logger.error('Stats not initialized');
            return;
        }
        
        _logger.info('Manually resetting continuousDays from', _stats.continuousDays, 'to 0');
        _stats.continuousDays = 0;
        save();
    }

    // 获取统计摘要
    function getSummary() {
        if (!_stats) {
            return {
                todayCount: 0,
                continuousDays: 0,
                weeklyCount: 0,
                weeklyTarget: getWeeklyTarget(),
                weeklyRate: 0,
                dailyTarget: getDailyTarget()
            };
        }
        
        return {
            todayCount: _stats.todayCount,
            continuousDays: _stats.continuousDays,
            weeklyCount: getWeeklyCount(),
            weeklyTarget: getWeeklyTarget(),
            weeklyRate: getWeeklyRate(),
            dailyTarget: getDailyTarget()
        };
    }

    // 订阅统计变化
    function subscribe(listener) {
        _listeners.push(listener);
        return () => {
            _listeners = _listeners.filter(l => l !== listener);
        };
    }

    return {
        load,
        save,
        recordActivity,
        getWeeklyRate,
        getWeeklyTarget,
        getDailyTarget,
        getWeeklyCount,
        getSummary,
        resetToday,
        resetWeek,
        subscribe,
        getTodayStr,
        fixContinuousDays,
        resetContinuousDays
    };
})();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsModule;
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.StatsModule = StatsModule;
}