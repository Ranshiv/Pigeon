@echo off
echo Starting Pigeon Application...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js and npm are available
echo.

REM Check if we're in the correct directory
if not exist "server.js" (
    echo ERROR: server.js not found in current directory
    echo Please run this script from the Pigeon root directory
    pause
    exit /b 1
)

if not exist "client\package.json" (
    echo ERROR: client directory not found
    echo Please run this script from the Pigeon root directory
    pause
    exit /b 1
)

echo Starting Pigeon Server...
start "Pigeon Server" cmd /k "echo Starting Pigeon Server... && node server.js"

REM Wait a moment for the server to start
timeout /t 3 /nobreak >nul

echo Starting Pigeon Client...
start "Pigeon Client" cmd /k "echo Starting Pigeon Client... && cd client && npm start"

echo.
echo ======================================
echo Pigeon Application is starting!
echo ======================================
echo.
echo Server will be running at: http://localhost:5001
echo Client will be running at: http://localhost:3000
echo.
echo Two new command windows have opened:
echo 1. Pigeon Server - Backend API server
echo 2. Pigeon Client - React frontend
echo.
echo To stop the application:
echo - Close both command windows, or
echo - Press Ctrl+C in each window
echo.
echo This window can be closed safely.
echo.
pause
