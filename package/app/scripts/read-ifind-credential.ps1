param(
  [Parameter(Mandatory = $true)]
  [string]$CredentialPath
)

$ErrorActionPreference = 'Stop'
$credential = Import-Clixml -LiteralPath $CredentialPath
$networkCredential = $credential.GetNetworkCredential()
@{
  username = $networkCredential.UserName
  password = $networkCredential.Password
} | ConvertTo-Json -Compress

