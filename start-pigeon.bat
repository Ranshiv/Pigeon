@echo off
echo ======================================
echo      Starting Pigeon Application
echo ======================================
echo.

:: -------------------------------------------------
:: 1. Check prerequisites (Node.js, npm, Windows Terminal)
:: -------------------------------------------------
where node >nul 2>nul || (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Download: https://nodejs.org/
    pause & exit /b 1
)

where npm >nul 2>nul || (
    echo ERROR: npm is not installed or not in PATH.
    echo Download: https://nodejs.org/
    pause & exit /b 1
)

:: -------------------------------------------------
:: 2. Verify we are in the project root
:: -------------------------------------------------
if not exist "server.js" (
    echo ERROR: server.js not found — run this from the Pigeon root directory.
    pause & exit /b 1
)

if not exist "client\package.json" (
    echo ERROR: client\package.json not found — run this from the Pigeon root directory.
    pause & exit /b 1
)

:: -------------------------------------------------
:: 3. Try to use Windows Terminal for two-tab launch
:: -------------------------------------------------
where wt >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Launching backend and frontend in one Windows Terminal window...
    wt ^
        new-tab -d . cmd /k "title Pigeon Server && echo Starting Pigeon Server... && node server.js" ^
        ; new-tab -d .\client cmd /k "title Pigeon Client && echo Starting Pigeon Client... && npm start"
    echo.
    echo Backend → http://localhost:5001
    echo Frontend → http://localhost:3000
    echo Both tabs are now running inside Windows Terminal.
    pause
    exit /b 0
)

:: -------------------------------------------------
:: 4. Fallback: open two classic cmd windows
:: -------------------------------------------------
echo Windows Terminal not found — falling back to two separate windows...
start "Pigeon Server" cmd /k "title Pigeon Server && echo Starting Pigeon Server... && node server.js"
timeout /t 3 /nobreak >nul
start "Pigeon Client" cmd /k "title Pigeon Client && echo Starting Pigeon Client... && cd client && npm start"

echo.
echo Backend → http://localhost:5001
echo Frontend → http://localhost:3000
echo Two command windows have been opened.
pause
