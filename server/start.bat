 b @echo off
echo ==========================================
echo   OOU AWARDS - Backend Setup
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo OK - Node.js is installed

echo.
echo [2/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo OK - Dependencies installed

echo.
echo [3/3] Creating environment file...
if not exist ".env" (
    copy .env.example .env
    echo OK - Created .env file
    echo.
    echo IMPORTANT: Please edit .env and add your Paystack keys!
    echo.
) else (
    echo OK - .env already exists
)

echo.
echo ==========================================
echo   Starting Server...
echo ==========================================
echo.
echo Server will run at: http://localhost:3001
echo Admin panel: admin.html (after starting frontend)
echo.
echo Press Ctrl+C to stop the server
echo.

npm start
