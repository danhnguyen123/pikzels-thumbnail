@echo off
REM Package Studio - double-click to launch
title Package Studio
cd /d "%~dp0"

echo Starting Package Studio server...
start "Package Studio Server" cmd /k "python server.py"

echo Waiting for server to start...
timeout /t 4 /nobreak >nul

echo Opening browser...
start "" http://localhost:8000

exit
