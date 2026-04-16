// 统计打卡模块
const FileSystemUtil = require('./fs-util.js');

const StatsModule = (function () {
    let _stats = null;
    let _listeners = [];
    let _useLocalFile = false;
    let _dataPath = '';

    // 固定标准值：8:00-18:00，每1小时一次，每天8次
    const STANDARD_TARGET_PER_DAY = 10 - 2;
    
    // 每周工作天数（周一至周五）
    const WORKDAYS_PER_WEEK = 5;
    
    // 每周标准目标次数 = 8次/天 × 5天 = 40次
    const STANDARD_TARGET_PER_WEEK = STANDARD_TARGET_PER_DAY * WORKDAYS_PER_WEEK;
    
    // 数据文件路径
    const DataFilePath = '/clock_stats.json';

    function initFileSystem() {
        if (typeof window !== 'undefined' && window.pake) {
            _useLocalFile = true;
            _dataPath = './user-data/';
            return true;
        }
        if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
            try {
                FileSystemUtil.init();
                const rootPath = FileSystemUtil.getRootPath();
                if (rootPath) {
                    _dataPath = require('path').join(rootPath, 'stat');
                    FileSystemUtil.ensureSubDir('stat');
                    _useLocalFile = true;
                    return true;
                }
            } catch (e) {
                console.warn('File system not available in stats:', e);
            }
        }
        return false;
    }

    function loadFromFile() {
        if (!_useLocalFile) return null;
        try {
            const filePath = _dataPath + DataFilePath;
            const data = FileSystemUtil.readFile(filePath);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) { }
        return null;
    }

    function saveToFile(data) {
        if (!_useLocalFile) return false;
        try {
            const filePath = _dataPath + DataFilePath;
            return FileSystemUtil.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (e) { }
        return false;
    }

    function load() {
        initFileSystem();

        const saved = _useLocalFile ? loadFromFile() : localStorage.getItem('activeBreakClockStats');
        const today = getTodayStr();

        if (saved) {
            try {
                _stats = typeof saved === 'string' ? JSON.parse(saved) : saved;
            } catch (e) {
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

        // 检查是否需要重置今日计数（新的一天）
        if (_stats.lastActivityDate !== today) {
            // 检查连续打卡
            if (_stats.lastActivityDate && isConsecutive(_stats.lastActivityDate, today)) {
                _stats.continuousDays++;
            } else if (_stats.lastActivityDate && _stats.lastActivityDate !== today) {
                _stats.continuousDays = 0;
            }
            _stats.todayCount = 0;
            _stats.lastActivityDate = today;
            save();
        }

        console.log('[Stats] Loaded stats:', _stats);
        return { ..._stats };
    }

    function getDefaultStats() {
        return {
            todayCount: 0,
            lastActivityDate: null,
            continuousDays: 0,
            weeklyRecords: {}
        };
    }

    function save() {
        localStorage.setItem('activeBreakClockStats', JSON.stringify(_stats));
        if (_useLocalFile) {
            saveToFile(_stats);
        }
        console.log('[Stats] Saved stats:', _stats);
        _listeners.forEach(fn => fn({ ..._stats }));
    }

    function getTodayStr() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function isConsecutive(lastDate, today) {
        const last = new Date(lastDate);
        const current = new Date(today);
        const diff = (current - last) / (1000 * 60 * 60 * 24);
        return diff === 1;
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

    function recordActivity() {
        const today = getTodayStr();
        const week = getWeekNumber(today);
        
        console.log('[Stats] ========== RECORD ACTIVITY ==========');
        console.log('[Stats] Today:', today);
        console.log('[Stats] Week:', week);
        console.log('[Stats] Before - todayCount:', _stats.todayCount, 'continuousDays:', _stats.continuousDays);

        if (_stats.lastActivityDate === today) {
            _stats.todayCount++;
            console.log('[Stats] Same day, increment to:', _stats.todayCount);
        } else {
            console.log('[Stats] New day, lastActivityDate:', _stats.lastActivityDate);
            
            if (_stats.lastActivityDate && isConsecutive(_stats.lastActivityDate, today)) {
                _stats.continuousDays++;
                console.log('[Stats] Consecutive! continuousDays:', _stats.continuousDays);
            } else if (_stats.lastActivityDate && _stats.lastActivityDate !== today) {
                _stats.continuousDays = 1;
                console.log('[Stats] Not consecutive, reset to 1');
            } else if (!_stats.lastActivityDate) {
                _stats.continuousDays = 1;
                console.log('[Stats] First time, set to 1');
            }
            _stats.todayCount = 1;
        }

        _stats.lastActivityDate = today;

        // 更新周记录
        if (!_stats.weeklyRecords) {
            _stats.weeklyRecords = {};
        }
        if (!_stats.weeklyRecords[week]) {
            _stats.weeklyRecords[week] = 0;
        }
        _stats.weeklyRecords[week]++;

        console.log('[Stats] After - todayCount:', _stats.todayCount, 'continuousDays:', _stats.continuousDays);
        console.log('[Stats] Weekly record for', week, ':', _stats.weeklyRecords[week]);
        console.log('[Stats] =======================================');
        
        save();
        return { ..._stats };
    }

    // 获取本周完成率（基于固定标准）
    function getWeeklyRate() {
        const today = getTodayStr();
        const week = getWeekNumber(today);
        
        if (!_stats.weeklyRecords) {
            _stats.weeklyRecords = {};
        }
        
        const currentCount = _stats.weeklyRecords[week] || 0;
        
        // 基于固定标准计算完成率
        let rate = 0;
        if (STANDARD_TARGET_PER_WEEK > 0) {
            rate = Math.min(100, Math.round((currentCount / STANDARD_TARGET_PER_WEEK) * 100));
        }
        
        console.log('[Stats] Weekly rate - week:', week, 'count:', currentCount, 'target:', STANDARD_TARGET_PER_WEEK, 'rate:', rate);
        
        return rate;
    }
    
    // 获取本周目标次数
    function getWeeklyTarget() {
        return STANDARD_TARGET_PER_WEEK;
    }
    
    // 获取每日目标次数
    function getDailyTarget() {
        return STANDARD_TARGET_PER_DAY;
    }
    
    // 获取本周已活动次数
    function getWeeklyCount() {
        const today = getTodayStr();
        const week = getWeekNumber(today);
        return _stats.weeklyRecords[week] || 0;
    }

    function resetToday() {
        _stats.todayCount = 0;
        save();
    }
    
    // 重置本周统计
    function resetWeek() {
        const today = getTodayStr();
        const week = getWeekNumber(today);
        if (_stats.weeklyRecords) {
            _stats.weeklyRecords[week] = 0;
        }
        _stats.todayCount = 0;
        save();
    }
    
    // 获取统计摘要
    function getSummary() {
        return {
            todayCount: _stats.todayCount,
            continuousDays: _stats.continuousDays,
            weeklyCount: getWeeklyCount(),
            weeklyTarget: STANDARD_TARGET_PER_WEEK,
            weeklyRate: getWeeklyRate(),
            dailyTarget: STANDARD_TARGET_PER_DAY
        };
    }

    function subscribe(listener) {
        _listeners.push(listener);
        return () => {
            _listeners = _listeners.filter(l => l !== listener);
        };
    }

    return {
        load,
        recordActivity,
        getWeeklyRate,
        getWeeklyTarget,
        getDailyTarget,
        getWeeklyCount,
        getSummary,
        resetToday,
        resetWeek,
        subscribe,
        getTodayStr
    };
})();