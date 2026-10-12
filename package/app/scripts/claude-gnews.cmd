@echo off
set "LOG=%~dp0..\..\..\runtime-logs\claude-gnews.log"
set "U=https://news.google.com/articles/CBMiiwFBVV95cUxOVGVNOTRDQmRDbm9CWWh4NUlXZFdubEpnd2FneFVUT25KUmZ4UzdhRXBaXzZVVWtLWG1MWnF4b1BNYUFoMkphUENuOUFVME1zSVVyM045S2NtVlVPTzR6OUZNR1NtUjM4dkp6emdIdWNFSXV2RzdyY2FHU052cVowS3hvd3pESThubnRn?hl=en-US&gl=US&ceid=US:en"
curl.exe -s -L -m 20 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" -o "%TEMP%\gn.html" -w "HTTP %%{http_code} final %%{url_effective}\n" "%U%" > "%LOG%" 2>&1
powershell -NoProfile -Command "$t=[IO.File]::ReadAllText('%TEMP%\gn.html'); 'len='+$t.Length; [regex]::Matches($t,'data-n-a-(sg|ts)=\"[^\"]+\"') | %% { $_.Value }; [regex]::Matches($t,'<title>[^<]*') | %% { $_.Value }" >> "%LOG%" 2>&1
