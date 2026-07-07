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

| Método | Descripción |
|---|---|
| `register(country?)` | Crea la cuenta (firma el mensaje de registro) |
| `login()` | `{ ticket, spoolId, gameAccountId }` — hace challenge+firma |
| `connectInfo()` | `{ e4cticket, e4caddr }` — lo que el engine espera en el userinfo |
| `getIdentityProof()` | Merkle proof de identidad contra la raíz anclada |
| `resourceBalance(type)` | Balance ERC-1155 del recurso (lectura on-chain) |

## Ejemplo ejecutable

Con el stack local arriba (`bash stack-up.sh`):

```bash
PLAYER_ADDRESS=<dir_e4coin> PLAYER_EVM=<dir_evm> node examples/login-and-balance.mjs
```

## Nota de integración

El ABI-encoding de las lecturas L2 está hecho a mano (sin librerías) y **verificado
byte-a-byte contra `cast`**. Para integraciones más ricas (escrituras, eventos), el
patrón recomendado es envolver este SDK con **viem** en el cliente.
