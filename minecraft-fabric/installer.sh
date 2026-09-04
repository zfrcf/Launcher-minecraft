#!/usr/bin/env bash
# Installe Fabric + mods de performance pour Minecraft Java (macOS / Linux).
# Usage : bash installer.sh [--version 1.21.11] [--shaders] [--dir ~/.minecraft] [--no-profile]
set -eu

VERSION="1.21.11"
SHADERS=0
NOPROFILE=0
MC_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --shaders) SHADERS=1; shift ;;
    --dir) MC_DIR="$2"; shift 2 ;;
    --no-profile) NOPROFILE=1; shift ;;
    *) echo "Option inconnue : $1"; exit 1 ;;
  esac
done

if [ -z "$MC_DIR" ]; then
  if [ "$(uname)" = "Darwin" ]; then MC_DIR="$HOME/Library/Application Support/minecraft"; else MC_DIR="$HOME/.minecraft"; fi
fi
mkdir -p "$MC_DIR/mods" "$MC_DIR/fabric-tools"

# Mods de performance (slugs Modrinth). Tous vérifiés disponibles pour Fabric 1.21.11.
MODS="fabric-api sodium lithium ferrite-core immediatelyfast entityculling krypton modmenu dynamic-fps sodium-extra reeses-sodium-options"
[ "$SHADERS" = "1" ] && MODS="$MODS iris"

UA="cubecraft-fabric-installer/1.0 (github.com/antoinefleau-33)"
get() { curl -fsSL -A "$UA" "$@"; }
compact() { tr -d '\n\r\t '; }   # aplatit un JSON indenté pour le parser avec grep
json_first() { # json_first '<clé>' : première valeur chaîne de la clé dans stdin
  grep -o "\"$1\":\"[^\"]*\"" | head -1 | sed -E 's/^"[^"]*":"//; s/"$//'
}

echo "== Minecraft $VERSION · dossier : $MC_DIR"

# ---- Java ----
JAVA=""
if command -v java >/dev/null 2>&1; then JAVA="$(command -v java)"; fi
if [ -z "$JAVA" ]; then
  for cand in "$MC_DIR"/runtime/*/*/*/bin/java "$MC_DIR"/runtime/*/*/*/jre.bundle/Contents/Home/bin/java; do
    [ -x "$cand" ] && { JAVA="$cand"; break; }
  done
fi
if [ -z "$JAVA" ]; then
  echo "== Java introuvable : téléchargement d'un JRE 21 (Temurin) dans $MC_DIR/fabric-tools/jre"
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) OS=mac; ARCH=aarch64 ;;
    Darwin-*) OS=mac; ARCH=x64 ;;
    Linux-aarch64) OS=linux; ARCH=aarch64 ;;
    *) OS=linux; ARCH=x64 ;;
  esac
  get "https://api.adoptium.net/v3/binary/latest/21/ga/$OS/$ARCH/jre/hotspot/normal/eclipse" -o "$MC_DIR/fabric-tools/jre.tar.gz"
  rm -rf "$MC_DIR/fabric-tools/jre" && mkdir -p "$MC_DIR/fabric-tools/jre"
  tar -xzf "$MC_DIR/fabric-tools/jre.tar.gz" -C "$MC_DIR/fabric-tools/jre" --strip-components=1
  rm -f "$MC_DIR/fabric-tools/jre.tar.gz"
  JAVA="$(find "$MC_DIR/fabric-tools/jre" -name java -type f | head -1)"
fi
echo "== Java : $JAVA"

# ---- Fabric ----
LOADER="$(get "https://meta.fabricmc.net/v2/versions/loader/$VERSION" | compact | grep -o '"version":"[^"]*","stable":true' | head -1 | sed -E 's/"version":"([^"]*)".*/\1/')"
[ -z "$LOADER" ] && { echo "Aucun Fabric Loader stable pour $VERSION (version inexistante ?)"; exit 1; }
INSTALLER_URL="$(get "https://meta.fabricmc.net/v2/versions/installer" | compact | json_first url)"
echo "== Fabric Loader $LOADER · installateur : $INSTALLER_URL"
get "$INSTALLER_URL" -o "$MC_DIR/fabric-tools/fabric-installer.jar"
PROFILE_FLAG=""; [ "$NOPROFILE" = "1" ] && PROFILE_FLAG="-noprofile"
"$JAVA" -jar "$MC_DIR/fabric-tools/fabric-installer.jar" client -mcversion "$VERSION" -loader "$LOADER" -dir "$MC_DIR" $PROFILE_FLAG

# ---- Mods ----
echo "== Téléchargement des mods dans $MC_DIR/mods"
ENC_V="%5B%22$VERSION%22%5D"
for slug in $MODS; do
  resp="$(get "https://api.modrinth.com/v2/project/$slug/version?game_versions=$ENC_V&loaders=%5B%22fabric%22%5D" | compact || true)"
  url="$(printf '%s' "$resp" | grep -o '"url":"https://cdn.modrinth.com/[^"]*\.jar"' | head -1 | sed -E 's/^"url":"//; s/"$//')"
  file="$(printf '%s' "$resp" | grep -o '"filename":"[^"]*\.jar"' | head -1 | sed -E 's/^"filename":"//; s/"$//')"
  if [ -z "$url" ]; then echo "   - $slug : pas de version pour $VERSION, ignoré"; continue; fi
  # supprime les anciennes versions du même mod
  rm -f "$MC_DIR/mods/${slug}"*.jar 2>/dev/null || true
  get "$url" -o "$MC_DIR/mods/$file"
  echo "   + $file"
done

# ---- Options JVM du profil (4 Go) ----
if [ "$NOPROFILE" = "0" ] && [ -f "$MC_DIR/launcher_profiles.json" ] && command -v python3 >/dev/null 2>&1; then
python3 - "$MC_DIR/launcher_profiles.json" "$LOADER" "$VERSION" <<'PY'
import json, sys
path, loader, version = sys.argv[1:4]
d = json.load(open(path, encoding='utf-8'))
target = 'fabric-loader-%s-%s' % (loader, version)
for p in d.get('profiles', {}).values():
    if p.get('lastVersionId') == target:
        p['name'] = 'Fabric %s (Sodium, FPS+)' % version
        p['javaArgs'] = '-Xmx4G -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M'
json.dump(d, open(path, 'w', encoding='utf-8'), indent=2)
print('== Profil du launcher mis à jour : ' + target + ' (4 Go de RAM)')
PY
fi

echo
echo "Terminé. Ouvre le launcher Minecraft, choisis le profil « Fabric $VERSION (Sodium, FPS+) » et clique sur JOUER."
echo "Serveur : donutsmp.net"
