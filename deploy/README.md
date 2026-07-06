# Despliegue de QuadDamage

Servidor dedicado de QuadDamage (fork de ioquake3) con autenticación e identidad
e4Coin. Artefactos para probar localmente y desplegar.

## Contenido

| Archivo | Uso |
|---|---|
| `Dockerfile` | Imagen del servidor dedicado standalone (build desde fuente) |
| `quaddamage-entrypoint.sh` | Arranque headless; configura auth/econ por variables de entorno |
| `docker-compose.yml` | Stack local: servidor + qd-auth + qd-oracle |

## Probar localmente (solo el servidor)

```bash
docker build -f deploy/Dockerfile -t ab4cus/quaddamage-server:latest .
docker run -d --name quaddamage -p 27960:27960/udp \
  -e QD_HOSTNAME="Mi QuadDamage" -e QD_AUTH=1 ab4cus/quaddamage-server:latest
docker logs -f quaddamage    # "Opening IP socket: 0.0.0.0:27960" = OK
```

Verificado: la imagen (~123 MB) arranca el servidor, abre el socket UDP y completa la
inicialización con la autenticación e4Coin activada.

## Stack completo (servidor + sidecars e4Coin)

```bash
# Requiere un nodo e4coind y una L2 (anvil/testnet) accesibles.
# Define las claves/direcciones en un .env junto al compose:
#   L2_RPC_URL, IDENTITY_REGISTRY, FEDERATION_PK, GAME_SIGNER_PK, RELAYER_PK
docker compose -f deploy/docker-compose.yml up --build
```

Levanta:
- **quaddamage-server** (:27960/udp) — el juego, con `sv_e4cauth 1`
- **qd-auth** (:8777) — login/identidad contra la L1 e4Coin
- **qd-oracle** — puente Tier 0 de eventos económicos → L2

Los tres comparten el volumen `shared` para el spool de tickets y eventos económicos.

## Variables de entorno del servidor

| Variable | Defecto | Descripción |
|---|---|---|
| `QD_HOSTNAME` | QuadDamage | Nombre del servidor |
| `QD_MAXCLIENTS` | 16 | Slots de jugador |
| `QD_PORT` | 27960 | Puerto UDP |
| `QD_AUTH` | 0 | `1` exige cuenta e4Coin |
| `QD_TICKET_DIR` | …/tickets | Spool de tickets (compartido con qd-auth) |
| `QD_ECON_SPOOL` | …/econ | Spool de eventos económicos (leído por qd-oracle) |
| `QD_EXTRA_ARGS` | — | Flags extra para el servidor |

## Binarios precompilados

Los releases (`v*`) generan binarios de **Linux, Windows y macOS** e imagen Docker
automáticamente vía [GitHub Actions](../.github/workflows/quaddamage-release.yml).
