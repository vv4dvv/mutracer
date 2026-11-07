@echo off
cd /d "%~dp0..\.."
rem Vite empties dist-viewer itself, but some editors replace fs.rm with a
rem recycle-bin shim that fails on secondary drives, so clear it first.
if exist "dist-viewer" rd /s /q "dist-viewer"
echo Building the viewer...
call npm run build:viewer
if errorlevel 1 (echo Build failed. & pause & exit /b 1)
echo Fixing asset paths...
node "scripts\viewer-standalone\fix-paths.mjs" "dist-viewer"
echo Copying the launcher...
copy /y "scripts\viewer-standalone\serve.mjs" "dist-viewer\serve.mjs" >nul
copy /y "scripts\viewer-standalone\*.bat" "dist-viewer\" >nul
copy /y "scripts\viewer-standalone\README.txt" "dist-viewer\README.txt" >nul
echo.
echo Done: dist-viewer\  (double-click the .bat inside to run it)
pause
