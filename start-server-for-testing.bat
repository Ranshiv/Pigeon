@echo off
echo 🚀 Starting Pigeon Server for Visual Designer Testing...
echo.

echo 📋 Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo ❌ Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

echo 📋 Checking npm packages...
if not exist node_modules (
    echo 📦 Installing npm packages...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install packages!
        pause
        exit /b 1
    )
)

echo 🗄️ Starting MongoDB (if needed)...
echo Note: Make sure MongoDB is running on your system

echo 🌐 Starting Pigeon Server...
echo Server will start on http://localhost:5001
echo.
echo 💡 To test visual designer persistence:
echo    1. Let this server run
echo    2. In another terminal, run: node test-comprehensive-persistence.js
echo.

node server.js
