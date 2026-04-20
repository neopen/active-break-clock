/**
 * HealthClock - Neutralino.js 主进程入口
 * 功能：日志管理、窗口控制、事件通信、开机自启、通知
 * 文档: https://neutralino.js.org/docs/api
 */

const { app, window, os, filesystem, events, debug } = require('@neutralinojs/lib');

// ============ 全局状态 ============
let logDir = null;
let logFile = null;
let logBuffer = [];
let logWriteTimer = null;
const LOG_FLUSH_INTERVAL = 1000;

let mainWindowId = 'main';
let lockWindowId = 'lock';
let isLockWindowShowing = false;
let lockTimer = null;

// ============ 日志系统 ============

/**
 * 异步刷新日志缓冲到文件
 */
async function flushLogBuffer() {
  if (logBuffer.length === 0 || !logFile) return;
  const messages = logBuffer.join('');
  logBuffer = [];
  try {
    await filesystem.writeFile(logFile, messages, { append: true });
  } catch (err) {
    console.error('[LOG] Write failed:', err);
  }
}

/**
 * 调度日志刷新（防抖）
 */
function scheduleLogFlush() {
  if (logWriteTimer) return;
  logWriteTimer = setTimeout(() => {
    logWriteTimer = null;
    flushLogBuffer();
  }, LOG_FLUSH_INTERVAL);
}

/**
 * 初始化日志目录（跨平台兼容）
 */
async function initLogDir() {
  try {
    // Neutralino 返回的路径可能含 \，统一转为 /
    let dataPath = await app.getDataPath();
    dataPath = dataPath.replace(/\\/g, '/');

    logDir = `${dataPath}/Logs`;
    const dirExists = await filesystem.exists(logDir);
    if (!dirExists) {
      await filesystem.createDirectory(logDir);
    }

    const today = new Date().toISOString().split('T')[0];
    logFile = `${logDir}/HealthClock_${today}.log`;
    console.log('[MAIN] Log initialized at:', logFile);
    return true;
  } catch (error) {
    console.error('[MAIN] Log init failed:', error);
    return false;
  }
}

/**
 * 统一日志函数（重写 console 方法）
 */
function log(level, ...args) {
  const message = `${new Date().toISOString()} - ${level} - ${args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ')}\n`;

  // 同时输出到控制台
  if (level === 'ERROR') {
    console.error(message.trim());
  } else {
    console.log(message.trim());
  }

  // 异步写入文件
  if (logFile) {
    logBuffer.push(message);
    scheduleLogFlush();
  }
}

// 重写全局 console 方法
console.log = (...args) => log('INFO', ...args);
console.error = (...args) => log('ERROR', ...args);
console.warn = (...args) => log('WARN', ...args);
console.info = (...args) => log('INFO', ...args);

// ============ 系统功能 ============

/**
 * 设置开机自启（Windows 兼容）
 */
async function setAutoLaunch(enable) {
  try {
    // Neutralino v6: os.setStartup 参数简化
    await os.setStartup({
      name: 'HealthClock',
      // command 为可执行文件路径，Neutralino 自动填充当前应用路径
      enabled: enable
    });
    console.log('[MAIN] Auto launch set to:', enable);
    return true;
  } catch (e) {
    console.error('[MAIN] Set auto launch failed:', e);
    return false;
  }
}

/**
 * 获取开机自启状态
 */
async function getAutoLaunchState() {
  try {
    const settings = await os.getStartupSettings();
    return settings?.enabled || false;
  } catch (e) {
    console.error('[MAIN] Get auto launch failed:', e);
    return false;
  }
}

/**
 * 发送系统通知
 */
async function showNotification(options = {}) {
  try {
    await os.showNotification({
      title: options.title || '起来走走',
      content: options.body || '该活动一下了~',
      icon: options.icon || '/icons/icon-256.png' // 路径以 / 开头
    });
    return true;
  } catch (e) {
    console.error('[MAIN] Notification failed:', e);
    return false;
  }
}

/**
 * 获取用户数据目录（跨平台）
 */
async function getUserDataPath() {
  try {
    const path = await app.getDataPath();
    return path.replace(/\\/g, '/');
  } catch (e) {
    console.error('[MAIN] Get userData path failed:', e);
    return null;
  }
}

// ============ 窗口管理 ============

/**
 * 创建主窗口（由 neutralino.config.json 自动创建，此函数用于确保加载）
 */
async function ensureMainWindow() {
  try {
    // 检查主窗口是否存在
    const exists = await window.exists(mainWindowId);
    if (!exists) {
      // Neutralino 默认已创建主窗口，此处仅做兜底
      console.log('[Window] Main window not found, skipping create');
      return;
    }

    // 确保加载正确页面（路径以 / 开头）
    await window.loadURL(mainWindowId, '/index.html');
    console.log('[Window] Main window ensured');
  } catch (error) {
    console.error('[Window] Ensure main failed:', error);
  }
}

/**
 * 显示/聚焦主窗口
 */
async function showMainWindow() {
  try {
    await window.show(mainWindowId);
    await window.setFocus(mainWindowId);
  } catch (error) {
    console.error('[Window] Show main failed:', error);
  }
}

/**
 * 隐藏主窗口
 */
async function hideMainWindow() {
  try {
    await window.hide(mainWindowId);
  } catch (error) {
    console.error('[Window] Hide main failed:', error);
  }
}

/**
 * 创建锁屏窗口（Neutralino 动态窗口）
 */
/**
 * 创建锁屏窗口（使用配置文件中的 lock 模式）
 */
async function createLockWindow(durationSeconds, forceLock) {
  console.log('[Window] ========== CREATE LOCK WINDOW ==========');
  console.log('[Window] durationSeconds:', durationSeconds, 'type:', typeof durationSeconds);
  console.log('[Window] forceLock:', forceLock);

  if (lockTimer) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }

  // 参数校验和转换
  let validDuration = parseInt(durationSeconds);
  console.log('[Window] After parseInt:', validDuration);

  if (isNaN(validDuration) || validDuration < 10) {
    console.log('[Window] Invalid duration, using default 60');
    validDuration = 60;
  }

  console.log('[Window] Final duration:', validDuration, 'seconds');

  try {
    // 检查窗口是否已存在
    const exists = await window.exists(lockWindowId).catch(() => false);
    console.log('[Window] Lock window exists:', exists);

    if (exists) {
      await window.destroy(lockWindowId);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 创建锁屏窗口
    console.log('[Window] Creating lock window with mode: lock');
    await window.create(lockWindowId, {
      mode: 'lock',
      url: `/lock.html?duration=${validDuration}&forceLock=${forceLock ? 'true' : 'false'}`
    });

    isLockWindowShowing = true;
    console.log('[Window] Lock window created successfully');

    // 设置超时自动关闭
    lockTimer = setTimeout(async () => {
      console.log('[Window] Lock timeout, force closing');
      await closeLockWindow();
    }, validDuration * 1000 + 3000);

  } catch (error) {
    console.error('[Window] Create lock failed:', error);
  }
}

// 辅助函数：延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 关闭锁屏窗口
 */
async function closeLockWindow() {
  if (lockTimer) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
  if (!isLockWindowShowing) return;

  isLockWindowShowing = false;

  try {
    const winExists = await window.exists(lockWindowId);
    if (winExists) {
      await window.destroy(lockWindowId); // Neutralino 使用 destroy 而非 close
    }

    // 通知渲染层锁屏已关闭
    await events.dispatch('lock-closed', {});

    // 恢复主窗口
    await showMainWindow();
    console.log('[Window] Lock window closed');
  } catch (error) {
    console.error('[Window] Close lock failed:', error);
  }
}

// ============ 事件通信 ============

/**
 * 注册所有 IPC 事件处理器
 * ⚠️ Neutralino 无 event.reply，统一使用 events.dispatch 响应
 */
function setupEventHandlers() {
  // 显示锁屏
  events.on('show-lock', async (data) => {
    console.log('[IPC] show-lock:', data?.duration, data?.forceLock);
    await hideMainWindow();
    await createLockWindow(data?.duration, data?.forceLock);
  });

  // 锁屏完成（用户主动结束）
  events.on('lock-complete', async () => {
    console.log('[IPC] lock-complete');
    await events.dispatch('stop-sound', {});
    await closeLockWindow();
  });

  // 隐藏锁屏（强制退出）
  events.on('hide-lock', async () => {
    console.log('[IPC] hide-lock');
    await events.dispatch('stop-sound', {});
    await closeLockWindow();
  });

  // 停止提示音
  events.on('stop-sound-request', async () => {
    console.log('[IPC] stop-sound-request');
    await events.dispatch('stop-sound', {});
  });

  // 获取用户数据路径
  events.on('get-user-data-path', async () => {
    const path = await getUserDataPath();
    await events.dispatch('user-data-path', { path }); // 用 dispatch 替代 reply
  });

  // 获取开机自启状态
  events.on('get-auto-launch', async () => {
    const enabled = await getAutoLaunchState();
    await events.dispatch('auto-launch-state', { enabled });
  });

  // 设置开机自启
  events.on('set-auto-launch', async (data) => {
    const enable = data?.enabled;
    const result = await setAutoLaunch(enable);
    await events.dispatch('auto-launch-set', { success: result });
  });

  // 发送通知
  events.on('show-notification', async (data) => {
    console.log('[IPC] show-notification:', data?.title);
    const result = await showNotification(data);
    await events.dispatch('notification-result', { success: result });
  });

  // 异步通知（带延迟回调）
  events.on('show-notification-async', async (data) => {
    console.log('[IPC] show-notification-async:', data?.title);
    await showNotification(data);
    setTimeout(async () => {
      await events.dispatch('notification-closed', { closed: true });
    }, 5000);
  });

  // 请求通知权限（Neutralino 默认允许）
  events.on('request-notification-permission', async () => {
    console.log('[IPC] request-notification-permission');
    await events.dispatch('notification-permission-result', { granted: true });
  });

  // 退出应用
  events.on('exit-app', async () => {
    console.log('[IPC] exit-app');
    await app.exit();
  });

  console.log('[IPC] All event handlers initialized');
}

// ============ 主入口 ============

async function main() {
  console.log('[MAIN] HealthClock starting...');

  // 1. 必须初始化 Neutralino
  await Neutralino.init();

  // 2. 初始化日志
  await initLogDir();

  // 3. 注册事件处理器
  setupEventHandlers();

  // 4. 确保主窗口加载正确页面
  await ensureMainWindow();

  // 5. 检查开机自启状态（仅日志，不自动设置）
  const isAutoLaunch = await getAutoLaunchState();
  console.log('[MAIN] Auto launch enabled:', isAutoLaunch);

  // 6. 启动完成
  console.log('[MAIN] HealthClock ready');

  // ⚠️ 不要调用 Neutralino.exit()，让应用在用户关闭时自然退出
}

// 启动应用 + 全局错误捕获
main().catch((err) => {
  console.error('[MAIN] Uncaught error:', err);
  // 可选：写入崩溃日志
  if (logFile) {
    filesystem.writeFile(logFile, `[CRASH] ${new Date().toISOString()} - ${JSON.stringify(err)}\n`, { append: true })
      .catch(() => { });
  }
});