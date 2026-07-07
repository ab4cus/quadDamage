// quaddamage-launcher — adaptador de arranque específico de QuadDamage (motor Q3).
//
// Capa FINA sobre el SDK de plataforma (@ab4cus/playchain-sdk). El SDK hace el
// trabajo reutilizable (wallet, login, ticket, balances, identidad); aquí solo se
// añade lo propio del motor Quake 3: formatear el ticket en las cvars de userinfo
// y lanzar el binario del cliente.
//
// En un checkout instalado sería:  import { PlayChainLauncher } from "@ab4cus/playchain-sdk";
// En el monorepo se importa por ruta relativa al módulo js del SDK.

import { spawn } from "node:child_process";
import { PlayChainLauncher, CliWallet, ExternalWallet }
  from "../../playChain-sdk/js/src/index.mjs";

export { CliWallet, ExternalWallet };

export class QuadDamageLauncher {
  /**
   * @param {object} o  igual que PlayChainLauncher + gameBinary opcional
   * @param {string} [o.gameBinary] ruta al ejecutable del cliente QuadDamage
   */
  constructor(o) {
    this.core = new PlayChainLauncher(o);
    this.gameBinary = o.gameBinary;
  }

  /** Registro idempotente de la cuenta. */
  ensureAccount(country = "") { return this.core.ensureAccount(country); }
  /** Balances para el HUD. */
  balances(types = []) { return this.core.balances(types); }
  /** Estado de identidad. */
  identity() { return this.core.identity(); }

  /**
   * Login + ticket, formateado como los ARGUMENTOS del motor Quake 3.
   * El ticket viaja en el userinfo con la clave "e4cticket" (la que valida el
   * servidor en SV_DirectConnect). En Q3 los cvars de userinfo se crean con
   * `setu`, así que NO hace falta modificar el engine cliente.
   * @param {string} serverAddr  ip:puerto del servidor QuadDamage
   */
  async prepareConnect(serverAddr) {
    const { ticket, address } = await this.core.connect();
    const args = ["+setu", "e4cticket", ticket];
    if (serverAddr) args.push("+connect", serverAddr);
    return { args, ticket, e4caddr: address, serverAddr };
  }

  /** Lanza el binario del juego ya autenticado y conectando al servidor. */
  async launch(serverAddr, extraArgs = []) {
    if (!this.gameBinary) throw new Error("gameBinary no configurado");
    const { args } = await this.prepareConnect(serverAddr);
    return spawn(this.gameBinary, [...args, ...extraArgs], { stdio: "inherit" });
  }
}

export default QuadDamageLauncher;
