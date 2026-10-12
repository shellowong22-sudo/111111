$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$watchdog = Join-Path $PSScriptRoot 'start-finance-hub-watchdog.ps1'
$taskName = 'Finance Hub Local Server'
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdog`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1)
try {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Keeps the Finance Hub local server available on http://localhost:4173.' -Force | Out-Null
} catch {
  $startup = [Environment]::GetFolderPath('Startup')
  $shortcutPath = Join-Path $startup 'Finance Hub Local Server.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = 'PowerShell.exe'
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdog`""
  $shortcut.WorkingDirectory = $appRoot
  $shortcut.WindowStyle = 7
  $shortcut.Save()
  Write-Output "Scheduled task unavailable; installed current-user startup shortcut: $shortcutPath"
}
Start-Process -FilePath 'PowerShell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',$watchdog -WindowStyle Hidden
Write-Output "Installed and started: $taskName"
