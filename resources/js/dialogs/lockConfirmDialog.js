/**
 * 锁屏内嵌确认对话框模块 (LockConfirmDialog)
 * 功能：在锁屏界面内部显示二次确认弹框，避免跳出锁屏上下文
 * 兼容：Neutralino / 现代浏览器 (纯 DOM 实现，无 Node.js 依赖)
 * 注意：依赖页面中存在 id="lockOverlay" 的 DOM 结构。若找不到 .lock-card 会自动降级挂载
 */
const LockConfirmDialog = (function () {
    // 安全初始化日志模块，降级到 console
    const logger = typeof Logger !== 'undefined' ? Logger.createLogger('LockConfirmDialog') : console;

    /**
     * 在锁屏覆盖层内部显示确认对话框
     * @param {Object} options - 配置项
     * @param {string} options.title - 对话框标题
     * @param {string} options.message - 提示内容（支持基础 HTML）
     * @param {string} [options.confirmText='确定'] - 确认按钮文本
     * @param {string} [options.cancelText='取消'] - 取消按钮文本（为空则隐藏）
     * @param {string} [options.confirmColor='#f59e0b'] - 确认按钮主题色
     * @returns {Promise<boolean>} 用户点击确认返回 true，取消/点击遮罩返回 false
     */
    function show(options) {
        logger.info('Show lock-internal dialog requested', { title: options.title });

        return new Promise((resolve) => {
            // 安全获取锁屏覆盖层
            const lockOverlay = document.getElementById('lockOverlay');
            if (!lockOverlay) {
                logger.error('#lockOverlay DOM element not found. Dialog cannot be mounted.');
                resolve(false);
                return;
            }

            // 兼容不同 DOM 结构：优先使用 .lock-card，不存在则直接使用 #lockOverlay
            let mountTarget = lockOverlay.querySelector('.lock-card') || lockOverlay;
            if (!lockOverlay.querySelector('.lock-card')) {
                logger.warn('.lock-card not found, mounting dialog directly to #lockOverlay');
            }

            const { title = '提示', message = '', confirmText = '确定', cancelText = '取消', confirmColor = '#f59e0b' } = options;
            let isResolved = false;

            // 统一关闭逻辑，防止多次 resolve
            const closeDialog = (result) => {
                if (isResolved) return;
                isResolved = true;
                if (dialogContainer && document.body.contains(dialogContainer)) {
                    dialogContainer.remove();
                }
                logger.debug('Lock dialog closed with result:', result);
                resolve(result);
            };

            // 清理可能残留的旧对话框
            const existing = lockOverlay.querySelector('.in-lock-dialog');
            if (existing) existing.remove();

            // 创建对话框容器
            const dialogContainer = document.createElement('div');
            dialogContainer.className = 'in-lock-dialog';
            Object.assign(dialogContainer.style, {
                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)',
                zIndex: '100', display: 'flex', justifyContent: 'center', alignItems: 'center',
                borderRadius: 'inherit' // 继承外层圆角
            });

            // 创建对话框主体
            const dialog = document.createElement('div');
            Object.assign(dialog.style, {
                background: '#ffffff', borderRadius: '16px', width: '300px', maxWidth: '85%',
                overflow: 'hidden', boxShadow: '0 15px 35px rgba(0, 0, 0, 0.4)', textAlign: 'center'
            });

            // 填充内容（移除图标，使用纯文本与排版区分层级）
            dialog.innerHTML = `
                <div style="padding: 20px 24px 12px 24px; font-size: 18px; font-weight: 600; color: #1e293b;">${title}</div>
                <div style="padding: 0 24px 20px 24px; font-size: 14px; color: #64748b; line-height: 1.6;">${message}</div>
                <div style="display: flex; border-top: 1px solid #e2e8f0;">
                    ${cancelText ? `<button class="lock-dlg-cancel" style="flex: 1; padding: 14px; font-size: 15px; font-weight: 500; border: none; background: transparent; color: #64748b; cursor: pointer; border-right: 1px solid #e2e8f0;">${cancelText}</button>` : ''}
                    <button class="lock-dlg-confirm" style="flex: 1; padding: 14px; font-size: 15px; font-weight: 500; border: none; background: transparent; color: ${confirmColor}; cursor: pointer;">${confirmText}</button>
                </div>
            `;

            dialogContainer.appendChild(dialog);
            mountTarget.appendChild(dialogContainer);

            // 绑定按钮事件
            const confirmBtn = dialog.querySelector('.lock-dlg-confirm');
            const cancelBtn = dialog.querySelector('.lock-dlg-cancel');

            if (confirmBtn) confirmBtn.addEventListener('click', () => closeDialog(true));
            if (cancelBtn) cancelBtn.addEventListener('click', () => closeDialog(false));

            // 点击遮罩层关闭（仅当存在取消选项时生效，符合防误触规范）
            if (cancelBtn) {
                dialogContainer.addEventListener('click', (e) => {
                    if (e.target === dialogContainer) closeDialog(false);
                });
            }
        });
    }

    return { show };
})();

// UMD 导出：兼容 CommonJS 与浏览器全局变量
if (typeof module !== 'undefined' && module.exports) module.exports = LockConfirmDialog;
if (typeof window !== 'undefined') window.LockConfirmDialog = LockConfirmDialog;