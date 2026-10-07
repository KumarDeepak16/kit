@echo off
rem Double-click to install the Kit helper (needed for Drop). No admin rights required.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
