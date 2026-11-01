param([string]$Root = 'C:\Services\chi-toolbox-lms')
$ErrorActionPreference = 'Stop'
$config = Import-PowerShellDataFile (Join-Path $Root 'worker.psd1')
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONIOENCODING = 'utf-8'
$private = Join-Path $Root 'private'
$public = Join-Path $Root 'public'
$log = Join-Path $Root 'logs\latest.log'
Set-Location -LiteralPath $Root
# Only safe worker status lines reach the task log; no cookie or raw browser errors.
& $config.Python -B (Join-Path $Root 'worker\worker.py') --source $config.Source --data-dir $private --public-dir $public --browser msedge --utc-offset '+09:00' --once *> $log
$result = $LASTEXITCODE
if ($null -eq $result) { exit 1 }
exit $result
