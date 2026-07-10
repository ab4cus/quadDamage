# Quad4Damage - instalador CLI para Windows (PowerShell 5.1+ / 7).
#
#   irm https://raw.githubusercontent.com/ab4cus/Quad4Damage/develop/install.ps1 | iex
#
# Sin admin: instala en %LOCALAPPDATA%\Quad4Damage. Verifica SHA256 contra
# SHA256SUMS del release (si existe). Version fijable: $env:QUAD4DAMAGE_VERSION.
# Nota: archivo ASCII puro a proposito (PowerShell 5.1 lee sin BOM como ANSI).

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = "ab4cus/Quad4Damage"
$InstallDir = if ($env:QUAD4DAMAGE_DIR) { $env:QUAD4DAMAGE_DIR } else { Join-Path $env:LOCALAPPDATA "Quad4Damage" }
$EngineDir = Join-Path $InstallDir "engine"
$Version = if ($env:QUAD4DAMAGE_VERSION) { $env:QUAD4DAMAGE_VERSION } else { "latest" }

function Say([string]$msg) { Write-Host "quad4damage-install: $msg" }

if ($Version -eq "latest") {
    Say "consultando la ultima version..."
    $release = Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$Repo/releases/latest"
    $Version = $release.tag_name
}
Say "version: $Version"

$Asset = "quad4damage-$Version-win64.zip"
$Url = "https://github.com/$Repo/releases/download/$Version/$Asset"
$Tmp = Join-Path ([IO.Path]::GetTempPath()) "quad4damage-install-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $Tmp | Out-Null

try {
    Say "descargando $Asset..."
    $ZipPath = Join-Path $Tmp $Asset
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $ZipPath

    # --- verificacion SHA256 ---
    $expected = $null
    try {
        $SumsPath = Join-Path $Tmp "SHA256SUMS"
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/releases/download/$Version/SHA256SUMS" -OutFile $SumsPath
        $line = Select-String -Path $SumsPath -Pattern ([regex]::Escape($Asset)) | Select-Object -First 1
        if ($line) { $expected = ($line.Line -split "\s+")[0] }
    } catch { Say "aviso: el release no publica SHA256SUMS; se omite la verificacion" }
    if ($expected) {
        $actual = (Get-FileHash -Algorithm SHA256 -Path $ZipPath).Hash.ToLowerInvariant()
        if ($actual -ne $expected.ToLowerInvariant()) {
            throw "checksum SHA256 INCORRECTO para $Asset (esperado $expected, obtenido $actual)"
        }
        Say "checksum SHA256 verificado [OK]"
    }

    # --- instalacion (el zip lleva el contenido de build/Release en la raiz) ---
    Say "instalando en $EngineDir..."
    if (Test-Path $EngineDir) { Remove-Item -Recurse -Force $EngineDir }
    New-Item -ItemType Directory -Force -Path $EngineDir | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $EngineDir -Force
    # si el zip llevara una carpeta Release/, aplanarla
    $inner = Join-Path $EngineDir "Release"
    if (Test-Path $inner) {
        Get-ChildItem $inner | Move-Item -Destination $EngineDir -Force
        Remove-Item -Recurse -Force $inner
    }

    # --- PATH de usuario (los .exe del motor viven en engine\) ---
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$EngineDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$EngineDir;$userPath", "User")
        Say "PATH de usuario actualizado (abre una nueva terminal para usarlo)"
    }

    Say "listo [OK]  Ejecutables:"
    Get-ChildItem -Path $EngineDir -Filter "*.exe" | ForEach-Object { Say "  - $($_.Name)" }
    Say "servidor dedicado (Tier 0):  q4ded.exe +set dedicated 2"
    Say "desinstalar:                 Remove-Item -Recurse -Force '$InstallDir'"
} finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
