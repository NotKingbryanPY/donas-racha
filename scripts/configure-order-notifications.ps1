[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ServiceAccountPath,
    [string]$NpxCliPath = 'C:\tmp\donas-firebase-cli\package\bin\npx-cli.js'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (-not (Test-Path -LiteralPath $nodePath) -or -not (Test-Path -LiteralPath $NpxCliPath)) { throw 'Falta el runtime Node/npx configurado en esta máquina.' }
function Invoke-ProtectedVercel([string[]]$Arguments, [string]$Value) {
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $nodePath
    $start.WorkingDirectory = $projectRoot
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['PATH'] = (Split-Path -Parent $nodePath) + ';' + $env:PATH
    # Arguments contain only fixed public names; credential values travel exclusively over stdin.
    if ($NpxCliPath.Contains('"')) { throw 'Ruta npx no válida.' }
    $start.Arguments = '"' + $NpxCliPath + '" --loglevel=silent -y vercel@64.0.2 ' + ($Arguments -join ' ')
    $process = [System.Diagnostics.Process]::Start($start)
    $outTask = $process.StandardOutput.ReadToEndAsync()
    $errorTask = $process.StandardError.ReadToEndAsync()
    if ($Value) { $process.StandardInput.WriteLine($Value) }
    $process.StandardInput.Close()
    $process.WaitForExit()
    # Discard raw CLI output: never echo a server credential or inspect auth stores.
    $null = $outTask.GetAwaiter().GetResult()
    $null = $errorTask.GetAwaiter().GetResult()
    return $process.ExitCode
}
if ((Invoke-ProtectedVercel -Arguments @('whoami','--non-interactive') -Value '') -ne 0) {
    throw 'Vercel CLI no está autorizado. Ejecuta npx -y vercel@64.0.2 login y vuelve a ejecutar este script. No envíes tokens al chat.'
}
$credential = Get-Content -LiteralPath $ServiceAccountPath -Raw | ConvertFrom-Json
if ($credential.type -ne 'service_account' -or $credential.project_id -ne 'donascontrol-1f5df' -or
    $credential.client_email -notmatch '@donascontrol-1f5df\.iam\.gserviceaccount\.com$' -or
    $credential.private_key -notmatch '^-----BEGIN PRIVATE KEY-----') {
    throw 'El archivo no corresponde a una cuenta de servicio de donascontrol-1f5df.'
}
$random = [byte[]]::new(32)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($random) } finally { $rng.Dispose() }
$cronSecret = [BitConverter]::ToString($random).Replace('-','').ToLowerInvariant()
$values = [ordered]@{
    FCM_PROJECT_ID = 'donascontrol-1f5df'
    FCM_CLIENT_EMAIL = [string]$credential.client_email
    FCM_PRIVATE_KEY = [string]$credential.private_key
    CRON_SECRET = $cronSecret
}
foreach ($entry in $values.GetEnumerator()) {
    $arguments = @('env','add',$entry.Key,'production','--project','donas-racha','--scope','king-entertainment','--sensitive','--yes','--force','--non-interactive')
    if ((Invoke-ProtectedVercel -Arguments $arguments -Value $entry.Value) -ne 0) { throw "No se pudo guardar $($entry.Key) en el proyecto Vercel previsto. Se ocultó la salida para proteger secretos." }
    Write-Output "Configurada en Production: $($entry.Key)"
}
$credential = $null; $values = $null; $cronSecret = $null
Write-Output 'Variables guardadas. Redespliega el proyecto existente; después activa la recuperación del servidor desde Pedidos con la cuenta ADMIN. Cada ejecución rota CRON_SECRET.'
