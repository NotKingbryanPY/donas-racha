function Get-FirebaseAndroidConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$PackageName = 'com.bryan.donas.control',
        [string]$ProjectId = 'donascontrol-1f5df',
        [string]$SenderId = '476925718096'
    )
    $configuration = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($configuration.project_info.project_id -ne $ProjectId -or
        [string]$configuration.project_info.project_number -ne $SenderId) {
        throw 'google-services.json pertenece a otro proyecto Firebase. No se modificó la configuración.'
    }
    $clients = @($configuration.client | Where-Object {
        $_.client_info.android_client_info.package_name -eq $PackageName
    })
    if ($clients.Count -ne 1) { throw "Se requiere exactamente un registro Firebase para $PackageName." }
    $appId = [string]$clients[0].client_info.mobilesdk_app_id
    $apiKeys = @($clients[0].api_key | ForEach-Object { [string]$_.current_key } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
    if ($appId -notmatch ('^1:' + [regex]::Escape($SenderId) + ':android:[0-9a-f]+$') -or $apiKeys.Count -ne 1) {
        throw 'La configuración Android no contiene un App ID válido y una API key pública inequívoca.'
    }
    # Return only public client configuration; never import service-account credentials.
    $result = @{
        ORG_GRADLE_PROJECT_FIREBASE_APP_ID = $appId
        ORG_GRADLE_PROJECT_FIREBASE_API_KEY = $apiKeys[0]
        ORG_GRADLE_PROJECT_FIREBASE_PROJECT_ID = $ProjectId
        ORG_GRADLE_PROJECT_FIREBASE_SENDER_ID = $SenderId
    }
    $webClients = @($clients[0].oauth_client | Where-Object client_type -eq 3 |
        ForEach-Object { [string]$_.client_id } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
    if ($webClients.Count -gt 1) { throw 'El cliente OAuth web de Google no es inequívoco.' }
    if ($webClients.Count -eq 1) { $result.ORG_GRADLE_PROJECT_FIREBASE_WEB_CLIENT_ID = $webClients[0] }
    return $result
}
