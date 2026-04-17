/**
 * 确认对话框模块
 * 用于显示需要用户确认的弹框
 */
const ConfirmDialog = (function() {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('ConfirmDialog') : console;
    
    // 添加动画样式（只添加一次）
    let stylesAdded = false;
    function ensureStyles() {
        if (stylesAdded) return;
        if (document.querySelector('#dialog-animation-style')) {
            stylesAdded = true;
            return;
        }
        const style = document.createElement('style');
        style.id = 'dialog-animation-style';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
        stylesAdded = true;
    }
    
    /**
     * 显示确认对话框
     * @param {Object} options - 配置选项
     * @param {string} options.title - 标题
     * @param {string} options.message - 消息内容
     * @param {string} [options.confirmText='确定'] - 确认按钮文字
     * @param {string} [options.cancelText='取消'] - 取消按钮文字
     * @param {string} [options.confirmColor='#f59e0b'] - 确认按钮颜色
     * @returns {Promise<boolean>} 用户选择结果
     */
    function show(options) {
        logger.info('show', options);
        return new Promise((resolve) => {
            const { title, message, confirmText = '确定', cancelText = '取消', confirmColor = '#f59e0b' } = options;
            
            ensureStyles();
            
            // 创建覆盖层
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 100000;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: system-ui, -apple-system, sans-serif;
            `;
            
            // 创建弹框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 28px;
                width: 300px;
                max-width: 85%;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
                padding: 0;
            `;
            
            dialog.innerHTML = `
                <div style="padding: 28px 24px 16px 24px; text-align: center;">
                    <div style="font-size: 52px; color: #b8b814; margin-bottom: 12px; display: block;">⚠️</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${title}</div>
                </div>
                <div style="padding: 0 24px 28px 24px; text-align: center;">
                    <div style="font-size: 15px; color: #64748b; line-height: 1.5;">${message}</div>
                </div>
                <div style="display: flex; border-top: 1px solid #e2e8f0;">
                    ${cancelText ? `<button class="dialog-cancel-btn" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: #64748b; cursor: pointer; border-right: 1px solid #e2e8f0;">${cancelText}</button>` : ''}
                    <button class="dialog-confirm-btn" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: ${confirmColor}; cursor: pointer;">${confirmText}</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            const close = (result) => {
                if (overlay && overlay.remove) {
                    overlay.remove();
                }
                resolve(result);
            };
            
            const cancelBtn = cancelText ? dialog.querySelector('.dialog-cancel-btn') : null;
            const confirmBtn = dialog.querySelector('.dialog-confirm-btn');
            
            if (cancelBtn) cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => close(true);
        });
    }
    
    return { show };
})();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfirmDialog;
}
if (typeof window !== 'undefined') {
    window.ConfirmDialog = ConfirmDialog;
}