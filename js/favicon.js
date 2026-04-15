const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

/**
 * 图标管理模块
 * 负责托盘图标的加载和管理
 */
class FaviconManager {
    /**
     * 查找可用的图标文件
     * @param {string} baseDir - 基础目录
     * @returns {string|null} 图标文件路径
     */
    static findIconFile(baseDir) {
        console.log('[FAVICON] Searching for icon files');
        
        // 尝试加载图标文件
        const iconPaths = [
            path.join(baseDir, 'favicon.ico'),
            path.join(baseDir, 'icons', 'icon-32.ico'),
            path.join(baseDir, 'icon.ico'),
            path.join(baseDir, 'icons', 'icon.ico'),
            // 额外的路径尝试
            path.join(process.cwd(), 'favicon.ico'),
            path.join(process.cwd(), 'icons', 'icon-32.ico')
        ];
        
        let trayIconPath = null;
        for (const iconPath of iconPaths) {
            console.log('[FAVICON] Trying to load tray icon from:', iconPath);
            try {
                if (fs.existsSync(iconPath)) {
                    console.log('[FAVICON] Tray icon file found:', iconPath);
                    // 检查文件大小，确保不是空文件
                    const stats = fs.statSync(iconPath);
                    console.log('[FAVICON] Icon file size:', stats.size, 'bytes');
                    if (stats.size > 0) {
                        trayIconPath = iconPath;
                        break;
                    } else {
                        console.log('[FAVICON] Icon file is empty:', iconPath);
                    }
                } else {
                    console.log('[FAVICON] Tray icon file not found:', iconPath);
                }
            } catch (e) {
                console.error('[FAVICON] Error checking icon file:', e);
            }
        }
        
        // 输出当前工作目录和 baseDir
        console.log('[FAVICON] Current working directory:', process.cwd());
        console.log('[FAVICON] Base directory:', baseDir);
        
        return trayIconPath;
    }
    
    /**
     * 创建托盘图标
     * @param {string} baseDir - 基础目录
     * @returns {Electron.Tray|null} 托盘实例
     */
    static createTrayIcon(baseDir) {
        console.log('[FAVICON] Creating tray icon');
        try {
            const trayIconPath = this.findIconFile(baseDir);
            
            if (trayIconPath) {
                // 使用找到的图标文件
                try {
                    const { Tray } = require('electron');
                    const tray = new Tray(trayIconPath);
                    console.log('[FAVICON] Tray created with icon:', trayIconPath);
                    // 验证图标是否加载成功
                    console.log('[FAVICON] Tray icon set successfully');
                    return tray;
                } catch (trayError) {
                    console.error('[FAVICON] Error creating tray with icon:', trayError);
                    // 如果失败，尝试使用空的 nativeImage
                    return this.createEmptyTray();
                }
            } else {
                console.log('[FAVICON] No tray icon files found');
                // 没有找到图标文件，使用空的 nativeImage
                return this.createEmptyTray();
            }
        } catch (error) {
            console.error('[FAVICON] Error creating tray:', error);
            console.error('[FAVICON] Error stack:', error.stack);
            // 即使创建托盘失败，也返回 null
            return null;
        }
    }
    
    /**
     * 创建空的托盘图标
     * @returns {Electron.Tray|null} 托盘实例
     */
    static createEmptyTray() {
        try {
            const { Tray } = require('electron');
            const emptyImage = nativeImage.createEmpty();
            const tray = new Tray(emptyImage);
            console.log('[FAVICON] Tray created with empty native image');
            return tray;
        } catch (nativeImageError) {
            console.error('[FAVICON] Failed to create tray with nativeImage:', nativeImageError);
            console.log('[FAVICON] Tray creation failed, but app will continue');
            return null;
        }
    }
}

module.exports = FaviconManager;