@echo off
setlocal
set "LOG=%~dp0..\..\..\runtime-logs\claude-netprobe.log"
echo [%date% %time%] START > "%LOG%"
for /f "usebackq delims=" %%U in ("%~dp0claude-netprobe-urls.txt") do (
  echo ==== %%U >> "%LOG%"
  curl.exe -s -m 40 -o "%TEMP%\np.txt" -w "HTTP %%{http_code} %%{time_total}s\n" -H "Referer: https://finance.sina.com.cn" -A "Mozilla/5.0" "%%U" >> "%LOG%" 2>&1
  powershell -NoProfile -Command "$t=[IO.File]::ReadAllText('%TEMP%\np.txt'); $t.Substring(0,[Math]::Min(700,$t.Length))" >> "%LOG%" 2>&1
  echo. >> "%LOG%"
)
echo [%date% %time%] DONE >> "%LOG%"
endlocal
