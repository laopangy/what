@echo off
cd /d "%~dp0"

:: Open the graphical prerequisite checker and installer.
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0setup.ps1"
