// Copia os ficheiros da app (os mesmos do site) para www/, que o Capacitor empacota na app iOS.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const FILES = [
  'index.html', 'styles.css', 'app.js', 'chat.js', 'data.js', 'pontos-encontro.json',
  'manifest.webmanifest', 'icon.svg', 'icons', 'vendor', 'privacidade.html',
];

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of FILES) cpSync(f, `www/${f}`, { recursive: true });
console.log(`www/ pronto (${FILES.length} entradas). O service worker (sw.js) fica de fora: na app os ficheiros já vêm no pacote.`);
