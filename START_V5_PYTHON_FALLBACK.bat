@echo off
cd /d "%~dp0"
title Classroom Administration System V5 - Python fallback

where py >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8080/login.html"
  py -m http.server 8080
  pause
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8080/login.html"
  python -m http.server 8080
  pause
  goto :eof
)

echo Python was not found.
pause
