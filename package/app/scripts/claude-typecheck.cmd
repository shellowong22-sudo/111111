@echo off
rem Type check the Ucheer files written by Claude. Log: ..\..\runtime-logs\claude-typecheck.log
setlocal
cd /d "%~dp0.."
set "LOG=%~dp0..\..\..\runtime-logs\claude-typecheck.log"
echo [%date% %time%] START > "%LOG%"
call pnpm exec cross-env NODE_OPTIONS=--max-old-space-size=6144 tsc -p tsconfig.claude-uc.json --pretty false >> "%LOG%" 2>&1
echo [%date% %time%] EXIT %errorlevel% >> "%LOG%"
endlocal
