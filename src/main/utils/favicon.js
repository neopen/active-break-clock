const fs = require('fs');
const path = require('path');
const { nativeImage, app } = require('electron');

// 简单的日志辅助函数
const logger = {
    debug: (...args) => console.log('[FAVICON]', ...args),
    info: (...args) => console.log('[FAVICON]', ...args),
    warn: (...args) => console.warn('[FAVICON]', ...args),
    error: (...args) => console.error('[FAVICON]', ...args)
};

/**
 * 图标管理模块
 */
class FaviconManager {

    /**
     * 查找可用的图标文件
     * @param {string} baseDir - 基础目录（通常是 __dirname）
     * @returns {string|null} 图标文件路径
     */
    static findIconFile(baseDir) {
        logger.debug('========== Finding Icon ==========');
        logger.debug('Base directory:', baseDir);
        logger.debug('App path:', app.getAppPath());
        logger.debug('Is packaged:', app.isPackaged);
        logger.debug('Process cwd:', process.cwd());
        logger.debug('Resources path:', process.resourcesPath);

        // 图标文件名列表（按优先级）
        const iconNames = [
            'icon-32.png',
            'icon-64.png',
            'icon-128.png',
            'icon-256.png',
            'icon-32.ico',
            'icon-64.ico',
            'icon.ico',
            'favicon.ico'
        ];

        const iconPaths = [];

        if (app.isPackaged) {
            // 生产环境 - 打包后的路径
            const resourcesPath = process.resourcesPath;
            const appPath = app.getAppPath();

            // 遍历所有可能的目录和文件名组合
            const dirs = [
                path.join(resourcesPath, 'app.asar', 'dist', 'renderer', 'icons'),
                path.join(resourcesPath, 'app.asar', 'src', 'renderer', 'icons'),
                path.join(resourcesPath, 'app', 'dist', 'renderer', 'icons'),
                path.join(resourcesPath, 'app', 'src', 'renderer', 'icons'),
                path.join(resourcesPath, 'icons'),
                path.join(appPath, 'dist', 'renderer', 'icons'),
                path.join(appPath, 'src', 'renderer', 'icons'),
                path.join(appPath, 'renderer', 'icons'),
                path.join(path.dirname(app.getPath('exe')), 'resources', 'icons'),
                path.join(path.dirname(app.getPath('exe')), 'icons')
            ];

            dirs.forEach(dir => {
                iconNames.forEach(name => {
                    iconPaths.push(path.join(dir, name));
                });
            });
        } else {
            // 开发环境
            const dirs = [
                path.join(baseDir, '../../renderer/icons'),
                path.join(process.cwd(), 'src/renderer/icons'),
                path.join(process.cwd(), 'dist/renderer/icons'),
                path.join(__dirname, '../../renderer/icons')
            ];

            dirs.forEach(dir => {
                iconNames.forEach(name => {
                    iconPaths.push(path.join(dir, name));
                });
            });
        }

        // 添加一些额外的路径
        iconPaths.push(
            path.join(baseDir, 'favicon.ico'),
            path.join(process.cwd(), 'favicon.ico')
        );

        // 去重
        const uniquePaths = [...new Set(iconPaths)];

        logger.debug('Checking paths:');
        let foundPath = null;

        for (const iconPath of uniquePaths) {
            const normalizedPath = path.normalize(iconPath);

            try {
                if (fs.existsSync(normalizedPath)) {
                    logger.debug('  ✓ File exists:', path.basename(normalizedPath));

                    try {
                        const image = nativeImage.createFromPath(normalizedPath);
                        if (!image.isEmpty()) {
                            const size = image.getSize();
                            logger.info('  ✓ Icon loaded! Size:', size.width, 'x', size.height);
                            foundPath = normalizedPath;
                            break;
                        } else {
                            logger.debug('  ✗ Icon image is empty');
                        }
                    } catch (loadError) {
                        logger.debug('  ✗ Failed to load:', loadError.message);
                    }
                }
            } catch (e) {
                // 忽略错误
            }
        }

        if (foundPath) {
            logger.info('========== Found Icon ==========');
            logger.info('Path:', foundPath);
        } else {
            logger.warn('========== No Icon Found ==========');
            logger.warn('Will use fallback icon');

            // 调试：列出目录内容
            this.debugListDirectories();
        }

        return foundPath;
    }

    /**
     * 调试：列出可能的目录内容
     */
    static debugListDirectories() {
        const dirsToCheck = [
            path.join(process.cwd(), 'src/renderer/icons'),
            path.join(process.cwd(), 'dist/renderer/icons'),
            path.join(__dirname, '../../renderer/icons')
        ];

        if (app.isPackaged) {
            dirsToCheck.push(
                path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer', 'icons'),
                path.join(process.resourcesPath, 'app.asar', 'src', 'renderer', 'icons')
            );
        }

        dirsToCheck.forEach(dir => {
            try {
                if (fs.existsSync(dir)) {
                    logger.debug('Directory exists:', dir);
                    const files = fs.readdirSync(dir);
                    logger.debug('Contents:', files);
                } else {
                    logger.debug('Directory does not exist:', dir);
                }
            } catch (e) {
                // 忽略
            }
        });
    }

    /**
     * 创建托盘图标
     * @param {string} baseDir - 基础目录
     * @returns {Electron.Tray|null} 托盘实例
     */
    static createTrayIcon(baseDir) {
        logger.info('Creating tray icon');
        try {
            const { Tray } = require('electron');
            const trayIconPath = this.findIconFile(baseDir);

            if (trayIconPath) {
                logger.info('Creating tray with icon:', trayIconPath);
                const tray = new Tray(trayIconPath);

                if (process.platform === 'darwin') {
                    tray.setPressedImage(trayIconPath);
                }

                logger.info('Tray created successfully');
                return tray;
            } else {
                logger.info('Creating fallback tray icon');
                return this.createFallbackTray();
            }
        } catch (error) {
            logger.error('Error creating tray:', error);
            return this.createFallbackTray();
        }
    }

    /**
     * 创建备用托盘图标
     * @returns {Electron.Tray|null}
     */
    static createFallbackTray() {
        try {
            const { Tray } = require('electron');

            // 创建时钟图标 SVG
            const svg = `
                <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="14" fill="#667eea" stroke="#5a67d8" stroke-width="2"/>
                    <circle cx="16" cy="16" r="10" fill="none" stroke="white" stroke-width="2"/>
                    <line x1="16" y1="16" x2="16" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <line x1="16" y1="16" x2="20" y2="20" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="16" cy="16" r="2" fill="white"/>
                </svg>
            `;

            const iconDataURL = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
            const image = nativeImage.createFromDataURL(iconDataURL);
            const tray = new Tray(image);

            logger.info('Fallback tray created');
            return tray;
        } catch (error) {
            logger.error('Failed to create fallback tray:', error);

            // 最后的备用方案
            try {
                const { Tray } = require('electron');
                const emptyImage = nativeImage.createEmpty();
                return new Tray(emptyImage);
            } catch (e) {
                return null;
            }
        }
    }
}

module.exports = FaviconManager;