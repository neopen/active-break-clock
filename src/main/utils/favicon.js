const fs = require('fs');
const path = require('path');
const { nativeImage, app } = require('electron');

// 简单的日志辅助函数（主进程版本）
const logger = {
    debug: (...args) => console.log('[FAVICON]', ...args),
    info: (...args) => console.log('[FAVICON]', ...args),
    warn: (...args) => console.warn('[FAVICON]', ...args),
    error: (...args) => console.error('[FAVICON]', ...args)
};

/**
 * 图标管理模块
 * 负责托盘图标的加载和管理
 */
class FaviconManager {
    
    /**
     * 查找可用的图标文件
     * @param {string} baseDir - 基础目录（通常是 __dirname）
     * @returns {string|null} 图标文件路径
     */
    static findIconFile(baseDir) {
        logger.debug('[FAVICON] ========== Finding Icon ==========');
        logger.debug('[FAVICON] Base directory (__dirname):', baseDir);
        logger.debug('[FAVICON] App path:', app.getAppPath());
        logger.debug('[FAVICON] Is packaged:', app.isPackaged);
        logger.debug('[FAVICON] Process cwd:', process.cwd());
        logger.debug('[FAVICON] Resources path:', process.resourcesPath);
        
        // 构建所有可能的图标路径
        const iconPaths = [];
        
        if (app.isPackaged) {
            // 生产环境 - 打包后的路径
            iconPaths.push(
                // 与 exe 同级的 resources 目录
                path.join(process.resourcesPath, 'app.asar', 'src', 'renderer', 'icons', 'icon-48.ico'),
                path.join(process.resourcesPath, 'app', 'src', 'renderer', 'icons', 'icon-48.ico'),
                path.join(process.resourcesPath, 'src', 'renderer', 'icons', 'icon-48.ico'),
                path.join(process.resourcesPath, 'icons', 'icon-48.ico'),
                // app.getAppPath() 返回的路径
                path.join(app.getAppPath(), 'src', 'renderer', 'icons', 'icon-48.ico'),
                path.join(app.getAppPath(), 'renderer', 'icons', 'icon-48.ico'),
                // 相对于 main.js 的路径
                path.join(baseDir, 'renderer', 'icons', 'icon-48.ico'),
                // 绝对路径备用
                path.join(path.dirname(app.getPath('exe')), 'resources', 'icons', 'icon-48.ico')
            );
        } else {
            // 开发环境
            // baseDir 通常是: .../HealthClock/src/main/utils
            // 所以需要向上两级，再进入 renderer/icons
            iconPaths.push(
                // 相对路径（推荐）
                path.join(baseDir, '../../renderer/icons/icon-32.ico'),
                path.join(baseDir, '../../renderer/icons/icon-48.ico'),
                path.join(baseDir, '../../renderer/icons/icon-72.ico'),
                path.join(baseDir, '../../renderer/icons/icon-96.ico'),
                path.join(baseDir, '../../renderer/icons/icon-128.ico'),
                path.join(baseDir, '../../renderer/icons/icon-256.ico'),
                // 使用 process.cwd()（项目根目录）
                path.join(process.cwd(), 'src/renderer/icons/icon-32.ico'),
                path.join(process.cwd(), 'src/renderer/icons/icon-48.ico'),
                path.join(process.cwd(), 'src/renderer/icons/icon-72.ico'),
                path.join(process.cwd(), 'src/renderer/icons/icon-96.ico'),
                path.join(process.cwd(), 'src/renderer/icons/icon-128.ico'),
                path.join(process.cwd(), 'src/renderer/icons/icon-256.ico'),
                // 使用 __dirname 的不同组合
                path.join(__dirname, '../../renderer/icons/icon-32.ico'),
                // 绝对路径备用
                path.resolve(baseDir, '../../renderer/icons/icon-32.ico')
            );
        }
        
        // 添加 .ico 和 .png 格式的备用路径
        const additionalPaths = [
            path.join(baseDir, 'favicon.ico'),
            path.join(process.cwd(), 'favicon.ico'),
            path.join(process.cwd(), 'icon-32.ico')
        ];
        
        const allPaths = [...iconPaths, ...additionalPaths];
        
        // 去重
        const uniquePaths = [...new Set(allPaths)];
        
        logger.debug('[FAVICON] Checking paths:');
        let foundPath = null;
        
        for (const iconPath of uniquePaths) {
            // 规范化路径
            const normalizedPath = path.normalize(iconPath);
            logger.debug('[FAVICON]   Checking:', normalizedPath);
            
            try {
                // 检查文件是否存在
                if (fs.existsSync(normalizedPath)) {
                    logger.debug('[FAVICON]   ✓ File exists!');
                    
                    // 尝试加载图标
                    try {
                        const image = nativeImage.createFromPath(normalizedPath);
                        if (!image.isEmpty()) {
                            const size = image.getSize();
                            logger.debug('[FAVICON]   ✓ Icon loaded successfully! Size:', size.width, 'x', size.height);
                            foundPath = normalizedPath;
                            break;
                        } else {
                            logger.info('[FAVICON]   ✗ Icon image is empty');
                        }
                    } catch (loadError) {
                        logger.error('[FAVICON]   ✗ Failed to load image:', loadError.message);
                    }
                } else {
                    logger.warn('[FAVICON]   ✗ File not found');
                }
            } catch (e) {
                logger.error('[FAVICON]   ✗ Error checking path:', e.message);
            }
        }
        
        if (foundPath) {
            logger.info('[FAVICON] ========== Found Icon ==========');
            logger.info('[FAVICON] Path:', foundPath);
        } else {
            logger.info('[FAVICON] ========== No Icon Found ==========');
            logger.info('[FAVICON] Will use generated fallback icon');
            
            // 列出实际目录内容以便调试
            try {
                const iconsDir = path.join(process.cwd(), 'src/renderer/icons');
                logger.debug('[FAVICON] Listing contents of:', iconsDir);
                if (fs.existsSync(iconsDir)) {
                    const files = fs.readdirSync(iconsDir);
                    logger.debug('[FAVICON] Directory contents:', files);
                } else {
                    logger.info('[FAVICON] Icons directory does not exist at:', iconsDir);
                }
            } catch (e) {
                logger.error('[FAVICON] Could not list directory:', e.message);
            }
        }
        
        return foundPath;
    }
    
    /**
     * 创建托盘图标
     * @param {string} baseDir - 基础目录
     * @returns {Electron.Tray|null} 托盘实例
     */
    static createTrayIcon(baseDir) {
        logger.info('[FAVICON] Creating tray icon');
        try {
            const { Tray } = require('electron');
            const trayIconPath = this.findIconFile(baseDir);
            
            if (trayIconPath) {
                logger.info('[FAVICON] Creating tray with icon:', trayIconPath);
                const tray = new Tray(trayIconPath);
                
                // macOS 特定设置
                if (process.platform === 'darwin') {
                    tray.setPressedImage(trayIconPath);
                }
                
                logger.info('[FAVICON] Tray created successfully');
                return tray;
            } else {
                // 创建备用托盘图标
                logger.info('[FAVICON] Creating fallback tray icon');
                return this.createFallbackTray();
            }
        } catch (error) {
            logger.error('[FAVICON] Error creating tray:', error);
            return this.createFallbackTray();
        }
    }
    
    /**
     * 创建备用托盘图标（简单的蓝色圆形）
     * @returns {Electron.Tray|null}
     */
    static createFallbackTray() {
        try {
            const { Tray } = require('electron');
            
            // 创建一个简单的时钟图标（32x32 像素）
            const canvas = `
                <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="14" fill="#667eea" stroke="#5a67d8" stroke-width="2"/>
                    <circle cx="16" cy="16" r="10" fill="none" stroke="white" stroke-width="2"/>
                    <line x1="16" y1="16" x2="16" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <line x1="16" y1="16" x2="20" y2="20" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="16" cy="16" r="2" fill="white"/>
                </svg>
            `;
            
            const iconDataURL = `data:image/svg+xml;base64,${Buffer.from(canvas).toString('base64')}`;
            const image = nativeImage.createFromDataURL(iconDataURL);
            const tray = new Tray(image);
            
            logger.info('[FAVICON] Fallback tray created with SVG icon');
            return tray;
        } catch (error) {
            logger.error('[FAVICON] Failed to create fallback tray:', error);
            return null;
        }
    }
}

module.exports = FaviconManager;