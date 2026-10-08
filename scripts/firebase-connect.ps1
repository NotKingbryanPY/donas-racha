[CmdletBinding()]
param(
    [string]$NpxCliPath = 'C:\tmp\donas-firebase-cli\package\bin\npx-cli.js',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
}
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    throw 'No se encontró Node.js. Ejecuta este script desde la terminal de Codex.'
}
if (-not (Test-Path -LiteralPath $NpxCliPath)) {
    throw 'Indica -NpxCliPath con la ruta al npx-cli.js instalado. Esta máquina lo tiene en C:\tmp\donas-firebase-cli.'
}
$originalProcessPath = $env:PATH
try {
    # npx launches firebase through cmd.exe; its child process must also find node.
    $env:PATH = (Split-Path -Parent $nodeExecutable) + ';' + $originalProcessPath
    if ($CheckOnly) {
        & $nodeExecutable --version
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo ejecutar Node.js.' }
        & $nodeExecutable $NpxCliPath --loglevel=silent -y firebase-tools@latest --version
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo ejecutar Firebase CLI.' }
        Write-Output 'Node.js y Firebase CLI funcionan correctamente.'
        return
    }
    $projectId = 'donascontrol-1f5df'
    $androidAppId = '1:476925718096:android:09f47532b8e643b406ab55'
    # Never use login:list --json: Firebase CLI includes private tokens in that response.
    function Get-AuthorizedProjects {
        $previousErrorAction = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $projectOutput = & $nodeExecutable $NpxCliPath --loglevel=silent -y firebase-tools@latest projects:list --json 2>$null
            if (-not $projectOutput) { return $null }
            try { $projects = ($projectOutput -join "`n") | ConvertFrom-Json } catch { return $null }
            if ($projects.status -ne 'success') { return $null }
            return $projects
        } finally { $ErrorActionPreference = $previousErrorAction }
    }
    $projects = Get-AuthorizedProjects
    if (-not $projects) {
    # The remote code flow avoids the localhost server's Windows/Node shutdown crash.
    & $nodeExecutable $NpxCliPath --loglevel=silent -y firebase-tools@latest login --non-interactive
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el enlace de autorización Firebase.' }
    $authorizationCode = Read-Host 'Completa el enlace de Google anterior e introduce el código aquí (oculto)' -AsSecureString
    $codePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($authorizationCode)
    try {
        $codeText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($codePointer)
        # Suppress npm's command echo, which would expose the authorization code.
        & $nodeExecutable $NpxCliPath --loglevel=silent -y firebase-tools@latest login $codeText
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($codePointer)
        $codeText = $null
        $authorizationCode.Dispose()
    }
    # Confirm actual project access even if the CLI crashed after saving credentials.
    $projects = Get-AuthorizedProjects
    if (-not $projects) { throw 'No se pudo verificar la sesión Firebase. Comprueba la conexión y vuelve a ejecutar el script.' }
}
if (-not @($projects.result | Where-Object projectId -eq $projectId).Count) {
    throw 'La cuenta autenticada no puede acceder a donascontrol-1f5df.'
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$configurationDirectory = Join-Path $projectRoot '.firebase/android'
New-Item -ItemType Directory -Path $configurationDirectory -Force | Out-Null
$configurationPath = Join-Path $configurationDirectory 'google-services.json'
$temporaryConfigPath = Join-Path $configurationDirectory ('google-services.' + [Guid]::NewGuid().ToString() + '.json')
& $nodeExecutable $NpxCliPath --loglevel=silent -y firebase-tools@latest apps:sdkconfig ANDROID $androidAppId --project $projectId --out $temporaryConfigPath
if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar la configuración del App ID existente.' }
. (Join-Path $PSScriptRoot 'Get-FirebaseAndroidConfiguration.ps1')
$publicConfiguration = Get-FirebaseAndroidConfiguration -Path $temporaryConfigPath
if ($publicConfiguration.ORG_GRADLE_PROJECT_FIREBASE_APP_ID -ne $androidAppId) {
    throw 'La configuración descargada no coincide con el App ID indicado.'
}
Move-Item -LiteralPath $temporaryConfigPath -Destination $configurationPath -Force
Write-Output 'Conexión Firebase y configuración del paquete oficial verificadas.'
Write-Output "Configuración pública: $configurationPath"
Write-Output 'Configuración lista para compilar. Si acabas de instalar el conector Firebase, reinicia Codex para cargarlo.'
} finally {
    if ($temporaryConfigPath -and (Test-Path -LiteralPath $temporaryConfigPath)) { Remove-Item -LiteralPath $temporaryConfigPath }
    $env:PATH = $originalProcessPath
}
