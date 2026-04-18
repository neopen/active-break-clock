module.exports = {
  env: {
    browser: true,    // 启用浏览器全局变量（window, document）
    es2021: true,     // 启用 ES2021 语法支持
    node: true,       // 启用 Node.js 全局变量（require, __dirname）
    electron: true    // 启用 Electron 特有 API（ipcRenderer, remote）
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'  // 支持 import/export
  },
  rules: {
    'no-console': 'warn',        // 禁止 console（开发时可临时关闭）
    'no-unused-vars': 'error',   // 未使用变量报错
    'semi': ['error', 'always'], // 强制语句末尾加分号
    'quotes': ['error', 'single'], // 强制单引号
    'indent': ['error', 2],      // 2 空格缩进
    'linebreak-style': ['error', 'windows'] // 强制 CRLF 换行（Windows）
  }
}