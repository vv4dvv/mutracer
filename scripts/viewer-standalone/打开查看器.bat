@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 18 or newer is required: https://nodejs.org/ & pause & exit /b 1)
node "%~dp0serve.mjs" "%~dp0..\..\dist-viewer"
pause
