// Línguas: o português é a base; o inglês traduz o que aparece no ecrã (dicionário + regras para
// frases com números). Assim os ecrãs não precisam de ser reescritos e nada muda em português.
import { EN, EN_RULES } from './i18n-en.js';

export let LANG = 'pt';
export const LOC = () => (LANG === 'en' ? 'en-GB' : 'pt-PT');

export function setLang(l) {
  LANG = l === 'en' ? 'en' : 'pt';
  document.documentElement.lang = LANG === 'en' ? 'en' : 'pt-PT';
}
// Língua automática: português se o telemóvel estiver em português; inglês nos outros casos.
export const autoLang = () => ((navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');

const rule = s => {
  for (const [re, f] of EN_RULES) {
    const m = s.match(re);
    if (m) return typeof f === 'function' ? f(...m) : s.replace(re, f);
  }
  return null;
};
const one = s => EN[s] ?? rule(s);

// Traduz um texto (devolve o mesmo texto se não houver tradução).
export function tr(t) {
  if (LANG !== 'en' || !t || typeof t !== 'string') return t;
  const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core = m[2];
  if (!core) return t;
  let out = one(core);
  if (out == null && core.includes(' · ')) {
    const parts = core.split(' · '), done = parts.map(p => one(p) ?? p);
    if (done.some((p, i) => p !== parts[i])) out = done.join(' · ');
  }
  return out == null || out === core ? t : m[1] + out + m[3];
}
// Usado pelas regras para traduzir a parte variável de uma frase.
export const trIn = s => (s == null ? s : one(s) ?? (s.includes(' · ') ? s.split(' · ').map(p => one(p) ?? p).join(' · ') : s));

const SKIP = '.bubble,script,style,textarea,[data-notr]';
const ATTRS = ['placeholder', 'aria-label', 'title'];
function textNode(n) {
  const p = n.parentElement;
  if (!p || p.closest(SKIP)) return;
  const v = tr(n.nodeValue);
  if (v !== n.nodeValue) n.nodeValue = v;
}
export function translateTree(root) {
  if (LANG !== 'en' || !root) return;
  if (root.nodeType === 3) return textNode(root);
  if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
  list.forEach(textNode);
  for (const e of [root, ...root.querySelectorAll('[placeholder],[aria-label],[title]')]) {
    for (const a of ATTRS) {
      const v = e.getAttribute(a);
      if (v) { const x = tr(v); if (x !== v) e.setAttribute(a, x); }
    }
  }
}
// Traduz tudo o que for aparecendo (páginas, janelas, avisos rápidos, mapa).
export function watchI18n() {
  new MutationObserver(ms => {
    if (LANG !== 'en') return;
    for (const m of ms) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') translateTree(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // Janelas do sistema (confirmar) também em inglês.
  const c = window.confirm.bind(window);
  window.confirm = msg => c(tr(msg));
}
