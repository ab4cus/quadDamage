#!/bin/sh
# Quad4Damage — instalador CLI para Linux y macOS (cliente + servidor dedicado).
#
#   curl -fsSL https://raw.githubusercontent.com/ab4cus/Quad4Damage/develop/install.sh | sh
#
# Prácticas (estilo rustup/foundryup): funciones + main() al final, sin sudo
# (instala en ~/.quad4damage), SHA256 verificado contra SHA256SUMS del release,
# versión fijable con QUAD4DAMAGE_VERSION, QUAD4DAMAGE_NO_MODIFY_PATH=1 disponible.
set -eu

REPO="ab4cus/Quad4Damage"
INSTALL_DIR="${QUAD4DAMAGE_DIR:-$HOME/.quad4damage}"
VERSION="${QUAD4DAMAGE_VERSION:-latest}"
NO_MODIFY_PATH="${QUAD4DAMAGE_NO_MODIFY_PATH:-0}"

say()  { printf 'quad4damage-install: %s\n' "$1"; }
err()  { printf 'quad4damage-install: ERROR: %s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || err "se necesita '$1' y no está instalado"; }

download() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$1" -O "$2"
    else
        err "se necesita curl o wget"
    fi
}

detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    case "$OS" in
        Linux)
            [ "$ARCH" = "x86_64" ] || err "Linux $ARCH aún no tiene binarios publicados (solo x86_64); compila con cmake (README)"
            ASSET_SUFFIX="linux-x86_64.tar.gz"
            ;;
        Darwin)
            [ "$ARCH" = "arm64" ] || err "los binarios macOS publicados son arm64 (Apple Silicon); en Intel compila con cmake (README)"
            ASSET_SUFFIX="macos-arm64.tar.gz"
            ;;
        *)
            err "plataforma no soportada: $OS (en Windows usa install.ps1)"
            ;;
    esac
}

resolve_version() {
    if [ "$VERSION" = "latest" ]; then
        say "consultando la última versión…"
        TAG="$(download "https://api.github.com/repos/$REPO/releases/latest" - 2>/dev/null \
            | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')" || TAG=""
        [ -n "$TAG" ] || err "no se pudo resolver la última versión (¿hay releases en github.com/$REPO?)"
    else
        TAG="$VERSION"
    fi
    say "versión: $TAG"
}

verify_checksum() {
    if [ ! -f "$1/SHA256SUMS" ]; then
        say "aviso: el release no publica SHA256SUMS; se omite la verificación"
        return 0
    fi
    expected="$(grep " $2\$" "$1/SHA256SUMS" | awk '{print $1}')" || expected=""
    [ -n "$expected" ] || { say "aviso: $2 no aparece en SHA256SUMS; se omite la verificación"; return 0; }
    if command -v sha256sum >/dev/null 2>&1; then
        actual="$(sha256sum "$1/$2" | awk '{print $1}')"
    else
        actual="$(shasum -a 256 "$1/$2" | awk '{print $1}')"
    fi
    [ "$actual" = "$expected" ] || err "checksum SHA256 INCORRECTO para $2"
    say "checksum SHA256 verificado ✓"
}

add_to_path() {
    [ "$NO_MODIFY_PATH" = "1" ] && return 0
    case ":$PATH:" in *":$INSTALL_DIR/bin:"*) return 0 ;; esac
    case "${SHELL:-}" in
        */zsh)  PROFILE="$HOME/.zshenv" ;;
        */bash) PROFILE="$HOME/.bashrc" ;;
        *)      PROFILE="$HOME/.profile" ;;
    esac
    LINE="export PATH=\"$INSTALL_DIR/bin:\$PATH\""
    if [ ! -f "$PROFILE" ] || ! grep -qs "$INSTALL_DIR/bin" "$PROFILE"; then
        printf '\n# Quad4Damage\n%s\n' "$LINE" >> "$PROFILE"
        say "PATH añadido a $PROFILE"
    fi
}

main() {
    need uname; need tar; need grep; need awk; need find
    detect_platform
    resolve_version

    ASSET="quad4damage-$TAG-$ASSET_SUFFIX"
    URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT

    say "descargando $ASSET…"
    download "$URL" "$TMP/$ASSET" || err "no se pudo descargar $URL"
    download "https://github.com/$REPO/releases/download/$TAG/SHA256SUMS" "$TMP/SHA256SUMS" 2>/dev/null || true
    verify_checksum "$TMP" "$ASSET"

    # El tarball contiene el directorio Release/ del build (motor + módulos .so).
    say "instalando en $INSTALL_DIR…"
    tar -xzf "$TMP/$ASSET" -C "$TMP"
    PAYLOAD="$TMP/Release"
    [ -d "$PAYLOAD" ] || PAYLOAD="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)"
    [ -n "$PAYLOAD" ] || err "el paquete no tiene el formato esperado"

    rm -rf "$INSTALL_DIR/engine"
    mkdir -p "$INSTALL_DIR/engine" "$INSTALL_DIR/bin"
    cp -R "$PAYLOAD"/. "$INSTALL_DIR/engine/"

    # Enlaza los ejecutables del motor (cliente y servidor dedicado) en bin/
    for f in "$INSTALL_DIR/engine"/*; do
        [ -f "$f" ] || continue
        case "$(basename "$f")" in
            *.so|*.dylib|*.pk3|*.txt|*.cfg) continue ;;
        esac
        if [ -x "$f" ] || head -c4 "$f" 2>/dev/null | grep -q "ELF"; then
            chmod +x "$f"
            ln -sf "$f" "$INSTALL_DIR/bin/$(basename "$f")"
        fi
    done

    add_to_path
    say "listo ✓  Motor en $INSTALL_DIR/engine · ejecutables en $INSTALL_DIR/bin:"
    ls "$INSTALL_DIR/bin" | sed 's/^/  - /'
    say "servidor dedicado (Tier 0):  q4ded +set dedicated 2  (ver docs del repo)"
    say "desinstalar:                 rm -rf $INSTALL_DIR"
}

main "$@"
