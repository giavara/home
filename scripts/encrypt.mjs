// encrypt.mjs — cifra dist/index.html con staticrypt usando SITE_PASSWORD da .env

import 'dotenv/config';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TARGET = path.join(DIST, 'index.html');

const password = process.env.SITE_PASSWORD;
if (!password) {
  console.error('ERRORE: SITE_PASSWORD non impostata in .env');
  process.exit(1);
}

if (!fs.existsSync(TARGET)) {
  console.error('ERRORE: dist/index.html non esiste. Esegui prima: npm run build');
  process.exit(1);
}

// staticrypt cifra il file in-place (sostituisce dist/index.html)
// --short: meno UI extra
// --remember 0: niente "remember me"
// -d DIST: directory output
// --template-button "Accedi" e altri custom: localizzazione italiana
console.log('Cifrando dist/index.html con staticrypt...');

try {
  execSync(
    [
      'npx', 'staticrypt',
      `"${TARGET}"`,
      '--password', `"${password}"`,
      '-d', `"${DIST}"`,
      '--short',
      '--remember', '0',
      '--template-title', '"Casa Borgo Veneto"',
      '--template-instructions', '"Inserisci la password per vedere il piano lavori."',
      '--template-button', '"Entra"',
      '--template-color-primary', '"#7a5a3f"',
      '--template-color-secondary', '"#f5efe6"',
    ].join(' '),
    { stdio: 'inherit', cwd: ROOT }
  );
  console.log('Cifratura OK');
} catch (e) {
  console.error('Cifratura fallita:', e.message);
  process.exit(1);
}
