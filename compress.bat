@echo off
chcp 65001 >nul
echo ========================================
echo   HealthClock 极限压缩工具
echo ========================================
echo.


set UPX="lib\upx.exe"
set SEVENZIP="D:\Program Files\7-Zip\7z.exe"

if not exist %SEVENZIP% (
    echo 错误: 未找到 7-Zip，请安装后重试
    pause
    exit /b 1
)

REM 设置 UPX 路径
if not exist %UPX% (
    echo 错误: 未找到 upx.exe
    pause
    exit /b 1
)

echo [1/4] 清理旧文件...
rd /s /q dist 2>nul
echo 完成

REM 安装精简版 Electron： npm install electron@41.2.0 --save-dev --no-optional
echo.
echo [2/4] 打包便携版...
call npx electron-builder --win --x64
echo 完成

echo [3/4] UPX 极限压缩（多种参数组合）...
for %%f in (dist\*.exe) do (
    echo 压缩: %%f
    echo 压缩前:
    dir "%%f" | find "%%~nxf"
    
    REM 先尝试标准压缩
    %UPX% --best "%%f"
    
    REM 如果支持，再尝试 LZMA
    %UPX% --lzma "%%f" 2>nul
)
echo 完成

echo [4/4] 7z 极限压缩...
%SEVENZIP% a -t7z -mx=9 -mfb=273 -ms=10g -mmt=4 -sdel dist\HealthClock_极限压缩.7z dist\*.exe
echo 完成

echo.
dir dist\*.7z
pause