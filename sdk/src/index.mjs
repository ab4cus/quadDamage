// @ab4cus/quaddamage-sdk — SDK de conexión de QuadDamage.
//
// Une las tres capas para el CLIENTE del juego y herramientas:
//   - identidad/auth (quadDamage-auth, ligado a la L1 e4Coin)
//   - economía / recursos (contratos L2: ResourceNFT, Marketplace)
//   - la wallet e4Coin del jugador (firma)
//
// El SDK NO habla directamente con el nodo e4coind ni firma sesiones (eso es
// server-authoritative, Tier 0). Da al cliente lo que necesita para: registrarse,
// hacer login, obtener su ticket de conexión, su Merkle proof de identidad y
// consultar sus balances de recursos on-chain.
//
// Sin dependencias externas (usa fetch nativo). El wallet lo provee el integrador
// (una función de firma), para no acoplar el SDK a un gestor de claves concreto.

export class QuadDamageClient {
  /**
   * @param {object} cfg
   * @param {string} cfg.authUrl   URL de quadDamage-auth (p.ej. http://127.0.0.1:8777)
   * @param {string} cfg.l2RpcUrl  RPC de la L2 (para lecturas de balances)
   * @param {object} cfg.contracts { resourceNFT, marketplace, identityRegistry, gameId }
   * @param {(msg:string)=>Promise<string>} cfg.sign  firma un mensaje con la clave e4Coin del jugador
   * @param {string} cfg.address   dirección e4Coin del jugador (su cuenta)
   */
  constructor(cfg) {
    this.authUrl = cfg.authUrl?.replace(/\/$/, "");
    this.l2RpcUrl = cfg.l2RpcUrl;
    this.contracts = cfg.contracts ?? {};
    this.sign = cfg.sign;
    this.address = cfg.address;
  }

  async _post(path, body) {
    const res = await fetch(this.authUrl + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `${path} -> ${res.status}`);
    return data;
  }
  async _get(path) {
    const res = await fetch(this.authUrl + path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `${path} -> ${res.status}`);
    return data;
  }

  // ------------------------------------------------ identidad / cuenta
  /** Registra la cuenta (= dirección e4Coin). Firma el mensaje de registro. */
  async register(country = "") {
    const registerMessage = `QuadDamage account registration for ${this.address}`;
    const signature = await this.sign(registerMessage);
    return this._post("/register", { address: this.address, signature, country });
  }

  /** Merkle proof de identidad (para verificación gasless en cualquier servicio). */
  async getIdentityProof() {
    return this._get(`/proof/${encodeURIComponent(this.address)}`);
  }

  // ------------------------------------------------ login → ticket de conexión
  /**
   * Hace login (challenge + firma) y devuelve el ticket que el cliente inyecta
   * en su userinfo (\e4cticket\<spoolid>) al conectar al servidor QuadDamage.
   */
  async login() {
    const { challenge } = await this._post("/challenge", { address: this.address });
    const signature = await this.sign(challenge);
    const { ticket, spool, gameAccountId } = await this._post("/login", {
      address: this.address, challenge, signature,
    });
    return { ticket, spoolId: spool, gameAccountId };
  }

  /**
   * Cadena de conexión completa: devuelve el userinfo extra que el engine espera.
   * Úsalo para setear las cvars antes de `connect`.
   */
  async connectInfo() {
    const { spoolId } = await this.login();
    return { e4cticket: spoolId, e4caddr: this.address };
  }

  // ------------------------------------------------ economía / recursos (L2, lectura)
  /** Lee un uint256 de la L2 vía JSON-RPC eth_call (sin dependencias). */
  async _ethCall(to, dataHex) {
    const res = await fetch(this.l2RpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to, data: dataHex }, "latest"] }),
    });
    const { result, error } = await res.json();
    if (error) throw new Error(error.message);
    return BigInt(result ?? "0x0");
  }

  /**
   * Balance de un recurso del jugador en ResourceNFT (ERC-1155). Lectura on-chain
   * pura (view), sin gas. Requiere contracts.resourceNFT, gameId y playerEvm.
   */
  async resourceBalance(resourceType) {
    const { resourceNFT, gameId } = this.contracts;
    if (!resourceNFT || !gameId) throw new Error("contracts.resourceNFT/gameId no configurados");
    // tokenIdFor(bytes32,string) -> uint256
    const tokenId = await this._ethCall(resourceNFT,
      SEL.tokenIdFor + word(gameId) + encStringTail(resourceType, 2));
    // balanceOf(address,uint256) -> uint256
    const bal = await this._ethCall(resourceNFT,
      SEL.balanceOf + word(this.playerEvm()) + word("0x" + tokenId.toString(16)));
    return bal;
  }

  /** Dirección EVM del jugador para las lecturas L2 (config o = address). */
  playerEvm() {
    return this.contracts.playerEvm ?? this.address;
  }
}

// -------------------------------------------------- ABI encoding mínimo (sin deps)
// Selectores precomputados (keccak256 de la firma, 4 bytes). Ver .claude/sigs.sh.
const SEL = {
  tokenIdFor: "0x761c41ba",
  balanceOf: "0x00fdd58e",
};

/** Rellena un valor (hex o dirección) a una palabra de 32 bytes (64 hex). */
function word(v) {
  const h = String(v).replace(/^0x/, "").toLowerCase();
  return h.padStart(64, "0");
}

/**
 * Cola ABI de un `string` dinámico cuando es el 2º argumento tras un valor fijo.
 * headWords = nº de palabras de cabecera antes del offset (aquí: 2 → el bytes32
 * fijo + esta ranura de offset). Devuelve: offset(word) + len(word) + data(padded).
 */
function encStringTail(str, headWords) {
  const bytes = Buffer.from(str, "utf8");
  const offset = word("0x" + (headWords * 32).toString(16));
  const len = word("0x" + bytes.length.toString(16));
  const dataHex = bytes.toString("hex");
  const padded = dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, "0");
  return offset + len + padded;
}

// Re-exporta el cliente, el launcher y los wallets como API pública del SDK.
export { QuadDamageLauncher } from "./launcher.mjs";
export { CliWallet, ExternalWallet } from "./wallet.mjs";

export default QuadDamageClient;
