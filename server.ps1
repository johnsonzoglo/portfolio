param(
  [int]$Port = 8000,
  [string]$AdminPassword = ''
)

$ErrorActionPreference = 'Stop'
$env:PORT = $Port
Set-Location $PSScriptRoot
if ($AdminPassword) {
  if ($AdminPassword.Length -lt 12) { throw 'AdminPassword must contain at least 12 characters.' }
  $env:ADMIN_PASSWORD = $AdminPassword
}
node .\server.js
