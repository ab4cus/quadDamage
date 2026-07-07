// quadDamage/sdk/wallet — gestión de la clave e4Coin del jugador (cliente).
//
// El wallet firma los mensajes de registro/login. Se ofrecen dos backends:
//   - CliWallet: usa e4coin-cli (para desarrollo / launcher de escritorio con nodo local)
//   - ExternalWallet: delega la firma a una función provista (hardware wallet, extensión,
//     wallet móvil…). El SDK nunca ve la clave privada.
//
// La CUENTA del jugador es su dirección e4Coin. Ver whitepaper/04-identidad-gasless.

import { execFileSync } from "node:child_process";

/** Wallet que firma vía e4coin-cli con un nodo/regtest local. */
export class CliWallet {
  /**
   * @param {object} o
   * @param {string} o.cli       ruta a e4coin-cli
   * @param {string} o.datadir   datadir del nodo
   * @param {string} [o.network] "regtest" | "testnet" | "" (mainnet)
   * @param {string} [o.rpcwallet] nombre del wallet RPC
   */
  constructor({ cli, datadir, network = "regtest", rpcwallet }) {
    this.cli = cli;
    this.base = [];
    if (network) this.base.push(`-${network}`);
    if (datadir) this.base.push(`-datadir=${datadir}`);
    if (rpcwallet) this.base.push(`-rpcwallet=${rpcwallet}`);
    this._address = null;
  }

  _run(...args) {
    return execFileSync(this.cli, [...this.base, ...args], { encoding: "utf8" }).trim();
  }

  /** Devuelve (o crea) la dirección e4Coin del jugador = su cuenta. */
  async getAddress() {
    if (this._address) return this._address;
    this._address = this._run("getnewaddress");
    return this._address;
  }

  /** Firma un mensaje con la clave de la dirección del jugador. */
  async sign(message) {
    const addr = await this.getAddress();
    return this._run("signmessage", addr, message);
  }
}

/**
 * Wallet externo: el integrador provee address + sign. El SDK no toca la clave.
 * Úsalo con una extensión de navegador, wallet móvil o hardware wallet.
 */
export class ExternalWallet {
  /**
   * @param {object} o
   * @param {string} o.address                 dirección e4Coin del jugador
   * @param {(msg:string)=>Promise<string>} o.sign  firma (base64 de firma e4Coin)
   */
  constructor({ address, sign }) {
    this._address = address;
    this._sign = sign;
  }
  async getAddress() { return this._address; }
  async sign(message) { return this._sign(message); }
}
