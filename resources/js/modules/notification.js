const NotificationModule = (function () {
    const logger = (typeof window !== 'undefined' && window.Logger && window.Logger.createLogger)
        ? window.Logger.createLogger('Notification')
        : console;
    let isEnabled = true;
    let permissionGranted = false;

    function isNeutralino() { return typeof Neutralino !== 'undefined'; }
    function isElectron() { return typeof window !== 'undefined' && !!window.require && !isNeutralino(); }

    async function init() {
        logger.info('NotificationModule.init called');
        if (isNeutralino() || isElectron()) {
            permissionGranted = true;
            logger.info('Desktop environment detected, setting permissionGranted = true');
            return true;
        }
        if (!('Notification' in window)) {
            logger.warn('Notifications not supported');
            return false;
        }
        if (Notification.permission === 'granted') {
            permissionGranted = true;
            return true;
        }
        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                permissionGranted = permission === 'granted';
                logger.info('Notification permission result:', permission);
            } catch (e) {
                logger.error('Error requesting permission:', e);
                permissionGranted = false;
            }
        } else {
            logger.warn('Notification permission denied');
            permissionGranted = false;
        }
        return permissionGranted;
    }

    function initWithoutWait() {
        logger.info('NotificationModule.initWithoutWait called');
        if (isNeutralino() || isElectron()) { permissionGranted = true; return; }
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') { permissionGranted = true; return; }
        if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
                permissionGranted = p === 'granted';
                logger.info('Notification permission result:', p);
            }).catch(e => logger.error('Notification request error:', e));
        }
    }

    function setEnabled(enabled) { isEnabled = enabled; logger.info('Notification enabled set to:', enabled); }

    async function send(title, options = {}) {
        logger.info('========== Sending notification ==========');
        logger.info('Title:', title);
        logger.info('Options:', options);
        logger.info('isEnabled:', isEnabled);
        logger.info('permissionGranted:', permissionGranted);
        logger.info('isNeutralino:', isNeutralino());
        logger.info('isElectron:', isElectron());

        if (!isEnabled) { logger.info('Notifications disabled in settings'); return false; }

        if (isNeutralino()) {
            try {
                // Neutralino v5+ API 要求使用对象参数
                await Neutralino.os.showNotification({ title: title, body: options.body || '' });
                logger.info('Neutralino notification sent successfully');
                return true;
            } catch (e) {
                logger.error('Failed to send notification via Neutralino:', e);
                return false;
            }
        }

        if (isElectron()) {
            try {
                const { ipcRenderer } = window.require('electron');
                const notificationOptions = { title, body: options.body || '', silent: false, requireInteraction: options.requireInteraction || false };
                ipcRenderer.send('show-notification-async', notificationOptions);
                logger.info('Notification request sent to main process');
                return true;
            } catch (e) {
                logger.error('Failed to send notification via IPC:', e);
                return false;
            }
        }

        if (!('Notification' in window) || Notification.permission !== 'granted') return false;
        try {
            const notif = new Notification(title, { body: options.body || '', requireInteraction: options.requireInteraction || false, tag: options.tag || 'health-reminder' });
            notif.onclick = () => { window.focus(); notif.close(); };
            setTimeout(() => notif.close(), 5000);
            return true;
        } catch (e) {
            logger.error('Send notification error:', e);
            return false;
        }
    }

    // 移除 Emoji，使用纯文本提示
    async function sendReminder() { return await send('[提醒] 该活动啦！', { body: '站起来走走，伸个懒腰，活动一下筋骨吧！', tag: 'health-reminder', requireInteraction: true }); }
    async function sendTest() { return await send('[测试] 测试通知', { body: '如果你看到这条消息，说明桌面通知已开启！', tag: 'test-notification', requireInteraction: false }); }

    return { init, initWithoutWait, setEnabled, send, sendReminder, sendTest };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NotificationModule;
if (typeof window !== 'undefined') window.NotificationModule = NotificationModule;