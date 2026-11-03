#!/bin/sh
# Launched on the Kobo only. No daemon, SSH, API key or network listener.
# Usage: sh download-dashboard.sh https://OWNER.github.io/REPO tharon
set -eu
umask 077
base=${1:?URL GitHub Pages requise}
spot=${2:-tharon}
case "$spot" in tharon|la-baule|suscinio) ;; *) echo 'Spot invalide'; exit 2;; esac
case "$base" in https://*.github.io/*) ;; *) echo 'URL HTTPS GitHub Pages requise'; exit 2;; esac
case "$base" in *'?'*|*'#'*|*'@'*|*' '*|*'/../'*) echo 'URL invalide'; exit 2;; esac
base=${base%/}
dir=/mnt/onboard/.adds/kobo-screen
curl_bin=${WING_CURL:-curl}
command -v "$curl_bin" >/dev/null 2>&1 || { echo 'curl absent'; exit 2; }
command -v sha256sum >/dev/null 2>&1 || { echo 'sha256sum absent'; exit 2; }
test -d "$dir" || { echo 'Dossier Kobo existant requis'; exit 2; }
work="$dir/.download-lock"
mkdir "$work" 2>/dev/null || { echo 'Téléchargement déjà actif (ou verrou à vérifier après interruption)'; exit 2; }
trap 'rm -f "$work/image.png" "$work/image.sha256"; rmdir "$work"' EXIT
trap 'exit 1' HUP INT TERM
get() {
  if test -n "${WING_CA_BUNDLE:-}"; then
    "$curl_bin" --fail --silent --show-error --proto '=https' --tlsv1.2 \
      --cacert "$WING_CA_BUNDLE" --connect-timeout 20 --max-time 90 \
      --max-filesize 1048576 --output "$2" "$1"
  else
    "$curl_bin" --fail --silent --show-error --proto '=https' --tlsv1.2 \
      --connect-timeout 20 --max-time 90 --max-filesize 1048576 --output "$2" "$1"
  fi
}
# No redirect following: an HTTP downgrade or unexpected host must fail.
get "$base/kobo/png/$spot.sha256" "$work/image.sha256"
get "$base/kobo/png/$spot.png" "$work/image.png"
expected=$(awk 'NR==1 {print $1}' "$work/image.sha256")
test "${#expected}" -eq 64 || { echo 'Empreinte invalide'; exit 1; }
case "$expected" in *[!0-9a-f]*) echo 'Empreinte invalide'; exit 1;; esac
actual=$(sha256sum "$work/image.png")
actual=${actual%% *}
test "$expected" = "$actual" || { echo 'SHA256 différent : ancienne image conservée'; exit 1; }
header=$(od -An -tx1 -N29 "$work/image.png" | tr -d ' \n\r')
test "$header" = '89504e470d0a1a0a0000000d4948445200000258000003200800000000' || {
  echo 'PNG incompatible : ancienne image conservée'; exit 1;
}
mv "$work/image.png" "$dir/meteo-wingfoil.png"
echo 'Téléchargement HTTPS et SHA256 validés, PNG 600 x 800 installé.'
echo 'Utiliser ensuite le menu existant Afficher météo.'
