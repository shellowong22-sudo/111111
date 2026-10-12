@echo off
rem One-time git baseline for the Ucheer terminal. Safe to run again.
setlocal
cd /d "%~dp0.."
where git >/dev/null 2>nul
if errorlevel 1 (
  echo [X] Git is not installed. Install it from https://git-scm.com/download/win and run this file again.
  pause
  exit /b 1
)
if exist ".git" (
  echo [i] .git already exists - skip init.
) else (
  git init -b main
)
git config core.autocrlf false
git config core.longpaths true
git config user.name >/dev/null 2>/dev/null || git config user.name "Shello"
git config user.email >/dev/null 2>/dev/null || git config user.email "shellowong22@gmail.com"
git add -A
git commit -q -m "baseline: terminal state"
echo.
echo ===== DONE =====
git log --oneline -3
pause
endlocal
