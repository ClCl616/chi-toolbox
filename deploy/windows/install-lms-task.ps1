param(
    [string]$Root = 'C:\Services\chi-toolbox-lms',
    [Parameter(Mandatory=$true)][string]$Python,
    [Parameter(Mandatory=$true)][string]$NotifierSource,
    [string]$TaskName = 'CHI-TOOLBOX-LMS'
)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) { throw 'Task already exists; inspect it before updating.' }
if (-not (Test-Path -LiteralPath $Python) -or -not (Test-Path -LiteralPath (Join-Path $NotifierSource 'src\dju_lms_notifier'))) { throw 'Python and reviewed Notifier source are required.' }
foreach ($dir in @($Root, "$Root\private", "$Root\public", "$Root\logs", "$Root\worker")) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $Root /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-20:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot secure worker root.' }
foreach ($dir in @('private','public','logs')) {
    & icacls.exe (Join-Path $Root $dir) /grant '*S-1-5-20:(OI)(CI)M' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot grant worker access.' }
}
# Web identity can traverse only to public snapshot/read state. No access to LMS cookies/SQLite.
& icacls.exe $Root /grant '*S-1-5-19:RX' | Out-Null
& icacls.exe (Join-Path $Root 'public') /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot grant public data access.' }
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Copy-Item -LiteralPath (Join-Path $source 'workers\lms\worker.py'),(Join-Path $source 'workers\lms\projector.py') -Destination "$Root\worker" -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'run-lms.ps1') -Destination $Root -Force
$pythonLiteral = $Python.Replace("'", "''")
$sourceLiteral = $NotifierSource.Replace("'", "''")
[IO.File]::WriteAllText((Join-Path $Root 'worker.psd1'), "@{`nPython='$pythonLiteral'`nSource='$sourceLiteral'`n}")
$runner = Join-Path $Root 'run-lms.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runner`" -Root `"$Root`"" -WorkingDirectory $Root
$timer = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 30)
$boot = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 25)
$principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\NETWORK SERVICE' -LogonType ServiceAccount
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($timer,$boot) -Settings $settings -Principal $principal -Description 'Chi Toolbox isolated LMS collection every 30 minutes; no Discord dispatch.' | Out-Null
Write-Output 'LMS task registered. Start and verify a first run before considering setup complete.'
