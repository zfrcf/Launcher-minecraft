#!/usr/bin/env bash
# Installe Fabric + mods de performance pour Minecraft Java (macOS / Linux).
# Usage : bash installer.sh [--version 1.21.11|latest] [--shaders] [--dir DOSSIER] [--no-profile] [--ram 4]
#
# Chaque mod telecharge est verifie par sa somme SHA-1 publiee par Modrinth : un fichier tronque
# ou corrompu est rejete au lieu de faire planter le jeu au lancement. Le script se termine par un
# recapitulatif et signale en clair un mod essentiel manquant.
set -eu

VERSION="1.21.11"
SHADERS=0
NOPROFILE=0
RAM=4
MC_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --shaders) SHADERS=1; shift ;;
    --dir) MC_DIR="$2"; shift 2 ;;
    --no-profile) NOPROFILE=1; shift ;;
    --ram) RAM="$2"; shift 2 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $1 (voir --help)"; exit 1 ;;
  esac
done

# Message utile si le script s'arrete sur une erreur non rattrapee (reseau coupe, disque plein).
EXPLIQUE=0   # passe a 1 quand le script a deja dit precisement ce qui n'allait pas
finir() {
  st=$?
  if [ $st -ne 0 ] && [ $st -ne 2 ] && [ "$EXPLIQUE" = "0" ]; then
    echo "" >&2
    echo "Echec (code $st). Rien n'a ete casse : tu peux relancer le script." >&2
    echo "Causes frequentes : connexion interrompue, disque plein, dossier Minecraft en lecture seule." >&2
  fi
}
trap finir EXIT

if [ -z "$MC_DIR" ]; then
  if [ "$(uname)" = "Darwin" ]; then MC_DIR="$HOME/Library/Application Support/minecraft"; else MC_DIR="$HOME/.minecraft"; fi
fi
mkdir -p "$MC_DIR/mods" "$MC_DIR/fabric-tools"

# Mods de performance (slugs Modrinth). Tous vérifiés disponibles pour Fabric 1.21.11.
MODS="fabric-api sodium lithium ferrite-core immediatelyfast entityculling krypton modmenu dynamic-fps sodium-extra reeses-sodium-options"
[ "$SHADERS" = "1" ] && MODS="$MODS iris"

UA="cubecraft-fabric-installer/1.1 (github.com/antoinefleau-33)"
get() { curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 20 -A "$UA" "$@"; }

# Somme SHA-1 d'un fichier, avec l'outil disponible (Linux : sha1sum, macOS : shasum).
sha1_of() {
  if command -v sha1sum >/dev/null 2>&1; then sha1sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 1 "$1" | cut -d' ' -f1
  else echo ""; fi
}
compact() { tr -d '\n\r\t '; }   # aplatit un JSON indenté pour le parser avec grep
json_first() { # json_first '<clé>' : première valeur chaîne de la clé dans stdin
  grep -o "\"$1\":\"[^\"]*\"" | head -1 | sed -E 's/^"[^"]*":"//; s/"$//'
}

# --version latest : derniere version de Minecraft a la fois stable cote Fabric et suivie par
# Sodium (inutile d'installer une version que les mods de performance ne suivent pas encore).
if [ "$VERSION" = "latest" ]; then
  echo "== Recherche de la derniere version compatible Fabric + Sodium"
  for v in $(get "https://meta.fabricmc.net/v2/versions/game" | compact | grep -o '"version":"[^"]*","stable":true' | sed -E 's/"version":"([^"]*)".*/\1/' | head -12); do
    enc="%5B%22$v%22%5D"
    if get "https://api.modrinth.com/v2/project/sodium/version?game_versions=$enc&loaders=%5B%22fabric%22%5D" | compact | grep -q '"filename"'; then
      VERSION="$v"; echo "   version retenue : $VERSION"; break
    fi
  done
  if [ "$VERSION" = "latest" ]; then
    echo "Aucune version recente n'a encore Sodium. Relance avec : bash installer.sh --version 1.21.11"
    EXPLIQUE=1; exit 1
  fi
fi

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
if [ -z "$LOADER" ]; then
  echo "Aucun Fabric Loader stable pour la version $VERSION."
  echo "Verifie le numero de version, ou lance : bash installer.sh --version latest"
  EXPLIQUE=1; exit 1
fi
INSTALLER_URL="$(get "https://meta.fabricmc.net/v2/versions/installer" | compact | json_first url)"
echo "== Fabric Loader $LOADER · installateur : $INSTALLER_URL"
get "$INSTALLER_URL" -o "$MC_DIR/fabric-tools/fabric-installer.jar"
PROFILE_FLAG=""; [ "$NOPROFILE" = "1" ] && PROFILE_FLAG="-noprofile"
"$JAVA" -jar "$MC_DIR/fabric-tools/fabric-installer.jar" client -mcversion "$VERSION" -loader "$LOADER" -dir "$MC_DIR" $PROFILE_FLAG

# ---- Mods ----
echo "== Téléchargement des mods dans $MC_DIR/mods"
ENC_V="%5B%22$VERSION%22%5D"
# Sans ces deux-la, l'installation n'apporte aucun gain : leur absence est traitee comme un echec.
ESSENTIELS="fabric-api sodium"
INSTALLES=""; IGNORES=""; ECHECS=""
for slug in $MODS; do
  resp="$(get "https://api.modrinth.com/v2/project/$slug/version?game_versions=$ENC_V&loaders=%5B%22fabric%22%5D" 2>/dev/null | compact || true)"
  url="$(printf '%s' "$resp" | grep -o '"url":"https://cdn.modrinth.com/[^"]*\.jar"' | head -1 | sed -E 's/^"url":"//; s/"$//')"
  file="$(printf '%s' "$resp" | grep -o '"filename":"[^"]*\.jar"' | head -1 | sed -E 's/^"filename":"//; s/"$//')"
  want="$(printf '%s' "$resp" | grep -o '"sha1":"[0-9a-f]\{40\}"' | head -1 | sed -E 's/^"sha1":"//; s/"$//')"
  if [ -z "$url" ]; then
    echo "   - $slug : pas de version pour $VERSION, ignoré"
    IGNORES="$IGNORES $slug"
    continue
  fi
  tmpjar="$MC_DIR/mods/.$slug.part"
  if ! get "$url" -o "$tmpjar"; then
    echo "   ! $slug : téléchargement impossible"
    rm -f "$tmpjar"; ECHECS="$ECHECS $slug"; continue
  fi
  # Verification : somme SHA-1 annoncee par Modrinth ; a defaut, au moins une archive .jar valide.
  got="$(sha1_of "$tmpjar")"
  if [ -n "$want" ] && [ -n "$got" ] && [ "$want" != "$got" ]; then
    echo "   ! $slug : fichier corrompu (somme de contrôle différente), non installé"
    rm -f "$tmpjar"; ECHECS="$ECHECS $slug"; continue
  fi
  if [ ! -s "$tmpjar" ] || [ "$(head -c 2 "$tmpjar")" != "PK" ]; then
    echo "   ! $slug : le fichier reçu n'est pas un mod valide, non installé"
    rm -f "$tmpjar"; ECHECS="$ECHECS $slug"; continue
  fi
  # supprime les anciennes versions du même mod, puis met en place le fichier vérifié
  rm -f "$MC_DIR/mods/${slug}"*.jar 2>/dev/null || true
  mv "$tmpjar" "$MC_DIR/mods/$file"
  echo "   + $file"
  INSTALLES="$INSTALLES $slug"
done

MANQUE_ESSENTIEL=""
for e in $ESSENTIELS; do
  case " $INSTALLES " in *" $e "*) ;; *) MANQUE_ESSENTIEL="$MANQUE_ESSENTIEL $e" ;; esac
done

# ---- Options JVM du profil (4 Go) ----
if [ "$NOPROFILE" = "0" ] && [ -f "$MC_DIR/launcher_profiles.json" ] && command -v python3 >/dev/null 2>&1; then
python3 - "$MC_DIR/launcher_profiles.json" "$LOADER" "$VERSION" "$RAM" <<'PY'
import json, sys
path, loader, version, ram = sys.argv[1:5]
d = json.load(open(path, encoding='utf-8'))
target = 'fabric-loader-%s-%s' % (loader, version)
for p in d.get('profiles', {}).values():
    if p.get('lastVersionId') == target:
        p['name'] = 'Fabric %s (Sodium, FPS+)' % version
        p['javaArgs'] = '-Xmx' + ram + 'G -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M'
json.dump(d, open(path, 'w', encoding='utf-8'), indent=2)
print('== Profil du launcher mis à jour : ' + target + ' (' + ram + ' Go de RAM)')
PY
fi

# ---- Recapitulatif ----
echo ""
echo "== Récapitulatif"
echo "   installés :$INSTALLES"
[ -n "$IGNORES" ] && echo "   sans version pour $VERSION :$IGNORES" || true
[ -n "$ECHECS" ] && echo "   échecs (relance le script) :$ECHECS" || true
if [ -n "$MANQUE_ESSENTIEL" ]; then
  echo ""
  echo "ATTENTION : il manque$MANQUE_ESSENTIEL — sans eux, aucun gain de FPS."
  echo "Relance le script, ou essaie : bash installer.sh --version latest"
  exit 2
fi

echo ""
echo "Terminé. Ouvre le launcher Minecraft, choisis le profil « Fabric $VERSION (Sodium, FPS+) » et clique sur JOUER."
echo "Serveur : donutsmp.net"
