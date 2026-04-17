/**
 * 自动关闭提示对话框模块
 */
const AutoCloseDialog = (function() {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('AutoCloseDialog') : console;
    
    let stylesAdded = false;
    function ensureStyles() {
        if (stylesAdded) return;
        if (document.querySelector('#auto-close-dialog-styles')) {
            stylesAdded = true;
            return;
        }
        const style = document.createElement('style');
        style.id = 'auto-close-dialog-styles';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes shrink {
                from { width: 100%; }
                to { width: 0%; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        stylesAdded = true;
    }
    
    /**
     * 显示自动关闭提示框
     * @param {Object} options
     * @param {string} options.title - 标题
     * @param {string} options.message - 消息内容
     * @param {number} [options.autoClose=3000] - 自动关闭时间（毫秒）
     * @param {string} [options.confirmColor='#22c55e'] - 主题颜色
     * @returns {Promise<boolean>}
     */
    function show(options) {
        logger.info('show', options);
        return new Promise((resolve) => {
            const { title, message, autoClose = 3000, confirmColor = '#22c55e' } = options;
            
            ensureStyles();
            
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                z-index: 100000;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: system-ui, -apple-system, sans-serif;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 28px;
                width: 300px;
                max-width: 85%;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                text-align: center;
                animation: slideUp 0.3s ease;
            `;
            
            dialog.innerHTML = `
                <div style="text-align: center; padding: 32px 24px 16px 24px; font-size: 48px;">✅</div>
                <div style="text-align: center; font-size: 20px; font-weight: 700; color: ${confirmColor}; padding: 0 24px 8px 24px;">${title}</div>
                <div style="text-align: center; font-size: 15px; color: #64748b; padding: 0 24px 24px 24px; line-height: 1.5;">${message}</div>
                <div style="padding: 16px 24px 24px 24px; border-top: 1px solid #e2e8f0;">
                    <div style="height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div class="timer-bar" style="width: 100%; height: 100%; background: ${confirmColor}; border-radius: 2px; animation: shrink ${autoClose / 1000}s linear forwards;"></div>
                    </div>
                    <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 8px;">${Math.ceil(autoClose / 1000)}秒后自动关闭</div>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            let timeoutId = setTimeout(() => close(), autoClose);
            
            const close = () => {
                clearTimeout(timeoutId);
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    if (overlay && overlay.remove) overlay.remove();
                    resolve(true);
                }, 200);
            };
            
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
                close();
            });
        });
    }
    
    return { show };
})();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoCloseDialog;
}
if (typeof window !== 'undefined') {
    window.AutoCloseDialog = AutoCloseDialog;
}