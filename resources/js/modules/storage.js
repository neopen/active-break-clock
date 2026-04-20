// 数据存储管理模块（支持本地文件备份）
const StorageModule = (function () {
    let autoBackupInterval = null;
    let isEnabled = true;
    const _logger = typeof Logger !== 'undefined' ? Logger.createLogger('Storage') : console;

    // 导出数据到 JSON 文件
    function exportData() {
        try {
            const config = localStorage.getItem('healthAlarmConfig');
            const stats = localStorage.getItem('healthAlarmStats');
            const data = {
                version: '1.0.0',
                exportTime: new Date().toISOString(),
                config: config ? JSON.parse(config) : null,
                stats: stats ? JSON.parse(stats) : null
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stand_up_backup_${formatDateForFilename(new Date())}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            _logger.info('Data exported successfully');
            return true;
        } catch (e) {
            _logger.error('Export failed:', e);
            return false;
        }
    }

    // 导入数据从 JSON 文件
    function importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.config) {
                        localStorage.setItem('healthAlarmConfig', JSON.stringify(data.config));
                    }
                    if (data.stats) {
                        localStorage.setItem('healthAlarmStats', JSON.stringify(data.stats));
                    }
                    _logger.info('Data imported successfully');
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // 格式化日期用于文件名
    function formatDateForFilename(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
    }

    // 启动自动备份（每天备份一次）
    function startAutoBackup(intervalHours = 24) {
        stopAutoBackup();
        if (isEnabled) {
            exportData();
        }
        const intervalMs = intervalHours * 60 * 60 * 1000;
        autoBackupInterval = setInterval(() => {
            if (isEnabled) {
                exportData();
                _logger.info('Auto backup executed');
            }
        }, intervalMs);
    }

    function stopAutoBackup() {
        if (autoBackupInterval) {
            clearInterval(autoBackupInterval);
            autoBackupInterval = null;
        }
    }

    function setEnabled(enabled) {
        isEnabled = enabled;
        if (!enabled) {
            stopAutoBackup();
        } else {
            startAutoBackup();
        }
    }

    // 清除所有数据
    function clearAllData() {
        localStorage.removeItem('healthAlarmConfig');
        localStorage.removeItem('healthAlarmStats');
        _logger.info('All data cleared');
    }

    // 获取数据大小
    function getDataSize() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key === 'healthAlarmConfig' || key === 'healthAlarmStats')) {
                total += localStorage.getItem(key).length;
            }
        }
        return Math.round(total / 1024); // KB
    }

    return {
        exportData,
        importData,
        startAutoBackup,
        stopAutoBackup,
        setEnabled,
        clearAllData,
        getDataSize
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageModule;
}
if (typeof window !== 'undefined') {
    window.StorageModule = StorageModule;
}