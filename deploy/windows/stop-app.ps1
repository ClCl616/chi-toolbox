param([string]$RuntimeRoot, [string]$TaskName)
$production = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'production.psd1')
if (-not $RuntimeRoot) { $RuntimeRoot = $production.RuntimeRoot }
if (-not $TaskName) { $TaskName = $production.TaskName }
$ErrorActionPreference = 'Stop'
Stop-ScheduledTask -TaskName $TaskName
$record = Join-Path $RuntimeRoot 'logs\process.json'
if (-not (Test-Path $record)) { return }
$state = Get-Content $record -Raw | ConvertFrom-Json
$process = Get-Process -Id $state.id -ErrorAction SilentlyContinue
if (-not $process) { return }
if ($process.StartTime.ToUniversalTime().Ticks.ToString() -ne $state.started) { return }
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $RuntimeRoot 'releases')) + '\'
if (-not ([IO.Path]::GetFullPath($state.entry)).StartsWith($releaseRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected process entry path.' }
$details = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.id)"
if ($process.ProcessName -ne 'node' -or -not $details.CommandLine.Contains($state.entry)) { throw 'Process identity does not match; not stopping it.' }
Stop-Process -Id $state.id -Force
$process.WaitForExit(10000) | Out-Null
