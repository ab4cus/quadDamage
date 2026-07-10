# Quad4Damage

**Quad4Damage** es el motor del juego insignia del ecosistema **Play4Chain / e4Coin**
(HelioMultiverso): un arena shooter *standalone* donde lo que ganas en la arena —
recursos, artefactos, logros — se acuña on-chain y es tuyo de verdad.

Es un fork de [ioquake3](https://ioquake3.org) (el mantenimiento comunitario del motor
id Tech 3 de Quake III Arena, liberado por id Software bajo GPL). Todo el crédito del
motor base es del proyecto ioquake3 y de id Software; este repo añade la capa de
identidad y economía blockchain **sin tocar el hot path del juego**.

## Qué añade Quad4Damage sobre ioquake3

| Pieza | Qué hace |
|---|---|
| `code/server/sv_e4cauth.c` | **Auth e4Coin**: la cuenta del jugador ES su dirección e4Coin (L1). El ticket lo emite el sidecar [quad4Damage-auth](https://github.com/ab4cus/quad4Damage-auth); el motor solo consume un token local (sin crypto ni red en código GPL) |
| `code/server/sv_econ.c` + `Trap_EconEvent` | **Economía Tier 0** (server-authoritative): eventos económicos → spool → sidecar [quad4Damage-oracle](https://github.com/ab4cus/quad4Damage-oracle) → mint de `ResourceNFT` en la L2 |
| `launcher/` | Capa fina sobre [play4Chain-sdk](https://github.com/ab4cus/play4Chain-sdk): login con la wallet y arranque con `+setu e4cticket … +connect …` |
| `deploy/` | Servidor headless containerizado (imagen Docker ~123 MB) + docker-compose con los sidecars |
| CI | Releases multiplataforma (Linux/Windows/macOS) con `SHA256SUMS` |

**Binarios**: cliente **`q4d`** · servidor dedicado **`q4ded`** (nombres fijados en
`cmake/identity.cmake`).

Principio rector: **la blockchain nunca entra en el hot path del juego** — la auth
ocurre una vez en el handshake y los eventos económicos son asíncronos vía sidecars.

## Instalación rápida (CLI)

Binarios del último release (cliente + servidor dedicado), con verificación SHA256
y sin sudo/admin (instala en `~/.quad4damage` o `%LOCALAPPDATA%\Quad4Damage`):

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/ab4cus/Quad4Damage/develop/install.sh | sh
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/ab4cus/Quad4Damage/develop/install.ps1 | iex
```

Versión concreta: `QUAD4DAMAGE_VERSION=vX.Y.Z` (sh) o `$env:QUAD4DAMAGE_VERSION="vX.Y.Z"` (ps).
También disponible vía el instalador gráfico universal
[Play4Chain Setup](https://github.com/ab4cus/play4Chain-setup).

## Compilar desde fuente

```bash
# dependencias (Debian/Ubuntu): cmake, SDL2, OpenGL, OpenAL
sudo apt install cmake libsdl2-dev libgl1-mesa-dev libopenal-dev

# servidor dedicado (headless)
cmake -S . -B build-server -DCMAKE_BUILD_TYPE=Release -DBUILD_STANDALONE=ON \
  -DBUILD_CLIENT=OFF -DBUILD_SERVER=ON
cmake --build build-server -j        # → build-server/Release/q4ded

# cliente + servidor
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_STANDALONE=ON \
  -DBUILD_CLIENT=ON -DBUILD_SERVER=ON
```

Servidor con auth y economía activas:

```bash
q4ded +set dedicated 2 +set sv_e4cauth 1 +set sv_e4cauthDir /ruta/tickets \
      +set sv_econSpool /ruta/spool
```

Estructura del motor (qué va al servidor, al cliente y a los módulos) y estado:
`docs/QUAD4DAMAGE-ESTRUCTURA.md` del repo meta.

## Estado

- ✅ Servidor: auth e4Coin + economía Tier 0, probado E2E (loop jugar→ganar→mint on-chain)
- ✅ Docker + releases CI + instalador CLI
- ⏳ Pendiente: login en el menú del cliente, mod de gameplay que emita `Trap_EconEvent`
  en kills/victorias reales, assets propios standalone

## Licencia y créditos

**GPL v2 o posterior** — ver [COPYING.txt](COPYING.txt). Este proyecto existe gracias a:

- **id Software**, que liberó el código de Quake III Arena bajo GPL (el README original
  de id se conserva como `id-readme.txt`).
- El proyecto **[ioquake3](https://ioquake3.org)** ([github.com/ioquake/ioq3](https://github.com/ioquake/ioq3)),
  base directa de este fork. Si buscas el motor genérico para tu propio juego, usa
  ioquake3 — Quad4Damage es específico del ecosistema Play4Chain.

La lógica de plataforma (crypto, red, blockchain) vive en sidecars separados por
RPC/spool: aislamiento de licencia y de latencia. Ningún código propietario se enlaza
con el motor.
