# @ab4cus/quaddamage-sdk

SDK de conexión de **QuadDamage** — une **cliente ↔ servidor ↔ blockchain** para el
cliente del juego y las herramientas. Es la pieza que faltaba para que un jugador use el
flujo completo desde el juego: registrarse, hacer login con su wallet e4Coin, obtener su
ticket de conexión, su prueba de identidad, y consultar sus recursos on-chain.

Sin dependencias externas (usa `fetch` nativo). El wallet lo provee el integrador (una
función de firma), para no acoplar el SDK a un gestor de claves concreto.

## Qué hace (y qué NO)

| Hace | No hace |
|---|---|
| Registro/login contra `quadDamage-auth` (cuenta = dirección e4Coin) | Firmar sesiones de juego (eso es server-authoritative, Tier 0) |
| Emitir el `e4cticket` que el cliente inyecta en su userinfo | Hablar directamente con el nodo e4coind |
| Merkle proof de identidad (verificación gasless) | Custodiar claves privadas |
| Leer balances de recursos on-chain (view, sin gas) | Mint/transfer (los hace el Oracle / marketplace) |

## Uso

```js
import { QuadDamageClient } from "@ab4cus/quaddamage-sdk";

const client = new QuadDamageClient({
  authUrl: "http://auth.quaddamage.gg",
  l2RpcUrl: "https://l2-rpc.e4coin.io",
  contracts: { resourceNFT, identityRegistry, gameId, playerEvm },
  address,                        // dirección e4Coin del jugador (su cuenta)
  sign: (msg) => wallet.sign(msg) // firma con la clave del jugador
});

await client.register("MX");                 // una vez
const { e4cticket, e4caddr } = await client.connectInfo();
//  el cliente del juego: cl_e4cticket <e4cticket> ; connect <servidor>

const iron = await client.resourceBalance("iron");   // balance on-chain, sin gas
```

## API

### `QuadDamageClient` (bajo nivel)
| Método | Descripción |
|---|---|
| `register(country?)` | Crea la cuenta (firma el mensaje de registro) |
| `login()` | `{ ticket, spoolId, gameAccountId }` — hace challenge+firma |
| `connectInfo()` | `{ e4cticket, e4caddr }` — lo que el engine espera en el userinfo |
| `getIdentityProof()` | Merkle proof de identidad contra la raíz anclada |
| `resourceBalance(type)` | Balance ERC-1155 del recurso (lectura on-chain) |

### `QuadDamageLauncher` (cliente completo) + wallets

El **cliente de QuadDamage** vive aquí: un launcher que orquesta wallet → login → ticket →
lanzar el juego autenticado, más los balances para el HUD.

```js
import { QuadDamageLauncher, CliWallet, ExternalWallet } from "@ab4cus/quaddamage-sdk";

// wallet: CliWallet (nodo local) o ExternalWallet (extensión/móvil/hardware)
const wallet = new ExternalWallet({ address, sign: (m) => myWallet.sign(m) });

const launcher = new QuadDamageLauncher({
  wallet, authUrl, l2RpcUrl, contracts,
  gameBinary: "/ruta/al/quaddamage",   // opcional, para launch()
});

await launcher.ensureAccount("MX");                 // registro idempotente
const conn = await launcher.prepareConnect("1.2.3.4:27960");
//  conn.args => ["+setu","e4cticket","<id>","+connect","1.2.3.4:27960"]
await launcher.launch("1.2.3.4:27960");             // lanza el juego autenticado
const hud = await launcher.balances(["iron", "artifact"]);
```

| Método del launcher | Descripción |
|---|---|
| `ensureAccount(country?)` | Registra la cuenta si no existe |
| `prepareConnect(server)` | Login + ticket → `{ userinfo, args, e4caddr }` |
| `launch(server, extra?)` | Lanza el binario del juego ya autenticado |
| `balances(types[])` | Balances de recursos para el HUD |
| `identity()` | Prueba de identidad (para mostrar "verificado") |

**Cómo llega el ticket al servidor** (sin modificar el engine cliente): el launcher lanza el
juego con `+setu e4cticket <id>`. En Quake 3, `setu` crea un cvar de **userinfo**, que viaja
en el paquete `connect`; el servidor lo lee en `SV_DirectConnect` (`sv_e4cauth.c`), valida el
ticket y fija `e4caddr` con la dirección e4Coin verificada.

## Ejemplo ejecutable

Con el stack local arriba (`bash stack-up.sh`):

```bash
PLAYER_ADDRESS=<dir_e4coin> PLAYER_EVM=<dir_evm> node examples/login-and-balance.mjs
```

## Nota de integración

El ABI-encoding de las lecturas L2 está hecho a mano (sin librerías) y **verificado
byte-a-byte contra `cast`**. Para integraciones más ricas (escrituras, eventos), el
patrón recomendado es envolver este SDK con **viem** en el cliente.
