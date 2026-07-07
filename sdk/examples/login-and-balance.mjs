// Ejemplo: login con e4Coin, obtener el ticket de conexión y leer balances.
//
// Requiere el stack local arriba (bash stack-up.sh) y las direcciones del deploy.
// La función de firma la provee el integrador; aquí se firma vía e4coin-cli para
// el ejemplo. En un cliente real, la firma la hace el wallet del jugador.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { QuadDamageClient } from "../src/index.mjs";

const RUN = process.env.QD_RUN ?? "../../../.run";
const deploy = JSON.parse(fs.readFileSync(`${RUN}/deploy.json`, "utf8"));
const E4_CLI = process.env.E4COIN_CLI ?? "../../../e4Coin-core/src/e4coin-cli";
const DATADIR = `${RUN}/e4coin`;

// firma con la clave e4Coin del jugador (aquí vía CLI; en cliente real: wallet)
const address = process.env.PLAYER_ADDRESS; // dirección e4Coin del jugador
const sign = async (msg) =>
  execFileSync(E4_CLI, ["-regtest", `-datadir=${DATADIR}`, "signmessage", address, msg],
    { encoding: "utf8" }).trim();

const client = new QuadDamageClient({
  authUrl: "http://127.0.0.1:8777",
  l2RpcUrl: "http://127.0.0.1:8545",
  contracts: {
    resourceNFT: deploy.resourceNFT,
    identityRegistry: deploy.identityRegistry,
    gameId: deploy.gameId,
    playerEvm: process.env.PLAYER_EVM, // dir EVM donde se acuñan los recursos
  },
  sign,
  address,
});

// 1. registro (una vez) + login
await client.register("MX").catch(() => {});           // ignora si ya existe
const conn = await client.connectInfo();
console.log("userinfo para conectar al servidor:", conn);
//   -> el cliente hace: cl_e4cticket <conn.e4cticket> ; connect <ip>

// 2. leer un balance de recurso on-chain (gasless)
if (process.env.PLAYER_EVM) {
  const iron = await client.resourceBalance("iron");
  console.log("balance de iron on-chain:", iron.toString());
}
