@echo off
chcp 65001 >nul
title Classroom Administration System V5
cd /d "%~dp0"

echo ============================================
echo  Classroom Administration System V5
echo ============================================
echo.
echo Starting local web server...
echo This version does NOT require Python.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080

echo.
echo The local server stopped or could not start.
echo If you saw an error above, send a screenshot of this window.
echo.
pause

REM V5.3 Google OAuth uses fixed localhost port 8080.
