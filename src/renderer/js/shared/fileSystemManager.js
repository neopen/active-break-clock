// 文件系统管理器
const FileSystemManager = (function () {
    let _initialized = false;
    let _useLocalFile = false;
    let _dataPath = '';
    let _fileSystemUtil = null;
    
    // 初始化文件系统
    function init() {
        if (_initialized) return true;
        
        console.log('FileSystemManager: Initializing...');
        console.log('FileSystemManager: Environment:', {
            hasProcess: typeof process !== 'undefined',
            hasWindow: typeof window !== 'undefined',
            isElectron: typeof process !== 'undefined' && process.versions && !!process.versions.electron,
            hasPake: typeof window !== 'undefined' && !!window.pake
        });
        
        // 检测是否在 PakePlus 环境中
        if (typeof window !== 'undefined' && window.pake) {
            _useLocalFile = true;
            _dataPath = './user-data/';
            console.log('FileSystemManager: Running in PakePlus');
            _initialized = true;
            return true;
        }
        
        // 检测 Node.js 环境（Electron）
        if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
            try {
                // 方法1：尝试使用 window.require
                if (typeof window !== 'undefined' && window.require) {
                    try {
                        _fileSystemUtil = window.require('./fs-util.js');
                        console.log('FileSystemManager: FileSystemUtil loaded via window.require');
                    } catch (e) {
                        console.warn('FileSystemManager: Failed to load via window.require:', e.message);
                    }
                }
                
                // 方法2：尝试直接使用全局 FileSystemUtil
                if (!_fileSystemUtil && typeof FileSystemUtil !== 'undefined') {
                    _fileSystemUtil = FileSystemUtil;
                    console.log('FileSystemManager: Using global FileSystemUtil');
                }
                
                // 方法3：如果 FileSystemUtil 已通过 script 标签加载，直接使用
                if (!_fileSystemUtil) {
                    console.warn('FileSystemManager: FileSystemUtil not available, file operations will fail');
                    _initialized = true;
                    return false;
                }
                
                // 初始化 FileSystemUtil
                if (_fileSystemUtil && typeof _fileSystemUtil.init === 'function') {
                    _fileSystemUtil.init();
                }
                
                const rootPath = _fileSystemUtil.getRootPath();
                if (rootPath) {
                    const path = window.require ? window.require('path') : require('path');
                    // 数据保存在 userData 目录下的 User_Data 子目录
                    _dataPath = path.join(rootPath, 'User_Data');
                    console.log('FileSystemManager: Data path set to:', _dataPath);
                    
                    // 确保 User_Data 目录存在
                    const dirCreated = _fileSystemUtil.ensureDir(_dataPath);
                    console.log('FileSystemManager: User_Data directory created:', dirCreated);
                    
                    _useLocalFile = true;
                    _initialized = true;
                    return true;
                }
            } catch (e) {
                console.error('FileSystemManager: File system error:', e.message);
                console.error('FileSystemManager: Error stack:', e.stack);
            }
        }
        
        console.log('FileSystemManager: Falling back to localStorage only');
        _initialized = true;
        return false;
    }
    
    // 获取数据路径
    function getDataPath() {
        if (!_initialized) {
            init();
        }
        return _dataPath;
    }
    
    // 是否使用本地文件存储
    function isUsingLocalFile() {
        if (!_initialized) {
            init();
        }
        return _useLocalFile;
    }
    
    // 获取文件系统工具
    function getFileSystemUtil() {
        if (!_initialized) {
            init();
        }
        return _fileSystemUtil;
    }
    
    // 构建文件路径
    function buildFilePath(fileName) {
        if (!_initialized) {
            init();
        }
        if (!_dataPath) return null;
        
        try {
            const path = require('path');
            return path.join(_dataPath, fileName);
        } catch (e) {
            console.error('FileSystemManager: Failed to build file path:', e);
            return null;
        }
    }
    
    // 检查文件是否存在
    function fileExists(fileName) {
        const filePath = buildFilePath(fileName);
        if (!filePath) return false;
        
        try {
            const fs = require('fs');
            return fs.existsSync(filePath);
        } catch (e) {
            return false;
        }
    }
    
    return {
        init,
        getDataPath,
        isUsingLocalFile,
        getFileSystemUtil,
        buildFilePath,
        fileExists
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.FileSystemManager = FileSystemManager;
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileSystemManager;
}