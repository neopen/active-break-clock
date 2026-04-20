/**
 * 统计模块 (StatsModule)
 * 功能：记录用户打卡次数、连续天数、周完成率等健康数据
 * 兼容：Neutralino.storage 与 浏览器 localStorage
 * 依赖：Logger.js (提供标准化日志输出)
 */
const StatsModule = (function () {
    // 安全初始化 Logger：若主进程/渲染层已加载则使用，否则降级为 console
    const _logger = typeof Logger !== 'undefined' && typeof Logger.createLogger === 'function'
        ? Logger.createLogger('Stats')
        : { info: console.info, warn: console.warn, error: console.error, debug: console.debug };

    let _listeners = [];
    // 同步初始化默认状态对象，防止 UI 首次渲染时因异步加载未完成而显示 undefined
    let _stats = {
        todayCount: 0,
        lastActivityDate: null,
        continuousDays: 0,
        weeklyRecords: {},
        dailyRecords: {}
    };

    /**
     * 检测当前运行环境是否为 Neutralino
     * @returns {boolean}
     */
    function isNeutralino() {
        return typeof Neutralino !== 'undefined' && Neutralino.init;
    }

    /**
     * 获取当前日期字符串 (YYYY-MM-DD)
     * @returns {string}
     */
    function getTodayStr() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    /**
     * 获取昨天日期字符串 (YYYY-MM-DD)
     * @returns {string}
     */
    function getYesterdayStr() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    }

    /**
     * 计算指定日期的 ISO 周数 (格式: YYYY-Wxx)
     * 规则：以周一为每周第一天
     * @param {string} dateStr - 日期字符串
     * @returns {string}
     */
    function getWeekNumber(dateStr) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const firstDayWeekday = firstDayOfYear.getDay();
        const dayOfYear = Math.floor((date - firstDayOfYear) / (24 * 60 * 60 * 1000));

        let weekNum;
        if (firstDayWeekday <= 1) {
            weekNum = Math.floor(dayOfYear / 7) + 1;
        } else {
            const daysToFirstMonday = (8 - firstDayWeekday) % 7;
            weekNum = dayOfYear < daysToFirstMonday ? 1 : Math.floor((dayOfYear - daysToFirstMonday) / 7) + 2;
        }
        return `${year}-${weekNum < 10 ? 'W0' : 'W'}${weekNum}`;
    }

    /**
     * 格式化 Date 对象为 YYYY-MM-DD
     * @param {Date} date
     * @returns {string}
     */
    function formatDateStr(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    /**
     * 加载统计数据（异步）
     * 优先读取 Neutralino.storage，失败则降级至 localStorage
     * 自动处理跨天逻辑：重置今日计数，判断连续打卡是否中断
     * @returns {Promise<Object>} 当前统计状态
     */
    async function load() {
        _logger.info('开始加载统计数据...');
        const defaults = { ..._stats };
        let saved = null;

        // 1. 尝试从 Neutralino 持久化存储读取
        if (isNeutralino()) {
            try {
                const data = await Neutralino.storage.getData('stats');
                if (data) saved = JSON.parse(data);
            } catch (e) {
                // NE_ST_NOSTKEX 为首次启动无数据的正常状态，不打印警告
                if (e.code !== 'NE_ST_NOSTKEX') {
                    _logger.warn('从 Neutralino 存储读取失败:', e);
                }
            }
        }

        // 2. 降级尝试从浏览器 localStorage 读取
        if (!saved) {
            const localData = localStorage.getItem('healthAlarmStats');
            if (localData) {
                try { saved = JSON.parse(localData); }
                catch (e) { _logger.warn('解析 localStorage 历史数据失败:', e); }
            }
        }

        // 3. 合并数据与默认值，防御性编程确保对象结构完整
        if (saved) {
            _stats = { ...defaults, ...saved };
            _stats.weeklyRecords = _stats.weeklyRecords || {};
            _stats.dailyRecords = _stats.dailyRecords || {};
            _stats.continuousDays = typeof _stats.continuousDays === 'number' ? _stats.continuousDays : 0;
            _stats.todayCount = typeof _stats.todayCount === 'number' ? _stats.todayCount : 0;
        } else {
            _logger.info('未找到历史数据，初始化默认配置');
            _stats = defaults;
        }

        // 4. 跨天逻辑处理
        const today = getTodayStr();
        const yesterday = getYesterdayStr();

        if (_stats.lastActivityDate !== today) {
            _logger.info('检测到日期变更或首次启动，执行跨天校验');
            const isConsecutive = (_stats.lastActivityDate === yesterday);

            if (_stats.lastActivityDate === null) {
                _logger.info('首次使用，无需重置连续天数');
            } else if (isConsecutive) {
                _logger.info('昨日已打卡，保持连续天数:', _stats.continuousDays);
            } else {
                _logger.info('打卡链条已中断（非连续日期），重置连续天数为 0');
                _stats.continuousDays = 0;
            }

            // 新的一天，今日计数归零，更新日期标记
            _stats.todayCount = 0;
            _stats.lastActivityDate = today;
            await save(); // 立即持久化新日期状态
        }

        _logger.info('统计数据加载完成');
        return { ..._stats };
    }

    /**
     * 保存统计数据（异步）
     * 同步写入 localStorage 与 Neutralino.storage，并通知所有 UI 订阅者
     */
    async function save() {
        const dataStr = JSON.stringify(_stats);
        localStorage.setItem('healthAlarmStats', dataStr);

        if (isNeutralino()) {
            try {
                await Neutralino.storage.setData('stats', dataStr);
                _logger.debug('数据已同步至 Neutralino.storage');
            } catch (e) {
                _logger.error('同步至 Neutralino.storage 失败:', e);
            }
        }
        // 触发订阅回调，实现 UI 响应式更新
        _listeners.forEach(fn => fn({ ..._stats }));
    }

    /**
     * 记录一次打卡活动
     * 更新今日计数、连续天数、每日记录与周记录
     * @returns {Promise<Object|null>} 更新后的状态，若未初始化则返回 null
     */
    async function recordActivity() {
        if (!_stats) {
            _logger.error('统计数据未初始化，无法记录活动');
            return null;
        }

        const today = getTodayStr();
        const week = getWeekNumber(today);
        const yesterday = getYesterdayStr();

        _logger.info('记录打卡活动...');

        // 更新每日原始记录（用于周完成率计算）
        if (!_stats.dailyRecords[today]) _stats.dailyRecords[today] = 0;
        _stats.dailyRecords[today]++;

        const isFirstEver = (_stats.lastActivityDate === null);
        const isSameDay = (_stats.lastActivityDate === today);
        const isConsecutive = (_stats.lastActivityDate === yesterday);

        // 核心状态机：根据日期关系更新计数与连续天数
        if (isSameDay) {
            _stats.todayCount++;
            _logger.info('今日重复打卡，当前次数:', _stats.todayCount);
            // 边界修复：若连续天数意外为 0 但今日有活动，强制修正为 1
            if (_stats.continuousDays === 0 && _stats.todayCount > 0) {
                _stats.continuousDays = 1;
                _logger.warn('自动修正异常连续天数: 0 -> 1');
            }
        } else {
            _stats.todayCount = 1; // 新的一天，重置今日计数
            if (isFirstEver) {
                _stats.continuousDays = 1;
                _logger.info('首次打卡，连续天数设为 1');
            } else if (isConsecutive) {
                _stats.continuousDays++;
                _logger.info('连续打卡成功，当前天数:', _stats.continuousDays);
            } else {
                _stats.continuousDays = 1;
                _logger.info('中断后重新打卡，连续天数重置为 1');
            }
            _stats.lastActivityDate = today; // 更新最后活动日期
        }

        // 更新本周累计记录
        if (!_stats.weeklyRecords[week]) _stats.weeklyRecords[week] = 0;
        _stats.weeklyRecords[week]++;

        await save();
        _logger.info('活动记录完成');
        return { ..._stats };
    }

    /**
     * 获取本周完成率
     * 算法：周一至周五，每日占比 = MIN(实际次数 / 目标次数, 1) * 20%，总和为本周完成率
     * @returns {number} 0-100 的整数
     */
    function getWeeklyRate() {
        if (!_stats) return 0;
        // 安全读取配置，防止 CONFIG 未定义时报错
        const dailyTarget = typeof CONFIG !== 'undefined' ? CONFIG.TARGETS.PER_DAY : 10;
        const workDaysPerWeek = typeof CONFIG !== 'undefined' ? CONFIG.TARGETS.WORK_DAYS_PER_WEEK : 5;

        const now = new Date();
        const dayOffset = now.getDay() === 0 ? 6 : now.getDay() - 1; // 计算距周一的偏移量
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOffset);
        monday.setHours(0, 0, 0, 0);

        let totalRate = 0;
        for (let i = 0; i < workDaysPerWeek; i++) {
            const checkDate = new Date(monday);
            checkDate.setDate(monday.getDate() + i);
            const dateStr = formatDateStr(checkDate);
            const dayCount = _stats.dailyRecords?.[dateStr] || 0;

            // 单日最高贡献 20%，超额不累计
            totalRate += Math.min(dayCount / dailyTarget, 1) * 20;
        }
        return Math.round(totalRate);
    }

    function getWeeklyTarget() { return typeof CONFIG !== 'undefined' ? CONFIG.TARGETS.PER_WEEK : 40; }
    function getDailyTarget() { return typeof CONFIG !== 'undefined' ? CONFIG.TARGETS.PER_DAY : 10; }

    function getWeeklyCount() {
        if (!_stats) return 0;
        const week = getWeekNumber(getTodayStr());
        return _stats.weeklyRecords?.[week] || 0;
    }

    function resetToday() {
        if (!_stats) return;
        _logger.info('手动重置今日统计');
        _stats.todayCount = 0;
        save();
    }

    function resetWeek() {
        if (!_stats) return;
        const week = getWeekNumber(getTodayStr());
        _logger.info('手动重置本周统计');
        if (_stats.weeklyRecords) _stats.weeklyRecords[week] = 0;
        _stats.todayCount = 0;
        save();
    }

    /**
     * 自动修正连续打卡天数（用于修复异常数据或跨周丢失）
     */
    function fixContinuousDays() {
        if (!_stats) return;
        const today = getTodayStr();
        const yesterday = getYesterdayStr();
        let fixed = false;

        // 规则1：最后活动日是昨天，但连续天数为 0 -> 修正为 1
        if (_stats.lastActivityDate === yesterday && _stats.continuousDays === 0) {
            _stats.continuousDays = 1; fixed = true;
        }
        // 规则2：最后活动日既不是今天也不是昨天 -> 链条已断，清零
        if (_stats.lastActivityDate !== today && _stats.lastActivityDate !== yesterday) {
            if (_stats.lastActivityDate !== null && _stats.continuousDays > 0) {
                _stats.continuousDays = 0; fixed = true;
            }
        }
        // 规则3：今日有活动但连续天数为 0 -> 修正为 1
        if (_stats.todayCount > 0 && _stats.continuousDays === 0 && _stats.lastActivityDate === today) {
            _stats.continuousDays = 1; fixed = true;
        }

        if (fixed) {
            save();
            _logger.info('连续天数自动修正完成，当前值:', _stats.continuousDays);
        }
    }

    function resetContinuousDays() {
        if (!_stats) return;
        _logger.info('手动重置连续天数');
        _stats.continuousDays = 0;
        save();
    }

    /**
     * 获取统计摘要（同步，始终返回安全默认值）
     * @returns {Object}
     */
    function getSummary() {
        return {
            todayCount: _stats?.todayCount ?? 0,
            continuousDays: _stats?.continuousDays ?? 0,
            weeklyCount: getWeeklyCount(),
            weeklyTarget: getWeeklyTarget(),
            weeklyRate: getWeeklyRate(),
            dailyTarget: getDailyTarget()
        };
    }

    /**
     * 订阅统计数据变化事件
     * @param {Function} listener - 回调函数
     * @returns {Function} 取消订阅函数
     */
    function subscribe(listener) {
        _listeners.push(listener);
        return () => { _listeners = _listeners.filter(l => l !== listener); };
    }

    // 对外暴露公开接口
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
        fixContinuousDays,
        resetContinuousDays
    };
})();

// UMD 导出：兼容 Node.js/CommonJS 与 浏览器全局变量
if (typeof module !== 'undefined' && module.exports) module.exports = StatsModule;
if (typeof window !== 'undefined') window.StatsModule = StatsModule;