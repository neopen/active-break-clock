const Config = (function () {
    let _config = null;
    let _elements = {};
    let _listeners = [];
    let _useLocalFile = false;
    let _dataPath = '';
    let _configFileName = 'user_clock_config.json';
    let _userDirName = 'User_Data';

    // 检测是否在 PakePlus 或 Electron 环境中
    function initFileSystem() {
        // 检测是否在 PakePlus 环境中
        if (typeof window !== 'undefined' && window.pake) {
            _useLocalFile = true;
            _dataPath = './user-data/';
            console.log('Running in PakePlus, using local file storage');
            return true;
        }

        // 检测 Node.js 环境（Electron）
        if (typeof process !== 'undefined' && process.versions && process.versions.electron && FileSystemUtil) {
            try {
                FileSystemUtil.init();
                const rootPath = FileSystemUtil.getRootPath();
                if (rootPath) {
                    const path = require('path');
                    // 数据保存在 userData 目录下的 User_Data 子目录
                    _dataPath = path.join(rootPath, _userDirName);
                    // 确保 User_Data 目录存在
                    const dirCreated = FileSystemUtil.ensureSubDir(_userDirName);
                    console.log('Config: User_Data directory created:', dirCreated);
                    console.log('Config: Data path:', _dataPath);
                    _useLocalFile = true;
                    return true;
                }
            } catch (e) {
                console.error('File system not available:', e);
            }
        }

        return false;
    }

    // 从本地文件加载
    function loadFromFile() {
        if (!_useLocalFile || !FileSystemUtil) return null;
        try {
            const path = require('path');
            const filePath = path.join(_dataPath, _configFileName);
            const data = FileSystemUtil.readFile(filePath);
            if (data) {
                const parsedData = JSON.parse(data);
                console.log('Config loaded from file:', parsedData);
                return parsedData;
            }
        } catch (e) {
            console.warn('Load from file failed:', e);
        }
        return null;
    }

    // 保存到本地文件
    function saveToFile(data) {
        if (!_useLocalFile || !FileSystemUtil) return false;
        try {
            const path = require('path');
            const filePath = path.join(_dataPath, _configFileName);
            console.log('Config: Attempting to save to:', filePath);
            const result = FileSystemUtil.writeFile(filePath, JSON.stringify(data, null, 2));
            if (result) {
                console.log('Config saved to file:', filePath);
            } else {
                console.error('Config: Failed to save to file:', filePath);
            }
            return result;
        } catch (e) {
            console.warn('Save to file failed:', e);
            return false;
        }
    }

    function setElements(elements) {
        _elements = elements;
        initFileSystem();
    }

    function load() {
        initFileSystem();

        const defaults = {
            startTime: '08:00',
            endTime: '18:00',
            intervalMinutes: 40,
            lockMinutes: 5,
            forceLock: false,
            soundEnabled: true,
            notificationEnabled: true
        };

        let saved = null;

        // 优先从本地文件读取
        if (_useLocalFile) {
            saved = loadFromFile();
        }

        // 回退到 localStorage
        if (!saved) {
            const localStorageData = localStorage.getItem('healthAlarmConfig');
            if (localStorageData) {
                try {
                    saved = JSON.parse(localStorageData);
                } catch (e) { }
            }
        }

        if (saved) {
            _config = { ...defaults, ...saved };
        } else {
            _config = { ...defaults };
        }

        // 同步到DOM
        if (_elements.startTime) _elements.startTime.value = _config.startTime;
        if (_elements.endTime) _elements.endTime.value = _config.endTime;
        if (_elements.intervalMinutes) _elements.intervalMinutes.value = _config.intervalMinutes;
        if (_elements.lockMinutes) _elements.lockMinutes.value = _config.lockMinutes;
        if (_elements.forceLockToggle) _elements.forceLockToggle.checked = _config.forceLock;
        if (_elements.soundToggle) _elements.soundToggle.checked = _config.soundEnabled;
        if (_elements.notificationToggle) _elements.notificationToggle.checked = _config.notificationEnabled;

        console.log('Config loaded:', _config);
        return { ..._config };
    }

    function save() {
        if (!_config) {
            _config = {};
        }

        if (_elements.startTime) _config.startTime = _elements.startTime.value;
        if (_elements.endTime) _config.endTime = _elements.endTime.value;
        if (_elements.intervalMinutes) _config.intervalMinutes = parseInt(_elements.intervalMinutes.value);
        if (_elements.lockMinutes) _config.lockMinutes = parseInt(_elements.lockMinutes.value);
        if (_elements.forceLockToggle) _config.forceLock = _elements.forceLockToggle.checked;
        if (_elements.soundToggle) _config.soundEnabled = _elements.soundToggle.checked;
        if (_elements.notificationToggle) _config.notificationEnabled = _elements.notificationToggle.checked;

        // 同时保存到 localStorage 和本地文件
        localStorage.setItem('healthAlarmConfig', JSON.stringify(_config));

        if (_useLocalFile) {
            saveToFile(_config);
        }

        console.log('Config saved');
        _listeners.forEach(fn => fn({ ..._config }));

        return { ..._config };
    }

    function get(key) {
        return _config ? _config[key] : null;
    }

    function set(key, value) {
        if (_config) {
            _config[key] = value;
            save();
        }
    }

    function subscribe(listener) {
        _listeners.push(listener);
        return () => {
            _listeners = _listeners.filter(l => l !== listener);
        };
    }

    function validateInterval(value, min, max) {
        const num = parseInt(value);
        return !isNaN(num) && num >= min && num <= max;
    }

    function validateLockMinutes(value, min, max) {
        const num = parseInt(value);
        return !isNaN(num) && num >= min && num <= max;
    }

    function fixIntervalValue(value, min, max, step) {
        let num = parseInt(value);
        if (isNaN(num)) return 40;
        if (num < min) return min;
        if (num > max) return max;
        return Math.round(num / step) * step;
    }

    function fixLockValue(value, min, max) {
        let num = parseInt(value);
        if (isNaN(num)) return 5;
        if (num < min) return min;
        if (num > max) return max;
        return num;
    }

    return {
        setElements,
        load,
        save,
        get,
        set,
        subscribe,
        validateInterval,
        validateLockMinutes,
        fixIntervalValue,
        fixLockValue
    };
})();