/**
 * 自动关闭提示框模块 (AutoCloseDialog)
 * 功能：显示操作成功/状态提示，支持倒计时进度条与自动消失，点击可立即关闭
 * 兼容：Neutralino / 现代浏览器
 */
const AutoCloseDialog = (function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('AutoCloseDialog') : console;
    let stylesInjected = false;

    /**
     * 注入全局动画样式（单例模式，避免重复添加 style 标签）
     */
    function injectStyles() {
        if (stylesInjected || document.getElementById('autoClose-dialog-styles')) {
            stylesInjected = true;
            return;
        }
        const style = document.createElement('style');
        style.id = 'autoClose-dialog-styles';
        style.textContent = `
            @keyframes autoCloseSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes autoCloseShrink { from { width: 100%; } to { width: 0%; } }
            @keyframes autoCloseFadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        document.head.appendChild(style);
        stylesInjected = true;
        logger.debug('AutoClose dialog animation styles injected');
    }

    /**
     * 显示自动关闭提示框
     * @param {Object} options - 配置项
     * @param {string} options.title - 提示标题
     * @param {string} options.message - 提示内容
     * @param {number} [options.autoClose=3000] - 自动关闭时间（毫秒）
     * @param {string} [options.confirmColor='#22c55e'] - 进度条与标题主题色
     * @returns {Promise<boolean>} 始终返回 true（自动关闭或手动点击关闭）
     */
    function show(options) {
        logger.info('Show auto-close dialog', { title: options.title, duration: options.autoClose });
        injectStyles();

        const { title = '提示', message = '', autoClose = 3000, confirmColor = '#22c55e' } = options;
        const seconds = Math.max(1, Math.ceil(autoClose / 1000)); // 确保至少显示 1 秒

        return new Promise((resolve) => {
            let timerId = null;
            let isResolved = false;

            const closeDialog = () => {
                if (isResolved) return;
                isResolved = true;
                if (timerId) clearTimeout(timerId);

                if (overlay && document.body.contains(overlay)) {
                    overlay.style.animation = 'autoCloseFadeOut 0.2s ease forwards';
                    setTimeout(() => {
                        if (document.body.contains(overlay)) document.body.removeChild(overlay);
                        logger.debug('Auto-close dialog removed');
                        resolve(true);
                    }, 200);
                } else {
                    resolve(true);
                }
            };

            // 创建遮罩层
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
                zIndex: '100000', display: 'flex', justifyContent: 'center', alignItems: 'center',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            });

            // 创建对话框主体
            const dialog = document.createElement('div');
            Object.assign(dialog.style, {
                background: '#ffffff', borderRadius: '16px', width: '320px', maxWidth: '90%',
                overflow: 'hidden', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                textAlign: 'center', animation: 'autoCloseSlideUp 0.25s ease-out'
            });

            dialog.innerHTML = `
                <div style="padding: 24px 24px 8px 24px; font-size: 16px; font-weight: 600; color: ${confirmColor};">${title}</div>
                <div style="padding: 0 24px 16px 24px; font-size: 14px; color: #64748b; line-height: 1.5;">${message}</div>
                <div style="padding: 0 20px 16px 20px;">
                    <div style="height: 3px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div style="width: 100%; height: 100%; background: ${confirmColor}; animation: autoCloseShrink ${seconds}s linear forwards;"></div>
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">${seconds} 秒后自动关闭</div>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 点击任意位置立即关闭
            overlay.addEventListener('click', closeDialog);

            // 启动自动关闭计时器
            timerId = setTimeout(closeDialog, autoClose);
        });
    }

    return { show };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AutoCloseDialog;
if (typeof window !== 'undefined') window.AutoCloseDialog = AutoCloseDialog;