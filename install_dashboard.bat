@echo off
echo Installing Asset Dashboard Dependencies...

echo.
echo 1/2 Installing Backend...
cd scripts\dashboard
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Backend installation failed. Make sure Node.js/npm is installed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 2/2 Installing Frontend...
cd client
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Frontend installation failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================
echo Done! Please run dashboard.bat now.
echo ========================================
pause
