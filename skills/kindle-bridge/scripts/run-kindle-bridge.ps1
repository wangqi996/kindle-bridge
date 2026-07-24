[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $CliArgs
)

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
$cliPath = Join-Path $repositoryRoot 'dist\cli\index.js'

if (-not (Test-Path -LiteralPath $cliPath)) {
  Write-Error "Kindle Bridge has not been built. Run 'npm install' and 'npm run build' in: $repositoryRoot"
  exit 3
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Error 'Node.js is required but was not found in PATH.'
  exit 3
}

& $nodeCommand.Source $cliPath @CliArgs
exit $LASTEXITCODE
