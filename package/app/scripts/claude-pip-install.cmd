@echo off
rem 为佑诚数据脚本安装所需的 Python 包（装进 .venv-akshare，数据工作台默认用这个环境运行脚本）
setlocal
cd /d "%~dp0.."
set "LOG=%~dp0..\..\..\runtime-logs\claude-pip.log"
echo [%date% %time%] START > "%LOG%"
set "PY=.venv-akshare\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" -m pip install --disable-pip-version-check -q aiohttp defusedxml requests pandas numpy scipy yfinance beautifulsoup4 openpyxl ta ffn py_vollib baostock geopy gnews deep_translator vaderSentiment >> "%LOG%" 2>&1
echo [%date% %time%] CORE EXIT %errorlevel% >> "%LOG%"
"%PY%" -m pip install --disable-pip-version-check -q financepy >> "%LOG%" 2>&1
echo [%date% %time%] FINANCEPY EXIT %errorlevel% >> "%LOG%"
"%PY%" -c "import aiohttp, defusedxml, yfinance, pandas; print('OK', aiohttp.__version__)" >> "%LOG%" 2>&1
echo [%date% %time%] DONE >> "%LOG%"
endlocal
