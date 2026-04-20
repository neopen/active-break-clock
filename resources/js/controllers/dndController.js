/**
 * 免打扰控制器 (DNDController)
 * 功能：管理午休时段与自定义免打扰时段的 UI 渲染、数据绑定与持久化
 * 兼容：Neutralino / 浏览器
 * 优化：修复 Config.load() 同步调用异常，全面改用 Config.get()/save() 异步安全模式
 */
const DNDController = (function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('DNDController') : console;
    let elements = {};

    /**
     * 转义 HTML 防止 XSS 注入
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, (m) => {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    /**
     * 控制免打扰设置区域的显示/隐藏
     */
    function toggleDndSettings(show) {
        const lunchBreakSettings = document.getElementById('lunchBreakSettings');
        if (lunchBreakSettings) lunchBreakSettings.style.display = show ? 'flex' : 'none';

        const customSection = document.querySelector('#customBreaksList')?.closest('div[style*="margin-top"]') || document.getElementById('customBreaksList')?.parentElement;
        if (customSection) customSection.style.display = show ? 'block' : 'none';
    }

    /**
     * 渲染自定义时段列表并绑定事件
     */
    function renderCustomBreaks(breaks) {
        const container = elements.customBreaksList;
        if (!container) {
            logger.warn('customBreaksList DOM 节点未找到');
            return;
        }

        if (!breaks || breaks.length === 0) {
            container.innerHTML = '<div class="break-empty" style="color:#94a3b8; font-size:12px; text-align:center; padding:8px;">暂无自定义时段，点击 + 添加</div>';
            return;
        }

        // 生成列表 HTML（已移除所有图标）
        container.innerHTML = breaks.map((item, index) => `
            <div class="break-item" data-index="${index}">
                <input type="text" class="break-name" value="${escapeHtml(item.name || '时段')}" placeholder="名称" data-field="name">
                <input type="time" class="break-start" value="${item.start}" data-field="start">
                <span>—</span>
                <input type="time" class="break-end" value="${item.end}" data-field="end">
                <button class="remove-break" data-index="${index}">X</button>
            </div>
        `).join('');

        // 绑定输入框变更事件
        container.querySelectorAll('.break-name, .break-start, .break-end').forEach(input => {
            input.addEventListener('change', async function () {
                const index = parseInt(this.closest('.break-item').dataset.index);
                const field = this.dataset.field;

                // 安全读取与更新
                const config = Config.get('_config') || {};
                if (!config.doNotDisturb) config.doNotDisturb = { enabled: false, lunchBreak: {}, customBreaks: [] };
                if (!config.doNotDisturb.customBreaks) config.doNotDisturb.customBreaks = [];
                if (config.doNotDisturb.customBreaks[index]) {
                    config.doNotDisturb.customBreaks[index][field] = this.value;
                    await Config.save();
                    logger.info('自定义时段已更新:', config.doNotDisturb.customBreaks[index]);
                }
            });
        });

        // 绑定删除按钮事件
        container.querySelectorAll('.remove-break').forEach(btn => {
            btn.addEventListener('click', async function () {
                const index = parseInt(this.dataset.index);
                const config = Config.get('_config') || {};
                if (config.doNotDisturb && config.doNotDisturb.customBreaks) {
                    config.doNotDisturb.customBreaks.splice(index, 1);
                    await Config.save();
                    logger.info('已删除自定义时段，索引:', index);
                    renderCustomBreaks(config.doNotDisturb.customBreaks);
                }
            });
        });
    }

    /**
     * 初始化控制器：绑定 DOM、加载配置、注册事件
     */
    async function init() {
        logger.info('开始初始化免打扰控制器...');
        elements.dndToggle = document.getElementById('dndToggle');
        elements.lunchStart = document.getElementById('lunchStart');
        elements.lunchEnd = document.getElementById('lunchEnd');
        elements.addBreakBtn = document.getElementById('addBreakBtn');
        elements.customBreaksList = document.getElementById('customBreaksList');

        if (!elements.dndToggle) {
            logger.warn('dndToggle 节点缺失，免打扰功能已禁用');
            return;
        }

        // 读取当前配置（使用同步缓存读取）
        const dnd = Config.get('doNotDisturb') || { enabled: false, lunchBreak: { start: '12:00', end: '14:00' }, customBreaks: [] };
        const isEnabled = dnd.enabled === true;

        elements.dndToggle.checked = isEnabled;
        toggleDndSettings(isEnabled);

        if (elements.lunchStart) elements.lunchStart.value = dnd.lunchBreak?.start || '12:00';
        if (elements.lunchEnd) elements.lunchEnd.value = dnd.lunchBreak?.end || '14:00';
        renderCustomBreaks(dnd.customBreaks || []);

        // ========== 事件绑定 ==========
        elements.dndToggle.addEventListener('change', async () => {
            const val = elements.dndToggle.checked;
            toggleDndSettings(val);
            const config = Config.get('_config') || {};
            config.doNotDisturb = config.doNotDisturb || { enabled: false, lunchBreak: {}, customBreaks: [] };
            config.doNotDisturb.enabled = val;
            await Config.save();
            logger.info('免打扰总开关变更:', val);
        });

        if (elements.lunchStart) {
            elements.lunchStart.addEventListener('change', async () => {
                const config = Config.get('_config') || {};
                config.doNotDisturb = config.doNotDisturb || {};
                config.doNotDisturb.lunchBreak = config.doNotDisturb.lunchBreak || {};
                config.doNotDisturb.lunchBreak.start = elements.lunchStart.value;
                await Config.save();
                logger.info('午休开始时间变更:', elements.lunchStart.value);
            });
        }

        if (elements.lunchEnd) {
            elements.lunchEnd.addEventListener('change', async () => {
                const config = Config.get('_config') || {};
                config.doNotDisturb = config.doNotDisturb || {};
                config.doNotDisturb.lunchBreak = config.doNotDisturb.lunchBreak || {};
                config.doNotDisturb.lunchBreak.end = elements.lunchEnd.value;
                await Config.save();
                logger.info('午休结束时间变更:', elements.lunchEnd.value);
            });
        }

        if (elements.addBreakBtn) {
            elements.addBreakBtn.addEventListener('click', async () => {
                const config = Config.get('_config') || {};
                config.doNotDisturb = config.doNotDisturb || {};
                config.doNotDisturb.customBreaks = config.doNotDisturb.customBreaks || [];
                config.doNotDisturb.customBreaks.push({ start: '14:00', end: '15:00', name: '新时段' });
                await Config.save();
                renderCustomBreaks(config.doNotDisturb.customBreaks);
                logger.info('添加自定义时段按钮触发');
            });
        }

        logger.info('免打扰控制器初始化完成');
    }

    return { init, renderCustomBreaks, toggleDndSettings };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DNDController;
if (typeof window !== 'undefined') window.DNDController = DNDController;