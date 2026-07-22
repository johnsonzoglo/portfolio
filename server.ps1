param(
  [int]$Port = 8002,
  [string]$AdminPassword = 'admin123'
)

$ErrorActionPreference = 'Stop'
$env:PORT = $Port
$env:ADMIN_PASSWORD = $AdminPassword
Set-Location $PSScriptRoot
node .\server.js
