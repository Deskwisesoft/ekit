import {
  CATEGORIES, DEFAULT_KIT, EMERGENCY_NUMBERS, DEFAULT_LISTS, GUIDES,
  IPMA_AREAS, IPMA_WARNINGS_URL, ALERT_SOURCES, LISBOA_POINTS_URL,
} from './data.js';
import { GroupChat, newChatConfig, newIdentity, pubkeyOf, loadNostr, DEFAULT_RELAYS } from './chat.js';

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
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 1) return s; } catch {}
  return seed();
}
let S = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const ui = { kitFilter: 'all', alertsLoading: false, alertsError: '', pos: null, geoError: '', pointsLoading: false };

// ---------- Pontos de encontro oficiais e geolocalização ----------
let POINTS = [], POINTS_META = { sources: [] };
async function loadPoints() {
  try {
    const d = await (await fetch('./pontos-encontro.json')).json();
    POINTS_META = d.meta;
    POINTS = d.points;
    if (S.pointsCache?.lisboa) POINTS = [...S.pointsCache.lisboa, ...POINTS.filter(p => p.m !== 'Lisboa')];
  } catch { /* sem cópia local: o mapa mostra só os pontos dos grupos */ }
  render();
}
async function refreshLisboa() {
  ui.pointsLoading = true; render();
  try {
    const d = await (await fetch(LISBOA_POINTS_URL, { cache: 'no-store' })).json();
    const lisboa = d.features.map(f => ({
      n: (f.properties.NOME || f.properties.DESIGNACAO || 'Ponto de encontro').trim(), f: f.properties.FREGUESIA || '',
      m: 'Lisboa', lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], cap: f.properties.CAPACIDADE, t: 'Emergência',
    }));
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
  const q = `${p.lat},${p.lng}`;
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
    p => { ui.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; ui.geoError = ''; then ? then(ui.pos) : render(); },
    e => { ui.geoError = e.code === 1 ? 'Permissão de localização recusada.' : 'Não foi possível obter a localização.'; render(); },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
  );
}

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

function download(name, text, type = 'application/json') {
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
      { type: 'info', html: 'Defina uma palavra-passe para cifrar o ficheiro. Partilhe-a por outro canal (ex.: pessoalmente). Sem palavra-passe o ficheiro fica legível por qualquer pessoa.' },
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

async function importFile(file) {
  let pkg;
  try { pkg = JSON.parse(await file.text()); } catch { return toast('Ficheiro inválido.'); }
  if (pkg.app !== 'ekit') return toast('Este ficheiro não é do eKit.');
  const apply = payload => {
    if (pkg.type === 'group') {
      const existing = S.groups.findIndex(g => g.id === payload.id);
      if (existing >= 0) {
        if (!confirm(`Já existe o grupo "${payload.name}". Substituir pela versão importada?`)) return;
        S.groups[existing] = payload;
      } else S.groups.push(payload);
      toast(`Grupo "${payload.name}" importado.`);
      location.hash = '#/grupos';
    } else if (pkg.type === 'backup') {
      if (!confirm('Substituir TODOS os dados deste dispositivo pela cópia de segurança?')) return;
      S = { ...seed(), ...payload, alertsCache: S.alertsCache };
      toast('Cópia de segurança restaurada.');
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
  if (!items.length) return toast('Nenhum produto tem data de validade.');
  const d = s => s.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ev = items.map(i => [
    'BEGIN:VEVENT', `UID:${i.id}@ekit`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${d(i.expiry)}`,
    `SUMMARY:Kit de emergência – expira: ${i.name.replace(/[,;]/g, ' ')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Substituir produto do kit', `TRIGGER:-P${S.settings.notifyDays}D`, 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n'));
  download('ekit-validades.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//eKit//PT', ...ev, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
}

// ---------- Notificações locais de validade ----------
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
async function fetchAlerts() {
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
};
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
        <button type="button" class="btn" data-here>📍 Aqui</button>
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
    ${fields.map(f => fieldHTML(f, f.type === 'geo' ? values : values[f.k])).join('')}
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
  if (here) here.onclick = () => { here.textContent = '…'; locate(p => { setGeo(p); here.textContent = '📍 Aqui'; }); };
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
function viewDashboard() {
  const st = stats();
  const alerts = districtAlerts();
  const meeting = S.groups.filter(g => g.meetingPoint || hasCoords(g));
  const top = alerts.find(w => SEV[w.awarenessLevelID] >= 2);
  const others = alerts.filter(w => w !== top);
  const favs = S.contacts.filter(c => c.priority).slice(0, 4);
  const chips = [
    st.missing && `<a class="chip" href="#/kit" data-act="kitFilter" data-v="missing">${st.missing} em falta</a>`,
    st.expiring && `<a class="chip warn" href="#/kit" data-act="kitFilter" data-v="expiring">${st.expiring} a expirar</a>`,
    st.expired && `<a class="chip bad" href="#/kit" data-act="kitFilter" data-v="expiring">${st.expired} expirado(s)</a>`,
  ].filter(Boolean).join('');
  return `
  ${top ? alertBanner(top, others.length) : ''}

  <section class="card">
    <a class="btn call big" href="tel:112">${icon('phone')} Ligar 112</a>
    ${favs.length ? `<div class="grid-buttons">${favs.map(c => `<a class="btn" href="${telHref(c.phone)}">${icon('phone')} ${esc(c.name)}</a>`).join('')}</div>` : ''}
    ${meeting.map(g => `<div class="meet">${icon('pin')}<div>
        <div class="muted small">Ponto de encontro · ${esc(g.name)}</div>
        <strong>${esc(g.meetingPoint || fmtCoords(g))}</strong>
        ${hasCoords(g) ? navLinks(g, g.meetingPoint) : ''}
      </div></div>`).join('') || '<p class="muted">Ainda não tem ponto de encontro. <a href="#/grupos">Criar grupo →</a></p>'}
    <a href="#/mapa">Mapa dos pontos de encontro →</a>
  </section>

  <section class="card hero">
    <div class="ring" style="--p:${st.pct}"><span>${st.pct}%</span></div>
    <div>
      <h2>Kit ${st.pct === 100 ? 'completo' : 'preparado a ' + st.pct + '%'}</h2>
      <p class="muted">${S.settings.household} pessoa(s) · autonomia de 72 horas · <a href="#/definicoes">alterar</a></p>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
    </div>
  </section>

  <section class="card">
    <h3>${top ? 'Outros avisos' : 'Avisos'} — ${esc(IPMA_AREAS[S.settings.district] || S.settings.district)}</h3>
    ${others.length ? `<ul class="list">${others.slice(0, 3).map(alertCard).join('')}</ul>` : `<p class="muted">${top ? 'Sem outros avisos.' : 'Sem avisos ativos guardados.'}</p>`}
    <a href="#/alertas">Ver todos os alertas →</a>
  </section>

  <section class="card">
    <h3>Próximas validades</h3>
    ${st.exp.length ? `<ul class="list">${st.exp.slice(0, 5).map(({ i, e }) => `
      <li class="row"><div class="row-main" data-act="editItem" data-id="${i.id}">
        <div class="row-title">${esc(i.name)}</div><div class="row-sub"><span class="badge ${e.cls}">${esc(e.label)}</span></div>
      </div></li>`).join('')}</ul>` : '<p class="muted">Nada a expirar nos próximos ' + S.settings.notifyDays + ' dias.</p>'}
  </section>`;
}

function viewKit() {
  const f = ui.kitFilter;
  const show = i => f === 'all' || (f === 'missing' && need(i) > 0 && !isOk(i)) || (f === 'expiring' && ['warn', 'bad'].includes(expiryState(i)?.cls));
  const filters = [['all', 'Todos'], ['missing', 'Em falta'], ['expiring', 'Validade']];
  return `
  <div class="toolbar">
    <div class="seg">${filters.map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-act="kitFilter" data-v="${k}">${t}</button>`).join('')}</div>
    <button class="btn primary" data-act="addItem">+ Item</button>
  </div>
  ${CATEGORIES.map(c => {
    const items = S.kit.filter(i => i.cat === c.id && show(i));
    if (!items.length) return '';
    return `<section class="card"><h3>${c.icon} ${esc(c.name)}</h3><ul class="list">${items.map(kitRow).join('')}</ul></section>`;
  }).join('') || '<p class="empty">Nenhum item neste filtro. 🎉</p>'}`;
}
function kitRow(i) {
  const n = need(i), ok = isOk(i), e = expiryState(i);
  const meta = [n > 0 ? `Necessário: ${n} ${esc(i.unit)}` : 'Opcional', i.location && '📍 ' + esc(i.location)].filter(Boolean).join(' · ');
  return `<li class="row ${ok ? 'done' : ''}">
    <button class="tick" data-act="fill" data-id="${i.id}" aria-label="Marcar como completo">${ok ? '✓' : ''}</button>
    <div class="row-main" data-act="editItem" data-id="${i.id}">
      <div class="row-title">${esc(i.name)}</div>
      <div class="row-sub">${meta}${e ? ` <span class="badge ${e.cls}">${esc(e.label)}</span>` : (i.expires ? ' <span class="badge">sem validade definida</span>' : '')}</div>
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
      { k: 'unit', label: 'Unidade' },
      { k: 'perPerson', label: 'Quantidade por pessoa do agregado', type: 'checkbox' },
      { k: 'have', label: 'Quantidade que tenho', type: 'number' },
      { k: 'expiry', label: 'Data de validade', type: 'date' },
      { k: 'location', label: 'Onde está guardado' },
      { k: 'notes', label: 'Notas', type: 'textarea' },
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
        <div class="row-title">${c.priority ? '⭐ ' : ''}${esc(c.name)}</div>
        <div class="row-sub">${esc([c.relation, c.notes].filter(Boolean).join(' · '))}</div>
      </div>${c.phone ? `<a class="btn" href="${telHref(c.phone)}">📞</a>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">Adicione familiares, vizinhos, médico, seguradora… Os favoritos (⭐) aparecem no painel.</p>'}
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
      { k: 'notes', label: 'Notas', type: 'textarea' },
      { k: 'priority', label: 'Favorito (mostrar no painel)', type: 'checkbox' },
    ],
    onSave(v) { if (c) Object.assign(c, v); else S.contacts.push({ id: uid(), ...v }); },
    onDelete: c && (() => { S.contacts = S.contacts.filter(x => x !== c); }),
  });
}

function viewGroups() {
  return `
  <div class="toolbar">
    <p class="muted small">Cada grupo é independente: só é partilhado o que está nesse grupo, por ficheiro cifrado.</p>
    <span class="spacer"></span>
    <button class="btn" data-act="import">Importar</button>
    <button class="btn primary" data-act="addGroup">+ Grupo</button>
  </div>
  ${S.groups.length ? S.groups.map(g => `
    <section class="card">
      <div class="toolbar">
        <h3>👥 ${esc(g.name)}</h3><span class="spacer"></span>
        <a class="btn" href="#/chat/${g.id}">${icon('chat')} Chat</a>
        <button class="btn ghost" data-act="editGroup" data-id="${g.id}">Editar</button>
        <button class="btn ghost" data-act="exportGroup" data-id="${g.id}">Partilhar</button>
      </div>
      ${g.meetingPoint || hasCoords(g) ? `<div class="meet">${icon('pin')}<div>
        <div class="muted small">Ponto de encontro</div><strong>${esc(g.meetingPoint || 'sem nome')}</strong>
        ${hasCoords(g) ? `<div class="mono small muted">${fmtCoords(g)}</div>${navLinks(g, g.meetingPoint)}` : ''}</div></div>` : ''}
      ${g.notes ? `<p class="muted">${esc(g.notes)}</p>` : ''}
      <ul class="list">${(g.members || []).map(m => `
        <li class="row"><div class="row-main" data-act="editMember" data-id="${g.id}" data-mid="${m.id}">
          <div class="row-title">${esc(m.name)}${m.role ? ` <span class="badge">${esc(m.role)}</span>` : ''}</div>
          ${m.needs ? `<div class="row-sub">🩺 ${esc(m.needs)}</div>` : ''}
        </div>${m.phone ? `<a class="btn" href="${telHref(m.phone)}">📞</a>` : ''}</li>`).join('')}</ul>
      <button class="btn ghost" data-act="addMember" data-id="${g.id}">+ Pessoa</button>
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
      { k: 'notes', label: 'Notas / plano do grupo', type: 'textarea' },
    ],
    onSave(v) { delete v.official; if (g) Object.assign(g, v); else S.groups.push({ id: uid(), members: [], ...v }); },
    onDelete: g && (() => { S.groups = S.groups.filter(x => x !== g); }),
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
      { k: 'bitchat', label: 'Nome no bitchat (para mensagens privadas sem internet)' },
      { k: 'needs', label: 'Necessidades especiais (mobilidade, medicação…)', type: 'textarea' },
      { type: 'info', html: 'Informação de saúde é uma <strong>categoria especial</strong> de dados (art. 9.º RGPD). Só guarde com o consentimento explícito da pessoa.' },
      { k: 'consent', label: 'A pessoa deu consentimento para guardar e partilhar estes dados neste grupo', type: 'checkbox' },
    ],
    onSave(v) {
      if (v.needs && !v.consent) { toast('Para guardar necessidades especiais é preciso o consentimento.'); return false; }
      v.consentAt = v.consent ? (m?.consentAt || new Date().toISOString()) : '';
      if (m) Object.assign(m, v); else g.members.push({ id: uid(), ...v });
    },
    onDelete: m && (() => { g.members = g.members.filter(x => x !== m); }),
  });
}

function viewLists() {
  return `
  <div class="toolbar"><span class="spacer"></span><button class="btn primary" data-act="addList">+ Lista</button></div>
  ${S.lists.map(l => {
    const done = l.items.filter(i => i.done).length;
    return `<section class="card">
      <div class="toolbar"><h3>${esc(l.name)} <span class="muted small">${done}/${l.items.length}</span></h3><span class="spacer"></span>
        <button class="btn ghost" data-act="resetList" data-id="${l.id}">Limpar ✓</button>
        <button class="btn ghost" data-act="editList" data-id="${l.id}">Editar</button></div>
      <ul class="list">${l.items.map(i => `
        <li class="row ${i.done ? 'done' : ''}">
          <button class="tick" data-act="toggleListItem" data-id="${l.id}" data-iid="${i.id}">${i.done ? '✓' : ''}</button>
          <div class="row-main"><div class="row-title">${esc(i.text)}</div></div>
          <button class="btn ghost" data-act="delListItem" data-id="${l.id}" data-iid="${i.id}" aria-label="Remover">✕</button>
        </li>`).join('')}</ul>
      <form class="inline" data-addto="${l.id}"><input name="text" placeholder="Adicionar passo…" required><button class="btn">+</button></form>
    </section>`;
  }).join('')}`;
}

function viewGuide() {
  return GUIDES.map(g => `
    <details class="card guide"><summary>${g.icon} ${esc(g.title)}</summary>
      <ol>${g.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    </details>`).join('') +
    '<p class="muted small">Informação geral. Siga sempre as indicações das autoridades locais (ANEPC, 112).</p>';
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
    <h3>Fontes oficiais</h3>
    <ul class="list">${ALERT_SOURCES.map(s => `<li class="row"><div class="row-main"><div class="row-title"><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></div><div class="row-sub">${esc(s.note)}</div></div></li>`).join('')}</ul>
    <p class="muted small">Em emergência siga sempre as indicações das autoridades e os alertas recebidos no telemóvel.</p>
  </section>`;
}

function viewMap() {
  const mine = S.groups.filter(hasCoords);
  const all = [...mine.map(g => ({ n: g.meetingPoint || g.name, m: 'Grupo: ' + g.name, lat: g.lat, lng: g.lng, mine: true })), ...POINTS];
  const nearest = ui.pos ? all.map(p => ({ p, d: distanceKm(ui.pos, p) })).sort((a, b) => a.d - b.d).slice(0, 8) : [];
  const at = S.pointsCache?.at;
  return `
  <section class="card">
    <div class="toolbar">
      <button class="btn primary" data-act="locate">📍 Onde estou</button>
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
        <div class="row-title">${p.mine ? '⭐ ' : ''}${esc(p.n)} <span class="badge ${p.t === 'Tsunami' ? 'warn' : ''}">${esc(p.m)}${p.t === 'Tsunami' ? ' · tsunami' : ''}</span></div>
        <div class="row-sub"><strong>${fmtDist(d)}</strong> para ${bearing(ui.pos, p)} · <span class="mono">${fmtCoords(p)}</span>${p.cap ? ` · capacidade ${p.cap.toLocaleString('pt-PT')} pessoas` : ''}</div>
        <div class="row-sub">${navLinks(p, p.n)}</div>
      </div></li>`).join('')}</ul>`
      : '<p class="muted">Carregue em "Onde estou". O GPS funciona sem internet: a distância e a direção aos pontos são calculadas no dispositivo.</p>'}
  </section>
  <section class="card">
    <h3>Dados oficiais</h3>
    <ul class="plain">${POINTS_META.sources.map(s => `<li><strong>${esc(s.m)}</strong>: <a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a> — ${esc(s.license)}</li>`).join('')}</ul>
    <p class="muted small">${POINTS.length} pontos incluídos na app (disponíveis offline).${at ? ' Lisboa atualizada em ' + new Date(at).toLocaleString('pt-PT') + '.' : ''}
      Outros municípios ainda não publicam estes dados em formato aberto; confirme sempre no Plano Municipal de Emergência do seu concelho.</p>
    <button class="btn" data-act="refreshLisboa" ${ui.pointsLoading ? 'disabled' : ''}>${ui.pointsLoading ? 'A atualizar…' : '🔄 Atualizar pontos de Lisboa'}</button>
  </section>`;
}

let map = null;
function initMap() {
  const el = $('#map');
  if (map) { ui.mapView = ui.recenter ? null : [map.getCenter(), map.getZoom()]; map.remove(); map = null; }
  if (ui.recenter && ui.pos) ui.recenter = false;
  if (!el) return;
  if (!window.L) { el.innerHTML = '<p class="empty">Mapa indisponível sem internet (abra-o uma vez com rede). A lista abaixo funciona offline.</p>'; return; }
  map = L.map(el);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  const popup = (p, title) => `<strong>${esc(title)}</strong><br>${esc(p.m || '')}${p.f ? ' · ' + esc(p.f) : ''}${p.cap ? '<br>Capacidade: ' + p.cap : ''}<br><span class="mono">${fmtCoords(p)}</span><br>${navLinks(p, title)}`;
  const bounds = [];
  POINTS.forEach(p => {
    const c = p.t === 'Tsunami' ? '#d97706' : '#2563eb';
    L.circleMarker([p.lat, p.lng], { radius: 6, color: c, fillColor: c, fillOpacity: 0.7, weight: 1 }).bindPopup(popup(p, p.n)).addTo(map);
  });
  S.groups.filter(hasCoords).forEach(g => {
    L.circleMarker([g.lat, g.lng], { radius: 10, color: '#fff', fillColor: '#7c3aed', fillOpacity: 1, weight: 3 })
      .bindPopup(popup({ ...g, m: 'Grupo: ' + g.name }, g.meetingPoint || g.name)).addTo(map);
    bounds.push([g.lat, g.lng]);
  });
  if (ui.pos) {
    L.circle([ui.pos.lat, ui.pos.lng], { radius: ui.pos.acc, color: '#16a34a', weight: 1, fillOpacity: 0.1 }).addTo(map);
    L.circleMarker([ui.pos.lat, ui.pos.lng], { radius: 7, color: '#fff', fillColor: '#16a34a', fillOpacity: 1, weight: 3 }).bindPopup('Está aqui').addTo(map);
  }
  if (ui.mapView) map.setView(ui.mapView[0], ui.mapView[1]);
  else if (ui.pos) map.setView([ui.pos.lat, ui.pos.lng], 15);
  else if (bounds.length) map.fitBounds(bounds, { maxZoom: 15, padding: [30, 30] });
  else map.setView([38.72, -9.25], 11);
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
  <section class="card">
    <h3>Lembretes</h3>
    <div class="grid-buttons">
      <button class="btn" data-act="enableNotif" ${notif !== 'default' ? 'disabled' : ''}>${notif === 'granted' ? '🔔 Notificações ativas' : notif === 'denied' ? 'Notificações bloqueadas' : '🔔 Ativar notificações'}</button>
      <button class="btn" data-act="exportIcs">📅 Validades para o calendário</button>
    </div>
    <p class="muted small">As notificações aparecem quando abre a app. Para lembretes mesmo com a app fechada, exporte as validades para o calendário do telemóvel.</p>
  </section>
  <section class="card form">
    <h3>Chat dos grupos</h3>
    <label for="relays">Relays Nostr (um por linha; vazio = predefinidos)</label>
    <textarea id="relays" rows="3" data-change="relays" placeholder="${DEFAULT_RELAYS.join('\n')}">${esc((S.settings.relays || []).join('\n'))}</textarea>
    <p class="muted small">Pode usar um relay próprio ou da sua organização. Os relays só recebem mensagens cifradas.</p>
  </section>
  <section class="card">
    <h3>Cópia de segurança</h3>
    <div class="grid-buttons">
      <button class="btn" data-act="exportBackup">⬇️ Exportar tudo</button>
      <button class="btn" data-act="import">⬆️ Importar ficheiro</button>
    </div>
  </section>
  <section class="card">
    <h3>Privacidade (RGPD)</h3>
    <ul class="plain">
      <li>Todos os dados ficam <strong>apenas neste dispositivo</strong>. Não há contas nem servidor.</li>
      <li>A partilha de um grupo exporta só esse grupo, cifrado com palavra-passe (AES-256).</li>
      <li>Dados de saúde de membros só são guardados com consentimento explícito registado.</li>
      <li>Pode apagar tudo a qualquer momento (direito ao apagamento).</li>
    </ul>
    <button class="btn danger" data-act="wipe">🗑️ Apagar todos os dados</button>
  </section>`;
}

// ---------- Chat do grupo (Nostr com internet, bitchat sem internet) ----------
let session = null; // GroupChat ativo
const myPub = () => (S.nostr?.pk || '');

async function ensureIdentity() {
  await loadNostr();
  if (!S.nostr) { const sk = newIdentity(); S.nostr = { sk, pk: pubkeyOf(sk) }; save(); }
}

function syncChat(r) {
  const g = r === 'chat' ? findGroup(ui.chatGroup) : null;
  if (!g?.chat) { if (session) { session.close(); session = null; } return; }
  if (session && session.cfg === g.chat) { if (navigator.onLine && !session.connected) session.connect(); return renderChatLog(); }
  if (session) session.close();
  session = null;
  ensureIdentity().then(() => {
    if (route() !== 'chat' || findGroup(ui.chatGroup) !== g || session) return;
    session = new GroupChat({
      cfg: g.chat, sk: S.nostr.sk, relays: S.settings.relays?.length ? S.settings.relays : DEFAULT_RELAYS,
      onMessage: m => addMsg(g.id, m),
      onAck: id => {
        const m = (S.chat?.[g.id] || []).find(x => x.id === id);
        if (m && m.status !== 'sent') { m.status = 'sent'; delete m.ev; save(); renderChatLog(); }
      },
      onStatus: renderChatLog,
    });
    session.flush = () => (S.chat?.[g.id] || []).filter(m => m.status === 'pending' && m.ev).forEach(m => session.publish(m.ev));
    session.connect();
    renderChatLog();
  }).catch(() => toast('Não foi possível carregar o módulo de chat.'));
}

function addMsg(gid, m) {
  S.chat ||= {};
  const list = (S.chat[gid] ||= []);
  const old = list.find(x => x.id === m.id);
  if (old) { if (m.status === 'sent' && old.status !== 'sent') { old.status = 'sent'; delete old.ev; } }
  else { list.push(m); list.sort((a, b) => a.ts - b.ts); if (list.length > 500) list.splice(0, list.length - 500); }
  save();
  renderChatLog();
}

function renderChatLog() {
  const log = $('#chatlog');
  if (!log) return;
  const msgs = S.chat?.[ui.chatGroup] || [];
  const me = myPub();
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const t = ts => new Date(ts).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  log.innerHTML = msgs.length ? msgs.map(m => `
    <li class="msg ${m.pk === me ? 'me' : ''}"><div class="bubble">
      ${m.pk === me ? '' : `<b>${esc(m.name || 'Sem nome')}</b>`}
      <p>${esc(m.text)}</p>
      <time>${t(m.ts)}${m.pk === me ? (m.status === 'pending' ? ' · por enviar' : ' · enviada') : ''}</time>
    </div></li>`).join('') : '<li class="empty">Ainda não há mensagens. Escreva a primeira.</li>';
  if (atBottom || !log.dataset.ready) { log.scrollTop = log.scrollHeight; log.dataset.ready = 1; }
  const st = $('#chat-status');
  if (st) {
    const n = session?.connected || 0;
    st.className = 'badge ' + (n ? 'good' : navigator.onLine ? 'warn' : 'bad');
    st.textContent = n ? `Online · ${n} relay${n > 1 ? 's' : ''}` : navigator.onLine ? 'A ligar…' : 'Sem internet';
  }
}

async function sendChat(form) {
  const input = form.elements.text;
  const text = input.value.trim();
  if (!text) return;
  if (!S.settings.myName) return askName(() => sendChat(form));
  const g = findGroup(form.dataset.chat);
  if (!session) return toast('O chat ainda está a carregar. Tente de novo.');
  const ev = await session.build(S.settings.myName, text);
  input.value = '';
  addMsg(g.id, { id: ev.id, pk: ev.pubkey, name: S.settings.myName, text, ts: Date.now(), status: 'pending', ev });
  session.publish(ev);
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
  const nicks = (g.members || []).filter(m => m.bitchat);
  return `<details class="card bitchat ${offline ? 'urgent' : ''}" ${offline ? 'open' : ''}>
    <summary>${icon('bt')}<span><strong>${offline ? 'Sem internet: continue pelo bitchat' : 'Sem internet? Use o bitchat'}</strong>
      <span class="muted small">Mensagens por Bluetooth, de telemóvel em telemóvel</span></span></summary>
    <ol class="steps">
      <li>Todos no grupo instalam o bitchat <strong>antes</strong> de uma emergência
        (<a href="https://github.com/permissionlesstech/bitchat" target="_blank" rel="noopener">iPhone</a> ·
        <a href="https://github.com/permissionlesstech/bitchat-android" target="_blank" rel="noopener">Android</a>).</li>
      <li>Toque em <strong>Enviar pelo bitchat</strong>, escolha o bitchat na partilha e depois o destino.
        Se não escrever nada, segue "estou bem" com o ponto de encontro e o GPS.</li>
    </ol>
    <div class="grid-buttons">
      <button class="btn primary" data-act="shareBitchat" data-id="${g.id}">${icon('share')} Enviar pelo bitchat</button>
      <a class="btn" href="bitchat://">${icon('bt')} Abrir bitchat</a>
    </div>
    <p class="note">O canal <strong>#mesh</strong> é público: qualquer pessoa por perto lê. Para assuntos privados, envie <strong>mensagem privada</strong> a cada membro.</p>
    ${nicks.length ? `<p class="muted small">Nomes no bitchat: ${nicks.map(m => `<strong>${esc(m.name)}</strong> → <span class="mono">${esc(m.bitchat)}</span>`).join(' · ')}</p>`
      : '<p class="muted small">Dica: em Grupos, registe o nome de cada pessoa no bitchat para as encontrar depressa.</p>'}
  </details>`;
}

function viewChat() {
  const g = findGroup(ui.chatGroup);
  if (!g) return '<p class="empty">Grupo não encontrado. <a href="#/grupos">Voltar aos grupos</a></p>';
  if (!g.chat) return `
    <section class="card">
      <h3>Chat do grupo ${esc(g.name)}</h3>
      <ul class="plain">
        <li>Com internet, as mensagens passam por relays públicos <strong>Nostr</strong>, cifradas com uma chave só deste grupo. Não há servidor da eKit nem contas.</li>
        <li>Os relays guardam o texto cifrado. Não conseguem ler o conteúdo, mas veem um identificador aleatório deste dispositivo e a hora.</li>
        <li>A chave vai dentro do ficheiro cifrado de <strong>Partilhar</strong> grupo. Depois de ativar, partilhe o grupo de novo com os membros.</li>
        <li>Sem internet, a app ajuda a continuar pelo <strong>bitchat</strong> (Bluetooth).</li>
      </ul>
      <button class="btn primary" data-act="enableChat" data-id="${g.id}">Ativar chat</button>
    </section>`;
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
    <p class="muted small">A escrever como <strong>${esc(S.settings.myName || '—')}</strong> · <button class="linkbtn" data-act="setName">mudar nome</button> ·
      <button class="linkbtn" data-act="rotateChat" data-id="${g.id}">nova chave (retirar acesso)</button></p>
  </section>
  ${offline ? '' : bitchatCard(g, false)}`;
}

// ---------- Router e eventos ----------
// [título, ícone, ecrã, nível] — nível 1: barra principal; 0: dentro de "Mais"; 2: o próprio "Mais"
const ROUTES = {
  painel: ['Painel', 'home', viewDashboard, 1], kit: ['Kit', 'kit', viewKit, 1], mapa: ['Mapa', 'map', viewMap, 1],
  alertas: ['Alertas', 'alert', viewAlerts, 1],
  contactos: ['Contactos', 'phone', viewContacts, 0, 'Números de emergência e contactos pessoais'],
  grupos: ['Grupos', 'users', viewGroups, 0, 'Família, vizinhos, pontos de encontro'],
  listas: ['Listas', 'list', viewLists, 0, 'Evacuação, revisão do kit, listas próprias'],
  guia: ['Guia', 'book', viewGuide, 0, 'O que fazer em sismo, inundação, incêndio…'],
  definicoes: ['Definições', 'settings', viewSettings, 0, 'Agregado, lembretes, cópia de segurança, privacidade'],
  mais: ['Mais', 'more', viewMore, 2],
};
ROUTES.chat = ['Chat', 'chat', viewChat, -1];
const route = () => {
  const r = location.hash.slice(2);
  if (r.startsWith('chat/')) { ui.chatGroup = r.slice(5); return 'chat'; }
  return ROUTES[r] && r !== 'chat' ? r : 'painel';
};

function viewMore() {
  return `<section class="card"><ul class="list">${Object.entries(ROUTES).filter(([, v]) => v[3] === 0).map(([k, [t, ic, , , desc]]) => `
    <li class="row"><a class="row-link" href="#/${k}">${icon(ic)}<div class="row-main"><div class="row-title">${t}</div><div class="row-sub">${desc}</div></div><span class="chev" aria-hidden="true">›</span></a></li>`).join('')}
  </ul></section>`;
}

function render() {
  const r = route();
  const urgent = districtAlerts().filter(w => SEV[w.awarenessLevelID] >= 2).length;
  $('#nav').innerHTML = Object.entries(ROUTES).filter(([, v]) => v[3] >= 0).map(([k, [t, ic, , lvl]]) => {
    const current = k === r || (k === 'mais' && ROUTES[r][3] <= 0);
    const cls = ['', 'pri', 'more'][lvl] || 'sec';
    return `<a href="#/${k}" class="${cls}" ${current ? 'aria-current="page"' : ''}>${icon(ic)}<span>${t}</span>${k === 'alertas' && urgent ? `<b class="dot-count" aria-label="${urgent} avisos graves">${urgent}</b>` : ''}</a>`;
  }).join('');
  $('#title').textContent = r === 'chat' ? 'Chat · ' + (findGroup(ui.chatGroup)?.name || '') : ROUTES[r][0];
  if (map && r !== 'mapa') { map.remove(); map = null; ui.mapView = null; }
  const draft = $('.chat-form input')?.value;
  $('#main').innerHTML = ROUTES[r][2]();
  if (r === 'mapa') initMap();
  syncChat(r);
  if (draft) { const i = $('.chat-form input'); if (i) i.value = draft; }
  $('#net').hidden = navigator.onLine;
}

const findKit = id => S.kit.find(i => i.id === id);
const findGroup = id => S.groups.find(g => g.id === id);
const findList = id => S.lists.find(l => l.id === id);

const actions = {
  enableChat: d => {
    const g = findGroup(d.id);
    newChatConfig().then(cfg => {
      g.chat = cfg; save(); render();
      if (!S.settings.myName) askName();
      toast('Chat ativo. Partilhe o grupo de novo para os membros receberem a chave.');
    });
    return 'async';
  },
  rotateChat: d => {
    const g = findGroup(d.id);
    if (!confirm('Criar uma nova chave? Quem não receber o grupo partilhado de novo deixa de ler as mensagens novas.')) return 'async';
    newChatConfig().then(cfg => { g.chat = cfg; delete (S.chat || {})[g.id]; save(); render(); toast('Nova chave criada. Partilhe o grupo com os membros atuais.'); });
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
  editMember: d => { const g = findGroup(d.id); memberForm(g, g.members.find(m => m.id === d.mid)); },
  exportGroup: d => { const g = findGroup(d.id); exportPackage('group', g, `ekit-grupo-${g.name.replace(/\W+/g, '_')}.json`); },
  exportBackup: () => { const { alertsCache, pointsCache, nostr, chat, ...data } = S; exportPackage('backup', data, `ekit-backup-${new Date().toISOString().slice(0, 10)}.json`); },
  import: () => $('#file').click(),
  exportIcs,
  addList: () => openForm({ title: 'Nova lista', fields: [{ k: 'name', label: 'Nome', required: true }], onSave: v => { S.lists.push({ id: uid(), name: v.name, items: [] }); } }),
  editList: d => { const l = findList(d.id); openForm({ title: 'Editar lista', values: l, fields: [{ k: 'name', label: 'Nome', required: true }], onSave: v => { l.name = v.name; }, onDelete: () => { S.lists = S.lists.filter(x => x !== l); } }); },
  resetList: d => { findList(d.id).items.forEach(i => { i.done = false; }); },
  toggleListItem: d => { const i = findList(d.id).items.find(x => x.id === d.iid); i.done = !i.done; },
  delListItem: d => { const l = findList(d.id); l.items = l.items.filter(x => x.id !== d.iid); },
  fetchAlerts: () => { fetchAlerts(); return 'async'; },
  locate: () => { ui.recenter = true; locate(); return 'async'; },
  refreshLisboa: () => { refreshLisboa(); return 'async'; },
  copy: d => { navigator.clipboard?.writeText(d.v).then(() => toast('Copiado: ' + d.v), () => toast(d.v)); return 'async'; },
  enableNotif: async () => { await Notification.requestPermission(); render(); checkExpiryNotification(); return 'async'; },
  wipe: () => {
    if (!confirm('Apagar TODOS os dados deste dispositivo? Esta ação não pode ser desfeita.')) return 'async';
    localStorage.removeItem(KEY); S = seed(); save(); toast('Dados apagados.');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (el.tagName === 'A' && el.dataset.act !== 'kitFilter') e.preventDefault();
  const r = actions[el.dataset.act](el.dataset);
  if (r !== 'async' && !$('#dlg').open) { save(); render(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.change;
  if (!k) return;
  if (k === 'relays') S.settings.relays = e.target.value.split(/\s+/).filter(u => /^wss?:\/\/\S+$/.test(u));
  else if (k === 'district') S.settings.district = e.target.value;
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
$('#file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { render(); fetchAlerts(); });
window.addEventListener('offline', render);

// ---------- Arranque ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
// Primeira utilização: 3 perguntas para o kit fazer sentido desde o início.
function onboarding() {
  S.settings.onboarded = true; save();
  openForm({
    title: 'Bem-vindo à eKit',
    submitLabel: 'Começar',
    values: { household: S.settings.household, district: S.settings.district, makeGroup: true },
    fields: [
      { type: 'info', html: 'Três perguntas rápidas para ajustar o kit à sua casa. Tudo fica guardado só neste dispositivo.' },
      { k: 'household', label: 'Quantas pessoas vivem em casa?', type: 'number' },
      { k: 'district', label: 'Distrito ou região (para os avisos)', type: 'select', options: Object.entries(IPMA_AREAS) },
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
checkExpiryNotification();
if (navigator.onLine && (!S.alertsCache || Date.now() - S.alertsCache.at > 30 * 60e3)) fetchAlerts();
