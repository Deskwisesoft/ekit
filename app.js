import {
  CATEGORIES, DEFAULT_KIT, EMERGENCY_NUMBERS, DEFAULT_LISTS, GUIDES,
  IPMA_AREAS, IPMA_WARNINGS_URL, ALERT_SOURCES, LISBOA_POINTS_URL, DISTRICT_CAPITALS, OVERPASS_URLS, SEISMIC_URL,
  RADIO_A1, RADIO_SOURCE, FIRE_RISK_URL, FIRE_LEVELS,
} from './data.js';
import { GroupHub, newChatConfig, newIdentity, pubkeyOf, loadNostr, DEFAULT_RELAYS, publishInvite, fetchInvite, newInviteCode, normalizeCode } from './chat.js';
const SITE_URL = 'https://deskwisesoft.github.io/ekit/';

// ---------- Estado (guardado só neste dispositivo) ----------
const KEY = 'ekit:v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function seed() {
  return {
    version: 1,
    settings: { household: 2, district: 'LSB', notifyDays: 30, lastNotified: '' },
    kit: DEFAULT_KIT.map(i => ({ id: uid(), ...i, have: 0, expiry: '', location: '', notes: '' })),
    contacts: [],
    groups: [],
    lists: DEFAULT_LISTS.map(l => ({ id: uid(), name: l.name, items: l.items.map(text => ({ id: uid(), text, done: false })) })),
    alertsCache: null,
  };
}
// ---------- Validação de tudo o que vem de fora (armazenamento, ficheiros, relays, dados abertos) ----------
// Os dados são normalizados à entrada: textos limitados, números verificados, coordenadas dentro dos limites,
// só os campos conhecidos. Assim nada vindo de outro membro do grupo ou de um ficheiro chega ao HTML sem controlo.
const GROUP_FIELDS = ['name', 'meetingPoint', 'lat', 'lng', 'notes'];
const MEMBER_FIELDS = ['name', 'phone', 'role', 'bitchat', 'needs', 'allergies', 'meds', 'blood', 'consentAt'];
const HEALTH_FIELDS = ['needs', 'allergies', 'meds', 'blood'];
// Secções que podem ir para a barra: as 4 primeiras ficam no telemóvel, o resto vai para o Menu.
const NAV_KEYS = ['painel', 'preparar', 'grupos', 'mapa', 'kit', 'alertas', 'contactos', 'guia'];
const arr = v => (Array.isArray(v) ? v : []);
const str = (v, max = 500) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const num = (v, d = 0) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const coord = (v, lim) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && Math.abs(n) <= lim ? n : ''; };
const isoDate = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const clampTs = v => Math.min(num(v), Date.now() + 5 * 60e3); // ninguém "ganha" com relógios no futuro
const idOf = v => (typeof v === 'string' && v && v.length <= 80 ? v : uid());

function cleanMember(m) {
  const o = { id: idOf(m?.id), updatedAt: clampTs(m?.updatedAt) };
  if (m?.deleted) { o.deleted = true; return o; }
  for (const k of MEMBER_FIELDS) o[k] = str(m?.[k], ['needs', 'allergies', 'meds'].includes(k) ? 1000 : k === 'blood' ? 10 : 200);
  o.consent = !!m?.consent;
  o.pk = /^[0-9a-f]{64}$/.test(m?.pk) ? m.pk : '';
  if (!o.consent) for (const k of HEALTH_FIELDS) o[k] = '';
  return o;
}
const PET_FIELDS = { name: 80, species: 40, breed: 80, chip: 30, registry: 60, vet: 120, vetPhone: 30, needs: 1000, notes: 1000 };
function cleanPet(a) {
  const o = { id: idOf(a?.id), updatedAt: clampTs(a?.updatedAt) };
  if (a?.deleted) { o.deleted = true; return o; }
  for (const [k, max] of Object.entries(PET_FIELDS)) o[k] = str(a?.[k], max);
  o.chip = o.chip.replace(/[^0-9A-Za-z]/g, '');
  o.rabies = isoDate(a?.rabies);
  return o;
}
const MEET_KINDS = { casa: 'Perto de casa', bairro: 'No bairro', fora: 'Fora da zona', outro: 'Outro' };
function cleanMeet(x) {
  const o = { id: idOf(x?.id), updatedAt: clampTs(x?.updatedAt) };
  if (x?.deleted) { o.deleted = true; return o; }
  o.name = str(x?.name, 200) || 'Ponto de encontro';
  o.kind = Object.hasOwn(MEET_KINDS, x?.kind) ? x.kind : 'outro';
  o.lat = coord(x?.lat, 90); o.lng = coord(x?.lng, 180);
  if (o.lat === '' || o.lng === '') { o.lat = ''; o.lng = ''; }
  o.notes = str(x?.notes, 500);
  return o;
}
function cleanGroup(g) {
  const o = {
    id: idOf(g?.id), name: str(g?.name, 120) || 'Grupo', meetingPoint: str(g?.meetingPoint, 300),
    lat: coord(g?.lat, 90), lng: coord(g?.lng, 180), notes: str(g?.notes, 2000), meta: {},
    members: arr(g?.members).filter(m => m && typeof m.id === 'string').slice(0, 200).map(cleanMember),
    pets: arr(g?.pets).filter(a => a && typeof a.id === 'string').slice(0, 100).map(cleanPet),
    points: arr(g?.points).filter(a => a && typeof a.id === 'string').slice(0, 20).map(cleanMeet),
  };
  if (o.lat === '' || o.lng === '') { o.lat = ''; o.lng = ''; }
  for (const k of GROUP_FIELDS) if (g?.meta?.[k] != null) o.meta[k] = clampTs(g.meta[k]);
  return o;
}
const cleanChatCfg = c => (c && /^[A-Za-z0-9+/]{43}=$/.test(c.key) && /^[0-9a-f]{40}$/.test(c.topic)
  ? { key: c.key, topic: c.topic, createdAt: str(c.createdAt, 40) } : undefined);
function cleanPoint(p) {
  const o = { n: str(p?.n, 200) || 'Ponto de encontro', f: str(p?.f, 120), m: str(p?.m, 60), lat: coord(p?.lat, 90), lng: coord(p?.lng, 180),
    cap: Number.isFinite(Number(p?.cap)) && p?.cap !== null ? Math.round(Number(p.cap)) : null, t: str(p?.t, 30) };
  return o.lat === '' || o.lng === '' ? null : o;
}
function cleanQuake(q) {
  const lat = Number(q?.lat), lng = Number(q?.lng ?? q?.lon), mag = Number(q?.mag ?? q?.magnitud);
  const t = typeof q?.t === 'string' ? q.t : typeof q?.time === 'string' ? q.time : '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(mag) || mag < 0 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return null;
  return { t: t.slice(0, 19), lat, lng, mag, reg: str(q?.reg ?? q?.obsRegion, 80).replace(/\s+/g, ' ').trim(), sensed: !!q?.sensed };
}
function cleanService(x) {
  const lat = Number(x?.lat), lng = Number(x?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { k: x?.k === 'police' ? 'police' : 'fire', n: str(x?.n, 160), op: str(x?.op, 120), phone: str(x?.phone, 40).replace(/[^\d+ ]/g, '').trim(), lat, lng };
}
function cleanState(s) {
  const base = seed();
  if (!s || typeof s !== 'object') return base;
  const st = s.settings || {};
  const out = { ...s, version: 1 };
  out.settings = {
    ...base.settings,
    household: Math.max(1, Math.min(50, Math.round(num(st.household, 2)))),
    district: Object.hasOwn(IPMA_AREAS, st.district) ? st.district : 'LSB',
    notifyDays: Math.max(1, Math.min(365, Math.round(num(st.notifyDays, 30)))),
    lastNotified: str(st.lastNotified, 10), onboarded: !!st.onboarded, myName: str(st.myName, 40),
    relays: arr(st.relays).filter(u => typeof u === 'string' && /^wss?:\/\/[^\s"'<>]+$/.test(u)).slice(0, 10),
    navOrder: arr(st.navOrder).filter(k => NAV_KEYS.includes(k)),
    blocked: arr(st.blocked).filter(k => /^[0-9a-f]{64}$/.test(k)),
    chatNotify: st.chatNotify !== false, chatPreview: st.chatPreview !== false,
    autoDistrict: st.autoDistrict !== false,
    radio: str(st.radio, 60), lastBackup: num(st.lastBackup), mapSaved: num(st.mapSaved), mapSavedN: num(st.mapSavedN),
    lastDrill: num(st.lastDrill), drillSnooze: num(st.drillSnooze), phoneReady: !!st.phoneReady,
  };
  out.kit = Array.isArray(s.kit) ? s.kit.map(i => ({
    id: idOf(i?.id), cat: CATEGORIES.some(c => c.id === i?.cat) ? i.cat : 'outros', name: str(i?.name, 200), qty: Math.max(0, num(i?.qty)),
    unit: str(i?.unit, 20), perPerson: !!i?.perPerson, expires: !!i?.expires, have: Math.max(0, num(i?.have)), expiry: isoDate(i?.expiry),
    location: str(i?.location, 200), notes: str(i?.notes, 1000),
  })) : base.kit;
  out.contacts = arr(s.contacts).map(c => ({ id: idOf(c?.id), name: str(c?.name, 120), phone: str(c?.phone, 30), relation: str(c?.relation, 120), notes: str(c?.notes, 1000), priority: !!c?.priority }));
  out.lists = Array.isArray(s.lists) ? s.lists.map(l => ({ id: idOf(l?.id), name: str(l?.name, 120), items: arr(l?.items).map(i => ({ id: idOf(i?.id), text: str(i?.text, 300), done: !!i?.done })) })) : base.lists;
  // Listas novas (documentos, vizinhos) chegam uma vez a quem já usava a app.
  if (num(s.listsV, 1) < 2) for (const l of base.lists) if (!out.lists.some(x => x.name === l.name)) out.lists.push(l);
  out.listsV = 2;
  out.fireRisk = s.fireRisk && Array.isArray(s.fireRisk.pts) ? { at: num(s.fireRisk.at), day: isoDate(s.fireRisk.day),
    pts: s.fireRisk.pts.filter(p => Array.isArray(p) && p.length === 4 && p.every(Number.isFinite)).slice(0, 400) } : undefined;
  out.quakes = s.quakes && Array.isArray(s.quakes.data) ? { at: num(s.quakes.at), area: num(s.quakes.area), data: s.quakes.data.map(cleanQuake).filter(Boolean).slice(0, 400) } : undefined;
  out.groups = arr(s.groups).filter(g => g && typeof g.id === 'string').map(g => ({
    ...cleanGroup(g), chat: cleanChatCfg(g.chat), syncPending: !!g.syncPending, syncRev: num(g.syncRev), sharedAt: str(g.sharedAt, 40), imported: !!g.imported, selfAdded: !!g.selfAdded,
  }));
  out.chatRead = Object.fromEntries(Object.entries(s.chatRead && typeof s.chatRead === 'object' ? s.chatRead : {}).map(([k, v]) => [str(k, 80), num(v)]));
  out.chat = {};
  for (const [gid, list] of Object.entries(s.chat && typeof s.chat === 'object' ? s.chat : {})) {
    out.chat[gid] = arr(list).slice(-500).map(m => ({
      id: str(m?.id, 64), pk: /^[0-9a-f]{64}$/.test(m?.pk) ? m.pk : '', name: str(m?.name, 40), text: str(m?.text, 2000), ts: num(m?.ts),
      status: m?.status === 'pending' ? 'pending' : 'sent', ...(m?.status === 'pending' && m?.ev ? { ev: m.ev } : {}),
    }));
  }
  out.lastPos = Number.isFinite(s.lastPos?.lat) && Math.abs(s.lastPos.lat) <= 90 && Number.isFinite(s.lastPos?.lng) && Math.abs(s.lastPos.lng) <= 180
    ? { lat: s.lastPos.lat, lng: s.lastPos.lng, at: num(s.lastPos.at) } : undefined;
  out.services = s.services && Array.isArray(s.services.list) ? { at: num(s.services.at), list: s.services.list.map(cleanService).filter(Boolean).slice(0, 300) } : undefined;
  out.nostr = s.nostr && /^[0-9a-f]{64}$/.test(s.nostr.sk) && /^[0-9a-f]{64}$/.test(s.nostr.pk) ? { sk: s.nostr.sk, pk: s.nostr.pk } : undefined;
  out.pointsCache = s.pointsCache?.lisboa ? { at: num(s.pointsCache.at), lisboa: arr(s.pointsCache.lisboa).map(cleanPoint).filter(Boolean) } : undefined;
  out.alertsCache = s.alertsCache && Array.isArray(s.alertsCache.data) ? { at: num(s.alertsCache.at), data: s.alertsCache.data.filter(w => w && typeof w === 'object') } : null;
  return out;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 1) return cleanState(s); } catch {}
  return seed();
}
let S = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const ui = { folds: {}, kitFilter: 'all', alertsLoading: false, alertsError: '', pos: null, geoError: '', pointsLoading: false };

// ---------- Pontos de encontro oficiais e geolocalização ----------
let POINTS = [], POINTS_META = { sources: [] };
async function loadPoints() {
  try {
    const d = await (await fetch('./pontos-encontro.json')).json();
    POINTS_META = d.meta;
    POINTS = arr(d.points).map(cleanPoint).filter(Boolean);
    if (S.pointsCache?.lisboa) POINTS = [...S.pointsCache.lisboa, ...POINTS.filter(p => p.m !== 'Lisboa')];
  } catch { /* sem cópia local: o mapa mostra só os pontos dos grupos */ }
  render();
}
async function refreshLisboa() {
  ui.pointsLoading = true; render();
  try {
    const d = await (await fetch(LISBOA_POINTS_URL, { cache: 'no-store' })).json();
    const lisboa = arr(d.features).map(f => cleanPoint({
      n: str(f?.properties?.NOME || f?.properties?.DESIGNACAO).trim(), f: f?.properties?.FREGUESIA,
      m: 'Lisboa', lat: f?.geometry?.coordinates?.[1], lng: f?.geometry?.coordinates?.[0], cap: f?.properties?.CAPACIDADE, t: 'Emergência',
    })).filter(Boolean);
    if (!lisboa.length) throw new Error('vazio');
    S.pointsCache = { at: Date.now(), lisboa }; save();
    POINTS = [...lisboa, ...POINTS.filter(p => p.m !== 'Lisboa')];
    toast(`${lisboa.length} pontos de Lisboa atualizados.`);
  } catch { toast('Não foi possível atualizar (sem rede?). Mantém-se a cópia local.'); }
  ui.pointsLoading = false; render();
}
const hasCoords = o => o && o.lat !== '' && o.lat != null && o.lng !== '' && o.lng != null;
function distanceKm(a, b) {
  const R = 6371, r = x => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const r = x => (x * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(deg / 45) % 8];
}
const fmtDist = km => (km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km');
const fmtCoords = p => `${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}`;
function navLinks(p, label) {
  const lat = Number(p.lat), lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  p = { lat, lng };
  const q = `${lat},${lng}`;
  return `<div class="navgo">
    <details class="menu"><summary class="btn sm">${icon('nav')} Navegar</summary>
      <div class="menu-list">
        <a href="geo:${q}?q=${q}(${encodeURIComponent(label || '')})">App de mapas do telemóvel</a>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${q}" target="_blank" rel="noopener">Google Maps</a>
        <a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}" target="_blank" rel="noopener">OpenStreetMap</a>
      </div>
    </details>
    <button class="btn sm" data-act="copy" data-v="${fmtCoords(p)}">${icon('copy')} Copiar GPS</button>
  </div>`;
}
function locate(then) {
  if (!navigator.geolocation) { ui.geoError = 'Este dispositivo não suporta localização.'; return render(); }
  ui.geoError = 'A obter localização…'; render();
  navigator.geolocation.getCurrentPosition(
    p => { ui.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; ui.geoError = ''; onPosition(ui.pos); then ? then(ui.pos) : render(); },
    e => { ui.geoError = e.code === 1 ? 'Permissão de localização recusada.' : 'Não foi possível obter a localização.'; render(); },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
  );
}

// A posição fica só neste dispositivo. Serve para o ponto mais próximo e para os avisos da zona.
function onPosition(p) {
  S.lastPos = { lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), at: Date.now() };
  save();
  if (S.settings.autoDistrict) detectDistrict(p);
}
const myPos = () => ui.pos || S.lastPos || null;
const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function districtFromCoords({ lat, lng }) {
  if (lng < -20) return lng > -26.5 ? 'AOR' : lng < -30 ? 'AOC' : 'ACE';
  if (lng < -15) return lat > 32.95 ? 'MPS' : lat >= 32.78 ? 'MCN' : 'MCS';
  let best = 'LSB', bd = Infinity;
  for (const [k, [la, ln]] of Object.entries(DISTRICT_CAPITALS)) { const d = distanceKm({ lat, lng }, { lat: la, lng: ln }); if (d < bd) { bd = d; best = k; } }
  return best;
}
// Servidores públicos do OpenStreetMap: tenta o principal e, se estiver ocupado, o alternativo.
async function overpass(q, ms = 15000) {
  for (const base of OVERPASS_URLS) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
    try {
      const res = await fetch(base + '?data=' + encodeURIComponent(q), { cache: 'no-store', signal: ac.signal });
      if (res.ok) return await res.json();
    } catch { /* ocupado ou sem rede: tenta o seguinte */ } finally { clearTimeout(t); }
  }
  throw new Error('overpass');
}
async function detectDistrict(p) {
  let k = districtFromCoords(p);
  // No continente, o OpenStreetMap diz o distrito exato (envia a posição arredondada a ~1 km).
  if (navigator.onLine && p.lng > -10) {
    try {
      const d = await overpass(`[out:json][timeout:15];is_in(${p.lat.toFixed(2)},${p.lng.toFixed(2)});area._[boundary=administrative][admin_level=6];out tags;`);
      const name = norm(d?.elements?.[0]?.tags?.name).replace(/^distrito d[eo]s? /, '');
      const hit = Object.entries(IPMA_AREAS).find(([, v]) => norm(v) === name);
      if (hit) k = hit[0];
    } catch { /* sem rede: fica a aproximação */ }
  }
  if (k !== S.settings.district) { S.settings.district = k; save(); render(); toast('Avisos para ' + IPMA_AREAS[k] + ' (pela sua localização).'); }
}
function nearestOfficial(pos) {
  let best = null;
  POINTS.forEach((p, i) => { const d = distanceKm(pos, p); if (!best || d < best.d) best = { p: { ...p, i }, d }; });
  return best;
}

// ---------- Bombeiros e polícia perto (OpenStreetMap) ----------
async function findServices() {
  const pos = myPos();
  if (!pos) return locate(() => findServices());
  if (!navigator.onLine) return toast('Precisa de internet para procurar. Os resultados ficam guardados.');
  ui.servicesLoading = true; render();
  const la = pos.lat.toFixed(2), ln = pos.lng.toFixed(2);
  try {
    const d = await overpass(`[out:json][timeout:20];nwr[amenity~"^(fire_station|police)$"](around:15000,${la},${ln});out tags center 200;`, 25000);
    const list = (d?.elements || []).map(e => {
      const t = e.tags || {}, k = t.amenity === 'police' ? 'police' : 'fire';
      return cleanService({ k, n: t.name || t.official_name || (k === 'fire' ? 'Bombeiros' : 'Posto policial'), op: t.operator || '',
        phone: String(t.phone || t['contact:phone'] || '').split(/[;,]/)[0], lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon });
    }).filter(Boolean);
    S.services = { at: Date.now(), list };
    save();
    if (!list.length) toast('Não foram encontrados bombeiros nem polícia num raio de 15 km.');
  } catch { toast('O serviço do OpenStreetMap está ocupado. Tente daqui a alguns minutos.'); }
  ui.servicesLoading = false; render();
}
function nearestServices(k, n) {
  const pos = myPos(), list = (S.services?.list || []).filter(s => s.k === k);
  return (pos ? list.map(s => ({ s, d: distanceKm(pos, s) })).sort((a, b) => a.d - b.d) : list.map(s => ({ s, d: null }))).slice(0, n);
}
const serviceRow = ({ s, d }) => `<li class="row"><div class="row-main"><div class="row-title">${esc(s.n)}</div>
  <div class="row-sub">${esc([s.op, d != null ? fmtDist(d) : ''].filter(Boolean).join(' · '))}${s.phone ? '' : ' · sem telefone registado'}</div></div>
  ${s.phone ? `<a class="btn" href="${telHref(s.phone)}" aria-label="Ligar para ${esc(s.n)}">${icon('phone')} ${esc(s.phone)}</a>` : ''}</li>`;

// ---------- Utilitários ----------
const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => (d ? new Date(d + 'T00:00').toLocaleDateString('pt-PT') : '');
const telHref = p => 'tel:' + String(p).replace(/[^\d+]/g, '');

function daysLeft(date) {
  if (!date) return null;
  const t = new Date();
  return Math.round((Date.parse(date) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
}
function expiryState(item) {
  const d = daysLeft(item.expiry);
  if (d === null) return null;
  if (d < 0) return { cls: 'bad', label: `Expirado (${fmtDate(item.expiry)})`, d };
  if (d <= S.settings.notifyDays) return { cls: 'warn', label: `Expira em ${d} dia${d === 1 ? '' : 's'}`, d };
  return { cls: 'good', label: `Válido até ${fmtDate(item.expiry)}`, d };
}
const need = i => (i.perPerson ? i.qty * S.settings.household : i.qty);
const isOk = i => need(i) > 0 && i.have >= need(i) && !(daysLeft(i.expiry) < 0);

function stats() {
  const required = S.kit.filter(i => need(i) > 0);
  const ok = required.filter(isOk).length;
  const exp = S.kit.map(i => ({ i, e: expiryState(i) })).filter(x => x.e && x.e.cls !== 'good').sort((a, b) => a.e.d - b.e.d);
  return {
    pct: required.length ? Math.round((ok / required.length) * 100) : 0,
    missing: required.length - ok,
    expired: exp.filter(x => x.e.cls === 'bad').length,
    expiring: exp.filter(x => x.e.cls === 'warn').length,
    exp,
  };
}

async function download(name, text, type = 'application/json') {
  const file = new File([text], name, { type });
  const mobile = native() || /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Cifra (AES-GCM + PBKDF2) para partilha/backup ----------
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encrypt(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt), new TextEncoder().encode(JSON.stringify(obj)));
  return { salt: b64(salt), iv: b64(iv), data: b64(data) };
}
async function decrypt(pkg, pass) {
  const key = await deriveKey(pass, unb64(pkg.salt));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(pkg.iv) }, key, unb64(pkg.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function exportPackage(type, payload, filename) {
  openForm({
    title: type === 'group' ? 'Exportar grupo' : 'Exportar cópia de segurança',
    fields: [
      { type: 'info', html: 'Partilhe a palavra-passe por outro canal. Sem ela, o ficheiro fica legível.' },
      { k: 'pass', label: 'Palavra-passe (mín. 8 caracteres)', type: 'password' },
    ],
    submitLabel: 'Exportar',
    async onSave({ pass }) {
      if (pass && pass.length < 8) { toast('Palavra-passe demasiado curta.'); return false; }
      if (!pass && !confirm('Exportar SEM cifra? Os dados pessoais ficarão legíveis.')) return false;
      const out = { app: 'ekit', type, exportedAt: new Date().toISOString(), encrypted: !!pass };
      if (pass) out.payload = await encrypt(payload, pass); else out.payload = payload;
      download(filename, JSON.stringify(out, null, 2));
      toast('Ficheiro exportado.');
    },
  });
}

function importGroupPayload(raw) {
  const payload = { ...cleanGroup(raw), chat: cleanChatCfg(raw?.chat) };
  const existing = findGroup(payload.id);
  if (existing) {
    mergeGroup(existing, payload);
    if (payload.chat?.key && payload.chat.key !== existing.chat?.key) existing.chat = payload.chat;
    toast(`Grupo "${existing.name}" atualizado.`);
  } else {
    S.groups.push({ ...payload, imported: true });
    toast(`Entrou no grupo "${payload.name}".`);
  }
  save();
  setTimeout(() => { S.groups.forEach(setupGroupKey); startHub(); }, 0);
  if (location.hash !== '#/grupos') location.hash = '#/grupos'; else render();
}

// Quem cria ou entra num grupo passa a constar como membro, com o seu nome; chega aos outros pela sincronização.
async function addSelfToGroup(g) {
  if (!g || g.selfAdded || !S.settings.myName) return;
  try { await ensureIdentity(); } catch { return; }
  const id = 'dev-' + S.nostr.pk.slice(0, 16);
  g.members ||= [];
  const me = { id, pk: S.nostr.pk, name: S.settings.myName, phone: '', role: '', bitchat: '', needs: '', consentAt: '', consent: false, updatedAt: Date.now() };
  const old = g.members.find(m => m.id === id);
  if (!old) g.members.push(me);
  else if (old.deleted) { for (const k of Object.keys(old)) delete old[k]; Object.assign(old, me); }
  g.selfAdded = true;
  markDirty(g);
  render();
}

const relaysList = () => (S.settings.relays?.length ? S.settings.relays : DEFAULT_RELAYS);

// Partilhar com código: o grupo vai cifrado com o próprio código; válido 24 h.
async function shareGroup(g) {
  const d = $('#dlg');
  const show = body => {
    d.innerHTML = `<div class="form share-dialog"><h2>Partilhar "${esc(g.name)}"</h2>${body}
      <div class="form-actions"><button type="button" class="btn ghost" data-file>Enviar ficheiro</button><span class="spacer"></span><button type="button" class="btn" data-close>Fechar</button></div></div>`;
    d.querySelector('[data-close]').onclick = () => d.close();
    d.querySelector('[data-file]').onclick = () => { d.close(); exportGroupFile(g); };
    if (!d.open) d.showModal();
  };
  if (!navigator.onLine) return show('<p>Precisa de internet para criar o código.</p>');
  show('<p class="muted">A criar código…</p>');
  try {
    await ensureIdentity();
    if (!g.chat) { g.chat = await newChatConfig(); markDirty(g); startHub(); }
    const code = newInviteCode();
    if (!(await publishInvite({ relays: relaysList(), sk: S.nostr.sk, code, payload: { ...groupPayload(g), chat: g.chat } }))) throw new Error('relays');
    g.sharedAt = new Date().toISOString(); save();
    const link = `${SITE_URL}#/entrar/${code}`;
    show(`<p>Dê este código a cada membro:</p>
      <p class="invite-code" aria-label="Código">${code}</p>
      <p class="muted small">Válido 24 horas. Na eKit: Grupos → Entrar com código.</p>
      <div class="grid-buttons"><button type="button" class="btn primary" data-copy>Copiar código</button>
      ${navigator.share ? '<button type="button" class="btn" data-share>Enviar…</button>' : ''}</div>`);
    d.querySelector('[data-copy]').onclick = () => navigator.clipboard?.writeText(code).then(() => toast('Código copiado.'), () => toast(code));
    const sh = d.querySelector('[data-share]');
    if (sh) sh.onclick = () => navigator.share({ text: `Entre no grupo "${g.name}" na eKit com o código ${code} (válido 24 h): ${link}` }).catch(() => {});
    if (route() === 'grupos') render();
  } catch {
    show('<p>Não foi possível criar o código. Tente de novo ou envie um ficheiro.</p>');
  }
}

function joinGroup(prefill = '') {
  openForm({
    title: 'Entrar num grupo',
    values: { code: prefill, myName: S.settings.myName },
    fields: [
      { k: 'code', label: 'Código (12 caracteres)', required: true },
      { k: 'myName', label: 'O seu nome no grupo', required: true },
    ],
    submitLabel: 'Entrar',
    async onSave({ code, myName }) {
      S.settings.myName = str(myName, 40).trim() || S.settings.myName;
      if (normalizeCode(code).length !== 12) { toast('O código tem 12 caracteres.'); return false; }
      if (!navigator.onLine) { toast('Precisa de internet.'); return false; }
      toast('A procurar o grupo…');
      try { await ensureIdentity(); } catch { toast('Não foi possível carregar o módulo de rede.'); return false; }
      const payload = await fetchInvite({ relays: relaysList(), code }).catch(() => null);
      if (!payload || typeof payload !== 'object') { toast('Código não encontrado ou expirado.'); return false; }
      importGroupPayload(payload);
      addSelfToGroup(findGroup(str(payload.id, 80)));
    },
  });
  const i = $('#dlg input[name=code]');
  if (i) { i.setAttribute('autocapitalize', 'characters'); i.setAttribute('autocomplete', 'one-time-code'); i.classList.add('mono'); }
}

function exportGroupFile(g) {
  g.sharedAt = new Date().toISOString();
  exportPackage('group', { ...groupPayload(g), chat: g.chat }, `ekit-grupo-${g.name.replace(/\W+/g, '_')}.json`);
}

async function importFile(file) {
  let pkg;
  try { pkg = JSON.parse(await file.text()); } catch { return toast('Ficheiro inválido.'); }
  if (pkg.app !== 'ekit') return toast('Este ficheiro não é do eKit.');
  let apply = payload => {
    if (pkg.type === 'group') {
      importGroupPayload(payload);
      return;
    } else if (pkg.type === 'backup') {
      if (!confirm('Substituir TODOS os dados deste dispositivo pela cópia de segurança?')) return;
      S = cleanState({ ...payload, version: 1, alertsCache: S.alertsCache, nostr: S.nostr, chat: S.chat });
      toast('Cópia de segurança restaurada.');
      setTimeout(restartHub, 0);
    }
    save(); render();
  };
  if (!pkg.encrypted) return apply(pkg.payload);
  openForm({
    title: 'Ficheiro cifrado',
    fields: [{ k: 'pass', label: 'Palavra-passe', type: 'password', required: true }],
    submitLabel: 'Abrir',
    async onSave({ pass }) {
      try { apply(await decrypt(pkg.payload, pass)); } catch { toast('Palavra-passe incorreta.'); return false; }
    },
  });
}

function exportIcs() {
  const items = S.kit.filter(i => i.expiry);
  const d = s => s.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  // Simulacro e revisão do kit: repetem de 6 em 6 meses.
  const next = new Date(Math.max(Date.now() + 864e5, (S.settings.lastDrill || Date.now()) + 182 * 864e5)).toISOString().slice(0, 10);
  const drill = ['BEGIN:VEVENT', `UID:simulacro@ekit`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${d(next)}`, 'RRULE:FREQ=MONTHLY;INTERVAL=6',
    'SUMMARY:Simulacro da família e revisão do kit (eKit)', 'DESCRIPTION:Ir ao ponto de encontro; rever validades, pilhas e contactos.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Simulacro da família', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT'].join('\r\n');
  const ev = items.map(i => [
    'BEGIN:VEVENT', `UID:${i.id}@ekit`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${d(i.expiry)}`,
    `SUMMARY:Kit de emergência – expira: ${i.name.replace(/[,;]/g, ' ')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Substituir produto do kit', `TRIGGER:-P${S.settings.notifyDays}D`, 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n'));
  download('ekit-lembretes.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//eKit//PT', drill, ...ev, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
}

// ---------- Notificações locais de validade ----------
const native = () => !!window.Capacitor?.isNativePlatform?.();
const nativeLN = () => { const C = window.Capacitor; return native() ? (C?.Plugins?.LocalNotifications || C?.registerPlugin?.('LocalNotifications')) : null; };
async function scheduleNativeReminders() {
  const LN = nativeLN();
  if (!LN) return;
  try {
    if ((await LN.checkPermissions()).display !== 'granted' && (await LN.requestPermissions()).display !== 'granted') return;
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    const now = Date.now(), list = [];
    S.kit.filter(i => i.expiry).forEach((i, n) => {
      const exp = new Date(i.expiry + 'T10:00');
      const warn = new Date(exp.getTime() - S.settings.notifyDays * 864e5);
      if (warn > now) list.push({ id: 1000 + n * 2, title: 'Kit de emergência', body: `${i.name}: expira dentro de ${S.settings.notifyDays} dias.`, schedule: { at: warn } });
      if (exp > now) list.push({ id: 1001 + n * 2, title: 'Kit de emergência', body: `${i.name}: expira hoje. Substitua-o.`, schedule: { at: exp } });
    });
    // Lembrete de revisão semestral e de simulacro
    list.push({ id: 999, title: 'Revisão do kit', body: 'Passaram seis meses: reveja validades, pilhas e o plano da família.', schedule: { at: new Date(now + 182 * 864e5) } });
    const drillAt = Math.max(now + 864e5, (S.settings.lastDrill || now) + 182 * 864e5);
    list.push({ id: 998, title: 'Simulacro da família', body: 'Combinem ir ao ponto de encontro e confirmem o plano.', schedule: { at: new Date(drillAt) } });
    if (list.length) await LN.schedule({ notifications: list.slice(0, 60) });
  } catch { /* plugin indisponível */ }
}
async function checkExpiryNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date().toISOString().slice(0, 10);
  if (S.settings.lastNotified === today) return;
  const st = stats();
  if (!st.exp.length) return;
  const body = st.exp.slice(0, 3).map(x => `${x.i.name}: ${x.e.label}`).join('\n');
  const reg = await navigator.serviceWorker?.getRegistration();
  const title = `eKit: ${st.expired} expirado(s), ${st.expiring} a expirar`;
  if (reg) reg.showNotification(title, { body, icon: 'icon.svg', tag: 'ekit-expiry' });
  else new Notification(title, { body });
  S.settings.lastNotified = today; save();
}

// ---------- Alertas (IPMA) ----------
// Sismos: os últimos 30 dias do IPMA, para a área da sua zona. Hora em UTC (como publica o IPMA).
const quakeArea = () => (['AOR', 'ACE', 'AOC'].includes(S.settings.district) ? 3 : 7);
const quakeTs = q => Date.parse(q.t + 'Z');
async function fetchQuakes() {
  const area = quakeArea();
  try {
    const d = await (await fetch(SEISMIC_URL(area), { cache: 'no-store' })).json();
    S.quakes = { at: Date.now(), area, data: arr(d?.data).map(cleanQuake).filter(Boolean) };
    save();
  } catch { /* sem rede: fica a última cópia */ }
}
function recentQuakes(days = 7) {
  const pos = myPos(), since = Date.now() - days * 864e5;
  return (S.quakes?.area === quakeArea() ? S.quakes.data : [])
    .filter(q => quakeTs(q) >= since && (q.mag >= 2.5 || q.sensed))
    .map(q => ({ ...q, d: pos ? distanceKm(pos, q) : null }))
    .filter(q => q.d == null || q.d <= 400)
    .sort((a, b) => quakeTs(b) - quakeTs(a));
}
// Sismo forte nas últimas 24 h perto de si: aparece no Painel.
const strongQuake = () => recentQuakes(1).find(q => q.mag >= 4 && (q.d == null || q.d <= 300));
const quakeWhen = q => new Date(quakeTs(q)).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function quakeBanner(q) {
  return `<a class="alert-banner ${q.mag >= 5 ? 'bad' : 'orange'}" href="#/emergencia">${icon('quake')}
    <div><strong>Sismo de magnitude ${q.mag.toFixed(1).replace('.', ',')}</strong>
      <span>${esc(q.reg)} · ${esc(quakeWhen(q))}${q.d != null ? ' · a ' + fmtDist(q.d) : ''} · O que fazer</span></div>
    <span class="chev" aria-hidden="true">›</span></a>`;
}

// Risco de incêndio rural (IPMA): guarda [lat, lng, hoje, amanhã] por concelho e usa o mais próximo.
async function fetchFireRisk() {
  try {
    const [a, b] = await Promise.all([0, 1].map(d => fetch(FIRE_RISK_URL(d), { cache: 'no-store' }).then(r => r.json())));
    const pts = Object.entries(a?.local || {}).map(([k, v]) => [Number(v?.latitude), Number(v?.longitude), num(v?.data?.rcm), num(b?.local?.[k]?.data?.rcm)])
      .filter(p => p.every(Number.isFinite) && p[2] >= 1 && p[2] <= 5);
    if (pts.length) { S.fireRisk = { at: Date.now(), day: isoDate(a?.dataPrev), pts }; save(); }
  } catch { /* sem rede: fica a última cópia */ }
}
function fireRiskHere() {
  const fr = S.fireRisk;
  if (!fr?.pts?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const pos = myPos() || (DISTRICT_CAPITALS[S.settings.district] && { lat: DISTRICT_CAPITALS[S.settings.district][0], lng: DISTRICT_CAPITALS[S.settings.district][1] });
  if (!pos) return null;
  let best = null, bd = Infinity;
  for (const p of fr.pts) { const d = distanceKm(pos, { lat: p[0], lng: p[1] }); if (d < bd) { bd = d; best = p; } }
  if (!best || bd > 40) return null; // sem dados para esta zona (ex.: ilhas)
  // O ficheiro de "hoje" pode ser de ontem: nesse caso o "amanhã" dele é o hoje.
  const shift = fr.day && fr.day < today;
  return { today: shift ? best[3] : best[2], tomorrow: shift ? 0 : best[3], own: !!myPos() };
}
const fireBadge = r => `<span class="badge ${r >= 4 ? 'bad' : r === 3 ? 'warn' : ''}">${FIRE_LEVELS[r]}</span>`;

async function fetchAlerts() {
  fetchQuakes(); fetchFireRisk();
  ui.alertsLoading = true; render();
  try {
    const r = await fetch(IPMA_WARNINGS_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = (await r.json()).filter(w => w.awarenessLevelID && w.awarenessLevelID !== 'green');
    S.alertsCache = { at: Date.now(), data }; save();
    ui.alertsError = '';
  } catch (e) {
    ui.alertsError = navigator.onLine
      ? `Não foi possível obter avisos do IPMA (${e.message}). Consulte as fontes abaixo.`
      : 'Sem ligação à internet. A mostrar os últimos avisos guardados.';
  }
  ui.alertsLoading = false; render();
}
const LEVELS = { yellow: ['Amarelo', 'warn'], orange: ['Laranja', 'orange'], red: ['Vermelho', 'bad'] };
function districtAlerts() {
  const now = Date.now();
  return (S.alertsCache?.data || [])
    .filter(w => w.idAreaAviso === S.settings.district && Date.parse(w.endTime) > now)
    .sort((a, b) => (SEV[b.awarenessLevelID] || 0) - (SEV[a.awarenessLevelID] || 0) || Date.parse(a.startTime) - Date.parse(b.startTime));
}
const SEV = { red: 3, orange: 2, yellow: 1 };
// "hoje às 21:00", "amanhã às 06:00", "13 nov. às 09:00"
function when(s) {
  const d = new Date(s), t = new Date();
  const day = (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5;
  const label = { 0: 'hoje', 1: 'amanhã', '-1': 'ontem' }[day] || d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
  return `${label} às ${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
}
const alertWhen = w => (Date.parse(w.startTime) <= Date.now() ? `Ativo até ${when(w.endTime)}` : `De ${when(w.startTime)} até ${when(w.endTime)}`);
function alertCard(w) {
  const [lvl, cls] = LEVELS[w.awarenessLevelID] || [w.awarenessLevelID, 'warn'];
  return `<li class="row"><div class="row-main">
    <div class="row-title"><span class="badge ${cls}">${esc(lvl)}</span> ${esc(w.awarenessTypeName)}</div>
    <div class="row-sub">${esc(alertWhen(w))}</div>
    ${w.text ? `<div class="row-sub">${esc(w.text)}</div>` : ''}
  </div></li>`;
}
function alertBanner(w, more) {
  const [lvl, cls] = LEVELS[w.awarenessLevelID];
  return `<a class="alert-banner ${cls}" href="#/alertas">
    ${icon('alert')}
    <div><strong>Aviso ${lvl.toLowerCase()} · ${esc(w.awarenessTypeName)}</strong>
      <span>${esc(IPMA_AREAS[w.idAreaAviso] || '')} · ${esc(alertWhen(w))}${more > 0 ? ` · +${more} aviso(s)` : ''}</span></div>
    <span class="chev" aria-hidden="true">›</span></a>`;
}

// Ícones de linha (SVG inline, um só tom)
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  kit: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M12 11v6M9 14h6"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  more: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bt: '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1"/><path d="M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  list: '<path d="m3 6 2 2 4-4M3 14l2 2 4-4M13 6h8M13 14h8M13 20h8"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  nav: '<path d="m3 11 19-9-9 19-2-8z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  drop: '<path d="M12 2.7s6 6.6 6 11.3a6 6 0 0 1-12 0c0-4.7 6-11.3 6-11.3z"/>',
  health: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-2-2 5.4-5.4a4 4 0 0 0-5-5L8 11 6 9l2.7-2.7a4 4 0 0 1 6 0z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-2-6-1 4-5 7-5 12a7 7 0 0 0 7 7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  wave: '<path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  quake: '<path d="M2 12h4l2-5 3 10 3-8 2 3h6"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  wifioff: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
  paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.05Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  radio: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8 17 3"/><circle cx="8" cy="14" r="2"/><path d="M14 12h4M14 16h4"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
};
const CAT_ICONS = { agua: 'drop', saude: 'health', energia: 'bolt', docs: 'doc', abrigo: 'tool', outros: 'box' };
const GUIDE_ICONS = { sismo: 'quake', inundacao: 'wave', tsunami: 'wave', incendio: 'flame', apagao: 'bolt', calor: 'sun', abrigo: 'home', evacuacao: 'route', telemovel: 'phone' };
const catIcon = id => `<span class="cat-ic">${icon(CAT_ICONS[id] || 'box')}</span>`;
const icon = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

// ---------- Formulário genérico (diálogo) ----------
function fieldHTML(f, v) {
  const id = 'f_' + f.k;
  const req = f.required ? 'required' : '';
  switch (f.type) {
    case 'info': return `<p class="muted">${f.html}</p>`;
    case 'geo': return `<label>Coordenadas GPS (latitude, longitude)</label>
      <div class="geo">
        <input name="lat" inputmode="decimal" placeholder="38.72225" value="${esc(v?.lat)}" aria-label="Latitude">
        <input name="lng" inputmode="decimal" placeholder="-9.13934" value="${esc(v?.lng)}" aria-label="Longitude">
        <button type="button" class="btn" data-here>Usar a minha posição</button>
      </div>`;
    case 'checkbox': return `<label class="check"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'select': return `<label for="${id}">${esc(f.label)}</label><select id="${id}" name="${f.k}">${f.options.map(([val, txt]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select>`;
    case 'textarea': return `<label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${f.k}" rows="3" ${req}>${esc(v)}</textarea>`;
    default: return `<label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${f.type === 'number' ? 'min="0" step="any"' : ''} autocomplete="off">`;
  }
}
function openForm({ title, fields, values = {}, onSave, onDelete, submitLabel = 'Guardar' }) {
  const d = $('#dlg');
  d.innerHTML = `<form class="form">
    <h2>${esc(title)}</h2>
    ${fields.filter(f => !f.more).map(f => fieldHTML(f, f.type === 'geo' ? values : values[f.k])).join('')}
    ${[...new Set(fields.filter(f => f.more).map(f => f.more))].map(lbl => {
      const fs = fields.filter(f => f.more === lbl);
      const filled = fs.some(f => f.k && values[f.k] && f.type !== 'checkbox');
      return `<details class="more" ${filled ? 'open' : ''}><summary>${esc(lbl)}</summary>${fs.map(f => fieldHTML(f, f.type === 'geo' ? values : values[f.k])).join('')}</details>`;
    }).join('')}
    <div class="form-actions">
      ${onDelete ? '<button type="button" class="btn danger" data-del>Eliminar</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn primary">${esc(submitLabel)}</button>
    </div></form>`;
  const form = d.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault();
    const v = {};
    for (const f of fields) {
      if (f.type === 'geo') {
        const num = s => (s.trim() === '' ? '' : Number(s.replace(',', '.')));
        v.lat = num(form.elements.lat.value); v.lng = num(form.elements.lng.value);
        if ((v.lat === '') !== (v.lng === '') || (v.lat !== '' && !(Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180))) {
          toast('Coordenadas inválidas.'); return;
        }
        continue;
      }
      const el = form.elements[f.k];
      if (!el) continue;
      v[f.k] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? Number(el.value || 0) : el.value.trim();
    }
    if ((await onSave(v)) !== false) { d.close(); save(); render(); }
  };
  d.querySelector('[data-cancel]').onclick = () => d.close();
  const setGeo = p => { form.elements.lat.value = p.lat.toFixed(6); form.elements.lng.value = p.lng.toFixed(6); };
  const here = d.querySelector('[data-here]');
  if (here) here.onclick = () => { here.textContent = '…'; locate(p => { setGeo(p); here.textContent = 'Usar a minha posição'; }); };
  const off = form.elements.official;
  if (off) off.onchange = () => {
    const p = POINTS[off.value];
    if (!p) return;
    setGeo(p);
    form.elements.meetingPoint.value = `${p.n} (${p.m})`;
  };
  const del = d.querySelector('[data-del]');
  if (del) del.onclick = () => { if (confirm('Eliminar definitivamente?')) { onDelete(); d.close(); save(); render(); } };
  d.showModal();
  form.querySelector('input:not([type=checkbox]),select,textarea')?.focus();
}

// ---------- Ecrãs ----------
// ---------- Início: "O que precisa agora?" ----------
// Duas portas (emergência / preparar) e o estado da sua zona agora. Nada mais.
function nowRows() {
  const rows = [];
  const qk = strongQuake();
  if (qk) rows.push(['bad', 'quake', `Sismo de magnitude ${qk.mag.toFixed(1).replace('.', ',')}`, `${qk.reg} · ${quakeWhen(qk)}`, '#/emergencia']);
  districtAlerts().slice().sort((x, y) => SEV[y.awarenessLevelID] - SEV[x.awarenessLevelID]).slice(0, 2).forEach(w => {
    const [lvl, cls] = LEVELS[w.awarenessLevelID];
    rows.push([cls, 'alert', `${w.awarenessTypeName} · aviso ${lvl.toLowerCase()}`, alertWhen(w), '#/alertas']);
  });
  const fr = fireRiskHere();
  if (fr && fr.today >= 3) rows.push([fr.today >= 4 ? 'bad' : 'warn', 'flame', `Risco de incêndio ${FIRE_LEVELS[fr.today].toLowerCase()}`, 'Hoje · sem queimadas nem fogo', '#/alertas']);
  if (!rows.length) rows.push(['good', 'check', 'Sem avisos', S.alertsCache?.at ? 'Atualizado ' + new Date(S.alertsCache.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : 'Abra com internet para atualizar', '#/alertas']);
  return rows.map(([cls, ic, t, sub, href]) => `<a class="now-row ${cls}" href="${href}">${icon(ic)}<span class="now-t"><strong>${esc(t)}</strong><small>${esc(sub)}</small></span><span class="chev" aria-hidden="true">›</span></a>`).join('');
}
function viewDashboard() {
  const steps = planSteps(), done = steps.filter(x => x.done).length;
  const pos = myPos(), g = S.groups.find(x => x.meetingPoint || hasCoords(x));
  const near = !g && pos && POINTS.length ? nearestOfficial(pos) : null;
  const meet = g
    ? `<a class="now-row" href="#/mapa">${icon('pin')}<span class="now-t"><strong>${esc(g.meetingPoint || fmtCoords(g))}</strong><small>Ponto de encontro${pos && hasCoords(g) ? ' · ' + fmtDist(distanceKm(pos, g)) : ''}</small></span><span class="chev" aria-hidden="true">›</span></a>`
    : near && near.d <= 25
      ? `<a class="now-row" href="#/mapa">${icon('pin')}<span class="now-t"><strong>${esc(near.p.n)}</strong><small>Ponto oficial mais próximo · ${fmtDist(near.d)}</small></span><span class="chev" aria-hidden="true">›</span></a>`
      : `<a class="now-row" href="#/grupos">${icon('pin')}<span class="now-t"><strong>Definir ponto de encontro</strong><small>Onde a família se encontra</small></span><span class="chev" aria-hidden="true">›</span></a>`;
  return `
  <a class="door sos" href="#/emergencia">${icon('alert')}<span class="door-t"><strong>Há uma emergência</strong><small>Avisar a família, para onde ir, o que fazer</small></span><span class="chev" aria-hidden="true">›</span></a>
  <a class="door" href="#/preparar">${icon('list')}<span class="door-t"><strong>Preparar-me</strong><small>${done === steps.length ? 'Plano completo' : `${done} de ${steps.length} passos feitos`}</small>
    <span class="bar"><i style="width:${Math.round((done / steps.length) * 100)}%"></i></span></span><span class="chev" aria-hidden="true">›</span></a>
  <section class="card now">
    <h3>Agora · ${esc(IPMA_AREAS[S.settings.district] || '')}</h3>
    ${nowRows()}
    ${meet}
    ${!pos ? `<button class="linkbtn small" data-act="useLocation">${icon('pin')} Usar a minha localização para a zona e o ponto mais próximo</button>` : ''}
  </section>`;
}

// ---------- Preparar: plano em passos + tudo em mosaicos ----------
function planSteps() {
  const st = stats(), drillOk = S.settings.lastDrill && Date.now() - S.settings.lastDrill < 182 * 864e5;
  const people = S.groups.reduce((n, g) => n + liveMembers(g).length, 0);
  const g = S.groups.find(x => x.meetingPoint || hasCoords(x));
  return [
    { t: 'Família e contactos', done: people > 1 || S.contacts.length > 0, sub: people ? `${people} pessoa(s) no grupo` : 'Quem contactar e com quem se encontrar', href: '#/grupos' },
    { t: 'Ponto de encontro', done: !!g, sub: g ? (g.meetingPoint || fmtCoords(g)) : 'Onde a família se encontra', href: '#/grupos' },
    { t: 'Kit de 72 horas', done: st.pct === 100, sub: st.pct === 100 ? 'Completo' : `${st.pct}% · ${st.missing} em falta`, href: '#/kit' },
    { t: 'Telemóvel preparado', done: !!S.settings.phoneReady, sub: 'Alertas de emergência e ficha médica', href: '#/guia', act: 'phoneReady', actLabel: 'Já fiz' },
    { t: 'Mapa sem internet', done: !!S.settings.mapSaved, sub: S.settings.mapSaved ? 'Guardado' : 'Guardar a zona de casa e do ponto', href: '#/mapa' },
    { t: 'Simulacro com a família', done: !!drillOk, sub: drillOk ? 'Feito em ' + new Date(S.settings.lastDrill).toLocaleDateString('pt-PT') : 'Ir juntos ao ponto de encontro', act: 'drillDone', actLabel: 'Fizemos hoje' },
  ];
}
function viewPrepare() {
  const st = stats(), steps = planSteps(), done = steps.filter(x => x.done).length;
  const people = S.groups.reduce((n, g) => n + liveMembers(g).length, 0), pets = S.groups.reduce((n, g) => n + livePets(g).length, 0);
  const alerts = districtAlerts().length, g = S.groups.find(x => hasCoords(x)), pos = myPos();
  const tiles = [
    ['#/kit', 'kit', 'Kit', `${st.pct}%${st.missing ? ' · faltam ' + st.missing : ''}`, st.pct < 100 ? 'warn' : 'good'],
    ['#/grupos', 'users', 'Família', people ? `${people} pessoa(s)${pets ? ' · ' + pets + ' animal(is)' : ''}` : 'Criar grupo', ''],
    ['#/mapa', 'map', 'Mapa', g && pos ? fmtDist(distanceKm(pos, g)) + ' do ponto' : 'Pontos de encontro', ''],
    ['#/alertas', 'alert', 'Avisos', alerts ? `${alerts} ativo(s)` : 'Sem avisos', alerts ? 'bad' : ''],
    ['#/contactos', 'phone', 'Contactos', 'Números úteis', ''],
    ['#/guia', 'book', 'O que fazer', 'Guias e listas', ''],
    ['#/cartao', 'list', 'Cartão', 'Para imprimir', ''],
    ['#/definicoes', 'radio', 'Rádio', (RADIO_A1[S.settings.district] || '').split(' · ')[0], ''],
  ];
  return `
  <section class="card">
    <h3>O seu plano · ${done} de ${steps.length}</h3>
    <span class="bar big"><i style="width:${Math.round((done / steps.length) * 100)}%"></i></span>
    <ol class="steps">${steps.map(x => `<li class="step ${x.done ? 'done' : ''}">
      ${x.href ? `<a class="step-main" href="${x.href}">` : '<div class="step-main">'}${icon(x.done ? 'checkCircle' : 'circle')}
        <span class="now-t"><strong>${esc(x.t)}</strong><small>${esc(x.sub)}</small></span>${x.href ? '<span class="chev" aria-hidden="true">›</span></a>' : '</div>'}
      ${!x.done && x.act ? `<button class="btn sm" data-act="${x.act}">${esc(x.actLabel)}</button>` : ''}</li>`).join('')}</ol>
  </section>
  <section class="card">
    <h3>Tudo</h3>
    <div class="tiles">${tiles.map(([href, ic, t, sub, cls]) => `<a class="tile ${cls}" href="${href}">${icon(ic)}<strong>${esc(t)}</strong><small>${esc(sub)}</small></a>`).join('')}</div>
  </section>
  ${st.exp.length ? `<section class="card">
    <h3>A expirar</h3>
    <ul class="list">${st.exp.slice(0, 5).map(({ i, e }) => `
      <li class="row"><div class="row-main" data-act="editItem" data-id="${i.id}">
        <div class="row-title">${esc(i.name)}</div><div class="row-sub"><span class="badge ${e.cls}">${esc(e.label)}</span></div>
      </div></li>`).join('')}</ul>
  </section>` : ''}
  ${backupNote()}`;
}
function backupNote() {
  const has = S.groups.length || S.contacts.length || S.kit.some(i => i.have > 0);
  if (!has || (S.settings.lastBackup && Date.now() - S.settings.lastBackup < 90 * 864e5)) return '';
  return `<p class="note small">${S.settings.lastBackup ? 'A última cópia de segurança tem mais de 3 meses.' : 'Ainda não fez cópia de segurança. Se perder o telemóvel, perde o plano.'} <a href="#/definicoes">Exportar →</a></p>`;
}

function viewKit() {
  const f = ui.kitFilter, st = stats();
  const show = i => f === 'all' || (f === 'missing' && need(i) > 0 && !isOk(i)) || (f === 'expiring' && ['warn', 'bad'].includes(expiryState(i)?.cls));
  const filters = [['all', 'Tudo'], ['missing', `Em falta${st.missing ? ' (' + st.missing + ')' : ''}`], ['expiring', 'Validade']];
  return `
  <section class="card hero">
    <div class="ring" style="--p:${st.pct}"><span>${st.pct}%</span></div>
    <div class="hero-body">
      <h2>${st.pct === 100 ? 'Kit completo' : `Faltam ${st.missing} coisa${st.missing === 1 ? '' : 's'}`}</h2>
      <p class="muted">Para ${S.settings.household} pessoa(s) durante 72 horas · <a href="#/definicoes">alterar</a></p>
      ${st.expired || st.expiring ? `<p class="small"><span class="badge ${st.expired ? 'bad' : 'warn'}">${st.expired ? st.expired + ' expirado(s)' : st.expiring + ' a expirar'}</span></p>` : ''}
    </div>
  </section>
  <div class="toolbar">
    <div class="seg">${filters.map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-act="kitFilter" data-v="${k}">${t}</button>`).join('')}</div>
    <span class="spacer"></span><button class="btn" data-act="addItem">+ Item</button>
  </div>
  ${CATEGORIES.map(c => {
    const all = S.kit.filter(i => i.cat === c.id), items = all.filter(show);
    if (!items.length) return '';
    const miss = all.filter(i => need(i) > 0 && !isOk(i)).length, key = 'cat-' + c.id;
    return `<details class="card fold" data-fold="${key}" ${isOpen(key, f !== 'all' || miss > 0) ? 'open' : ''}>
      <summary>${catIcon(c.id)}<span class="fold-t">${esc(c.name)}</span><span class="count ${miss ? 'warn' : 'good'}">${miss ? miss + ' em falta' : 'completo'}</span></summary>
      <ul class="list">${items.map(kitRow).join('')}</ul></details>`;
  }).join('') || '<p class="empty">Nada neste filtro.</p>'}`;
}
function kitRow(i) {
  const n = need(i), ok = isOk(i), e = expiryState(i);
  const meta = [n > 0 ? `Tenho ${i.have} de ${n} ${esc(i.unit)}` : 'Opcional', i.location && 'Em: ' + esc(i.location)].filter(Boolean).join(' · ');
  return `<li class="row kit-row ${ok ? 'done' : ''}">
    <button class="tick" data-act="fill" data-id="${i.id}" aria-label="Marcar como completo">${ok ? '✓' : ''}</button>
    <div class="row-main" data-act="editItem" data-id="${i.id}">
      <div class="row-title">${esc(i.name)}</div>
      <div class="row-sub">${meta}${e ? ` <span class="badge ${e.cls}">${esc(e.label)}</span>` : (i.expires && !ok ? ' · <span class="small">validade por definir</span>' : '')}</div>
    </div>
    <div class="stepper">
      <button data-act="dec" data-id="${i.id}" aria-label="Menos">−</button>
      <span>${i.have}</span>
      <button data-act="inc" data-id="${i.id}" aria-label="Mais">+</button>
    </div>
  </li>`;
}
function itemForm(item) {
  openForm({
    title: item ? 'Editar item' : 'Novo item',
    values: item || { cat: 'outros', qty: 1, unit: 'un', have: 0 },
    fields: [
      { k: 'name', label: 'Nome', required: true },
      { k: 'cat', label: 'Categoria', type: 'select', options: CATEGORIES.map(c => [c.id, c.name]) },
      { k: 'qty', label: 'Quantidade recomendada', type: 'number' },
      { k: 'unit', more: 'Mais detalhes', label: 'Unidade' },
      { k: 'perPerson', more: 'Mais detalhes', label: 'Quantidade por pessoa do agregado', type: 'checkbox' },
      { k: 'have', label: 'Quantidade que tenho', type: 'number' },
      { k: 'expiry', label: 'Data de validade', type: 'date' },
      { k: 'location', more: 'Mais detalhes', label: 'Onde está guardado' },
      { k: 'notes', more: 'Mais detalhes', label: 'Notas', type: 'textarea' },
    ],
    onSave(v) { if (item) Object.assign(item, v); else S.kit.push({ id: uid(), expires: false, ...v }); },
    onDelete: item && (() => { S.kit = S.kit.filter(x => x !== item); }),
  });
}

function viewContacts() {
  return `
  <section class="card">
    <h3>Números de emergência</h3>
    <ul class="list">${EMERGENCY_NUMBERS.map(n => `<li class="row"><div class="row-main"><div class="row-title">${esc(n.name)}</div><div class="row-sub">${esc(n.note)}</div></div><a class="btn ${n.phone === '112' ? 'call' : ''}" href="${telHref(n.phone)}">${icon('phone')} ${esc(n.phone)}</a></li>`).join('')}</ul>
  </section>
  <section class="card">
    <div class="toolbar"><h3>Os meus contactos</h3><button class="btn primary" data-act="addContact">+ Contacto</button></div>
    ${S.contacts.length ? `<ul class="list">${S.contacts.map(c => `
      <li class="row"><div class="row-main" data-act="editContact" data-id="${c.id}">
        <div class="row-title">${esc(c.name)}${c.priority ? ' <span class="badge">favorito</span>' : ''}</div>
        <div class="row-sub">${esc([c.relation, c.notes].filter(Boolean).join(' · '))}</div>
      </div>${c.phone ? `<a class="btn" href="${telHref(c.phone)}" aria-label="Ligar a ${esc(c.name)}">${icon('phone')}</a>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">Família, vizinhos, médico… Os favoritos aparecem no Painel.</p>'}
    ${S.groups.map(g => {
      const ms = liveMembers(g).filter(m => m.name);
      return ms.length ? `<h4 class="sub-h">${icon('users')} Grupo: ${esc(g.name)}</h4>
      <ul class="list">${ms.map(m => `<li class="row"><div class="row-main" data-act="editMember" data-id="${g.id}" data-mid="${m.id}">
        <div class="row-title">${esc(m.name)}${m.pk && m.pk === myPub() ? ' <span class="badge">eu</span>' : ''}</div>
        <div class="row-sub">${esc(m.role || '')}${m.phone ? '' : (m.role ? ' · ' : '') + 'sem telefone'}</div>
      </div>${m.phone ? `<a class="btn" href="${telHref(m.phone)}" aria-label="Ligar a ${esc(m.name)}">${icon('phone')}</a>` : ''}</li>`).join('')}</ul>` : '';
    }).join('')}
    ${S.groups.some(g => liveMembers(g).length) ? '<p class="muted small">Os contactos dos grupos atualizam-se com o grupo. Edite-os aqui ou em Grupos.</p>' : ''}
  </section>
  <section class="card">
    <h3>Bombeiros e polícia perto de si</h3>
    ${S.services ? `
      <h4 class="sub-h">${icon('alert')} Bombeiros</h4>
      ${nearestServices('fire', 3).length ? `<ul class="list">${nearestServices('fire', 3).map(serviceRow).join('')}</ul>` : '<p class="muted small">Nenhum encontrado.</p>'}
      <h4 class="sub-h">${icon('users')} Polícia (PSP / GNR)</h4>
      ${nearestServices('police', 3).length ? `<ul class="list">${nearestServices('police', 3).map(serviceRow).join('')}</ul>` : '<p class="muted small">Nenhuma encontrada.</p>'}
      <p class="muted small">Guardado em ${new Date(S.services.at).toLocaleDateString('pt-PT')} para usar sem internet. Fonte: OpenStreetMap (confirme os números).</p>`
      : '<p class="muted small">Encontra os quartéis e esquadras mais próximos e guarda os telefones para usar sem internet.</p>'}
    <p class="note small">Em perigo imediato ligue <strong>112</strong>. Estes números são para situações não urgentes.</p>
    <button class="btn" data-act="findServices" ${ui.servicesLoading ? 'disabled' : ''}>${icon('pin')} ${ui.servicesLoading ? 'A procurar…' : S.services ? 'Atualizar perto de mim' : 'Procurar perto de mim'}</button>
    <p class="muted small">Envia a posição aproximada (cerca de 1 km) ao OpenStreetMap.</p>
  </section>`;
}
function contactForm(c) {
  openForm({
    title: c ? 'Editar contacto' : 'Novo contacto',
    values: c || {},
    fields: [
      { k: 'name', label: 'Nome', required: true },
      { k: 'phone', label: 'Telefone', type: 'tel' },
      { k: 'relation', label: 'Relação (ex.: vizinho, médico)' },
      { k: 'notes', more: 'Mais detalhes', label: 'Notas', type: 'textarea' },
      { k: 'priority', label: 'Favorito (mostrar no painel)', type: 'checkbox' },
    ],
    onSave(v) { if (c) Object.assign(c, v); else S.contacts.push({ id: uid(), ...v }); },
    onDelete: c && (() => { S.contacts = S.contacts.filter(x => x !== c); }),
  });
}

function viewGroups() {
  return `
  <div class="toolbar">
    <button class="btn primary" data-act="addGroup">+ Novo grupo</button>
    <button class="btn" data-act="joinGroup">Entrar com código</button>
    <span class="spacer"></span>
    <a class="btn ghost" href="#/cartao">${icon('list')} Cartão para imprimir</a>
  </div>
  ${S.groups.length ? S.groups.map(g => `
    <section class="card">
      <div class="group-head"><h2>${esc(g.name)}</h2>${syncBadge(g)}</div>
      <div class="grid-buttons g3">
        <a class="btn" href="#/chat/${g.id}">${icon('chat')} Chat${countBadge(unread(g.id), 'mensagens por ler')}</a>
        <button class="btn" data-act="shareGroup" data-id="${g.id}">${icon('share')} Convidar</button>
        <button class="btn" data-act="editGroup" data-id="${g.id}">${icon('settings')} Editar</button>
      </div>
      <h4 class="sub-h">${icon('pin')} Pontos de encontro</h4>
      <div class="meet">${icon('pin')}<div class="meet-body">
        <div class="meet-head"><span class="muted small">Ponto de encontro principal</span>
          <button class="linkbtn small" data-act="editMeetMain" data-id="${g.id}">${g.meetingPoint || hasCoords(g) ? 'Editar' : 'Definir'}</button></div>
        ${g.meetingPoint || hasCoords(g) ? `<strong>${esc(g.meetingPoint || 'sem nome')}</strong>
        ${hasCoords(g) ? `<div class="mono small muted">${fmtCoords(g)}</div>${navLinks(g, g.meetingPoint)}` : ''}` : '<span class="muted small">Por definir</span>'}</div></div>
      ${livePoints(g).map(x => `<div class="meet alt">${icon('pin')}<div class="meet-body">
        <div class="meet-head"><span class="muted small">${esc(MEET_KINDS[x.kind])}</span>
          <button class="linkbtn small" data-act="editMeet" data-id="${g.id}" data-pid="${x.id}">Editar</button></div>
        <strong>${esc(x.name)}</strong>${x.notes ? `<div class="muted small">${esc(x.notes)}</div>` : ''}
        ${hasCoords(x) ? `<div class="mono small muted">${fmtCoords(x)}</div>${navLinks(x, x.name)}` : ''}</div></div>`).join('')}
      <button class="btn ghost" data-act="addMeet" data-id="${g.id}">${icon('pin')} + Ponto alternativo</button>
      ${g.notes ? `<p class="muted">${esc(g.notes)}</p>` : ''}
      ${g.chat && !g.sharedAt && !g.imported ? '<p class="note">Carregue em <strong>Convidar</strong> para dar o código à família. Assim todos veem o mesmo.</p>' : ''}
      <h4 class="sub-h">${icon('users')} Pessoas${liveMembers(g).length ? ' · ' + liveMembers(g).length : ''}</h4>
      ${liveMembers(g).length ? '' : '<p class="muted small">Ainda sem pessoas.</p>'}
      <ul class="list">${liveMembers(g).map(m => `
        <li class="row"><div class="row-main" data-act="editMember" data-id="${g.id}" data-mid="${m.id}">
          <div class="row-title">${esc(m.name)}${m.pk && m.pk === myPub() ? ' <span class="badge good">eu</span>' : ''}${m.role ? ` <span class="badge">${esc(m.role)}</span>` : ''}</div>
          ${m.needs ? `<div class="row-sub">Necessidades: ${esc(m.needs)}</div>` : ''}
        </div>${m.phone ? `<a class="btn" href="${telHref(m.phone)}" aria-label="Ligar a ${esc(m.name)}">${icon('phone')}</a>` : ''}</li>`).join('')}</ul>
      <button class="btn ghost" data-act="addMember" data-id="${g.id}">+ Pessoa</button>
      <h4 class="sub-h">${icon('paw')} Animais${livePets(g).length ? ' · ' + livePets(g).length : ''}</h4>
      ${livePets(g).length ? `<ul class="list">${livePets(g).map(a => {
        const rd = daysLeft(a.rabies);
        const rab = a.rabies ? `<span class="badge ${rd < 0 ? 'bad' : rd <= 30 ? 'warn' : 'good'}">antirrábica ${rd < 0 ? 'expirada' : 'até ' + fmtDate(a.rabies)}</span>` : '';
        return `<li class="row"><div class="row-main" data-act="editPet" data-id="${g.id}" data-pid="${a.id}">
          <div class="row-title">${esc(a.name)} <span class="badge">${esc([a.species, a.breed].filter(Boolean).join(' · ') || 'animal')}</span></div>
          <div class="row-sub">${a.chip ? `Chip <span class="mono">${esc(a.chip)}</span>` : 'Sem chip registado'}${a.registry ? ' · ' + esc(a.registry) : ''} ${rab}</div>
          ${a.needs ? `<div class="row-sub">Cuidados: ${esc(a.needs)}</div>` : ''}
        </div>${a.vetPhone ? `<a class="btn" href="${telHref(a.vetPhone)}" aria-label="Ligar ao veterinário de ${esc(a.name)}">${icon('phone')}</a>` : ''}</li>`;
      }).join('')}</ul>` : ''}
      <button class="btn ghost" data-act="addPet" data-id="${g.id}">${icon('paw')} + Animal</button>
    </section>`).join('')
    : '<p class="empty">Crie um grupo para a família, vizinhos, condomínio ou equipa de trabalho.</p>'}`;
}
function groupForm(g, defaults) {
  openForm({
    title: g ? 'Editar grupo' : 'Novo grupo',
    values: g || defaults || {},
    fields: [
      { k: 'name', label: 'Nome do grupo', required: true },
      ...(POINTS.length ? [{ k: 'official', label: 'Usar um ponto de encontro oficial (opcional)', type: 'select',
        options: [['', '— escolher —'], ...POINTS.map((p, i) => [String(i), `${p.m} · ${p.n}${p.t === 'Tsunami' ? ' (tsunami)' : ''}`])] }] : []),
      { k: 'meetingPoint', label: 'Ponto de encontro (nome/descrição)' },
      { k: 'geo', type: 'geo' },
      { k: 'notes', more: 'Mais detalhes', label: 'Notas / plano do grupo', type: 'textarea' },
      ...(!g && !S.settings.myName ? [{ k: 'myName', label: 'O seu nome no grupo', required: true }] : []),
    ],
    onSave(v) {
      delete v.official;
      if (v.myName) S.settings.myName = str(v.myName, 40).trim();
      delete v.myName;
      const now = Date.now();
      if (g) {
        for (const k of GROUP_FIELDS) if (String(v[k] ?? '') !== String(g[k] ?? '')) { g[k] = v[k]; (g.meta ||= {})[k] = now; }
        markDirty(g);
      } else {
        const ng = { id: uid(), members: [], ...v, meta: Object.fromEntries(GROUP_FIELDS.map(k => [k, now])) };
        S.groups.push(ng);
        setupGroupKey(ng);
        setTimeout(() => addSelfToGroup(ng), 0);
      }
    },
    // Só remove deste dispositivo; os outros membros mantêm o grupo.
    onDelete: g && (() => { S.groups = S.groups.filter(x => x !== g); delete (S.chat || {})[g.id]; startHub(); }),
  });
}
const officialField = () => (POINTS.length ? [{ k: 'official', label: 'Usar um ponto oficial (opcional)', type: 'select',
  options: [['', '— escolher —'], ...POINTS.map((p, i) => [String(i), `${p.m} · ${p.n}${p.t === 'Tsunami' ? ' (tsunami)' : ''}`])] }] : []);

// Ponto principal: qualquer membro pode alterar; sincroniza para todos.
function meetMainForm(g) {
  openForm({
    title: 'Ponto de encontro principal',
    values: g,
    fields: [...officialField(), { k: 'meetingPoint', label: 'Nome / descrição' }, { k: 'geo', type: 'geo' }],
    onSave(v) {
      delete v.official;
      const now = Date.now();
      for (const k of ['meetingPoint', 'lat', 'lng']) if (String(v[k] ?? '') !== String(g[k] ?? '')) { g[k] = v[k]; (g.meta ||= {})[k] = now; }
      markDirty(g);
    },
  });
}
// Pontos alternativos (perto de casa, bairro, fora da zona)
function meetForm(g, x, preset) {
  openForm({
    title: x ? 'Editar ponto alternativo' : 'Novo ponto alternativo',
    values: x || preset || { kind: 'bairro' },
    fields: [
      { k: 'kind', label: 'Tipo', type: 'select', options: Object.entries(MEET_KINDS) },
      ...officialField(),
      { k: 'meetingPoint', label: 'Nome / descrição', required: true },
      { k: 'geo', type: 'geo' },
      { k: 'notes', label: 'Quando usar (ex.: se a casa estiver inacessível)' },
    ],
    onSave(v) {
      delete v.official;
      const item = { kind: v.kind, name: v.meetingPoint, lat: v.lat, lng: v.lng, notes: v.notes, updatedAt: Date.now() };
      g.points ||= [];
      if (x) Object.assign(x, item); else g.points.push({ id: uid(), ...item });
      markDirty(g);
    },
    onDelete: x && (() => { for (const k of Object.keys(x)) if (k !== 'id') delete x[k]; x.deleted = true; x.updatedAt = Date.now(); markDirty(g); }),
  });
  if (x) { const f = $('#dlg form'); if (f?.elements.meetingPoint) f.elements.meetingPoint.value = x.name; }
}
// No mapa: usar um ponto oficial num grupo, como principal ou alternativo
function useOfficialPoint(p) {
  if (!S.groups.length) return toast('Crie primeiro um grupo.');
  openForm({
    title: 'Usar no grupo',
    values: { gid: S.groups[0].id, as: 'alt' },
    fields: [
      { type: 'info', html: `<strong>${esc(p.n)}</strong> · ${esc(p.m)}` },
      { k: 'gid', label: 'Grupo', type: 'select', options: S.groups.map(g => [g.id, g.name]) },
      { k: 'as', label: 'Como', type: 'select', options: [['alt', 'Ponto alternativo'], ['main', 'Ponto principal']] },
    ],
    submitLabel: 'Usar',
    onSave(v) {
      const g = findGroup(v.gid);
      const name = `${p.n} (${p.m})`, now = Date.now();
      if (v.as === 'main') {
        Object.assign(g, { meetingPoint: name, lat: p.lat, lng: p.lng });
        g.meta ||= {}; g.meta.meetingPoint = g.meta.lat = g.meta.lng = now;
      } else (g.points ||= []).push({ id: uid(), kind: 'bairro', name, lat: p.lat, lng: p.lng, notes: '', updatedAt: now });
      markDirty(g);
      toast(`Adicionado a "${g.name}".`);
    },
  });
}

function petForm(g, a) {
  openForm({
    title: a ? 'Editar animal' : 'Novo animal',
    values: a || { species: 'Cão' },
    fields: [
      { k: 'name', label: 'Nome', required: true },
      { k: 'species', label: 'Espécie', type: 'select', options: ['Cão', 'Gato', 'Ave', 'Coelho', 'Réptil', 'Outro'].map(x => [x, x]) },
      { k: 'breed', more: 'Mais detalhes', label: 'Raça / descrição (cor, sinais)' },
      { k: 'chip', label: 'Nº do microchip (15 dígitos)' },
      { k: 'registry', more: 'Mais detalhes', label: 'Registo (ex.: SIAC) ou nº do boletim' },
      { k: 'rabies', more: 'Mais detalhes', label: 'Vacina antirrábica válida até', type: 'date' },
      { k: 'vet', more: 'Mais detalhes', label: 'Veterinário' },
      { k: 'vetPhone', more: 'Mais detalhes', label: 'Telefone do veterinário', type: 'tel' },
      { k: 'needs', more: 'Mais detalhes', label: 'Cuidados (medicação, alimentação, comportamento)', type: 'textarea' },
      { k: 'notes', more: 'Mais detalhes', label: 'Notas', type: 'textarea' },
    ],
    onSave(v) {
      if (v.chip && !/^\d{15}$/.test(v.chip.replace(/\s/g, '')) && !confirm('O nº do microchip costuma ter 15 dígitos. Guardar assim mesmo?')) return false;
      v.chip = v.chip.replace(/\s/g, '');
      v.updatedAt = Date.now();
      g.pets ||= [];
      if (a) Object.assign(a, v); else g.pets.push({ id: uid(), ...v });
      markDirty(g);
    },
    onDelete: a && (() => { for (const k of Object.keys(a)) if (k !== 'id') delete a[k]; a.deleted = true; a.updatedAt = Date.now(); markDirty(g); }),
  });
}
function memberForm(g, m) {
  openForm({
    title: m ? 'Editar pessoa' : 'Nova pessoa',
    values: m || {},
    fields: [
      { k: 'name', label: 'Nome', required: true },
      { k: 'phone', label: 'Telefone', type: 'tel' },
      { k: 'role', label: 'Papel (ex.: responsável, criança)' },
      { k: 'bitchat', more: 'Mais detalhes', label: 'Nome no bitchat (para mensagens privadas sem internet)' },
      { type: 'info', more: 'Saúde (opcional)', html: 'Só com consentimento da pessoa. Ajuda quem socorre.' },
      { k: 'needs', more: 'Saúde (opcional)', label: 'Necessidades especiais (mobilidade, equipamentos…)', type: 'textarea' },
      { k: 'meds', more: 'Saúde (opcional)', label: 'Medicação habitual' },
      { k: 'allergies', more: 'Saúde (opcional)', label: 'Alergias' },
      { k: 'blood', more: 'Saúde (opcional)', label: 'Grupo sanguíneo (ex.: A+)' },
      { k: 'consent', more: 'Saúde (opcional)', label: 'A pessoa consentiu partilhar estes dados com o grupo', type: 'checkbox' },
    ],
    onSave(v) {
      if (HEALTH_FIELDS.some(k => v[k]) && !v.consent) { toast('Para guardar dados de saúde é preciso o consentimento.'); return false; }
      v.consentAt = v.consent ? (m?.consentAt || new Date().toISOString()) : '';
      v.updatedAt = Date.now();
      if (m) Object.assign(m, v); else g.members.push({ id: uid(), ...v });
      markDirty(g);
    },
    onDelete: m && (() => { for (const k of Object.keys(m)) if (k !== 'id') delete m[k]; m.deleted = true; m.updatedAt = Date.now(); markDirty(g); }),
  });
}

function viewLists() {
  return `
  <div class="toolbar"><span class="spacer"></span><button class="btn primary" data-act="addList">+ Lista</button></div>
  ${S.lists.map(l => {
    const done = l.items.filter(i => i.done).length;
    const key = 'list-' + l.id;
    return `<details class="card fold" data-fold="${key}" ${isOpen(key, false) ? 'open' : ''}>
      <summary>${icon('list')}<span class="fold-t">${esc(l.name)}</span><span class="count ${done === l.items.length && done ? 'good' : ''}">${done}/${l.items.length}</span></summary>
      <div class="toolbar"><span class="spacer"></span>
        <button class="btn ghost sm" data-act="resetList" data-id="${l.id}">Desmarcar tudo</button>
        <button class="btn ghost sm" data-act="editList" data-id="${l.id}">Editar</button></div>
      <ul class="list">${l.items.map(i => `
        <li class="row ${i.done ? 'done' : ''}">
          <button class="tick" data-act="toggleListItem" data-id="${l.id}" data-iid="${i.id}">${i.done ? '✓' : ''}</button>
          <div class="row-main"><div class="row-title">${esc(i.text)}</div></div>
          <button class="btn ghost" data-act="delListItem" data-id="${l.id}" data-iid="${i.id}" aria-label="Remover">✕</button>
        </li>`).join('')}</ul>
      <form class="inline" data-addto="${l.id}"><input name="text" placeholder="Adicionar passo…" required><button class="btn">+</button></form>
    </details>`;
  }).join('')}`;
}

function viewGuide() {
  return GUIDES.map(g => `
    <details class="card guide"><summary>${icon(GUIDE_ICONS[g.id] || 'alert')} ${esc(g.title)}</summary>
      <ol>${g.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    </details>`).join('') +
    '<p class="muted small">Siga sempre as indicações das autoridades.</p>' +
    '<h2 class="sec-h">Listas de verificação</h2>' + viewLists();
}

function viewAlerts() {
  const alerts = districtAlerts();
  const at = S.alertsCache?.at;
  return `
  <section class="card">
    <div class="toolbar">
      <select data-change="district" aria-label="Distrito">${Object.entries(IPMA_AREAS).map(([k, v]) => `<option value="${k}" ${k === S.settings.district ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button class="btn primary" data-act="fetchAlerts" ${ui.alertsLoading ? 'disabled' : ''}>${ui.alertsLoading ? 'A atualizar…' : 'Atualizar'}</button>
    </div>
    ${ui.alertsError ? `<p class="badge warn block">${esc(ui.alertsError)}</p>` : ''}
    <p class="muted small">${at ? 'Última atualização: ' + new Date(at).toLocaleString('pt-PT') : 'Ainda sem dados. Carregue em Atualizar com ligação à internet.'} · Fonte: IPMA</p>
    ${alerts.length ? `<ul class="list">${alerts.map(alertCard).join('')}</ul>` : '<p class="empty">Sem avisos meteorológicos ativos para esta zona.</p>'}
  </section>
  <section class="card">
    <h3>Risco de incêndio rural</h3>
    ${(() => { const fr = fireRiskHere(); return fr ? `<ul class="list">
      <li class="row"><div class="row-main"><div class="row-title">Hoje ${fireBadge(fr.today)}</div></div></li>
      ${fr.tomorrow ? `<li class="row"><div class="row-main"><div class="row-title">Amanhã ${fireBadge(fr.tomorrow)}</div></div></li>` : ''}</ul>
      <p class="muted small">${fr.own ? 'No concelho onde está' : 'Na capital de distrito (use a sua localização para o seu concelho)'}. Fonte: IPMA.${fr.today >= 3 ? ' Não faça queimadas nem use máquinas que façam faíscas.' : ''}</p>`
      : '<p class="muted small">Sem dados para esta zona. Carregue em Atualizar com internet.</p>'; })()}
    <p class="small">Incêndios ativos: <a href="https://fogos.pt" target="_blank" rel="noopener">fogos.pt</a> · <a href="https://prociv.gov.pt/pt/home/ocorrencias/" target="_blank" rel="noopener">ANEPC</a></p>
  </section>
  <section class="card">
    <h3>Sismos recentes</h3>
    ${(() => { const qs = recentQuakes(7); return qs.length ? `<ul class="list">${qs.slice(0, 8).map(q => `<li class="row"><div class="row-main">
      <div class="row-title">Magnitude ${q.mag.toFixed(1).replace('.', ',')} <span class="badge ${q.mag >= 4 ? 'bad' : q.mag >= 3 ? 'warn' : ''}">${esc(q.reg)}</span>${q.sensed ? ' <span class="badge">sentido</span>' : ''}</div>
      <div class="row-sub">${esc(quakeWhen(q))}${q.d != null ? ' · a ' + fmtDist(q.d) + ' de si' : ''}</div></div></li>`).join('')}</ul>`
      : '<p class="muted small">Sem sismos de magnitude 2,5 ou superior nos últimos 7 dias' + (myPos() ? ' perto de si' : '') + '.</p>'; })()}
    <p class="muted small">Fonte: IPMA (dados preliminares). Sismo forte? <a href="#/emergencia">Modo emergência →</a></p>
  </section>
  <details class="card fold" data-fold="sources" ${isOpen('sources', false) ? 'open' : ''}>
    <summary>${icon('shield')}<span class="fold-t">Fontes oficiais</span></summary>
    <ul class="list">${ALERT_SOURCES.map(s => `<li class="row"><div class="row-main"><div class="row-title"><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></div><div class="row-sub">${esc(s.note)}</div></div></li>`).join('')}</ul>
  </details>`;
}

function viewMap() {
  const mine = S.groups.filter(hasCoords);
  const alts = S.groups.flatMap(g => livePoints(g).filter(hasCoords).map(x => ({ n: x.name, m: `${g.name} · ${MEET_KINDS[x.kind]}`, lat: x.lat, lng: x.lng, mine: true })));
  const all = [...mine.map(g => ({ n: g.meetingPoint || g.name, m: 'Grupo: ' + g.name, lat: g.lat, lng: g.lng, mine: true })), ...alts, ...POINTS.map((p, i) => ({ ...p, i }))];
  const nearest = ui.pos ? all.map(p => ({ p, d: distanceKm(ui.pos, p) })).sort((a, b) => a.d - b.d).slice(0, 8) : [];
  const at = S.pointsCache?.at;
  return `
  <section class="card">
    <div class="toolbar">
      <button class="btn primary" data-act="locate">${icon('pin')} Onde estou</button>
      <span class="legend"><i class="dot mine"></i>Grupos <i class="dot off"></i>Oficiais <i class="dot tsu"></i>Tsunami</span>
    </div>
    ${ui.geoError ? `<p class="muted small">${esc(ui.geoError)}</p>` : ''}
    ${ui.pos ? `<p class="muted small">A sua posição: <span class="mono">${fmtCoords(ui.pos)}</span> (±${Math.round(ui.pos.acc)} m) <button class="linkbtn" data-act="copy" data-v="${fmtCoords(ui.pos)}">Copiar</button></p>` : ''}
    <div id="map" class="map"></div>
  </section>
  <section class="card">
    <h3>Pontos mais próximos</h3>
    ${ui.pos ? `<ul class="list">${nearest.map(({ p, d }) => `
      <li class="row"><div class="row-main">
        <div class="row-title">${esc(p.n)} <span class="badge ${p.t === 'Tsunami' ? 'warn' : ''}">${esc(p.m)}${p.t === 'Tsunami' ? ' · tsunami' : ''}</span></div>
        <div class="row-sub"><strong>${fmtDist(d)}</strong> para ${bearing(ui.pos, p)} · <span class="mono">${fmtCoords(p)}</span>${p.cap ? ` · capacidade ${p.cap.toLocaleString('pt-PT')} pessoas` : ''}</div>
        <div class="row-sub">${navLinks(p, p.n)}</div>
        ${p.mine ? '' : `<div class="row-sub"><button class="btn sm ghost" data-act="useOfficial" data-i="${p.i}">${icon('users')} Usar no grupo</button></div>`}
      </div></li>`).join('')}</ul>`
      : '<p class="muted">Carregue em "Onde estou". Funciona sem internet.</p>'}
  </section>
  <section class="card">
    <h3>Procurar pontos oficiais</h3>
    <input type="search" id="pt-search" value="${esc(ui.ptQuery || '')}" placeholder="Nome, freguesia ou concelho" aria-label="Procurar pontos de encontro oficiais" autocomplete="off">
    <ul class="list" id="pt-results">${pointResults()}</ul>
  </section>
  <section class="card">
    <h3>Mapa sem internet</h3>
    ${`
    <p class="muted small">Guarda o mapa à volta da sua posição e dos pontos de encontro dos grupos, para ver sem rede.</p>
    <div class="progress" ${ui.tilesTotal ? '' : 'hidden'}><i id="tiles-bar"></i></div>
    <p class="small" id="tiles-msg">${S.settings.mapSaved ? `Zona guardada em ${new Date(S.settings.mapSaved).toLocaleDateString('pt-PT')} (${S.settings.mapSavedN} partes).` : ''}</p>
    <button class="btn" data-act="saveMap" ${ui.tilesTotal ? 'disabled' : ''}>${icon('map')} ${S.settings.mapSaved ? 'Atualizar mapa guardado' : 'Guardar mapa da minha zona'}</button>`}
  </section>
  <details class="card fold" data-fold="mapdata" ${isOpen('mapdata', false) ? 'open' : ''}>
    <summary>${icon('shield')}<span class="fold-t">Dados oficiais</span></summary>
    <ul class="plain">${POINTS_META.sources.map(s => `<li><strong>${esc(s.m)}</strong>: <a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a> — ${esc(s.license)}</li>`).join('')}</ul>
    <p class="muted small">${POINTS.length} pontos, disponíveis offline.${at ? ' Lisboa atualizada em ' + new Date(at).toLocaleString('pt-PT') + '.' : ''}</p>
    <button class="btn" data-act="refreshLisboa" ${ui.pointsLoading ? 'disabled' : ''}>${ui.pointsLoading ? 'A atualizar…' : 'Atualizar pontos de Lisboa'}</button>
  </details>
`;
}

// Mosaicos à volta de cada sítio importante, do nível 12 (cidade) ao 16 (ruas). Limite modesto
// para respeitar o OpenStreetMap: só a zona de cada ponto, a pedido do utilizador.
// Partes do mapa guardadas no IndexedDB: funcionam no site e na app (onde não há service worker).
let tileDBp = null;
const tileDB = () => (tileDBp ||= new Promise((res, rej) => {
  const r = indexedDB.open('ekit-map', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('tiles');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tileReq = (mode, fn) => tileDB().then(db => new Promise(res => {
  const q = fn(db.transaction('tiles', mode).objectStore('tiles'));
  q.onsuccess = () => res(q.result); q.onerror = () => res(null);
})).catch(() => null);
const tileGet = k => tileReq('readonly', s => s.get(k));
const tilePut = (k, blob) => tileReq('readwrite', s => s.put(blob, k));
// Camada do Leaflet que usa primeiro a parte guardada e só depois a rede.
function offlineTileLayer() {
  const Layer = L.TileLayer.extend({
    createTile(c, done) {
      const img = document.createElement('img');
      img.alt = ''; img.setAttribute('role', 'presentation');
      img.referrerPolicy = 'strict-origin-when-cross-origin'; // o OpenStreetMap exige saber o site (só o endereço do site)
      img.onload = () => done(null, img);
      img.onerror = e => done(e, img);
      const url = this.getTileUrl(c);
      tileGet(`${c.z}/${c.x}/${c.y}`).then(b => {
        if (b) { const u = URL.createObjectURL(b); img.onload = () => { URL.revokeObjectURL(u); done(null, img); }; img.src = u; }
        else { img.crossOrigin = 'anonymous'; img.src = url; }
      });
      return img;
    },
  });
  return new Layer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
}
function tilesAround(places) {
  const set = new Set();
  const tile = (lat, lng, z) => {
    const n = 2 ** z, x = Math.floor(((lng + 180) / 360) * n);
    const r = (lat * Math.PI) / 180, y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
    return [x, y];
  };
  for (const p of places) for (let z = 12; z <= 16; z++) {
    const span = z <= 13 ? 0 : z === 14 ? 1 : z === 15 ? 2 : 3;
    const [x, y] = tile(p.lat, p.lng, z);
    for (let dx = -span; dx <= span; dx++) for (let dy = -span; dy <= span; dy++) set.add(`${z}/${x + dx}/${y + dy}`);
  }
  return [...set].slice(0, 600);
}
async function saveMapArea() {
  const pos = myPos();
  const places = [pos, ...S.groups.filter(hasCoords), ...S.groups.flatMap(g => livePoints(g).filter(hasCoords))].filter(Boolean);
  if (!places.length) return toast('Use "Onde estou" ou defina um ponto de encontro primeiro.');
  if (!navigator.onLine) return toast('Precisa de internet para guardar o mapa.');
  const list = tilesAround(places);
  ui.tilesTotal = list.length; render();
  let done = 0, ok = 0;
  const step = () => {
    const bar = $('#tiles-bar'), msg = $('#tiles-msg');
    if (bar) bar.style.width = Math.round((done / list.length) * 100) + '%';
    if (msg) msg.textContent = `A guardar… ${done} de ${list.length}`;
  };
  const load = async t => {
    try {
      const r = await fetch(`https://tile.openstreetmap.org/${t}.png`, { referrerPolicy: 'strict-origin-when-cross-origin' });
      if (r.ok) { await tilePut(t, await r.blob()); ok++; }
    } catch { /* falhou esta parte: segue */ }
  };
  const queue = [...list];
  await Promise.all(Array.from({ length: 2 }, async () => { while (queue.length) { await load(queue.shift()); done++; step(); } }));
  S.settings.mapSaved = Date.now(); S.settings.mapSavedN = ok; ui.tilesTotal = 0;
  save(); render();
  toast(ok ? `Mapa guardado (${ok} partes). Funciona sem internet.` : 'Não foi possível guardar o mapa.');
}

function pointResults() {
  const q = norm(ui.ptQuery);
  if (q.length < 2) return '';
  const pos = myPos();
  const hits = POINTS.map((p, i) => ({ p, i })).filter(({ p }) => norm(`${p.n} ${p.f || ''} ${p.m}`).includes(q))
    .map(x => ({ ...x, d: pos ? distanceKm(pos, x.p) : null })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  if (!hits.length) return '<li class="row"><div class="row-main muted">Nenhum ponto oficial com esse nome.</div></li>';
  return hits.slice(0, 15).map(({ p, i, d }) => `<li class="row"><div class="row-main" data-act="showPoint" data-i="${i}">
      <div class="row-title">${esc(p.n)} <span class="badge ${p.t === 'Tsunami' ? 'warn' : ''}">${esc(p.m)}${p.t === 'Tsunami' ? ' · tsunami' : ''}</span></div>
      <div class="row-sub">${esc(p.f || '')}${d != null ? (p.f ? ' · ' : '') + fmtDist(d) : ''}</div></div>
    <button class="btn sm" data-act="showPoint" data-i="${i}">Ver no mapa</button></li>`).join('') + (hits.length > 15 ? `<li class="row"><div class="row-main muted small">+${hits.length - 15} resultados. Escreva mais para filtrar.</div></li>` : '');
}
document.addEventListener('input', e => {
  if (e.target.id !== 'pt-search') return;
  ui.ptQuery = e.target.value;
  $('#pt-results').innerHTML = pointResults();
});

// O mapa é criado uma vez e reaproveitado: assim as atualizações do ecrã não interrompem o zoom nem o arrastar.
let map = null, mapLayer = null, mapKey = '';
const officialMarkers = [];
function initMap() {
  const el = $('#map');
  if (!el) return;
  if (!window.L) { el.innerHTML = '<p class="empty">Mapa indisponível sem internet. A lista funciona.</p>'; return; }
  let fresh = false;
  if (map) { el.replaceWith(map.getContainer()); map.invalidateSize(); }
  else {
    map = L.map(el, { zoomSnap: 0.5, wheelPxPerZoomLevel: 90 });
    offlineTileLayer().addTo(map);
    mapLayer = L.layerGroup().addTo(map);
    mapKey = ''; fresh = true;
  }
  const key = JSON.stringify([POINTS.length, ui.pos, S.groups.map(g => [g.lat, g.lng, g.meetingPoint, livePoints(g).map(x => [x.lat, x.lng, x.name])])]);
  if (key !== mapKey) { mapKey = key; drawMarkers(); }
  const bounds = S.groups.filter(hasCoords).map(g => [g.lat, g.lng]);
  if (ui.recenter && ui.pos) { ui.recenter = false; map.setView([ui.pos.lat, ui.pos.lng], 15); }
  else if (fresh) {
    if (ui.pos) map.setView([ui.pos.lat, ui.pos.lng], 15);
    else if (bounds.length) map.fitBounds(bounds, { maxZoom: 15, padding: [30, 30] });
    else map.setView([38.72, -9.25], 11);
  }
}
function drawMarkers() {
  mapLayer.clearLayers();
  officialMarkers.length = 0;
  const popup = (p, title) => `<strong>${esc(title)}</strong><br>${esc(p.m || '')}${p.f ? ' · ' + esc(p.f) : ''}${p.cap ? '<br>Capacidade: ' + Number(p.cap).toLocaleString('pt-PT') : ''}<br><span class="mono">${fmtCoords(p)}</span><br>${navLinks(p, title)}`;
  POINTS.forEach((p, i) => {
    const c = p.t === 'Tsunami' ? '#d97706' : '#2563eb';
    officialMarkers[i] = L.circleMarker([p.lat, p.lng], { radius: 6, color: c, fillColor: c, fillOpacity: 0.7, weight: 1 }).bindPopup(popup(p, p.n)).addTo(mapLayer);
  });
  S.groups.forEach(g => livePoints(g).filter(hasCoords).forEach(x => {
    L.circleMarker([x.lat, x.lng], { radius: 8, color: '#fff', fillColor: '#a78bfa', fillOpacity: 1, weight: 2 })
      .bindPopup(popup({ ...x, m: `${g.name} · ${MEET_KINDS[x.kind]}` }, x.name)).addTo(mapLayer);
  }));
  S.groups.filter(hasCoords).forEach(g => {
    L.circleMarker([g.lat, g.lng], { radius: 10, color: '#fff', fillColor: '#7c3aed', fillOpacity: 1, weight: 3 })
      .bindPopup(popup({ ...g, m: 'Grupo: ' + g.name }, g.meetingPoint || g.name)).addTo(mapLayer);
  });
  if (ui.pos) {
    L.circle([ui.pos.lat, ui.pos.lng], { radius: ui.pos.acc, color: '#16a34a', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(mapLayer);
    L.circleMarker([ui.pos.lat, ui.pos.lng], { radius: 7, color: '#fff', fillColor: '#16a34a', fillOpacity: 1, weight: 3 }).bindPopup('Está aqui').addTo(mapLayer);
  }
}

function viewSettings() {
  const notif = 'Notification' in window ? Notification.permission : 'unsupported';
  return `
  <section class="card form">
    <h3>Agregado</h3>
    <label for="hh">Número de pessoas</label>
    <input id="hh" type="number" min="1" value="${S.settings.household}" data-change="household">
    <label for="nd">Avisar validades com quantos dias de antecedência</label>
    <input id="nd" type="number" min="1" value="${S.settings.notifyDays}" data-change="notifyDays">
  </section>
  <details class="card fold" data-fold="set-nav" ${isOpen('set-nav', false) ? 'open' : ''}>
    <summary>${icon('list')}<span class="fold-t">Ordem dos menus</span></summary>
    <p class="muted small">No telemóvel, as 4 primeiras ficam na barra de baixo; as outras ficam no Menu.</p>
    <ol class="list nav-order">${navOrder().map((k, i, o) => `
      <li class="row ${i === 3 ? 'nav-cut' : ''}"><span class="cat-ic">${icon(ROUTES[k][1])}</span>
        <div class="row-main"><div class="row-title">${esc(ROUTES[k][0])}</div>${i < 4 ? '<div class="row-sub">Barra principal</div>' : ''}</div>
        <button class="btn sm" data-act="navUp" data-k="${k}" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(ROUTES[k][0])}">↑</button>
        <button class="btn sm" data-act="navDown" data-k="${k}" ${i === o.length - 1 ? 'disabled' : ''} aria-label="Descer ${esc(ROUTES[k][0])}">↓</button>
      </li>`).join('')}</ol>
    <button class="btn ghost" data-act="navReset">Repor ordem original</button>
  </details>
  <section class="card">
    <h3>Lembretes</h3>
    <div class="grid-buttons">
      <button class="btn" data-act="enableNotif" ${notif !== 'default' ? 'disabled' : ''}>${notif === 'granted' ? 'Notificações ativas' : notif === 'denied' ? 'Notificações bloqueadas' : 'Ativar notificações'}</button>
      <button class="btn" data-act="exportIcs">Validades e simulacro no calendário</button>
    </div>
    <p class="muted small">Com a app fechada, use o calendário.</p>
  </section>
  <section class="card form">
    <h3>Rádio</h3>
    <p><strong>Antena 1 · ${esc(IPMA_AREAS[S.settings.district])}</strong><br><span class="small">${esc(RADIO_A1[S.settings.district] || '')}</span></p>
    <p class="muted small">FM em MHz, OM em kHz. Fonte: <a href="${RADIO_SOURCE}" target="_blank" rel="noopener">RTP</a>. Num apagão a informação oficial chega pela rádio: experimente já num rádio a pilhas.</p>
    <label for="radio">Rádio local que também quer ter à mão (opcional)</label>
    <input id="radio" data-change="radio" value="${esc(S.settings.radio)}" placeholder="ex.: Rádio da sua cidade · 90.0 FM" maxlength="60">
  </section>
  <section class="card form">
    <h3>Localização</h3>
    <label class="check"><input type="checkbox" data-change="autoDistrict" ${S.settings.autoDistrict ? 'checked' : ''}> Escolher a zona dos avisos pela localização</label>
    <p class="muted small">A posição fica neste dispositivo. ${S.lastPos ? `<button class="linkbtn" data-act="forgetPos">Esquecer a última posição</button>` : ''}</p>
  </section>
  <details class="card fold" data-fold="set-chat" ${isOpen('set-chat', false) ? 'open' : ''}>
    <summary>${icon('chat')}<span class="fold-t">Chat dos grupos</span></summary>
    <label class="check"><input type="checkbox" data-change="chatNotify" ${S.settings.chatNotify ? 'checked' : ''}> Notificar mensagens novas</label>
    <label class="check"><input type="checkbox" data-change="chatPreview" ${S.settings.chatPreview ? 'checked' : ''}> Mostrar o texto na notificação</label>
    <details class="adv"><summary>Opções avançadas</summary>
      <label for="relays">Relays Nostr (um por linha; vazio = predefinidos)</label>
      <textarea id="relays" rows="3" data-change="relays" placeholder="${DEFAULT_RELAYS.join('\n')}">${esc((S.settings.relays || []).join('\n'))}</textarea>
      <p class="muted small">Os relays só recebem texto cifrado.</p>
    </details>
    ${S.settings.blocked?.length ? `<p class="small">${S.settings.blocked.length} remetente(s) bloqueado(s). <button class="linkbtn" data-act="unblockAll">Desbloquear todos</button></p>` : ''}
  </details>
  <section class="card">
    <h3>Cópia de segurança</h3>
    <p class="muted small">${S.settings.lastBackup ? 'Última cópia: ' + new Date(S.settings.lastBackup).toLocaleDateString('pt-PT') + '.' : 'Ainda não fez nenhuma cópia.'} Guarde-a fora do telemóvel (email, computador).</p>
    <div class="grid-buttons">
      <button class="btn" data-act="exportBackup">Exportar tudo</button>
      <button class="btn" data-act="import">Importar ficheiro</button>
    </div>
  </section>
  <details class="card fold" data-fold="set-priv" ${isOpen('set-priv', false) ? 'open' : ''}>
    <summary>${icon('lock')}<span class="fold-t">Privacidade e apagar dados</span></summary>
    <p class="muted small">Os dados ficam neste dispositivo. <a href="#/sobre">Saber mais</a></p>
    <button class="btn danger" data-act="wipe">Apagar todos os dados</button>
  </details>`;
}

// ---------- Rede dos grupos: sincronização + chat (Nostr), bitchat sem internet ----------
// Tudo o que pertence a um grupo (nome, ponto de encontro, GPS, notas, pessoas) é publicado
// cifrado com a chave do grupo e fundido nos outros dispositivos: vence a alteração mais recente,
// campo a campo e pessoa a pessoa. Pessoas removidas ficam como "lápide" para a remoção se propagar.
let hub = null;
const sentState = new Map(); // id do evento de estado -> { gid, rev }
const keying = new Set();
const myPub = () => (S.nostr?.pk || '');
const liveMembers = g => (g.members || []).filter(m => !m.deleted);
const livePets = g => (g.pets || []).filter(a => !a.deleted);
const livePoints = g => (g.points || []).filter(a => !a.deleted);

async function ensureIdentity() {
  await loadNostr();
  if (!S.nostr) { const sk = newIdentity(); S.nostr = { sk, pk: pubkeyOf(sk) }; save(); }
}

// Só o que é partilhado com o grupo (sem a chave nem estado local deste dispositivo).
function groupPayload(g) {
  return { id: g.id, ...Object.fromEntries(GROUP_FIELDS.map(k => [k, g[k] ?? ''])), meta: g.meta || {}, members: g.members || [], pets: g.pets || [], points: g.points || [] };
}

function mergeGroup(g, r) {
  r = cleanGroup(r);
  let changed = false;
  g.meta ||= {};
  for (const k of GROUP_FIELDS) {
    const rt = Number(r.meta?.[k]) || 0;
    if (rt > (g.meta[k] || 0)) { g[k] = r[k]; g.meta[k] = rt; changed = true; }
  }
  for (const key of ['members', 'pets', 'points']) {
    g[key] ||= [];
    for (const rm of r[key]) {
      const lm = g[key].find(m => m.id === rm.id);
      if (!lm) { g[key].push({ ...rm }); changed = true; }
      else if ((Number(rm.updatedAt) || 0) > (lm.updatedAt || 0)) {
        for (const k of Object.keys(lm)) delete lm[k];
        Object.assign(lm, rm);
        changed = true;
      }
    }
  }
  return changed;
}

function setupGroupKey(g) {
  if (g.chat || keying.has(g.id)) return;
  keying.add(g.id);
  newChatConfig().then(cfg => {
    keying.delete(g.id);
    g.chat = cfg;
    markDirty(g);
    startHub();
    render();
  });
}

let syncTimer;
function markDirty(g) {
  g.syncPending = true;
  g.syncRev = (g.syncRev || 0) + 1;
  save();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 600);
}

async function syncNow() {
  if (!hub?.connected) return;
  for (const g of S.groups.filter(x => x.chat && x.syncPending)) {
    const ev = await hub.buildState(g.chat, groupPayload(g));
    sentState.set(ev.id, { gid: g.id, rev: g.syncRev });
    hub.publish(ev);
  }
}

function flushChats() {
  for (const [gid, list] of Object.entries(S.chat || {})) {
    if (!findGroup(gid)) continue;
    list.filter(m => m.status === 'pending' && m.ev).forEach(m => hub.publish(m.ev));
  }
}

function onAck(id) {
  const st = sentState.get(id);
  if (st) {
    sentState.delete(id);
    const g = findGroup(st.gid);
    if (g && g.syncRev === st.rev && g.syncPending) { g.syncPending = false; save(); if (route() === 'grupos' && !$('#dlg').open) render(); }
    return;
  }
  for (const list of Object.values(S.chat || {})) {
    const m = list.find(x => x.id === id);
    if (m && m.status !== 'sent') { m.status = 'sent'; delete m.ev; save(); renderChatLog(); return; }
  }
}

function startHub() {
  if (!S.groups.some(g => g.chat)) { if (hub) { hub.close(); hub = null; } return; }
  ensureIdentity().then(() => {
    if (!hub) {
      ui.hubStartedAt = Date.now();
      hub = new GroupHub({
        sk: S.nostr.sk,
        relays: S.settings.relays?.length ? S.settings.relays : DEFAULT_RELAYS,
        onChat: addMsg,
        onState: (gid, remote) => {
          const g = findGroup(gid);
          if (g && mergeGroup(g, remote)) { save(); if (!$('#dlg').open) render(); else ui.pendingRender = true; }
        },
        onAck,
        onStatus: () => { renderChatLog(); if (route() === 'grupos' && !$('#dlg').open) render(); },
      });
      hub.onOpen = () => { flushChats(); syncNow(); };
    }
    hub.setGroups(S.groups.filter(g => g.chat).map(g => ({ id: g.id, cfg: g.chat })));
    if (navigator.onLine) hub.connect();
  }).catch(() => toast('Não foi possível carregar o módulo de rede dos grupos.'));
}
function restartHub() { if (hub) { hub.close(); hub = null; } startHub(); }

// ---------- Notificações do chat ----------
// Avisam de mensagens novas de outros membros quando não está a ver essa conversa.
// Sem servidor de push, só chegam com a app aberta ou em segundo plano recente.
const unread = gid => {
  const since = S.chatRead?.[gid] || 0, me = myPub(), blocked = S.settings.blocked || [];
  return (S.chat?.[gid] || []).filter(m => m.pk !== me && m.ts > since && !blocked.includes(m.pk)).length;
};
const unreadTotal = () => S.groups.reduce((n, g) => n + unread(g.id), 0);
const countBadge = (n, label) => (n ? `<b class="dot-count" aria-label="${n} ${label}">${n > 99 ? '99+' : n}</b>` : '');
function markChatRead(gid) {
  if (document.hidden || route() !== 'chat' || ui.chatGroup !== gid) return;
  if (unread(gid)) { S.chatRead = { ...(S.chatRead || {}), [gid]: Date.now() }; save(); }
}
async function notifyChat(gid, m) {
  if (!S.settings.chatNotify) return;
  const g = findGroup(gid);
  if (!g || (!document.hidden && route() === 'chat' && ui.chatGroup === gid)) return;
  const title = `${g.name} · ${m.name || 'Nova mensagem'}`;
  const body = S.settings.chatPreview ? m.text.slice(0, 140) : 'Nova mensagem';
  const url = '#/chat/' + gid;
  const LN = nativeLN();
  if (LN) {
    try { await LN.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e9), title, body, extra: { url }, schedule: { at: new Date(Date.now() + 300) } }] }); } catch { /* sem permissão */ }
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag: 'ekit-chat-' + gid, renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url } };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification(title, opts); else new Notification(title, opts);
}
async function enableChatNotifications() {
  const LN = nativeLN();
  if (LN) { try { await LN.requestPermissions(); } catch { /* indisponível */ } }
  else if ('Notification' in window) await Notification.requestPermission();
  render();
}

function addMsg(gid, m) {
  if (S.settings.blocked?.includes(m.pk)) return;
  S.chat ||= {};
  const list = (S.chat[gid] ||= []);
  const old = list.find(x => x.id === m.id);
  if (old) { if (m.status === 'sent' && old.status !== 'sent') { old.status = 'sent'; delete old.ev; } }
  else {
    list.push(m); list.sort((a, b) => a.ts - b.ts); if (list.length > 500) list.splice(0, list.length - 500);
    // Mensagem nova de outra pessoa, recebida agora (não do histórico antigo)
    if (m.pk !== myPub() && m.ts > (ui.hubStartedAt || Date.now()) - 2 * 60e3) notifyChat(gid, m);
  }
  save();
  renderChatLog();
  markChatRead(gid);
  if (['grupos', 'painel', 'preparar', 'mais'].includes(route())) { if (!$('#dlg').open) render(); else ui.pendingRender = true; }
  else updateNavBadges();
}

function renderChatLog() {
  const log = $('#chatlog');
  if (!log) return;
  const blocked = S.settings.blocked || [];
  const msgs = (S.chat?.[ui.chatGroup] || []).filter(m => !blocked.includes(m.pk));
  const me = myPub();
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const t = ts => new Date(ts).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  log.innerHTML = msgs.length ? msgs.map(m => `
    <li class="msg ${m.pk === me ? 'me' : ''}"><div class="bubble">
      ${m.pk === me ? '' : `<b>${esc(m.name || 'Sem nome')} <span class="fp" title="Identificador do dispositivo">#${esc(m.pk.slice(0, 4))}</span>
        <button class="linkbtn fp" data-act="blockSender" data-pk="${esc(m.pk)}" data-name="${esc(m.name)}">bloquear</button></b>`}
      <p>${esc(m.text)}</p>
      <time>${t(m.ts)}${m.pk === me ? (m.status === 'pending' ? ' · por enviar' : ' · enviada') : ''}</time>
    </div></li>`).join('') : '<li class="empty">Ainda não há mensagens. Escreva a primeira.</li>';
  if (atBottom || !log.dataset.ready) { log.scrollTop = log.scrollHeight; log.dataset.ready = 1; }
  const st = $('#chat-status');
  if (st) {
    const n = hub?.connected || 0;
    st.className = 'badge ' + (n ? 'good' : navigator.onLine ? 'warn' : 'bad');
    st.textContent = n ? `Online · ${n} relay${n > 1 ? 's' : ''}` : navigator.onLine ? 'A ligar…' : 'Sem internet';
  }
}

function syncBadge(g) {
  if (!g.chat) return '<span class="badge">a preparar…</span>';
  if (g.syncPending) return `<span class="badge warn">${navigator.onLine ? 'a sincronizar…' : 'por sincronizar'}</span>`;
  return hub?.connected ? '<span class="badge good">sincronizado</span>' : '<span class="badge">offline</span>';
}

async function sendChat(form) {
  const input = form.elements.text;
  const text = input.value.trim();
  if (!text) return;
  if (!S.settings.myName) return askName(() => sendChat(form));
  const g = findGroup(form.dataset.chat);
  if (!hub || !g?.chat) { startHub(); return toast('O chat ainda está a carregar. Tente de novo.'); }
  input.value = '';
  await postToGroup(g, text);
}
// Fica em fila se não houver rede e segue quando a ligação voltar.
async function postToGroup(g, text) {
  if (!hub || !g?.chat || !S.settings.myName) return false;
  const ev = await hub.buildChat(g.chat, S.settings.myName, text);
  addMsg(g.id, { id: ev.id, pk: ev.pubkey, name: S.settings.myName, text, ts: Date.now(), status: 'pending', ev });
  hub.publish(ev);
  return true;
}

function askName(then) {
  openForm({
    title: 'Como quer aparecer no chat?',
    values: { myName: S.settings.myName },
    fields: [{ k: 'myName', label: 'O seu nome (visível só para o grupo)', required: true }],
    onSave(v) { S.settings.myName = v.myName.slice(0, 40); if (then) setTimeout(then, 0); },
  });
}

// Texto pronto para o bitchat: o rascunho, ou estado + ponto de encontro com GPS.
function bitchatText(g) {
  const draft = $('.chat-form input')?.value.trim();
  if (draft) return `[${g.name}] ${draft}`;
  const where = g.meetingPoint || '';
  const gps = hasCoords(g) ? ` (GPS ${fmtCoords(g)})` : '';
  return `[${g.name}] ${S.settings.myName || 'Eu'}: estou bem.${where || gps ? ` Vou para o ponto de encontro: ${where}${gps}.` : ''}`;
}

function bitchatCard(g, offline) {
  const nicks = liveMembers(g).filter(m => m.bitchat);
  return `<details class="card bitchat ${offline ? 'urgent' : ''}" ${offline ? 'open' : ''}>
    <summary>${icon('bt')}<span><strong>${offline ? 'Sem internet: continue pelo bitchat' : 'Sem internet? Use o bitchat'}</strong>
      <span class="muted small">Bluetooth, sem rede</span></span></summary>
    <p class="small">Instale antes de precisar: <a href="https://github.com/permissionlesstech/bitchat" target="_blank" rel="noopener">iPhone</a> · <a href="https://github.com/permissionlesstech/bitchat-android" target="_blank" rel="noopener">Android</a></p>
    <div class="grid-buttons">
      <button class="btn primary" data-act="shareBitchat" data-id="${g.id}">${icon('share')} Enviar pelo bitchat</button>
      <a class="btn" href="bitchat://">${icon('bt')} Abrir bitchat</a>
    </div>
    <p class="note"><strong>#mesh</strong> é público. Assuntos privados: mensagem privada.</p>
    ${nicks.length ? `<p class="muted small">Nomes no bitchat: ${nicks.map(m => `<strong>${esc(m.name)}</strong> → <span class="mono">${esc(m.bitchat)}</span>`).join(' · ')}</p>`
      : ''}
  </details>`;
}

function viewChat() {
  const g = findGroup(ui.chatGroup);
  if (!g) return '<p class="empty">Grupo não encontrado. <a href="#/grupos">Voltar aos grupos</a></p>';
  if (!g.chat) { setTimeout(() => setupGroupKey(g), 0); return '<p class="empty">A preparar a chave do grupo…</p>'; }
  const offline = !navigator.onLine;
  return `
  ${offline ? bitchatCard(g, true) : ''}
  <section class="card chat">
    <div class="toolbar"><a href="#/grupos">‹ Grupos</a><span class="spacer"></span><span id="chat-status" class="badge"></span></div>
    <ul id="chatlog" class="chatlog" aria-live="polite"></ul>
    <form class="chat-form" data-chat="${g.id}">
      <input name="text" placeholder="${navigator.onLine ? 'Mensagem para o grupo…' : 'Sem internet: fica em fila até voltar a rede'}" autocomplete="off" maxlength="2000" aria-label="Mensagem">
      <button class="btn primary">Enviar</button>
    </form>
    ${S.settings.chatNotify && !native() && 'Notification' in window && Notification.permission === 'default'
      ? '<p class="small"><button class="btn sm" data-act="enableChatNotif">Ativar notificações do chat</button></p>' : ''}
    <p class="muted small">A escrever como <strong>${esc(S.settings.myName || '—')}</strong> · <button class="linkbtn" data-act="setName">mudar nome</button> ·
      <button class="linkbtn" data-act="rotateChat" data-id="${g.id}">nova chave (retirar acesso)</button></p>
  </section>
  ${offline ? '' : bitchatCard(g, false)}`;
}

// ---------- Router e eventos ----------
// [título, ícone, ecrã, nível, descrição]
const ROUTES = {
  painel: ['Início', 'home', viewDashboard, 1, ''],
  preparar: ['Preparar', 'list', viewPrepare, 1, 'O seu plano, passo a passo.'],
  kit: ['Kit de emergência', 'kit', viewKit, 1, '72 horas de autonomia para a sua casa.'],
  mapa: ['Pontos de encontro', 'map', viewMap, 1, 'Do seu grupo e oficiais dos municípios.'],
  alertas: ['Avisos', 'alert', viewAlerts, 1, 'IPMA, para a sua zona.'],
  contactos: ['Contactos', 'phone', viewContacts, 0, 'Emergência e pessoais'],
  grupos: ['Família', 'users', viewGroups, 0, 'Pessoas, animais e pontos de encontro'],
  guia: ['O que fazer', 'book', viewGuide, 0, 'Guias para cada situação e listas de verificação'],
  definicoes: ['Definições', 'settings', viewSettings, 0, 'Agregado, lembretes, dados'],
  sobre: ['Sobre e princípios', 'shield', viewAbout, 0, 'Missão, princípios, privacidade'],
  mais: ['Menu', 'more', viewMore, 2, ''],
};
ROUTES.chat = ['Chat do grupo', 'chat', viewChat, -1, 'Cifrado entre os membros.'];
ROUTES.emergencia = ['Modo emergência', 'alert', viewEmergency, -1, 'O essencial, em poucos toques.'];
ROUTES.agir = ['O que fazer agora', 'alert', viewAct, -1, ''];
ROUTES.cartao = ['Cartão da família', 'users', viewCard, -1, 'Para imprimir e guardar no kit e na carteira.'];
const route = () => {
  const r = location.hash.slice(2);
  if (r.startsWith('chat/')) { ui.chatGroup = r.slice(5); return 'chat'; }
  if (r.startsWith('agir/')) { ui.guide = r.slice(5); return 'agir'; }
  if (r.startsWith('entrar/')) {
    const code = decodeURIComponent(r.slice(7));
    setTimeout(() => { history.replaceState(null, '', '#/grupos'); render(); joinGroup(code); }, 0);
    return 'grupos';
  }
  if (r === 'listas') return 'guia';
  return ROUTES[r] && r !== 'chat' ? r : 'painel';
};

const NAV_SHORT = { agir: 'Emergência', kit: 'Kit', mapa: 'Mapa', alertas: 'Avisos', sobre: 'Sobre', guia: 'O que fazer', emergencia: 'Emergência', cartao: 'Cartão', mais: 'Menu' };

function pageHead(r, title) {
  if (r === 'painel') {
    const d = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<header class="page-head"><span class="eyebrow">${esc(d)}</span><h1>O que precisa agora?</h1></header>`;
  }
  const desc = ROUTES[r][4];
  return `<header class="page-head"><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</header>`;
}

function viewAbout() {
  return `
  <section class="card">
    <h3>A nossa missão</h3>
    <p>Preparar pessoas e famílias para emergências: kit de 72 horas, pontos de encontro e comunicação.</p>
    <p class="note"><strong>Não é um serviço oficial.</strong> Em emergência, ligue <a href="tel:112">112</a>.</p>
  </section>

  <section class="card">
    <h3>Princípios de utilização responsável</h3>
    <ol class="principles">
      <li><div><strong>A informação oficial vem primeiro.</strong>Confirme nas fontes oficiais; não partilhe rumores.</div></li>
      <li><div><strong>Ligue 112 apenas em emergência.</strong>Dúvidas de saúde: SNS 24.</div></li>
      <li><div><strong>Partilhe dados de outras pessoas só com o seu consentimento.</strong></div></li>
      <li><div><strong>Mantenha o kit em dia.</strong>Reveja-o a cada seis meses.</div></li>
      <li><div><strong>Combine o plano antes da emergência.</strong>Onde se encontram e como comunicam.</div></li>
      <li><div><strong>Use o chat com sobriedade.</strong>Onde está, como está, do que precisa.</div></li>
      <li><div><strong>Lembre-se de quem está à sua volta.</strong>Vizinhos idosos ou sozinhos.</div></li>
    </ol>
  </section>

  <section class="card">
    <h3 id="privacidade">Privacidade e proteção de dados</h3>
    <div class="facts">
      <div class="fact">${icon('lock')}<strong>Sem contas nem servidor</strong><span class="muted small">Os seus dados ficam apenas neste dispositivo.</span></div>
      <div class="fact">${icon('users')}<strong>Partilha só por grupo</strong><span class="muted small">Cada grupo tem a sua chave; os relays só veem texto cifrado.</span></div>
      <div class="fact">${icon('shield')}<strong>Consentimento registado</strong><span class="muted small">Dados de saúde exigem o consentimento explícito da pessoa.</span></div>
      <div class="fact">${icon('wifioff')}<strong>Funciona offline</strong><span class="muted small">Sem rede, o essencial continua disponível.</span></div>
    </div>
    <p class="muted small">Sem publicidade nem rastreio. <a href="privacidade.html">Política de privacidade</a></p>
  </section>

  <section class="card">
    <h3>Fontes e transparência</h3>
    <ul class="plain">
      <li>Recomendações de preparação: União Europeia (autonomia de 72 horas) e orientações nacionais de proteção civil.</li>
      <li>Avisos meteorológicos: Instituto Português do Mar e da Atmosfera (IPMA), dados abertos.</li>
      <li>Pontos de encontro: Município de Lisboa (CC0) e Município de Cascais (CC-BY), dados abertos.</li>
      <li>Mapa: © colaboradores OpenStreetMap.</li>
      <li>Código-fonte aberto e auditável: <a href="https://github.com/Deskwisesoft/ekit" target="_blank" rel="noopener">github.com/Deskwisesoft/ekit</a>.</li>
    </ul>
  </section>`;
}

// Ordem dos menus escolhida pela pessoa: as 4 primeiras vão para a barra inferior do telemóvel.
function navOrder() {
  const o = (S.settings.navOrder || []).filter(k => NAV_KEYS.includes(k));
  return [...o, ...NAV_KEYS.filter(k => !o.includes(k))];
}
function moveNav(k, delta) {
  const o = navOrder(), i = o.indexOf(k), j = i + delta;
  if (i < 0 || j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]];
  S.settings.navOrder = o;
}

// ---------- Modo emergência ----------
// Pensado para stress e pouca bateria: fundo escuro, botões grandes, só o essencial.
const allMembers = () => S.groups.flatMap(g => liveMembers(g).map(m => ({ ...m, g })));
function statusRecipients() {
  const me = myPub(), seen = new Set();
  return allMembers().filter(m => m.phone && !(me && m.pk === me)).map(m => m.phone.replace(/[^\d+]/g, '')).filter(p => p && !seen.has(p) && seen.add(p));
}
function smsHref(nums, body) {
  const b = encodeURIComponent(body);
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
    ? `sms:/open?addresses=${nums.join(',')}&body=${b}` : `sms:${nums.join(',')}?body=${b}`;
}
function statusText(help) {
  const pos = myPos(), g = S.groups.find(x => x.meetingPoint || hasCoords(x));
  const time = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return [
    `eKit: ${help ? 'PRECISO DE AJUDA' : 'Estou bem'}${S.settings.myName ? ' (' + S.settings.myName + ')' : ''}. ${time}.`,
    pos ? `Estou em ${pos.lat.toFixed(5)},${pos.lng.toFixed(5)} https://www.openstreetmap.org/?mlat=${pos.lat.toFixed(5)}&mlon=${pos.lng.toFixed(5)}#map=17/${pos.lat.toFixed(5)}/${pos.lng.toFixed(5)}` : '',
    g ? `Ponto de encontro: ${g.meetingPoint || fmtCoords(g)}.` : '',
  ].filter(Boolean).join(' ');
}
function sendStatus(help) {
  const text = statusText(help), nums = statusRecipients();
  // Também no chat dos grupos: chega por internet quando houver, e fica em fila sem rede.
  S.groups.filter(g => g.chat).forEach(g => postToGroup(g, text));
  if (!ui.pos) locate(() => render()); // a próxima mensagem já leva a posição atual
  if (nums.length) { location.href = smsHref(nums, text); return; }
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else { navigator.clipboard?.writeText(text); toast('Sem telefones no grupo. Mensagem copiada.'); }
}
// ---------- Passo a passo de uma situação ----------
// A evacuação usa a lista "Antes de sair de casa" do utilizador (a que ele planeou).
function guideSteps(g) {
  if (g.id === 'evacuacao') {
    const l = S.lists.find(x => /evacua/i.test(x.name));
    if (l?.items.length) return [...l.items.map(i => i.text), ...g.steps.slice(1)];
  }
  return g.steps;
}
function viewAct() {
  const g = GUIDES.find(x => x.id === ui.guide);
  if (!g) return '<p class="empty">Situação não encontrada. <a href="#/emergencia">Voltar</a></p>';
  const steps = guideSteps(g), n = steps.length;
  if (ui.stepFor !== g.id) { ui.stepFor = g.id; ui.step = 0; }
  const i = Math.min(ui.step, n), end = i >= n;
  const meet = S.groups.find(x => x.meetingPoint || hasCoords(x)), pos = myPos();
  const goRow = ['evacuacao', 'tsunami', 'incendio', 'inundacao', 'sismo'].includes(g.id) && meet
    ? `<a class="now-row" href="#/mapa">${icon('pin')}<span class="now-t"><strong>${esc(meet.meetingPoint || fmtCoords(meet))}</strong><small>Ponto de encontro${pos && hasCoords(meet) ? ' · ' + fmtDist(distanceKm(pos, meet)) : ''}</small></span><span class="chev" aria-hidden="true">›</span></a>` : '';
  return `
  <div class="act-head">${icon(GUIDE_ICONS[g.id] || 'alert')}<strong>${esc(g.title)}</strong><span class="count">${end ? 'Concluído' : `Passo ${i + 1} de ${n}`}</span></div>
  <div class="dots" aria-hidden="true">${steps.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('')}</div>
  ${end ? `<section class="card step-card">
      <p class="step-text">Fez todos os passos.</p>
      <p class="muted">Avise a família e siga as indicações das autoridades.</p>
      <div class="status-btns"><button class="btn ok" data-act="status" data-v="ok">✓ Estou bem</button><button class="btn help" data-act="status" data-v="help">! Preciso de ajuda</button></div>
    </section>`
    : `<section class="card step-card"><span class="step-num">${i + 1}</span><p class="step-text">${esc(steps[i])}</p></section>`}
  <div class="step-nav">
    ${i > 0 ? '<button class="btn" data-act="stepPrev">‹ Anterior</button>' : ''}
    ${end ? '<a class="btn primary" href="#/emergencia">Outras situações</a>' : `<button class="btn primary" data-act="stepNext">${i === n - 1 ? 'Concluir ✓' : 'Seguinte ›'}</button>`}
  </div>
  ${goRow}
  <details class="card fold" data-fold="all-steps" ${isOpen('all-steps', false) ? 'open' : ''}>
    <summary>${icon('list')}<span class="fold-t">Ver todos os passos</span></summary>
    <ol class="all-steps">${steps.map((t, k) => `<li class="${k < i ? 'done' : ''}">${esc(t)}</li>`).join('')}</ol>
  </details>
  <p class="crisis-exit"><a href="#/emergencia">‹ Modo emergência</a></p>`;
}

function viewEmergency() {
  ui.stepFor = null; // ao escolher de novo uma situação, começa no primeiro passo
  const pos = myPos(), nums = statusRecipients();
  const meet = S.groups.filter(g => g.meetingPoint || hasCoords(g));
  const alts = S.groups.flatMap(g => livePoints(g).map(x => ({ ...x, g })));
  const near = pos && POINTS.length ? nearestOfficial(pos) : null;
  const tsu = pos ? POINTS.filter(p => p.t === 'Tsunami').map(p => ({ p, d: distanceKm(pos, p) })).sort((a, b) => a.d - b.d)[0] : null;
  const health = allMembers().filter(m => m.consent && HEALTH_FIELDS.some(k => m[k]));
  const calls = [
    ...allMembers().filter(m => m.phone && !(m.pk && m.pk === myPub())).map(m => [m.name, m.phone]),
    ...S.contacts.filter(c => c.priority && c.phone).map(c => [c.name, c.phone]),
    ...['fire', 'police'].flatMap(k => nearestServices(k, 1).filter(x => x.s.phone).map(({ s }) => [s.n, s.phone])),
  ].slice(0, 10);
  const qk = strongQuake();
  return `
  <a class="btn call big" href="tel:112">${icon('phone')} Ligar 112</a>
  ${qk ? quakeBanner(qk) : ''}
  <section class="card">
    <h3>O que está a acontecer?</h3>
    <div class="tiles">${GUIDES.filter(g => g.id !== 'telemovel').map(g => `<a class="tile" href="#/agir/${g.id}">${icon(GUIDE_ICONS[g.id] || 'alert')}<strong>${esc(g.title)}</strong><small>${guideSteps(g).length} passos</small></a>`).join('')}</div>
  </section>
  <section class="card">
    <h3>Avisar a família</h3>
    <div class="status-btns">
      <button class="btn ok" data-act="status" data-v="ok">✓ Estou bem</button>
      <button class="btn help" data-act="status" data-v="help">! Preciso de ajuda</button>
    </div>
    <p class="muted small">${nums.length ? `Abre as SMS para ${nums.length} pessoa(s) com ${pos ? 'a sua posição' : 'o ponto de encontro'}.` : 'Adicione telefones às pessoas do grupo para enviar por SMS.'}
      As SMS costumam funcionar quando a internet falha.</p>
  </section>
  <section class="card">
    <h3>Para onde ir</h3>
    ${meet.map(g => `<div class="meet">${icon('pin')}<div class="meet-body"><div class="muted small">Ponto de encontro · ${esc(g.name)}</div>
      <strong>${esc(g.meetingPoint || fmtCoords(g))}</strong>${hasCoords(g) ? navLinks(g, g.meetingPoint) : ''}</div></div>`).join('')}
    ${alts.map(x => `<div class="meet alt">${icon('pin')}<div class="meet-body"><div class="muted small">${esc(MEET_KINDS[x.kind])}${x.notes ? ' · ' + esc(x.notes) : ''}</div>
      <strong>${esc(x.name)}</strong>${hasCoords(x) ? navLinks(x, x.name) : ''}</div></div>`).join('')}
    ${near && near.d <= 25 ? `<div class="meet near">${icon('pin')}<div class="meet-body"><div class="muted small">Ponto oficial mais próximo · ${fmtDist(near.d)} para ${bearing(pos, near.p)}</div>
      <strong>${esc(near.p.n)}</strong>${navLinks(near.p, near.p.n)}</div></div>` : ''}
    ${tsu && tsu.d <= 5 ? `<p class="note small"><strong>Está perto da costa.</strong> Depois de um sismo forte, afaste-se do mar a pé e suba: ponto de tsunami mais próximo a ${fmtDist(tsu.d)} (${esc(tsu.p.n)}).</p>` : ''}
    ${!meet.length && !alts.length && !(near && near.d <= 25) ? `<p class="muted">Sem ponto definido. <button class="btn sm" data-act="useLocation">${icon('pin')} Ver o ponto oficial mais próximo</button></p>` : ''}
  </section>

  ${calls.length ? `<section class="card"><h3>Ligar</h3><ul class="list">${calls.map(([n, p]) => `<li class="row"><div class="row-main"><div class="row-title">${esc(n)}</div></div>
    <a class="btn" href="${telHref(p)}" aria-label="Ligar a ${esc(n)}">${icon('phone')} ${esc(p)}</a></li>`).join('')}</ul></section>` : ''}
  ${health.length ? `<section class="card"><h3>Saúde (para quem socorre)</h3><ul class="list">${health.map(m => `<li class="row"><div class="row-main">
    <div class="row-title">${esc(m.name)}${m.blood ? ` <span class="badge">${esc(m.blood)}</span>` : ''}</div>
    <div class="row-sub">${esc([m.allergies && 'Alergias: ' + m.allergies, m.meds && 'Medicação: ' + m.meds, m.needs].filter(Boolean).join(' · '))}</div></div></li>`).join('')}</ul></section>` : ''}
  <section class="card">
    <h3>Rádio e bateria</h3>
    <p><strong>Antena 1</strong> (${esc(IPMA_AREAS[S.settings.district])}): ${esc(RADIO_A1[S.settings.district] || '')}${S.settings.radio ? `<br><strong>${esc(S.settings.radio)}</strong>` : ''}</p>
    <ul class="tips small">
      <li>Ative o modo de poupança de energia e baixe o brilho.</li>
      <li>Prefira SMS a chamadas; chamadas curtas.</li>
      <li>Desligue dados e Bluetooth quando não precisar; ligue de vez em quando para ver mensagens.</li>
    </ul>
  </section>
  <p class="crisis-exit"><a href="#/painel">Sair do modo emergência</a></p>`;
}

// ---------- Cartão da família (para imprimir) ----------
function viewCard() {
  const rows = (a) => a.filter(Boolean).join('');
  return `
  <div class="toolbar no-print"><span class="spacer"></span>
    <button class="btn primary" data-act="print">Imprimir</button></div>
  <section class="card family-card">
    <h2>Em emergência: 112</h2>
    <p class="small">Ponto de encontro e contactos da família · atualizado em ${new Date().toLocaleDateString('pt-PT')}</p>
    <p class="small"><strong>Rádio Antena 1 (${esc(IPMA_AREAS[S.settings.district])}):</strong> ${esc(RADIO_A1[S.settings.district] || '')}${S.settings.radio ? ` · ${esc(S.settings.radio)}` : ''}</p>
  </section>
  ${S.groups.map(g => `<section class="card family-card">
    <h3>${esc(g.name)}</h3>
    <table>
      ${g.meetingPoint || hasCoords(g) ? `<tr><th>Ponto de encontro</th><td>${esc(g.meetingPoint || '')}${hasCoords(g) ? `<br><span class="mono">${fmtCoords(g)}</span>` : ''}</td></tr>` : ''}
      ${rows(livePoints(g).map(x => `<tr><th>${esc(MEET_KINDS[x.kind])}</th><td>${esc(x.name)}${x.notes ? ' — ' + esc(x.notes) : ''}${hasCoords(x) ? `<br><span class="mono">${fmtCoords(x)}</span>` : ''}</td></tr>`))}
    </table>
    ${liveMembers(g).length ? `<h4 class="sub-h">Pessoas</h4><table>${liveMembers(g).map(m => `<tr><th>${esc(m.name)}${m.role ? `<br><span class="small">${esc(m.role)}</span>` : ''}</th>
      <td>${esc(m.phone || '')}${m.consent && HEALTH_FIELDS.some(k => m[k]) ? `<br><span class="small">${esc([m.blood, m.allergies && 'Alergias: ' + m.allergies, m.meds && 'Medicação: ' + m.meds, m.needs].filter(Boolean).join(' · '))}</span>` : ''}</td></tr>`).join('')}</table>` : ''}
    ${livePets(g).length ? `<h4 class="sub-h">Animais</h4><table>${livePets(g).map(a => `<tr><th>${esc(a.name)}<br><span class="small">${esc([a.species, a.breed].filter(Boolean).join(' · '))}</span></th>
      <td>${a.chip ? 'Chip <span class="mono">' + esc(a.chip) + '</span>' : ''}${a.vetPhone ? '<br>Veterinário: ' + esc(a.vetPhone) : ''}</td></tr>`).join('')}</table>` : ''}
  </section>`).join('') || '<p class="empty">Crie um grupo para preencher o cartão.</p>'}
  <section class="card family-card">
    <h3>Outros números</h3>
    <table>${EMERGENCY_NUMBERS.filter(n => n.phone !== '112').map(n => `<tr><th>${esc(n.name)}</th><td>${esc(n.phone)}</td></tr>`).join('')}
      ${['fire', 'police'].flatMap(k => nearestServices(k, 1).filter(x => x.s.phone).map(({ s }) => `<tr><th>${esc(s.n)}</th><td>${esc(s.phone)}</td></tr>`)).join('')}
      ${S.contacts.filter(c => c.priority && c.phone).map(c => `<tr><th>${esc(c.name)}</th><td>${esc(c.phone)}</td></tr>`).join('')}</table>
  </section>`;
}

// Menu: tudo num só sítio, por ordem de importância.
function viewMore() {
  const link = ([k, t, ic, desc]) => `<li class="row"><a class="row-link" href="#/${k}">${icon(ic)}<div class="row-main"><div class="row-title">${esc(t)}</div><div class="row-sub">${esc(desc)}</div></div>${navBadge(k, navOrder())}<span class="chev" aria-hidden="true">›</span></a></li>`;
  const block = (title, items) => `<section class="card"><h3>${title}</h3><ul class="list">${items.map(link).join('')}</ul></section>`;
  const sec = k => [k, ROUTES[k][0], ROUTES[k][1], ROUTES[k][4]];
  return `<a class="sos-entry" href="#/emergencia">${icon('alert')} Modo emergência</a>
  ${block('Preparar', navOrder().slice(4).map(sec))}
  ${block('Ter à mão', [['cartao', 'Cartão da família', 'users', 'Para imprimir e guardar no kit']])}
  ${block('Aplicação', [sec('definicoes'), ['sobre', 'Sobre e privacidade', 'shield', 'Missão, princípios, dados']])}`;
}

// Contadores: avisos graves (Avisos) e mensagens por ler (Grupos); no telemóvel somam-se no Menu se a secção lá estiver.
function navBadge(k, order) {
  const urgent = districtAlerts().filter(w => SEV[w.awarenessLevelID] >= 2).length;
  const msgs = unreadTotal();
  const top = order.slice(0, 4);
  if (k === 'alertas') return countBadge(urgent, 'avisos graves');
  if (k === 'grupos') return countBadge(msgs, 'mensagens por ler');
  if (k === 'mais') return countBadge((top.includes('alertas') ? 0 : urgent) + (top.includes('grupos') ? 0 : msgs), 'novidades');
  return '';
}
function updateNavBadges() {
  const order = navOrder();
  document.querySelectorAll('#nav a').forEach(a => {
    const k = a.getAttribute('href').slice(2);
    a.querySelector('.dot-count')?.remove();
    const b = navBadge(k, order);
    if (b) a.insertAdjacentHTML('beforeend', b);
  });
}

function render() {
  const r = route();
  const urgent = districtAlerts().filter(w => SEV[w.awarenessLevelID] >= 2).length;
  const order = navOrder();
  // Telemóvel: 4 secções + Menu. Computador: todas as secções + Menu (Definições, Sobre, Cartão).
  const here = r === 'chat' ? 'grupos' : r;
  const inMenuMobile = !order.slice(0, 4).includes(here);
  const inMenuDesktop = !order.includes(here);
  $('#nav').innerHTML = [...order, 'mais'].map((k, i) => {
    const [t, ic] = ROUTES[k];
    const current = k === here || (k === 'mais' && inMenuDesktop);
    const cls = k === 'mais' ? `more${inMenuMobile ? ' cur-m' : ''}` : i < 4 ? 'pri' : 'sec';
    return `<a href="#/${k}" class="${cls}" ${current ? 'aria-current="page"' : ''}>${icon(ic)}<span>${NAV_SHORT[k] || t}</span>${navBadge(k, order)}</a>`;
  }).join('');
  const title = r === 'chat' ? 'Chat · ' + (findGroup(ui.chatGroup)?.name || '') : ROUTES[r][0];
  $('#page-title').textContent = r === 'chat' ? 'Chat' : NAV_SHORT[r] || ROUTES[r][0];
  document.title = r === 'painel' ? 'eKit · Preparação para emergências' : `${title} · eKit`;
  if (map && r !== 'mapa') { map.remove(); map = null; mapLayer = null; }
  const draft = $('.chat-form input')?.value;
  $('#main').className = 'r-' + r;
  document.documentElement.classList.toggle('crisis', r === 'emergencia' || r === 'agir');
  $('#main').innerHTML = pageHead(r, title) + `<div class="content">${ROUTES[r][2]()}</div>`;
  if (r === 'mapa') initMap();
  if (r === 'chat') { renderChatLog(); markChatRead(ui.chatGroup); }
  if (draft) { const i = $('.chat-form input'); if (i) i.value = draft; }
  $('#net').hidden = navigator.onLine;
}

const findKit = id => S.kit.find(i => i.id === id);
const findGroup = id => S.groups.find(g => g.id === id);
const findList = id => S.lists.find(l => l.id === id);

const actions = {
  enableChatNotif: () => { enableChatNotifications(); return 'async'; },
  blockSender: d => {
    if (!confirm(`Bloquear "${d.name}" (#${d.pk.slice(0, 4)})? Deixa de ver as mensagens deste dispositivo.`)) return 'async';
    S.settings.blocked = [...new Set([...(S.settings.blocked || []), d.pk])];
    save(); renderChatLog(); toast('Remetente bloqueado neste dispositivo.');
    return 'async';
  },
  unblockAll: () => { S.settings.blocked = []; toast('Desbloqueados.'); },
  navUp: d => moveNav(d.k, -1),
  navDown: d => moveNav(d.k, 1),
  navReset: () => { S.settings.navOrder = []; },
  rotateChat: d => {
    const g = findGroup(d.id);
    if (!confirm('Criar nova chave? Só quem receber o grupo de novo continua a ler.')) return 'async';
    newChatConfig().then(cfg => { g.chat = cfg; g.sharedAt = ''; delete (S.chat || {})[g.id]; markDirty(g); startHub(); render(); toast('Nova chave criada. Partilhe o grupo com os membros atuais.'); });
    return 'async';
  },
  setName: () => { askName(); return 'async'; },
  shareBitchat: d => {
    const text = bitchatText(findGroup(d.id));
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast('Texto copiado. Abra o bitchat e cole.'), () => toast(text));
    return 'async';
  },
  kitFilter: d => { ui.kitFilter = d.v; },
  addItem: () => itemForm(),
  editItem: d => itemForm(findKit(d.id)),
  inc: d => { findKit(d.id).have++; },
  dec: d => { const i = findKit(d.id); i.have = Math.max(0, i.have - 1); },
  fill: d => { const i = findKit(d.id); i.have = isOk(i) ? 0 : Math.max(need(i), 1); },
  addContact: () => contactForm(),
  editContact: d => contactForm(S.contacts.find(c => c.id === d.id)),
  addGroup: () => groupForm(),
  editGroup: d => groupForm(findGroup(d.id)),
  addMember: d => memberForm(findGroup(d.id)),
  addPet: d => petForm(findGroup(d.id)),
  editMeetMain: d => meetMainForm(findGroup(d.id)),
  addMeet: d => meetForm(findGroup(d.id)),
  editMeet: d => { const g = findGroup(d.id); meetForm(g, g.points.find(x => x.id === d.pid)); },
  useOfficial: d => { const p = POINTS[Number(d.i)]; if (p) useOfficialPoint(p); },
  editPet: d => { const g = findGroup(d.id); petForm(g, g.pets.find(a => a.id === d.pid)); },
  editMember: d => { const g = findGroup(d.id); memberForm(g, g.members.find(m => m.id === d.mid)); },
  shareGroup: d => { shareGroup(findGroup(d.id)); return 'async'; },
  joinGroup: () => { joinGroup(); return 'async'; },
  exportBackup: () => { const { alertsCache, pointsCache, nostr, chat, quakes, ...data } = S; exportPackage('backup', data, `ekit-backup-${new Date().toISOString().slice(0, 10)}.json`); S.settings.lastBackup = Date.now(); },
  import: () => $('#file').click(),
  exportIcs,
  addList: () => openForm({ title: 'Nova lista', fields: [{ k: 'name', label: 'Nome', required: true }], onSave: v => { S.lists.push({ id: uid(), name: v.name, items: [] }); } }),
  editList: d => { const l = findList(d.id); openForm({ title: 'Editar lista', values: l, fields: [{ k: 'name', label: 'Nome', required: true }], onSave: v => { l.name = v.name; }, onDelete: () => { S.lists = S.lists.filter(x => x !== l); } }); },
  resetList: d => { findList(d.id).items.forEach(i => { i.done = false; }); },
  toggleListItem: d => { const i = findList(d.id).items.find(x => x.id === d.iid); i.done = !i.done; },
  delListItem: d => { const l = findList(d.id); l.items = l.items.filter(x => x.id !== d.iid); },
  fetchAlerts: () => { fetchAlerts(); return 'async'; },
  locate: () => { ui.recenter = true; locate(); return 'async'; },
  useLocation: () => { locate(); return 'async'; },
  saveMap: () => { saveMapArea(); return 'async'; },
  drillDone: () => { S.settings.lastDrill = Date.now(); toast('Registado. Próximo lembrete daqui a 6 meses.'); scheduleNativeReminders(); },
  drillLater: () => { S.settings.drillSnooze = Date.now() + 30 * 864e5; },
  phoneReady: () => { S.settings.phoneReady = true; },
  status: d => { sendStatus(d.v === 'help'); return 'async'; },
  stepNext: () => { ui.step = (ui.step || 0) + 1; window.scrollTo(0, 0); },
  stepPrev: () => { ui.step = Math.max(0, (ui.step || 0) - 1); window.scrollTo(0, 0); },
  print: () => { window.print(); return 'async'; },
  findServices: () => { findServices(); return 'async'; },
  forgetPos: () => { delete S.lastPos; ui.pos = null; },
  showPoint: d => {
    const p = POINTS[Number(d.i)], m = officialMarkers[Number(d.i)];
    if (!p || !map) return 'async';
    map.setView([p.lat, p.lng], 17);
    m?.openPopup();
    map.getContainer().scrollIntoView({ behavior: 'smooth', block: 'center' });
    return 'async';
  },
  refreshLisboa: () => { refreshLisboa(); return 'async'; },
  copy: d => { navigator.clipboard?.writeText(d.v).then(() => toast('Copiado: ' + d.v), () => toast(d.v)); return 'async'; },
  enableNotif: async () => { await Notification.requestPermission(); render(); checkExpiryNotification(); return 'async'; },
  wipe: () => {
    if (!confirm('Apagar TODOS os dados deste dispositivo? Esta ação não pode ser desfeita.')) return 'async';
    localStorage.removeItem(KEY); S = seed(); save(); restartHub(); toast('Dados apagados.');
  },
};

// Antes de ligar 112: confirmação consciente + alternativas para o que não é emergência.
// O 112 nunca fica bloqueado; só passa a exigir um toque deliberado.
function confirm112() {
  const d = $('#dlg');
  const alts = EMERGENCY_NUMBERS.filter(n => n.phone !== '112');
  d.innerHTML = `<div class="form call-confirm">
    <h2>Ligar 112?</h2>
    <p>Só em <strong>perigo imediato</strong> para pessoas ou bens.</p>
    <ul class="plain small">
      <li>Alguém inconsciente, sem respirar ou com uma ferida grave</li>
      <li>Incêndio, acidente grave, inundação ou desabamento</li>
      <li>Crime a acontecer ou ameaça imediata</li>
    </ul>
    <a class="btn call big" href="tel:112" data-confirmed>${icon('phone')} Sim, é uma emergência · ligar 112</a>
    <h3>Não é uma emergência?</h3>
    <ul class="list">${alts.map(n => `<li class="row"><div class="row-main"><div class="row-title">${esc(n.name)}</div><div class="row-sub">${esc(n.note)}</div></div>
      <a class="btn" href="${telHref(n.phone)}">${esc(n.phone.replace(/(\d{3})(?=\d)/g, '$1 '))}</a></li>`).join('')}
      ${['fire', 'police'].map(k => nearestServices(k, 1).filter(x => x.s.phone).map(({ s }) => `<li class="row"><div class="row-main"><div class="row-title">${esc(s.n)}</div>
        <div class="row-sub">${k === 'fire' ? 'Bombeiros mais próximos' : 'Polícia mais próxima'} · assuntos não urgentes</div></div><a class="btn" href="${telHref(s.phone)}">${esc(s.phone)}</a></li>`).join('')).join('')}
      <li class="row"><div class="row-main"><div class="row-title">Avisos meteorológicos</div><div class="row-sub">Informação do IPMA para a sua zona</div></div>
      <a class="btn" href="#/alertas" data-close>Ver avisos</a></li>
    </ul>
    <p class="note">Ligou por engano? <strong>Não desligue</strong>: explique ao operador.</p>
    <div class="form-actions"><span class="spacer"></span><button type="button" class="btn" data-close>Cancelar</button></div>
  </div>`;
  d.querySelectorAll('[data-close], [data-confirmed]').forEach(b => b.addEventListener('click', () => setTimeout(() => d.close(), 0)));
  d.showModal();
  d.querySelector('[data-close].btn:not([href])')?.focus({ preventScroll: true });
  d.scrollTop = 0;
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="tel:"]');
  if (a && a.getAttribute('href').replace(/\D/g, '') === '112' && !a.hasAttribute('data-confirmed')) {
    e.preventDefault();
    confirm112();
  }
}, true);

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (el.tagName === 'A' && el.dataset.act !== 'kitFilter') e.preventDefault();
  const r = actions[el.dataset.act](el.dataset);
  if (r !== 'async' && !$('#dlg').open) { save(); render(); }
});
// Lembra-se das secções abertas/fechadas entre atualizações do ecrã.
document.addEventListener('toggle', e => { const k = e.target.dataset?.fold; if (k) ui.folds[k] = e.target.open; }, true);
const isOpen = (k, dflt) => (k in ui.folds ? ui.folds[k] : dflt);
document.addEventListener('change', e => {
  const k = e.target.dataset.change;
  if (!k) return;
  if (e.target.type === 'checkbox') { S.settings[k] = e.target.checked; if (k === 'chatNotify' && e.target.checked) enableChatNotifications(); save(); return; }
  if (k === 'relays') { S.settings.relays = e.target.value.split(/\s+/).filter(u => /^wss?:\/\/\S+$/.test(u)); setTimeout(restartHub, 0); }
  else if (k === 'district') { S.settings.district = e.target.value; S.settings.autoDistrict = false; }
  else if (k === 'radio') { S.settings.radio = e.target.value.trim().slice(0, 60); save(); return; }
  else S.settings[k] = Math.max(1, Number(e.target.value) || 1);
  save(); render();
});
document.addEventListener('submit', e => {
  if (e.target.dataset.chat) { e.preventDefault(); sendChat(e.target); return; }
  const id = e.target.dataset.addto;
  if (!id) return;
  e.preventDefault();
  findList(id).items.push({ id: uid(), text: e.target.elements.text.value.trim(), done: false });
  save(); render();
});
// Atualizações que chegaram com uma janela aberta aparecem quando ela fecha.
new MutationObserver(() => { if (!$('#dlg').open && ui.pendingRender) { ui.pendingRender = false; render(); } })
  .observe($('#dlg'), { attributes: true, attributeFilter: ['open'] });
$('#file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { render(); fetchAlerts(); startHub(); });
window.addEventListener('offline', render);

// ---------- Arranque ----------
// Na app nativa os ficheiros já vêm no pacote; o service worker só é usado no site.
if ('serviceWorker' in navigator && !native()) navigator.serviceWorker.register('./sw.js');
scheduleNativeReminders();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) scheduleNativeReminders();
  else if (route() === 'chat') { markChatRead(ui.chatGroup); updateNavBadges(); }
});
try { nativeLN()?.addListener?.('localNotificationActionPerformed', a => { const u = a?.notification?.extra?.url; if (typeof u === 'string' && u.startsWith('#/chat/')) location.hash = u; }); } catch { /* sem plugin */ }
// Primeira utilização: 3 perguntas para o kit fazer sentido desde o início.
function onboarding() {
  S.settings.onboarded = true; save();
  openForm({
    title: 'Bem-vindo à eKit',
    submitLabel: 'Começar',
    values: { household: S.settings.household, district: S.settings.district, makeGroup: true },
    fields: [
      { type: 'info', html: 'Fica tudo guardado neste dispositivo.' },
      { k: 'household', label: 'Quantas pessoas vivem em casa?', type: 'number' },
      { k: 'district', label: 'Distrito (para os avisos)', type: 'select', options: Object.entries(IPMA_AREAS) },
      { k: 'makeGroup', label: 'Definir agora o ponto de encontro da família', type: 'checkbox' },
    ],
    onSave(v) {
      S.settings.household = Math.max(1, Math.round(v.household) || 1);
      S.settings.district = v.district;
      if (v.makeGroup && !S.groups.length) setTimeout(() => groupForm(null, { name: 'Família' }), 0);
    },
  });
}

render();
loadPoints();
if (!S.settings.onboarded) onboarding();
S.groups.forEach(setupGroupKey); // grupos antigos sem chave recebem uma
startHub();
setTimeout(() => S.groups.filter(g => g.chat).forEach(addSelfToGroup), 1500);
checkExpiryNotification();
navigator.permissions?.query({ name: 'geolocation' }).then(p => { if (p.state === 'granted') navigator.geolocation.getCurrentPosition(
  x => { ui.pos = { lat: x.coords.latitude, lng: x.coords.longitude, acc: x.coords.accuracy }; onPosition(ui.pos); render(); }, () => {}, { maximumAge: 10 * 60e3, timeout: 20000 }); }).catch(() => {});
if (navigator.onLine && (!S.alertsCache || Date.now() - S.alertsCache.at > 30 * 60e3)) fetchAlerts();
