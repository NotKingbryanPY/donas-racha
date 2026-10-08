$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/Get-FirebaseAndroidConfiguration.ps1')
$fixtureDirectory = Join-Path $PSScriptRoot '../test-output/firebase-config'
New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
$fixturePath = Join-Path $fixtureDirectory 'google-services.fixture.json'
function New-Configuration {
    return @{
        project_info = @{ project_id = 'donascontrol-1f5df'; project_number = '476925718096' }
        client = @(@{
            client_info = @{ mobilesdk_app_id = '1:476925718096:android:abcdef012345'; android_client_info = @{ package_name = 'com.bryan.donas.control' } }
            api_key = @(@{ current_key = 'test-only-public-key' })
        })
    }
}
function Write-Fixture($Data) { $Data | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $fixturePath -Encoding utf8 }
function Assert-Rejected($Label) {
    $rejected = $false
    try { $null = Get-FirebaseAndroidConfiguration -Path $fixturePath } catch { $rejected = $true }
    if (-not $rejected) { throw "Se aceptó una configuración inválida: $Label" }
}
$fixture = New-Configuration
Write-Fixture $fixture
$publicConfiguration = Get-FirebaseAndroidConfiguration -Path $fixturePath
if ($publicConfiguration.Count -ne 4 -or $publicConfiguration.ORG_GRADLE_PROJECT_FIREBASE_APP_ID -ne '1:476925718096:android:abcdef012345') { throw 'La configuración pública válida no se importó correctamente.' }
$fixture.client[0].oauth_client = @(@{client_type=3;client_id='test-web-client.apps.googleusercontent.com'})
Write-Fixture $fixture
$publicConfiguration = Get-FirebaseAndroidConfiguration -Path $fixturePath
if ($publicConfiguration.ORG_GRADLE_PROJECT_FIREBASE_WEB_CLIENT_ID -ne 'test-web-client.apps.googleusercontent.com') { throw 'No se importó el cliente OAuth web.' }
$fixture.client[0].oauth_client += @{client_type=3;client_id='another-web-client.apps.googleusercontent.com'}
Write-Fixture $fixture; Assert-Rejected 'OAuth web ambiguo'
$fixture = New-Configuration
$fixture.project_info.project_id = 'otro-proyecto'; Write-Fixture $fixture; Assert-Rejected 'proyecto incorrecto'
$fixture = New-Configuration
$fixture.project_info.project_number = '999999999999'; Write-Fixture $fixture; Assert-Rejected 'sender incorrecto'
$fixture = New-Configuration
$fixture.client[0].client_info.android_client_info.package_name = 'com.bryan.donas.pilot'; Write-Fixture $fixture; Assert-Rejected 'paquete piloto'
$fixture = New-Configuration
$fixture.client[0].client_info.mobilesdk_app_id = '1:999999999999:android:abcdef'; Write-Fixture $fixture; Assert-Rejected 'app ID de otro proyecto'
$fixture = New-Configuration
$fixture.client[0].api_key += @{ current_key = 'another-test-only-key' }; Write-Fixture $fixture; Assert-Rejected 'API key ambigua'
Write-Fixture @{ type = 'service_account'; project_id = 'donascontrol-1f5df'; private_key = 'TEST-ONLY-DO-NOT-IMPORT' }
Assert-Rejected 'cuenta de servicio privada'
$parseTokens = $null; $parseErrors = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../scripts/build-android-official.ps1'),[ref]$parseTokens,[ref]$parseErrors)
if ($parseErrors.Count) { throw 'El script de compilación contiene errores de sintaxis.' }
Write-Output 'PASS Firebase config: app oficial, proyecto/sender, paquete incorrecto, App ID, ambigüedad y rechazo de cuenta de servicio; sintaxis del build oficial.'
