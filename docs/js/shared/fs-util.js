// 文件系统工具模块
const FileSystemUtil = (function () {
    let _fs = null;
    let _initialized = false;
    let _rootPath = null;
    
    // 初始化文件系统
    // 初始化文件系统
    function init() {
        if (_initialized) return true;
        
        console.log('FileSystemUtil: Initializing...');
        
        // 在 Electron 渲染进程中，通过 window.require 获取 fs 模块
        if (typeof window !== 'undefined' && window.require) {
            try {
                _fs = window.require('fs');
                _initialized = true;
                console.log('FileSystemUtil: File system initialized via window.require');
                return true;
            } catch (e) {
                console.warn('FileSystemUtil: Failed to get fs via window.require:', e);
            }
        }
        
        // 备用方案：使用 require
        if (typeof require !== 'undefined') {
            try {
                _fs = require('fs');
                _initialized = true;
                console.log('FileSystemUtil: File system initialized via require');
                return true;
            } catch (e) {
                console.warn('FileSystemUtil: Failed to get fs via require:', e);
            }
        }
        
        console.warn('FileSystemUtil: File system not available');
        return false;
    }
    
    // 获取 HealthClock 根目录路径
    function getRootPath() {
        if (_rootPath) return _rootPath;
        
        if (!_initialized && !init()) {
            console.warn('FileSystemUtil: Not initialized, cannot get root path');
            return null;
        }
        
        try {
            // 获取 path 模块
            const path = window.require ? window.require('path') : require('path');
            let userDataPath = null;
            
            // 通过 Electron 的 ipcRenderer 从主进程获取 userData 路径
            if (typeof window !== 'undefined' && window.require) {
                try {
                    const { ipcRenderer } = window.require('electron');
                    console.log('FileSystemUtil: Requesting userData path via IPC...');
                    
                    // 使用同步请求，但添加超时保护
                    userDataPath = ipcRenderer.sendSync('get-user-data-path');
                    console.log('FileSystemUtil: Got userData path via IPC:', userDataPath);
                } catch (e) {
                    console.warn('FileSystemUtil: Failed to get userData via IPC:', e);
                }
            }
            
            // 降级方案：使用环境变量
            if (!userDataPath) {
                console.log('FileSystemUtil: Using fallback path detection');
                
                // 获取 Electron app 模块
                let app;
                try {
                    const electron = window.require ? window.require('electron') : require('electron');
                    app = electron.app || electron.remote.app;
                } catch (e) {
                    console.warn('FileSystemUtil: Failed to get electron app:', e);
                }
                
                if (app) {
                    userDataPath = app.getPath('userData');
                    console.log('FileSystemUtil: Got userData path via app.getPath:', userDataPath);
                } else if (typeof process !== 'undefined') {
                    if (process.env.APPDATA) {
                        userDataPath = path.join(process.env.APPDATA, 'HealthClock');
                    } else if (process.env.HOME) {
                        if (process.platform === 'darwin') {
                            userDataPath = path.join(process.env.HOME, 'Library', 'Application Support', 'HealthClock');
                        } else if (process.platform === 'linux') {
                            userDataPath = path.join(process.env.HOME, '.config', 'HealthClock');
                        } else {
                            userDataPath = path.join(process.env.HOME, 'HealthClock');
                        }
                    } else {
                        userDataPath = path.join(process.cwd(), 'HealthClock');
                    }
                    console.log('FileSystemUtil: Fallback userData path:', userDataPath);
                }
            }
            
            if (!userDataPath) {
                console.error('FileSystemUtil: Failed to determine userData path');
                return null;
            }
            
            _rootPath = userDataPath;
            console.log('FileSystemUtil: Root path set to:', _rootPath);
            
            // 确保根目录存在
            ensureDir(_rootPath);
            
            return _rootPath;
        } catch (e) {
            console.error('FileSystemUtil: Failed to get root path:', e);
            return null;
        }
    }
    
    // 确保目录存在
    function ensureDir(dirPath) {
        if (!_initialized && !init()) {
            console.warn('ensureDir: File system not initialized');
            return false;
        }
        
        if (!_fs) {
            console.warn('ensureDir: fs module not available');
            return false;
        }
        
        try {
            if (!_fs.existsSync(dirPath)) {
                _fs.mkdirSync(dirPath, { recursive: true });
                console.log('ensureDir: Directory created successfully:', dirPath);
            } else {
                console.log('ensureDir: Directory already exists:', dirPath);
            }
            return true;
        } catch (e) {
            console.error('ensureDir: Failed to ensure directory:', dirPath, 'Error:', e.message);
            return false;
        }
    }
    
    // 确保 HealthClock 根目录存在
    function ensureRootDir() {
        const rootPath = getRootPath();
        if (!rootPath) {
            console.warn('ensureRootDir: Root path is null');
            return false;
        }
        return ensureDir(rootPath);
    }
    
    // 确保子目录存在
    function ensureSubDir(subDir) {
        const rootPath = getRootPath();
        if (!rootPath) {
            console.warn('ensureSubDir: Root path is null');
            return false;
        }
        
        const dirPath = require('path').join(rootPath, subDir);
        console.log('FileSystemUtil: Ensuring subdirectory:', dirPath);
        const result = ensureDir(dirPath);
        console.log('FileSystemUtil: ensureSubDir result:', result);
        return result;
    }
    
    // 读取文件
    function readFile(filePath) {
        if (!_initialized && !init()) {
            return null;
        }
        
        try {
            if (_fs.existsSync(filePath)) {
                const content = _fs.readFileSync(filePath, 'utf8');
                console.log('FileSystemUtil: File read successfully:', filePath);
                return content;
            }
            console.log('FileSystemUtil: File not found:', filePath);
            return null;
        } catch (e) {
            console.warn('FileSystemUtil: Failed to read file:', e);
            return null;
        }
    }
    
    // 写入文件
    function writeFile(filePath, content) {
        if (!_initialized && !init()) {
            console.warn('writeFile: File system not initialized');
            return false;
        }
        
        try {
            const dirPath = require('path').dirname(filePath);
            const dirCreated = ensureDir(dirPath);
            if (!dirCreated) {
                console.warn('writeFile: Failed to create directory:', dirPath);
                return false;
            }
            _fs.writeFileSync(filePath, content, 'utf8');
            console.log('writeFile: File written successfully:', filePath);
            return true;
        } catch (e) {
            console.warn('writeFile: Failed to write file:', e);
            return false;
        }
    }
    
    return {
        init,
        getRootPath,
        ensureDir,
        ensureRootDir,
        ensureSubDir,
        readFile,
        writeFile
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.FileSystemUtil = FileSystemUtil;
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileSystemUtil;
}