const NotificationModule = (function () {
    let isEnabled = true;
    let permissionGranted = false;
    let _logger = typeof Logger !== 'undefined' ? Logger.createLogger('Notification') : console;

    function isElectron() {
        return typeof window !== 'undefined' && !!window.require;
    }

    async function init() {
        _logger.info('NotificationModule.init called');

        if (isElectron()) {
            // 在 Electron 环境中，直接设为 true，因为主进程有权限
            // 不需要通过 IPC 请求权限
            _logger.info('Electron environment detected, setting permissionGranted = true');
            permissionGranted = true;
            return true;
        }

        // 浏览器环境
        if (!('Notification' in window)) {
            _logger.warn('Notifications not supported');
            return false;
        }

        if (Notification.permission === 'granted') {
            permissionGranted = true;
            _logger.info('Notification permission already granted');
            return true;
        }

        if (Notification.permission !== 'denied') {
            _logger.info('Requesting notification permission');
            try {
                const permission = await Notification.requestPermission();
                permissionGranted = permission === 'granted';
                _logger.info('Notification permission result:', permission);
            } catch (e) {
                _logger.error('Error requesting permission:', e);
                permissionGranted = false;
            }
        } else {
            _logger.warn('Notification permission denied');
            permissionGranted = false;
        }

        return permissionGranted;
    }

    function initWithoutWait() {
        _logger.info('NotificationModule.initWithoutWait called');

        if (isElectron()) {
            _logger.info('Electron environment, setting permissionGranted = true');
            permissionGranted = true;
            return;
        }

        // 浏览器环境
        if (!('Notification' in window)) {
            _logger.warn('Notifications not supported');
            return;
        }

        if (Notification.permission === 'granted') {
            permissionGranted = true;
            _logger.info('Notification permission already granted');
            return;
        }

        if (Notification.permission !== 'denied') {
            _logger.info('Requesting notification permission (non-blocking)');
            Notification.requestPermission().then(permission => {
                permissionGranted = permission === 'granted';
                _logger.info('Notification permission result:', permission);
            }).catch(e => _logger.error('Notification request error:', e));
        }
    }

    function setEnabled(enabled) {
        isEnabled = enabled;
        _logger.info('Notification enabled set to:', enabled);
    }

    async function send(title, options = {}) {
        _logger.info('========== Sending notification ==========');
        _logger.info('Title:', title);
        _logger.info('Options:', options);
        _logger.info('isEnabled:', isEnabled);
        _logger.info('permissionGranted:', permissionGranted);
        _logger.info('isElectron:', isElectron());

        if (!isEnabled) {
            _logger.info('Notifications disabled in settings');
            return false;
        }

        // 在 Electron 环境中，通过主进程发送通知
        if (isElectron()) {
            try {
                const { ipcRenderer } = window.require('electron');

                const notificationOptions = {
                    title: title,
                    body: options.body || '',
                    silent: false,
                    requireInteraction: options.requireInteraction || false
                };

                _logger.info('Sending to main process:', notificationOptions);

                // 使用异步方式发送，避免阻塞
                ipcRenderer.send('show-notification-async', notificationOptions);
                _logger.info('Notification request sent to main process');
                return true;
            } catch (e) {
                _logger.error('Failed to send notification via IPC:', e);
                return false;
            }
        }

        // 浏览器环境
        if (!('Notification' in window)) {
            _logger.warn('Notifications not supported');
            return false;
        }

        if (Notification.permission !== 'granted') {
            _logger.warn('No notification permission');
            return false;
        }

        try {
            const notification = new Notification(title, {
                body: options.body || '',
                icon: './icons/icon-64.png',
                requireInteraction: options.requireInteraction || false,
                tag: options.tag || 'health-reminder'
            });

            notification.onclick = () => {
                _logger.info('Notification clicked');
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 5000);
            _logger.info('Browser notification sent successfully');
            return true;
        } catch (e) {
            _logger.error('Send notification error:', e);
            return false;
        }
    }

    async function sendReminder() {
        _logger.info('Sending reminder notification');
        return await send('🧘 该活动啦！', {
            body: '站起来走走，伸个懒腰，活动一下筋骨吧！',
            tag: 'health-reminder',
            requireInteraction: true
        });
    }

    async function sendTest() {
        _logger.info('Sending test notification');
        return await send('🔔 测试通知', {
            body: '如果你看到这条消息，说明桌面通知已开启！',
            tag: 'test-notification',
            requireInteraction: false
        });
    }

    return {
        init,
        initWithoutWait,
        setEnabled,
        send,
        sendReminder,
        sendTest
    };
})();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationModule;
}

if (typeof window !== 'undefined') {
    window.NotificationModule = NotificationModule;
}