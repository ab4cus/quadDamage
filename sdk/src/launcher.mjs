// quadDamage/sdk/launcher — orquesta el flujo de arranque del CLIENTE de QuadDamage.
//
// Es el "pegamento" que un launcher de escritorio (o el propio menú del juego) usa para:
//   1. asegurar la cuenta e4Coin (registro si hace falta)
//   2. hacer login → obtener el ticket de conexión (e4cticket)
//   3. producir los ARGUMENTOS con los que se lanza el binario del juego para
//      conectarse autenticado a un servidor QuadDamage
//   4. (opcional) lanzar el proceso del juego
//
// El engine (code/client) leerá las cvars \e4cticket\ y \e4caddr\ del userinfo al
// conectar; el servidor las valida en SV_DirectConnect (ver code/server/sv_e4cauth.c).

import { spawn } from "node:child_process";
import { QuadDamageClient } from "./index.mjs";

export class QuadDamageLauncher {
  /**
   * @param {object} o
   * @param {import('./wallet.mjs').CliWallet|import('./wallet.mjs').ExternalWallet} o.wallet
   * @param {string} o.authUrl     URL de quadDamage-auth
   * @param {string} [o.l2RpcUrl]  RPC de la L2 (para balances)
   * @param {object} [o.contracts] direcciones (resourceNFT, gameId, playerEvm…)
   * @param {string} [o.gameBinary] ruta al ejecutable del cliente QuadDamage
   */
  constructor(o) {
    this.wallet = o.wallet;
    this.authUrl = o.authUrl;
    this.l2RpcUrl = o.l2RpcUrl;
    this.contracts = o.contracts ?? {};
    this.gameBinary = o.gameBinary;
    this._client = null;
  }

  async _clientFor() {
    if (this._client) return this._client;
    const address = await this.wallet.getAddress();
    this._client = new QuadDamageClient({
      authUrl: this.authUrl,
      l2RpcUrl: this.l2RpcUrl,
      contracts: this.contracts,
      address,
      sign: (msg) => this.wallet.sign(msg),
    });
    return this._client;
  }

  /** Asegura que la cuenta existe (registro idempotente). */
  async ensureAccount(country = "") {
    const c = await this._clientFor();
    try {
      return await c.register(country);
    } catch (e) {
      if (String(e.message).includes("ya existe")) return { alreadyRegistered: true };
      throw e;
    }
  }

  /**
   * Prepara la conexión: login + ticket. Devuelve las cvars y los argumentos de
   * línea de comandos con los que lanzar el juego para conectar autenticado.
   * @param {string} serverAddr  ip:puerto del servidor QuadDamage (p.ej. 1.2.3.4:27960)
   */
  async prepareConnect(serverAddr) {
    const c = await this._clientFor();
    const { e4cticket, e4caddr } = await c.connectInfo();
    // El ticket viaja en el USERINFO con la clave "e4cticket" (la que lee el servidor
    // en SV_DirectConnect). En Quake 3 los cvars de userinfo se crean con `setu`, así
    // que NO hace falta modificar el engine cliente: basta lanzarlo con +setu.
    // La dirección verificada (e4caddr) la fija el servidor tras validar; no se envía.
    const userinfo = { e4cticket };
    const args = [];
    for (const [k, v] of Object.entries(userinfo)) args.push("+setu", k, v);
    if (serverAddr) args.push("+connect", serverAddr);
    return { userinfo, args, serverAddr, e4caddr, ticket: e4cticket };
  }

  /**
   * Lanza el binario del juego ya autenticado y conectando al servidor dado.
   * Requiere gameBinary. Devuelve el ChildProcess.
   */
  async launch(serverAddr, extraArgs = []) {
    if (!this.gameBinary) throw new Error("gameBinary no configurado");
    const { args } = await this.prepareConnect(serverAddr);
    const child = spawn(this.gameBinary, [...args, ...extraArgs], { stdio: "inherit" });
    return child;
  }

  /** Consulta rápida de balances de recursos del jugador (para el HUD del launcher). */
  async balances(resourceTypes = []) {
    const c = await this._clientFor();
    const out = {};
    for (const r of resourceTypes) out[r] = (await c.resourceBalance(r)).toString();
    return out;
  }

  /** Estado de identidad (Merkle proof) para mostrar "verificado" en el launcher. */
  async identity() {
    const c = await this._clientFor();
    return c.getIdentityProof();
  }
}

export default QuadDamageLauncher;
