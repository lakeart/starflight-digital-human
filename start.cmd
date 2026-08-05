@echo off
setlocal
cd /d "%~dp0"
echo Starting aviation tourism digital human frontend...
echo.
echo Open this URL in your browser:
echo   http://127.0.0.1:5173
echo.
echo Tip: keep this window open while using the page.
echo.
call npm.cmd run dev -- --host 127.0.0.1
pause
