param(
    [string]$OutputDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) ("outputs/legacy-db-" + (Get-Date -Format 'yyyyMMdd-HHmmss')))
)

$ErrorActionPreference = 'Stop'
$package = 'com.bryan.donas'
$adbCandidates = @(
    (Join-Path (Split-Path $PSScriptRoot -Parent) 'work/tools/sdk/platform-tools/adb.exe'),
    $(if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe' }),
    $(if ($env:ANDROID_SDK_ROOT) { Join-Path $env:ANDROID_SDK_ROOT 'platform-tools/adb.exe' })
) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }
$adb = $adbCandidates | Select-Object -First 1
if (-not $adb) {
    $command = Get-Command adb -ErrorAction SilentlyContinue
    if ($command) { $adb = $command.Source }
}
if (-not $adb) { throw 'No se encontró adb. Instala Android Platform Tools o configura ANDROID_HOME.' }

$devices = @(& $adb devices | ForEach-Object { if ($_ -match '^([\w.:-]+)\s+device\s*$') { $Matches[1] } })
if ($devices.Count -ne 1) { throw "Conecta y autoriza exactamente un teléfono Android; encontrados: $($devices.Count)." }
$serial = $devices[0]
$adbArgs = @('-s', $serial)

$packagePath = & $adb @adbArgs shell pm path $package
if ($LASTEXITCODE -ne 0 -or -not ($packagePath -match '^package:')) { throw "No se encontró $package en el teléfono." }
$identity = & $adb @adbArgs shell run-as $package id 2>&1
if ($LASTEXITCODE -ne 0 -or $identity -notmatch 'uid=') {
    throw 'El APK instalado no permite run-as. Comprueba que sea la versión debug 1.1.1 antes de modificar la instalación.'
}

if (Test-Path -LiteralPath $OutputDirectory) { throw "La carpeta de destino ya existe: $OutputDirectory" }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
& $adb @adbArgs shell am force-stop $package | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener la app antigua para obtener una copia coherente.' }

$available = @(& $adb @adbArgs shell run-as $package ls databases 2>&1 | ForEach-Object { $_.ToString().Trim() })
if ($LASTEXITCODE -ne 0 -or $available -notcontains 'donas.db') {
    throw 'No se encontró databases/donas.db en la app antigua. No desinstales la app.'
}

foreach ($name in @('donas.db', 'donas.db-wal', 'donas.db-shm')) {
    if ($available -notcontains $name) { continue }
    $destination = Join-Path $OutputDirectory $name
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $adb
    # Windows PowerShell 5.1 usa .NET Framework, que no ofrece ArgumentList.
    # Todos los argumentos variables proceden de listas cerradas o del serial validado arriba.
    $start.Arguments = "-s $serial exec-out run-as $package cat databases/$name"
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::Start($start)
    try {
        $file = [System.IO.File]::Create($destination)
        try { $process.StandardOutput.BaseStream.CopyTo($file) }
        finally { $file.Dispose() }
        $errorText = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0 -or (Get-Item -LiteralPath $destination).Length -eq 0) {
            throw "No se pudo copiar $name. $errorText"
        }
    } finally { $process.Dispose() }
    $digest = Get-FileHash -LiteralPath $destination -Algorithm SHA256
    Write-Output "$name  SHA-256 $($digest.Hash)"
}

Write-Output "Copia conservada en $OutputDirectory"
Write-Output 'No desinstales la app antigua todavía: esta copia debe validarse y transformarse antes de importarla.'
