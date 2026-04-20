/**
 * 标准确认对话框模块 (ConfirmDialog)
 * 功能：显示需要用户明确确认的模态弹框，支持自定义标题、内容、按钮文本与颜色
 * 兼容：Neutralino / 现代浏览器 (纯 DOM 实现，无 Node.js 依赖)
 */
const ConfirmDialog = (function () {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('ConfirmDialog') : console;
    let stylesInjected = false;

    /**
     * 注入全局动画样式（单例模式）
     */
    function injectStyles() {
        if (stylesInjected || document.getElementById('confirm-dialog-styles')) {
            stylesInjected = true;
            return;
        }
        const style = document.createElement('style');
        style.id = 'confirm-dialog-styles';
        style.textContent = `
            @keyframes confirmDialogSlideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
        stylesInjected = true;
        logger.debug('Confirm dialog animation styles injected');
    }

    /**
     * 显示确认对话框
     * @param {Object} options - 配置项
     * @param {string} options.title - 对话框标题
     * @param {string} options.message - 提示内容（支持基础 HTML）
     * @param {string} [options.confirmText='确定'] - 确认按钮文本
     * @param {string} [options.cancelText='取消'] - 取消按钮文本（为空则隐藏取消按钮）
     * @param {string} [options.confirmColor='#f59e0b'] - 确认按钮主题色
     * @returns {Promise<boolean>} 用户点击确认返回 true，取消/点击遮罩返回 false
     */
    function show(options) {
        logger.info('Show confirm dialog requested', { title: options.title });
        injectStyles();

        const { title = '提示', message = '', confirmText = '确定', cancelText = '取消', confirmColor = '#f59e0b' } = options;

        return new Promise((resolve) => {
            let isResolved = false;

            const closeDialog = (result) => {
                if (isResolved) return;
                isResolved = true;
                if (overlay && document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                    logger.debug('Confirm dialog closed with result:', result);
                }
                resolve(result);
            };

            // 创建遮罩层
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                zIndex: '100000', display: 'flex', justifyContent: 'center', alignItems: 'center',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            });

            // 创建对话框主体
            const dialog = document.createElement('div');
            Object.assign(dialog.style, {
                background: '#ffffff', borderRadius: '16px', width: '320px', maxWidth: '90%',
                overflow: 'hidden', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                animation: 'confirmDialogSlideUp 0.25s ease-out', textAlign: 'center'
            });

            // 填充内容（移除图标，使用纯文本排版）
            dialog.innerHTML = `
                <div style="padding: 24px 24px 12px 24px; font-size: 18px; font-weight: 600; color: #1e293b;">${title}</div>
                <div style="padding: 0 24px 24px 24px; font-size: 14px; color: #64748b; line-height: 1.6;">${message}</div>
                <div style="display: flex; border-top: 1px solid #e2e8f0;">
                    ${cancelText ? `<button class="dlg-cancel" style="flex: 1; padding: 14px; font-size: 15px; font-weight: 500; border: none; background: transparent; color: #64748b; cursor: pointer; border-right: 1px solid #e2e8f0;">${cancelText}</button>` : ''}
                    <button class="dlg-confirm" style="flex: 1; padding: 14px; font-size: 15px; font-weight: 500; border: none; background: transparent; color: ${confirmColor}; cursor: pointer;">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 绑定按钮事件
            const confirmBtn = dialog.querySelector('.dlg-confirm');
            const cancelBtn = dialog.querySelector('.dlg-cancel');

            if (confirmBtn) confirmBtn.addEventListener('click', () => closeDialog(true));
            if (cancelBtn) cancelBtn.addEventListener('click', () => closeDialog(false));

            // 点击遮罩层关闭（仅当存在取消按钮时允许点击外部关闭）
            if (cancelBtn) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) closeDialog(false);
                });
            }
        });
    }

    return { show };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ConfirmDialog;
if (typeof window !== 'undefined') window.ConfirmDialog = ConfirmDialog;