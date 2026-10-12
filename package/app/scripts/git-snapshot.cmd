@echo off
rem Save a restore point of the current code (run any time, e.g. after each merged task).
setlocal
cd /d "%~dp0.."
git add -A
git commit -q -m "snapshot %date% %time%"
if errorlevel 1 (echo [i] Nothing new to save.) else (echo [OK] Restore point saved.)
git log --oneline -5
pause
endlocal
