// Ejemplo: launcher de Quad4Damage — login e4Coin y conexión autenticada al servidor.
// Con el stack local arriba (bash stack-up.sh):
//   node examples/launch.mjs [ip:puerto]

import fs from "node:fs";
import { Quad4DamageLauncher, CliWallet } from "../quad4damage-launcher.mjs";

const RUN = process.env.QD_RUN ?? "../../../.run";
const deploy = JSON.parse(fs.readFileSync(`${RUN}/deploy.json`, "utf8"));
const server = process.argv[2] ?? "127.0.0.1:27960";

const wallet = new CliWallet({
  cli: process.env.E4COIN_CLI ?? "../../../e4Coin-core/src/e4coin-cli",
  datadir: `${RUN}/e4coin`,
  network: "regtest",
  rpcwallet: "smoke",
});

const launcher = new Quad4DamageLauncher({
  wallet,
  authUrl: "http://127.0.0.1:8777",
  l2RpcUrl: "http://127.0.0.1:8545",
  contracts: { resourceNFT: deploy.resourceNFT, gameId: deploy.gameId, playerEvm: process.env.PLAYER_EVM },
  // gameBinary: "../../build-client/Release/ioquake3",  // para launch() real
});

console.log("cuenta e4Coin:", await wallet.getAddress());
await launcher.ensureAccount("MX");

const conn = await launcher.prepareConnect(server);
console.log("\n=== lanzar el juego autenticado ===");
console.log("  quad4damage " + conn.args.join(" "));
console.log("(el servidor validará el ticket y fijará e4caddr =", conn.e4caddr + ")");

if (process.env.PLAYER_EVM) {
  console.log("balances (HUD):", await launcher.balances(["iron", "artifact"]));
}
