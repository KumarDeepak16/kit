# Registers the Kit helper with Chrome, Edge, Brave and Chromium for the current user.
# No admin rights needed. Run again any time (e.g. after moving the Kit folder).
#   install.ps1             install
#   install.ps1 -Uninstall  remove
#   install.ps1 -NoFirewall skip the optional firewall prompt
param([switch]$Uninstall, [switch]$NoFirewall)
$ErrorActionPreference = 'Stop'

$HostName = 'in.1619.kit'
$ExtensionId = 'nbmfafaoglnmgabfcmkhcdhfbahgaffl'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Launcher = Join-Path $Here 'kit-host.cmd'
$ManifestPath = Join-Path $Here "$HostName.json"
$Keys = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName",
  "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$HostName",
  "HKCU:\Software\Chromium\NativeMessagingHosts\$HostName"
)

if ($Uninstall) {
  foreach ($key in $Keys) { if (Test-Path $key) { Remove-Item $key -Force } }
  Remove-Item $Launcher, $ManifestPath -Force -ErrorAction SilentlyContinue
  Write-Host 'Kit helper removed.' -ForegroundColor Green
  exit 0
}

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  Write-Host 'Kit helper needs Node.js 18 or newer.' -ForegroundColor Red
  Write-Host 'Install the LTS version from https://nodejs.org, then run this again.'
  exit 1
}
$Major = [int]((& $Node --version).TrimStart('v').Split('.')[0])
if ($Major -lt 18) {
  Write-Host "Node.js $Major found; Kit helper needs 18 or newer. Update from https://nodejs.org" -ForegroundColor Red
  exit 1
}

# Chrome launches this .cmd with stdin/stdout wired to the extension.
[IO.File]::WriteAllText($Launcher, "@echo off`r`n`"$Node`" `"%~dp0kit-host.mjs`" %*`r`n", [Text.Encoding]::ASCII)

$Manifest = [ordered]@{
  name            = $HostName
  description     = 'Kit helper: local Wi-Fi server for Drop'
  path            = $Launcher
  type            = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json
[IO.File]::WriteAllText($ManifestPath, $Manifest, (New-Object Text.UTF8Encoding $false))

foreach ($key in $Keys) {
  New-Item -Path $key -Force | Out-Null
  Set-Item -Path $key -Value $ManifestPath
}

Write-Host ''
Write-Host '  Kit helper installed.' -ForegroundColor Green
Write-Host '  Open Kit -> Drop -> Turn on.'
Write-Host ''

# Optional: allow other devices on your private Wi-Fi to reach the helper (needs one UAC click).
if ($NoFirewall) { exit 0 }
$Answer = Read-Host '  Allow Drop through Windows Firewall on private networks now? [Y/n]'
if ($Answer -notmatch '^[nN]') {
  $Rule = "New-NetFirewallRule -DisplayName 'Kit Drop (Node.js)' -Direction Inbound -Program '$Node' -Action Allow -Profile Private -ErrorAction SilentlyContinue | Out-Null"
  try {
    Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-NoProfile', '-Command', $Rule
    Write-Host '  Firewall rule added.' -ForegroundColor Green
  } catch {
    Write-Host '  Skipped. Windows will ask the first time a phone connects - choose "Allow" for private networks.' -ForegroundColor Yellow
  }
}
