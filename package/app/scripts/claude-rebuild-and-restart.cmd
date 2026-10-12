@echo off
rem Finance Hub: rebuild dist and let the watchdog restart port 4173.
rem Written by Claude on 2026-10-06. Log: ..\..\runtime-logs\claude-rebuild.log
setlocal
cd /d "%~dp0.."
set "LOG=%~dp0..\..\..\runtime-logs\claude-rebuild.log"
set "BACKUP=%~dp0..\..\..\dist-backup-before-claude"
echo [%date% %time%] START > "%LOG%"
if not exist "%BACKUP%\index.js" (
  echo backing up dist to %BACKUP% >> "%LOG%"
  robocopy "dist" "%BACKUP%" /E /NFL /NDL /NJH /NJS >> "%LOG%" 2>&1
)
echo [%date% %time%] BUILD >> "%LOG%"
call pnpm run build >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%date% %time%] BUILD FAILED - restoring previous dist >> "%LOG%"
  robocopy "%BACKUP%" "dist" /MIR /NFL /NDL /NJH /NJS >> "%LOG%" 2>&1
  exit /b 1
)
echo [%date% %time%] RESTART 4173 >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }" >> "%LOG%" 2>&1
echo [%date% %time%] DONE >> "%LOG%"
endlocal
