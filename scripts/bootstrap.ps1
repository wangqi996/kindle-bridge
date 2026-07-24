[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$userProfilePath = [System.IO.Path]::GetFullPath([Environment]::GetFolderPath('UserProfile'))
$skillRoot = [System.IO.Path]::GetFullPath((Join-Path $userProfilePath '.agents\skills'))
$backupRoot = [System.IO.Path]::GetFullPath((Join-Path $userProfilePath '.agents\skill-backups\kindle-bridge'))

if (-not $skillRoot.StartsWith($userProfilePath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'The skill destination is outside the current user profile.'
}

foreach ($commandName in @('node', 'npm')) {
  if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
    throw "Missing $commandName. Install Node.js LTS and run this script again."
  }
}

Push-Location $repoRoot
try {
  npm ci
  npm run build
  npm link
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Path $skillRoot -Force | Out-Null
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach ($skillName in @('kindle-setup', 'send-to-kindle', 'kindle-bridge')) {
  $source = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "skills\$skillName"))
  $destination = [System.IO.Path]::GetFullPath((Join-Path $skillRoot $skillName))

  if (-not $source.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Skill source is outside the repository: $source"
  }
  if (-not $destination.StartsWith($skillRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Skill destination is outside the shared skill directory: $destination"
  }

  if (Test-Path -LiteralPath $destination) {
    $backup = Join-Path $backupRoot "$skillName-$stamp"
    Move-Item -LiteralPath $destination -Destination $backup
    Write-Host "Backed up existing skill: $backup"
  }

  Copy-Item -LiteralPath $source -Destination $destination -Recurse
  Write-Host "Installed skill: $skillName"
}

Write-Host ''
Write-Host 'Kindle Bridge is installed for the current Windows user.'
Write-Host 'Capability status:'
kindle --json capability
Write-Host ''
Write-Host 'If the state is not ready, ask an Agent to use $kindle-setup.'
