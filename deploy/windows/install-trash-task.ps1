param([string]$SourceRoot)
$production = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'production.psd1')
if (-not $SourceRoot) { $SourceRoot = $production.SourceRoot }
$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$script = Join-Path $SourceRoot 'scripts\purge-trash.mjs'
if (!(Test-Path -LiteralPath $script)) { throw 'Trash cleanup script is missing.' }
if (!(Test-Path -LiteralPath $production.MaintenanceEnvironment)) { throw 'Configure the protected maintenance/trash.env file first.' }
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '"') -WorkingDirectory $SourceRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '04:00'
$principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\NETWORK SERVICE' -LogonType ServiceAccount
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 20)
Register-ScheduledTask -TaskName $production.TrashTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host 'CHI-HUB-Trash registered. Verify server-only configuration and source ACL before running.'
