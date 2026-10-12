$ErrorActionPreference = 'Continue'
$appRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $appRoot '..\..\runtime-logs'
$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $appRoot '..\..\..\..'))
$mysqlExecutable = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
$mysqlConfig = Join-Path $workspaceRoot 'runtime\mysql3307\my.ini'
$ifindSdkPath = 'C:\Users\shell\Desktop\THSDataInterface_Windows_20260529\THSDataInterface_Windows\bin\x64'
$ifindCredentialFile = Join-Path $appRoot '.runtime\ifind-credential.xml'
$freeLlmApiRoot = 'C:\Users\shell\Documents\Codex\2026-09-22\c-users-shell-documents-codex-2026-3\work\freellmapi\freellmapi-main'
$freeLlmApiPort = 3003
$freeLlmApiDb = Join-Path $freeLlmApiRoot 'server\data\freeapi.db'
$freeLlmApiSqlite = 'D:\Anaconda\Library\bin\sqlite3.exe'
$freeLlmApiProcess = $null
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$lastDbReady = $false
$lastFreeLlmApiReady = $false
$lastOmniRouteReady = $false

function Get-OmniRouteSetting([string]$name) {
  # The local media bridge key is provisioned once on this machine and must
  # remain server-side. Read it from the protected runtime file instead of
  # placing the value in the frontend bundle, source tree, or watchdog logs.
  if ($name -eq 'OMNIROUTE_API_KEY') {
    $secretFile = Join-Path $env:USERPROFILE '.omniroute\ucheer-media-api-key.secret'
    if (Test-Path -LiteralPath $secretFile) {
      $secret = (Get-Content -LiteralPath $secretFile -Raw -ErrorAction SilentlyContinue).Trim()
      if ($secret) { return $secret }
    }
  }
  # dotenv loads .env into the Node child, but the watchdog must read the
  # same file itself before it can authenticate a health check.
  $envFile = Join-Path $appRoot '.env'
  if (Test-Path -LiteralPath $envFile) {
    $pattern = '^\s*' + [regex]::Escape($name) + '\s*=\s*(.*?)\s*$'
    $match = Select-String -LiteralPath $envFile -Pattern $pattern -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($match) {
      $value = $match.Matches[0].Groups[1].Value.Trim().Trim('"', "'")
      if ($value) { return $value }
    }
  }
  $processValue = [Environment]::GetEnvironmentVariable($name, 'Process')
  if ($processValue) { return $processValue }
  return [Environment]::GetEnvironmentVariable($name, 'User')
}

function Ensure-FreeLlmApi {
  # A listening port is not enough: another local service previously occupied
  # 3002 and caused the terminal to label a non-AI HTTP server as the gateway.
  $gatewayReady = $false
  try {
    $probe = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/v1/models" -f $freeLlmApiPort) -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    $gatewayReady = $probe.StatusCode -ne 404
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    # 401/403 means the FreeLLMAPI route exists but needs its key; 404 means
    # this is not the OpenAI-compatible gateway.
    $gatewayReady = $status -in @(401, 403)
  }
  if ($gatewayReady) {
    return $true
  }

  if (-not (Test-Path -LiteralPath (Join-Path $freeLlmApiRoot 'server\dist\index.js'))) {
    return $false
  }

  if ($script:freeLlmApiProcess -and -not $script:freeLlmApiProcess.HasExited) {
    return $false
  }

  $gatewayStdout = Join-Path $logRoot ("freellmapi-{0}.stdout.log" -f $freeLlmApiPort)
  $gatewayStderr = Join-Path $logRoot ("freellmapi-{0}.stderr.log" -f $freeLlmApiPort)
  # The watchdog later sets PORT=4173 for Finance Hub. Override it only for
  # the child gateway, then restore the watchdog environment before starting
  # the terminal process so the two services cannot bind the same port.
  $previousPort = $env:PORT
  $env:PORT = [string]$freeLlmApiPort
  try {
    $script:freeLlmApiProcess = Start-Process -FilePath 'D:\node.exe' -ArgumentList 'server/dist/index.js' -WorkingDirectory $freeLlmApiRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $gatewayStdout -RedirectStandardError $gatewayStderr
  } finally {
    if ($null -eq $previousPort) {
      Remove-Item Env:PORT -ErrorAction SilentlyContinue
    } else {
      $env:PORT = $previousPort
    }
  }
  return $false
}

while ($true) {
  $freeLlmApiReady = Ensure-FreeLlmApi
  $dbReady = Test-NetConnection -ComputerName '127.0.0.1' -Port 3307 -InformationLevel Quiet -WarningAction SilentlyContinue
  $omniRouteApiKey = Get-OmniRouteSetting 'OMNIROUTE_API_KEY'
  $manualOmniRouteBaseUrl = Get-OmniRouteSetting 'OMNIROUTE_BASE_URL'
  # A listening port is not a usable AI route: require a live model catalog.
  # Local OmniRoute can intentionally run without an API key (for example
  # gTTS, local executors, or a loopback-only deployment), so the probe must
  # not make a key a prerequisite. Remote HTTPS deployments still require the
  # configured key inside the app's normal gateway validation.
  $omniRouteReady = $false
  if (Test-NetConnection -ComputerName '127.0.0.1' -Port 20128 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    try {
      $headers = @{}
      if ($omniRouteApiKey) { $headers.Authorization = "Bearer $omniRouteApiKey" }
      $modelsResponse = Invoke-RestMethod -Uri 'http://127.0.0.1:20128/v1/models' -Headers $headers -TimeoutSec 4
      $omniRouteReady = @($modelsResponse.data).Count -gt 0
    } catch {
      $omniRouteReady = $false
    }
  }
  if (-not $dbReady -and (Test-Path -LiteralPath $mysqlExecutable) -and (Test-Path -LiteralPath $mysqlConfig)) {
    # Keep the config path quoted: the workspace path may contain spaces and
    # mysqld otherwise treats the remainder as extra command-line arguments.
    $mysqlArguments = '--defaults-file="{0}"' -f $mysqlConfig
    Start-Process -FilePath $mysqlExecutable -ArgumentList $mysqlArguments -WindowStyle Hidden
    $dbDeadline = (Get-Date).AddSeconds(25)
    do {
      Start-Sleep -Milliseconds 500
      $dbReady = Test-NetConnection -ComputerName '127.0.0.1' -Port 3307 -InformationLevel Quiet -WarningAction SilentlyContinue
    } until ($dbReady -or (Get-Date) -gt $dbDeadline)
  }

  $listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  # If the web process was started while MySQL was still offline, its
  # DATABASE_URL was intentionally absent and the lazy DB client remains
  # disabled for that process. Restart exactly once when the database comes
  # back so persisted FinMind/OpenBB observations become readable without a
  # manual restart. The transition guard prevents a restart on every poll.
  if ($listener -and $dbReady -and -not $lastDbReady) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    $listener = $null
    Start-Sleep -Milliseconds 500
  }
  if ($listener -and ($freeLlmApiReady -ne $lastFreeLlmApiReady)) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    $listener = $null
    Start-Sleep -Milliseconds 500
  }
  # Switch only after the model directory can be read with configured credentials.
  if ($listener -and ($omniRouteReady -ne $lastOmniRouteReady)) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    $listener = $null
    Start-Sleep -Milliseconds 500
  }
  if (-not $listener) {
    if ($dbReady) {
      $env:DATABASE_URL = 'mysql://root@127.0.0.1:3307/finance_hub'
    } else {
      Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    }
    $env:PORT = '4173'
    # The desktop preview must own its configured port. Falling forward to
    # 4174/4175 creates invisible duplicate servers that keep serving stale
    # builds while the browser remains attached to 4173.
    $env:STRICT_PORT = 'true'
    $env:NODE_ENV = 'production'
    # This watchdog is for the current local desktop preview, not deployment.
    # Development credentials are accepted only with loopback binding.
    $env:LOCAL_PREVIEW = 'true'
    $env:BIND_HOST = '127.0.0.1'
    $env:AUTH_MODE = 'local'
    $env:LOCAL_ADMIN_PASSWORD = 'local-admin-change-me'
    $env:STANDALONE_MODE = 'true'
    $env:APP_ORIGIN = 'http://localhost:4173'
    $env:SCHEDULER_SECRET = 'finance-hub-local-scheduler-v1-4173'
    $env:STANDALONE_SCHEDULER_USER_ID = '1'
    # Ucheer AI uses the local FreeLLMAPI OpenAI-compatible gateway. The
    # gateway's unified key is read from its encrypted local settings database
    # and is never written to the frontend or to a log file.
    if (Test-Path -LiteralPath (Join-Path $freeLlmApiRoot 'server\dist\index.js')) {
      $env:FREELLMAPI_BASE_URL = 'http://127.0.0.1:3003/v1'
      $env:FREELLMAPI_MODEL = 'auto'
      if ((Test-Path -LiteralPath $freeLlmApiSqlite) -and (Test-Path -LiteralPath $freeLlmApiDb)) {
        $freeLlmApiKey = (& $freeLlmApiSqlite $freeLlmApiDb "SELECT value FROM settings WHERE key='unified_api_key';" 2>$null).Trim()
        if ($freeLlmApiKey) {
          $env:FREELLMAPI_API_KEY = $freeLlmApiKey
        } else {
          Remove-Item Env:FREELLMAPI_API_KEY -ErrorAction SilentlyContinue
        }
      }
    } else {
      Remove-Item Env:FREELLMAPI_BASE_URL,Env:FREELLMAPI_API_KEY,Env:FREELLMAPI_MODEL -ErrorAction SilentlyContinue
    }
    if ($manualOmniRouteBaseUrl -and $manualOmniRouteBaseUrl -notmatch '^https?://(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?/') {
      # Preserve an explicitly configured remote HTTPS OmniRoute endpoint.
      $env:OMNIROUTE_BASE_URL = $manualOmniRouteBaseUrl
      if (-not $env:OMNIROUTE_MODEL) { $env:OMNIROUTE_MODEL = 'auto' }
    } elseif ($omniRouteReady) {
      $env:OMNIROUTE_BASE_URL = 'http://127.0.0.1:20128/v1'
      $env:OMNIROUTE_MODEL = 'auto'
    } else {
      Remove-Item Env:OMNIROUTE_BASE_URL,Env:OMNIROUTE_MODEL -ErrorAction SilentlyContinue
    }
    if ($omniRouteApiKey) { $env:OMNIROUTE_API_KEY = $omniRouteApiKey }
    if (Test-Path -LiteralPath (Join-Path $ifindSdkPath 'iFinDPy.py')) {
      $env:THS_IFIND_SDK_PATH = $ifindSdkPath
    } else {
      Remove-Item Env:THS_IFIND_SDK_PATH -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $ifindCredentialFile) {
      $env:THS_IFIND_CREDENTIAL_FILE = $ifindCredentialFile
    } else {
      Remove-Item Env:THS_IFIND_CREDENTIAL_FILE -ErrorAction SilentlyContinue
    }

    $appProcess = Start-Process -FilePath 'node' -ArgumentList 'dist/index.js' -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'app-4173.stdout.log') -RedirectStandardError (Join-Path $logRoot 'app-4173.stderr.log')
    # A large production bundle can need more than one poll interval to bind.
    # Wait here so the next watchdog iteration cannot launch a second copy.
    $startupDeadline = (Get-Date).AddSeconds(30)
    do {
      Start-Sleep -Milliseconds 500
      $appProcess.Refresh()
      $listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    } until ($listener -or $appProcess.HasExited -or (Get-Date) -gt $startupDeadline)
  }

  $lastDbReady = $dbReady
  $lastFreeLlmApiReady = $freeLlmApiReady
  $lastOmniRouteReady = $omniRouteReady

  # Poll both dependencies continuously. Blocking on the Node child would
  # prevent database recovery while the web process is still alive.
  Start-Sleep -Seconds 5
}
