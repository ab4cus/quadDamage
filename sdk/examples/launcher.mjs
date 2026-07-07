// Ejemplo de LAUNCHER del cliente QuadDamage (flujo completo desde el juego).
//
// Con el stack local arriba (bash stack-up.sh), este launcher:
//   1. usa la wallet e4Coin local (e4coin-cli) para tener la cuenta del jugador
//   2. registra la cuenta si hace falta
//   3. hace login → obtiene el ticket de conexión
//   4. imprime los ARGUMENTOS con los que se lanzaría el juego autenticado
//   5. muestra balances de recursos (HUD)
//
// Uso:
//   node examples/launcher.mjs [ip:puerto]
// (por defecto 127.0.0.1:27960, el servidor del stack local)

import fs from "node:fs";
import { QuadDamageLauncher, CliWallet } from "../src/index.mjs";

const RUN = process.env.QD_RUN ?? "../../../.run";
const deploy = JSON.parse(fs.readFileSync(`${RUN}/deploy.json`, "utf8"));
const server = process.argv[2] ?? "127.0.0.1:27960";

const wallet = new CliWallet({
  cli: process.env.E4COIN_CLI ?? "../../../e4Coin-core/src/e4coin-cli",
  datadir: `${RUN}/e4coin`,
  network: "regtest",
  rpcwallet: "smoke",
});

const launcher = new QuadDamageLauncher({
  wallet,
  authUrl: "http://127.0.0.1:8777",
  l2RpcUrl: "http://127.0.0.1:8545",
  contracts: {
    resourceNFT: deploy.resourceNFT,
    gameId: deploy.gameId,
    playerEvm: process.env.PLAYER_EVM, // dir EVM donde se acuñan los recursos
  },
  // gameBinary: "../../build-client/Release/quaddamage",  // para launch() real
});

const address = await wallet.getAddress();
console.log("cuenta e4Coin del jugador:", address);

await launcher.ensureAccount("MX");
console.log("cuenta lista.");

const conn = await launcher.prepareConnect(server);
console.log("\n=== para lanzar el juego autenticado ===");
console.log("  quaddamage " + conn.args.join(" "));
console.log("userinfo enviado al servidor:", conn.userinfo);
console.log("(el servidor validará el ticket y fijará e4caddr =", conn.e4caddr + ")");

if (process.env.PLAYER_EVM) {
  const bal = await launcher.balances(["iron", "artifact"]);
  console.log("\nbalances (HUD):", bal);
}
