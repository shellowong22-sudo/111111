$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.runtime'
$credentialPath = Join-Path $runtimeDirectory 'ifind-credential.xml'

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
Write-Host '同花顺 iFinD SDK 本机授权' -ForegroundColor Cyan
Write-Host '凭据将使用 Windows 当前用户加密，只能由当前 Windows 账户解密。'
$credential = Get-Credential -Message '请输入同花顺 iFinD SDK 账号和密码'
if ($null -eq $credential -or [string]::IsNullOrWhiteSpace($credential.UserName)) {
  throw '未提供同花顺账号，授权已取消。'
}
$credential | Export-Clixml -LiteralPath $credentialPath -Force
Write-Host '授权凭据已加密保存。关闭此窗口后，Finance Hub 将验证 SDK 登录。' -ForegroundColor Green
Read-Host '按回车关闭'

