/**
 * 锁屏内确认对话框模块
 */
const LockConfirmDialog = (function() {
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('LockConfirmDialog') : console;
    
    /**
     * 在锁屏弹框内部显示确认对话框
     * @param {Object} options
     * @returns {Promise<boolean>}
     */
    function show(options) {
        logger.info('show', options);
        return new Promise((resolve) => {
            const { title, message, confirmText = '确定', cancelText = '取消', confirmColor = '#f59e0b' } = options;
            
            const lockOverlayEl = document.getElementById('lockOverlay');
            if (!lockOverlayEl) {
                logger.error('Lock overlay not found');
                resolve(false);
                return;
            }
            
            const lockCard = lockOverlayEl.querySelector('.lock-card');
            if (!lockCard) {
                logger.error('Lock card not found');
                resolve(false);
                return;
            }
            
            // 移除已存在的确认弹框
            const existingDialog = lockOverlayEl.querySelector('.in-lock-dialog');
            if (existingDialog) existingDialog.remove();
            
            // 创建确认弹框容器
            const dialogContainer = document.createElement('div');
            dialogContainer.className = 'in-lock-dialog';
            dialogContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
                z-index: 100;
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 56px;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 28px;
                width: 280px;
                max-width: 85%;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                text-align: center;
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
                    ${cancelText ? `<button class="lock-dialog-cancel" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: #64748b; cursor: pointer; border-right: 1px solid #e2e8f0;">${cancelText}</button>` : ''}
                    <button class="lock-dialog-confirm" style="flex: 1; padding: 16px; font-size: 16px; font-weight: 600; border: none; background: white; color: ${confirmColor}; cursor: pointer;">${confirmText}</button>
                </div>
            `;
            
            dialogContainer.appendChild(dialog);
            
            const originalPosition = lockCard.style.position;
            lockCard.style.position = 'relative';
            lockCard.appendChild(dialogContainer);
            
            const cancelBtn = cancelText ? dialog.querySelector('.lock-dialog-cancel') : null;
            const confirmBtn = dialog.querySelector('.lock-dialog-confirm');
            
            const close = (result) => {
                if (dialogContainer && dialogContainer.remove) dialogContainer.remove();
                lockCard.style.position = originalPosition;
                resolve(result);
            };
            
            if (cancelBtn) cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => close(true);
        });
    }
    
    return { show };
})();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LockConfirmDialog;
}
if (typeof window !== 'undefined') {
    window.LockConfirmDialog = LockConfirmDialog;
}