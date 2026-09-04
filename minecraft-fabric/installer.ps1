# Installe Fabric + mods de performance pour Minecraft Java (Windows).
# Clic droit > "Exécuter avec PowerShell", ou :
#   powershell -ExecutionPolicy Bypass -File installer.ps1 [-Version 1.21.11|latest] [-Shaders] [-Ram 4]
#
# Chaque mod téléchargé est vérifié par sa somme SHA-1 publiée par Modrinth : un fichier tronqué
# ou corrompu est rejeté au lieu de faire planter le jeu au lancement. Le script se termine par un
# récapitulatif et signale en clair un mod essentiel manquant.
param(
  [string]$Version = "1.21.11",
  [switch]$Shaders,
  [switch]$NoProfile,
  [int]$Ram = 4,
  [string]$MinecraftDir = "$env:APPDATA\.minecraft"
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$UA = "cubecraft-fabric-installer/1.0 (github.com/antoinefleau-33)"
$tools = Join-Path $MinecraftDir "fabric-tools"
$modsDir = Join-Path $MinecraftDir "mods"
New-Item -ItemType Directory -Force -Path $tools, $modsDir | Out-Null

# Mods de performance (slugs Modrinth), tous disponibles pour Fabric 1.21.11
$mods = @("fabric-api","sodium","lithium","ferrite-core","immediatelyfast","entityculling","krypton","modmenu","dynamic-fps","sodium-extra","reeses-sodium-options")
if ($Shaders) { $mods += "iris" }

function Get-Json($url) { Invoke-RestMethod -Uri $url -Headers @{ "User-Agent" = $UA } }
function Get-File($url, $out) { Invoke-WebRequest -Uri $url -Headers @{ "User-Agent" = $UA } -OutFile $out }

# -Version latest : dernière version de Minecraft à la fois stable côté Fabric et suivie par
# Sodium (inutile d'installer une version que les mods de performance ne suivent pas encore).
if ($Version -eq "latest") {
  Write-Host "== Recherche de la dernière version compatible Fabric + Sodium"
  $encL0 = [Uri]::EscapeDataString("[`"fabric`"]")
  foreach ($g in (Get-Json "https://meta.fabricmc.net/v2/versions/game" | Where-Object { $_.stable } | Select-Object -First 12)) {
    $encV0 = [Uri]::EscapeDataString("[`"$($g.version)`"]")
    try { $probe = Get-Json "https://api.modrinth.com/v2/project/sodium/version?game_versions=$encV0&loaders=$encL0" } catch { $probe = @() }
    if ($probe -and $probe.Count -gt 0) { $Version = $g.version; Write-Host "   version retenue : $Version"; break }
  }
  if ($Version -eq "latest") { throw "Aucune version récente n'a encore Sodium. Relance avec : -Version 1.21.11" }
}

Write-Host "== Minecraft $Version · dossier : $MinecraftDir"

# ---- Java : PATH, puis JRE fourni par le launcher, sinon téléchargement d'un JRE 21 ----
$java = $null
$cmd = Get-Command java -ErrorAction SilentlyContinue
if ($cmd) { $java = $cmd.Source }
if (-not $java) {
  $roots = @(
    "$env:LOCALAPPDATA\Packages\Microsoft.4297127D64EC6_8wekyb3d8bbwe\LocalCache\Local\runtime",
    "${env:ProgramFiles(x86)}\Minecraft Launcher\runtime",
    "$env:ProgramFiles\Minecraft Launcher\runtime",
    "$MinecraftDir\runtime"
  )
  foreach ($r in $roots) {
    if (Test-Path $r) {
      $found = Get-ChildItem -Path $r -Recurse -Filter "java.exe" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "java-runtime-(delta|gamma|beta)" } | Select-Object -First 1
      if ($found) { $java = $found.FullName; break }
    }
  }
}
if (-not $java) {
  Write-Host "== Java introuvable : téléchargement d'un JRE 21 (Temurin)"
  $zip = Join-Path $tools "jre.zip"
  Get-File "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse" $zip
  $jreDir = Join-Path $tools "jre"
  if (Test-Path $jreDir) { Remove-Item -Recurse -Force $jreDir }
  Expand-Archive -Path $zip -DestinationPath $jreDir -Force
  Remove-Item $zip
  $java = (Get-ChildItem -Path $jreDir -Recurse -Filter "java.exe" | Select-Object -First 1).FullName
}
Write-Host "== Java : $java"

# ---- Fabric ----
$loaders = Get-Json "https://meta.fabricmc.net/v2/versions/loader/$Version"
if (-not $loaders -or $loaders.Count -eq 0) { throw "Aucun Fabric Loader pour la version $Version (version inexistante ?)" }
$loader = ($loaders | Where-Object { $_.loader.stable } | Select-Object -First 1).loader.version
if (-not $loader) { $loader = $loaders[0].loader.version }
$installerUrl = (Get-Json "https://meta.fabricmc.net/v2/versions/installer")[0].url
Write-Host "== Fabric Loader $loader · installateur : $installerUrl"
$installerJar = Join-Path $tools "fabric-installer.jar"
Get-File $installerUrl $installerJar
$installerArgs = @("-jar", $installerJar, "client", "-mcversion", $Version, "-loader", $loader, "-dir", $MinecraftDir)
if ($NoProfile) { $installerArgs += "-noprofile" }
& $java @installerArgs
if ($LASTEXITCODE -ne 0) { throw "L'installateur Fabric a échoué (code $LASTEXITCODE)" }

# ---- Mods ----
Write-Host "== Téléchargement des mods dans $modsDir"
$encV = [Uri]::EscapeDataString("[`"$Version`"]")
$encL = [Uri]::EscapeDataString("[`"fabric`"]")
# Sans ces deux-là, l'installation n'apporte aucun gain : leur absence est traitée comme un échec.
$essentiels = @("fabric-api", "sodium")
$installes = @(); $ignores = @(); $echecs = @()
foreach ($slug in $mods) {
  try {
    $versions = Get-Json "https://api.modrinth.com/v2/project/$slug/version?game_versions=$encV&loaders=$encL"
  } catch { $versions = @() }
  if (-not $versions -or $versions.Count -eq 0) {
    Write-Host "   - $slug : pas de version pour $Version, ignoré"
    $ignores += $slug
    continue
  }
  $file = $versions[0].files | Where-Object { $_.primary } | Select-Object -First 1
  if (-not $file) { $file = $versions[0].files[0] }
  $tmp = Join-Path $modsDir ".$slug.part"
  try { Get-File $file.url $tmp } catch {
    Write-Host "   ! $slug : téléchargement impossible"
    if (Test-Path $tmp) { Remove-Item -Force $tmp }
    $echecs += $slug; continue
  }
  # Vérification : somme SHA-1 annoncée par Modrinth ; à défaut, au moins une archive .jar valide.
  $attendu = $null
  if ($file.hashes -and $file.hashes.sha1) { $attendu = $file.hashes.sha1 }
  $obtenu = (Get-FileHash -Path $tmp -Algorithm SHA1).Hash.ToLower()
  if ($attendu -and ($attendu.ToLower() -ne $obtenu)) {
    Write-Host "   ! $slug : fichier corrompu (somme de contrôle différente), non installé"
    Remove-Item -Force $tmp; $echecs += $slug; continue
  }
  if ((Get-Item $tmp).Length -lt 1024) {
    Write-Host "   ! $slug : le fichier reçu n'est pas un mod valide, non installé"
    Remove-Item -Force $tmp; $echecs += $slug; continue
  }
  Get-ChildItem -Path $modsDir -Filter "$slug*.jar" -ErrorAction SilentlyContinue | Remove-Item -Force
  Move-Item -Force $tmp (Join-Path $modsDir $file.filename)
  Write-Host "   + $($file.filename)"
  $installes += $slug
}
$manqueEssentiel = @($essentiels | Where-Object { $installes -notcontains $_ })

# ---- Profil du launcher : nom + 4 Go de RAM ----
$profilesPath = Join-Path $MinecraftDir "launcher_profiles.json"
if (-not $NoProfile -and (Test-Path $profilesPath)) {
  $json = Get-Content $profilesPath -Raw | ConvertFrom-Json
  $target = "fabric-loader-$loader-$Version"
  foreach ($prop in $json.profiles.PSObject.Properties) {
    $p = $prop.Value
    if ($p.lastVersionId -eq $target) {
      $p | Add-Member -NotePropertyName name -NotePropertyValue "Fabric $Version (Sodium, FPS+)" -Force
      $p | Add-Member -NotePropertyName javaArgs -NotePropertyValue "-Xmx${Ram}G -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M" -Force
    }
  }
  $text = $json | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText($profilesPath, $text, (New-Object System.Text.UTF8Encoding $false))  # UTF-8 sans BOM, exigé par le launcher
  Write-Host "== Profil du launcher mis à jour : $target ($Ram Go de RAM)"
}

# ---- Récapitulatif ----
Write-Host ""
Write-Host "== Récapitulatif"
Write-Host "   installés : $($installes -join ' ')"
if ($ignores.Count -gt 0) { Write-Host "   sans version pour $Version : $($ignores -join ' ')" }
if ($echecs.Count -gt 0)  { Write-Host "   échecs (relance le script) : $($echecs -join ' ')" }
if ($manqueEssentiel.Count -gt 0) {
  Write-Host ""
  Write-Host "ATTENTION : il manque $($manqueEssentiel -join ' ') — sans eux, aucun gain de FPS."
  Write-Host "Relance le script, ou essaie : powershell -ExecutionPolicy Bypass -File installer.ps1 -Version latest"
  exit 2
}

Write-Host ""
Write-Host "Terminé. Ouvre le launcher Minecraft, choisis le profil « Fabric $Version (Sodium, FPS+) » et clique sur JOUER."
Write-Host "Serveur : donutsmp.net"
