const AutoLaunchModule = (function () {
    const logger = (typeof window !== 'undefined' && window.Logger && window.Logger.createLogger)
        ? window.Logger.createLogger('AutoLaunch')
        : console;

    function isNeutralino() {
        return typeof Neutralino !== 'undefined' && Neutralino.init;
    }

    async function getStatus() {
        if (!isNeutralino()) return false;
        try {
            // Neutralino 暂不支持直接读取开机自启状态
            // 从 storage 读取保存的设置
            const saved = await Neutralino.storage.getData('autoLaunch');
            return saved === 'true';
        } catch (e) {
            return false;
        }
    }

    async function setEnabled(enabled) {
        if (!isNeutralino()) return false;
        try {
            // 保存设置
            await Neutralino.storage.setData('autoLaunch', enabled.toString());
            // 注意：Neutralino 目前不支持设置开机自启动
            // 需要用户手动将应用添加到开机启动项
            if (enabled) {
                const info = await Neutralino.os.getInfo();
                const platform = info.os;  // 'Windows', 'Darwin', 'Linux'
                let instructions = '';
                if (platform === 'Windows') {
                    instructions = '请按 Win+R，输入 shell:startup，将应用快捷方式放入打开的文件夹';
                } else if (platform === 'Darwin') {
                    instructions = '请在系统偏好设置 > 用户与群组 > 登录项中添加应用';
                } else if (platform === 'Linux') {
                    instructions = '请创建 .desktop 文件并放到 ~/.config/autostart/';
                }
                // 显示提示
                if (typeof AutoCloseDialog !== 'undefined') {
                    AutoCloseDialog.show({
                        title: '开机自启动',
                        message: `需要手动设置：\n${instructions}`,
                        autoClose: 5000,
                        confirmColor: '#a78bfa'
                    });
                }
            }
            logger.info('Auto launch setting saved:', enabled);
            return true;
        } catch (e) {
            logger.error('Failed to set auto launch:', e);
            return false;
        }
    }

    return { getStatus, setEnabled };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AutoLaunchModule;
if (typeof window !== 'undefined') window.AutoLaunchModule = AutoLaunchModule;