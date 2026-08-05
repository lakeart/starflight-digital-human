@echo off
setlocal
cd /d "%~dp0"
echo Starting backend API on http://127.0.0.1:5001/api ...
echo.

if not exist ".venv\Scripts\python.exe" (
  echo Creating local Python virtual environment in .venv ...
  py -3.12 -m venv .venv
  if errorlevel 1 (
    echo.
    echo Could not create .venv. Please install Python 3.12 or check the py launcher.
    pause
    exit /b 1
  )
)

".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 (
  echo.
  echo Dependency install failed. Please check the pip output above.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" backend\app.py
pause
