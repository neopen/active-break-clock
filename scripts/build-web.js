// scripts/build-web.js

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src', 'renderer');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

console.log('🔨 Building web version for GitHub Pages...\n');

// ========== 1. 清空并创建 docs 目录 ==========
if (fs.existsSync(DOCS_DIR)) {
    fs.rmSync(DOCS_DIR, { recursive: true, force: true });
    console.log('  🗑️  Cleared docs/ directory');
}
fs.mkdirSync(DOCS_DIR, { recursive: true });
console.log('  📁 Created docs/ directory\n');

// ========== 2. 复制所有静态资源（原样复制） ==========
console.log('📦 Copying static assets...');

const staticItems = [
    { src: 'css', dest: 'css', isDir: true },
    { src: 'icons', dest: 'icons', isDir: true },
    { src: 'js', dest: 'js', isDir: true },
    { src: 'manifest.json', dest: 'manifest.json', isDir: false }
];

staticItems.forEach(item => {
    const src = path.join(SRC_DIR, item.src);
    const dest = path.join(DOCS_DIR, item.dest);
    
    if (fs.existsSync(src)) {
        if (item.isDir) {
            copyDirectory(src, dest);
        } else {
            copyFile(src, dest);
        }
        console.log(`  ✅ ${item.src}`);
    } else {
        console.log(`  ⚠️  Missing: ${item.src}`);
    }
});

// ========== 3. 创建 Web 适配脚本 ==========
console.log('\n📝 Creating web adapter...');

const webAdapter = `// Web 适配层 - 模拟 Electron 环境
(function() {
    console.log('[Web Adapter] Initializing...');
    
    // 模拟 require 函数
    window.require = function(module) {
        console.log('[Web Adapter] require called for:', module);
        return null;
    };
    
    // 模拟 FileSystemManager
    window.FileSystemManager = window.FileSystemManager || {
        init: function() { return false; },
        getDataPath: function() { return null; },
        isUsingLocalFile: function() { return false; },
        getFileSystemUtil: function() { return null; },
        buildFilePath: function() { return null; },
        fileExists: function() { return false; }
    };
    
    // 模拟 FileSystemUtil
    window.FileSystemUtil = window.FileSystemUtil || {
        init: function() { return false; },
        getRootPath: function() { return null; },
        ensureDir: function() { return false; },
        ensureRootDir: function() { return false; },
        ensureSubDir: function() { return false; },
        readFile: function() { return null; },
        writeFile: function() { return false; }
    };
    
    // 修复 ReminderModule 的 totalSeconds 问题
    if (window.ReminderModule) {
        var originalCloseLockScreen = window.ReminderModule.closeLockScreen;
        if (originalCloseLockScreen) {
            window.ReminderModule.closeLockScreen = function() {
                try {
                    return originalCloseLockScreen.call(this);
                } catch (e) {
                    console.warn('[Web Adapter] closeLockScreen error:', e);
                    // Web 版：直接隐藏锁屏
                    var overlay = document.getElementById('lockOverlay');
                    if (overlay) overlay.classList.add('hidden');
                }
            };
        }
    }
    
    // 修复 NotificationModule
    if (!window.NotificationModule) {
        window.NotificationModule = {
            init: function() { return Promise.resolve(false); },
            initWithoutWait: function() {},
            setEnabled: function() {},
            send: function() { return Promise.resolve(false); },
            sendReminder: function() { return Promise.resolve(false); },
            sendTest: function() { return Promise.resolve(false); }
        };
    }
    
    // 禁用 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register = function() {
            console.log('[Web Adapter] Service Worker disabled for web demo');
            return Promise.reject(new Error('Service Worker disabled'));
        };
    }
    
    console.log('[Web Adapter] Initialized');
})();
`;

fs.writeFileSync(path.join(DOCS_DIR, 'js', 'web-adapter.js'), webAdapter);
console.log('  ✅ js/web-adapter.js');

// ========== 4. 创建 Web 版 lock.html ==========
console.log('\n📄 Creating web version of lock.html...');
createWebLockHTML();

// ========== 5. 处理 index.html ==========
console.log('\n📄 Processing index.html...');

const indexSrc = path.join(SRC_DIR, 'index.html');
const indexDest = path.join(DOCS_DIR, 'index.html');

if (fs.existsSync(indexSrc)) {
    let html = fs.readFileSync(indexSrc, 'utf-8');
    html = adaptHTMLForWeb(html);
    fs.writeFileSync(indexDest, html, 'utf-8');
    console.log('  ✅ index.html');
}

// ========== 6. 创建配置文件 ==========
console.log('\n⚙️  Creating configuration files...');

fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '');
fs.writeFileSync(path.join(DOCS_DIR, 'robots.txt'), 
`User-agent: *
Allow: /
`);
console.log('  ✅ .nojekyll, robots.txt');

console.log('\n✨ Web build complete!');
console.log(`📂 Output: ${DOCS_DIR}`);
console.log('🌐 Test: npx serve docs\n');

// ========== 辅助函数 ==========

function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    }
}

function copyFile(src, dest) {
    fs.copyFileSync(src, dest);
}

function createWebLockHTML() {
    const lockHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>锁屏提醒 - Web 演示版</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            user-select: none;
        }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            position: fixed;
        }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .lock-card {
            background: rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(20px);
            border-radius: 56px;
            padding: 48px 32px;
            width: 100%;
            max-width: 380px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        .lock-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 1s ease infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .lock-title {
            font-size: 36px;
            font-weight: 800;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #fff 0%, #a78bfa 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .lock-message {
            font-size: 18px;
            margin-bottom: 40px;
            opacity: 0.9;
            line-height: 1.6;
            color: white;
        }
        .timer-ring {
            position: relative;
            width: 220px;
            height: 220px;
            margin: 0 auto 32px;
        }
        .timer-circle-bg {
            width: 220px;
            height: 220px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            position: absolute;
        }
        .timer-circle-progress {
            width: 220px;
            height: 220px;
            border-radius: 50%;
            position: absolute;
            transform: rotate(-90deg);
        }
        .timer-center {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }
        .timer-number {
            font-size: 56px;
            font-weight: 800;
            color: white;
        }
        .timer-unit {
            font-size: 18px;
            margin-left: 4px;
            opacity: 0.7;
            color: white;
        }
        .timer-label {
            font-size: 12px;
            opacity: 0.5;
            margin-top: 6px;
            color: white;
        }
        .action-btn {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            border: none;
            padding: 18px 32px;
            border-radius: 60px;
            font-size: 20px;
            font-weight: 600;
            color: white;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
            box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
            margin-top: 20px;
        }
        .action-btn:active {
            transform: scale(0.97);
        }
        .action-btn.disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .reminder-suggestion {
            margin-top: 32px;
            font-size: 14px;
            opacity: 0.6;
            display: flex;
            gap: 24px;
            justify-content: center;
            color: white;
        }
        .suggestion-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
        }
        .suggestion-icon {
            font-size: 28px;
        }
        .web-notice {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.5);
            color: white;
            padding: 8px 20px;
            border-radius: 30px;
            font-size: 13px;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="lock-card">
        <div class="lock-icon">🧘</div>
        <div class="lock-title">该活动啦！</div>
        <div class="lock-message">站起来走走，伸个懒腰<br>活动一下筋骨</div>

        <div class="timer-ring">
            <div class="timer-circle-bg"></div>
            <div class="timer-circle-progress" id="progressCircle"></div>
            <div class="timer-center">
                <span class="timer-number" id="countdownSeconds">60</span>
                <span class="timer-unit">秒</span>
                <div class="timer-label">倒计时</div>
            </div>
        </div>

        <button id="unlockBtn" class="action-btn">等待倒计时...</button>

        <div class="reminder-suggestion">
            <div class="suggestion-item">
                <span class="suggestion-icon">🚶</span>
                <span>走动一下</span>
            </div>
            <div class="suggestion-item">
                <span class="suggestion-icon">💧</span>
                <span>喝杯热水</span>
            </div>
            <div class="suggestion-item">
                <span class="suggestion-icon">👀</span>
                <span>看看远方</span>
            </div>
        </div>
    </div>
    
    <div class="web-notice">⚡ Web 演示版 - 关闭此页面即可退出</div>

    <script>
        (function() {
            var params = new URLSearchParams(window.location.search);
            var duration = parseInt(params.get('duration')) || 60;
            var forceLock = params.get('forceLock') === 'true';
            
            if (duration < 10) duration = 60;
            
            var totalSeconds = duration;
            var currentSeconds = duration;
            
            var countdownSpan = document.getElementById('countdownSeconds');
            var unlockBtn = document.getElementById('unlockBtn');
            var progressCircle = document.getElementById('progressCircle');
            
            function updateDisplay() {
                countdownSpan.textContent = currentSeconds;
                
                var percent = (totalSeconds - currentSeconds) / totalSeconds;
                var angle = percent * 360;
                progressCircle.style.background = 'conic-gradient(from 0deg, #a78bfa 0deg, #a78bfa ' + angle + 'deg, rgba(255,255,255,0.1) ' + angle + 'deg)';
                
                if (forceLock) {
                    unlockBtn.textContent = '⏳ 请等待 ' + currentSeconds + ' 秒';
                    unlockBtn.classList.add('disabled');
                    unlockBtn.disabled = true;
                } else {
                    unlockBtn.textContent = '⏳ 请活动 ' + currentSeconds + ' 秒';
                    unlockBtn.classList.remove('disabled');
                    unlockBtn.disabled = false;
                }
            }
            
            function closeLock() {
                window.location.href = 'index.html';
            }
            
            unlockBtn.addEventListener('click', function() {
                if (!forceLock) {
                    if (currentSeconds > 0) {
                        if (confirm('活动时间还没到，确定要提前结束吗？')) {
                            closeLock();
                        }
                    } else {
                        closeLock();
                    }
                }
            });
            
            updateDisplay();
            
            var timer = setInterval(function() {
                if (currentSeconds <= 1) {
                    clearInterval(timer);
                    countdownSpan.textContent = '0';
                    setTimeout(closeLock, 500);
                } else {
                    currentSeconds--;
                    updateDisplay();
                }
            }, 1000);
            
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' || (e.ctrlKey && e.key === 'w')) {
                    e.preventDefault();
                }
            });
        })();
    </script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(DOCS_DIR, 'lock.html'), lockHTML);
}

function adaptHTMLForWeb(html) {
    // 添加 Web 适配脚本（在所有脚本之前）
    const adapterScript = '<script src="./js/web-adapter.js"></script>';
    html = html.replace(
        '<script src="./js/shared/constants.js">',
        adapterScript + '\n    <script src="./js/shared/constants.js">'
    );
    
    // 添加 Web 提示条
    const webNotice = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 10px 16px; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap;">
        <span>⚡ Web 演示版 - 通知和锁屏功能受限</span>
        <a href="https://github.com/neopen/active-break-clock/releases" target="_blank" style="background: white; color: #667eea; padding: 6px 16px; border-radius: 20px; text-decoration: none; font-weight: 600; font-size: 13px;">📥 下载桌面版</a>
    </div>
    `;
    
    html = html.replace('<div class="app-container">', webNotice + '<div class="app-container">');
    
    // 移除下载桌面版链接
    html = html.replace(
        /<div class="status-bar-right">[\s\S]*?<\/div>/g,
        '<div class="status-bar-right"></div>'
    );
    
    // 添加 Web 模式标识
    html = html.replace('<body>', '<body data-mode="web">');
    
    return html;
}