param(
    [string]$Credentials = (Join-Path $env:USERPROFILE '.codex/keys/donas-control-official/credentials.json')
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Credentials)) { throw 'No existe la clave oficial. Conserva la firma original; no generes otra para actualizar la app.' }
$officialSigning = Get-Content -LiteralPath $Credentials -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $officialSigning.storeFile)) { throw 'No se encontró el keystore oficial.' }
$officialEnvironment = @{
    DONAS_OFFICIAL_STORE_FILE = $officialSigning.storeFile
    DONAS_OFFICIAL_STORE_PASSWORD = $officialSigning.storePassword
    DONAS_OFFICIAL_KEY_ALIAS = $officialSigning.keyAlias
    DONAS_OFFICIAL_KEY_PASSWORD = $officialSigning.keyPassword
}
$previousEnvironment = @{}
$projectRoot = Split-Path -Parent $PSScriptRoot
try {
    foreach ($entry in $officialEnvironment.GetEnumerator()) {
        $previousEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
    Push-Location (Join-Path $projectRoot 'android/donas-control')
    try {
        & './gradlew.bat' testDebugUnitTest assembleOfficial lintDebug lintOfficial
        if ($LASTEXITCODE -ne 0) { throw 'Falló la verificación de la app oficial.' }
    } finally { Pop-Location }
    $outputDirectory = Join-Path $projectRoot 'outputs'
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    $appGradle = Get-Content -LiteralPath (Join-Path $projectRoot 'android/donas-control/app/build.gradle.kts') -Raw
    $officialVersion = [regex]::Match($appGradle, 'versionName\s*=\s*"([0-9.]+)"').Groups[1].Value
    if (-not $officialVersion) { throw 'No se encontró la versión del APK.' }
    $officialApk = Join-Path $outputDirectory "Donas-Control-$officialVersion-oficial.apk"
    Copy-Item -LiteralPath (Join-Path $projectRoot 'android/donas-control/app/build/outputs/apk/official/app-official.apk') -Destination $officialApk
    $digest = (Get-FileHash -LiteralPath $officialApk -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath "$officialApk.sha256" -Value "$digest  Donas-Control-$officialVersion-oficial.apk" -Encoding ascii
    Write-Output "APK oficial generado: $officialApk"
} finally {
    foreach ($entry in $previousEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
}
