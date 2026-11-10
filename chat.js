// Chat de grupo sobre Nostr (sem servidor próprio).
// - Cada grupo tem uma chave secreta (AES-256-GCM) que só viaja no ficheiro cifrado de partilha do grupo.
// - Os relays Nostr só veem texto cifrado, um identificador aleatório do dispositivo e a hora.
// - O "tópico" do grupo é um hash da chave: não revela o nome do grupo.
// Assinaturas Nostr (BIP-340) via nostr-tools, carregado a pedido de vendor/.

export const CHAT_KIND = 4243; // evento regular, específico da eKit
export const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const NOSTR_SRC = 'vendor/nostr-tools-2.25.1.js';

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));

let loading;
export function loadNostr() {
  if (window.NostrTools) return Promise.resolve();
  loading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = NOSTR_SRC;
    s.onload = res;
    s.onerror = () => { loading = null; rej(new Error('nostr-tools')); };
    document.head.append(s);
  });
  return loading;
}

export async function newChatConfig() {
  const key = b64(crypto.getRandomValues(new Uint8Array(32)));
  const h = await crypto.subtle.digest('SHA-256', enc.encode('ekit-chat-topic:' + key));
  return { key, topic: hex(new Uint8Array(h)).slice(0, 40), createdAt: new Date().toISOString() };
}

const keys = new Map();
async function aesKey(k) {
  if (!keys.has(k)) keys.set(k, await crypto.subtle.importKey('raw', unb64(k), 'AES-GCM', false, ['encrypt', 'decrypt']));
  return keys.get(k);
}
async function seal(k, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(k), enc.encode(JSON.stringify(obj)));
  return b64(iv) + '.' + b64(new Uint8Array(ct));
}
async function unseal(k, s) {
  const [iv, ct] = s.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(k), unb64(ct));
  return JSON.parse(dec.decode(pt));
}

export const newIdentity = () => hex(window.NostrTools.generateSecretKey());
export const pubkeyOf = sk => window.NostrTools.getPublicKey(unhex(sk));

export class GroupChat {
  constructor({ cfg, sk, relays = DEFAULT_RELAYS, onMessage, onAck, onStatus }) {
    Object.assign(this, { cfg, sk, relays, onMessage, onAck, onStatus });
    this.sockets = new Map();
    this.subId = 'ekit-' + Math.random().toString(36).slice(2, 10);
    this.closed = true;
  }

  connect() {
    this.closed = false;
    for (const url of this.relays) if (!(this.sockets.get(url)?.readyState <= 1)) this.open(url);
  }

  open(url) {
    if (this.closed || !navigator.onLine) return;
    let ws;
    try { ws = new WebSocket(url); } catch { return; }
    this.sockets.set(url, ws);
    ws.onopen = () => {
      const since = Math.floor(Date.now() / 1000) - 30 * 86400;
      ws.send(JSON.stringify(['REQ', this.subId, { kinds: [CHAT_KIND], '#t': [this.cfg.topic], since, limit: 300 }]));
      this.onStatus();
      this.flush?.();
    };
    ws.onmessage = e => { try { this.handle(JSON.parse(e.data)); } catch { /* mensagem inválida do relay */ } };
    ws.onerror = () => {};
    ws.onclose = () => {
      this.onStatus();
      if (!this.closed) setTimeout(() => { if (this.sockets.get(url) === ws) this.open(url); }, 8000);
    };
  }

  async handle(m) {
    if (m[0] === 'OK' && m[2] === true) return this.onAck(m[1]);
    if (m[0] !== 'EVENT' || m[1] !== this.subId) return;
    const ev = m[2];
    if (ev.kind !== CHAT_KIND || !ev.tags.some(t => t[0] === 't' && t[1] === this.cfg.topic)) return;
    if (!window.NostrTools.verifyEvent(ev)) return;
    try {
      const body = await unseal(this.cfg.key, ev.content);
      this.onMessage({
        id: ev.id, pk: ev.pubkey, ts: ev.created_at * 1000, status: 'sent',
        name: String(body.n || '').slice(0, 40), text: String(body.m || '').slice(0, 2000),
      });
    } catch { /* não é deste grupo (outra chave) */ }
  }

  get connected() { return [...this.sockets.values()].filter(s => s.readyState === 1).length; }

  async build(name, text) {
    const content = await seal(this.cfg.key, { n: name, m: text });
    return window.NostrTools.finalizeEvent(
      { kind: CHAT_KIND, created_at: Math.floor(Date.now() / 1000), tags: [['t', this.cfg.topic]], content },
      unhex(this.sk),
    );
  }

  publish(ev) {
    let n = 0;
    for (const s of this.sockets.values()) if (s.readyState === 1) { s.send(JSON.stringify(['EVENT', ev])); n++; }
    return n;
  }

  close() {
    this.closed = true;
    for (const s of this.sockets.values()) { try { s.close(); } catch { /* já fechado */ } }
    this.sockets.clear();
  }
}
