// render.mjs — sezione Render: legge render.yaml, converte le foto in WebP, le cifra e le scrive in docs/r/.
// Il repo è pubblico: le foto escono solo cifrate (AES-256-GCM). La chiave sta in .env (RENDER_KEY)
// e arriva al browser soltanto dentro index.html, che staticrypt cifra con la password del sito.
// Gli originali in casa-3d si leggono e basta: niente viene spostato o riscritto.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

const LATO_MAX = 2000;   // px sul lato lungo: nitide a schermo intero, leggere da scaricare
const QUALITA = 82;
const CWEBP = trovaCwebp();
// Entra nel nome dei file cifrati: se cambia formato o qualità, le foto si rigenerano da sole.
const FORMATO = `${CWEBP ? 'webp' : 'jpeg'}-${LATO_MAX}-q${QUALITA}`;

export function buildRender({ root, dist }) {
  const configFile = path.join(root, 'render.yaml');
  if (!fs.existsSync(configFile)) {
    console.warn('⚠️  render.yaml non trovato: sezione Render nascosta');
    return null;
  }
  const config = yaml.load(fs.readFileSync(configFile, 'utf8')) || {};
  const sorgente = espandi(config.sorgente || '~/Projects/casa-3d/render');
  const key = chiave(path.join(root, '.env'));
  const outDir = path.join(dist, 'r');
  fs.mkdirSync(outDir, { recursive: true });

  // Cache: da quale originale viene ogni file cifrato. Serve a non riconvertire a ogni build
  // e a ripubblicare le foto già fatte anche da un Mac dove casa-3d non c'è.
  const cacheFile = path.join(root, '.render-cache.json');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const nuovaCache = {};
  const usati = new Set();
  let nuove = 0;

  const temi = (config.temi || []).map(t => {
    if (!t.id || !/^[a-z0-9-]+$/.test(t.id)) throw new Error(`render.yaml: id tema non valido "${t.id}" (solo minuscole, cifre, trattini)`);
    const foto = (t.foto || []).map(f => {
      const voce = preparaFoto(f.img);
      if (!voce) return null;
      nuovaCache[f.img] = voce;
      usati.add(voce.file);
      const colore = [f.colore, f.codice].find(c => /^#[0-9a-f]{6}$/i.test(c || '')) || '';
      return {
        src: 'r/' + voce.file, mime: voce.mime, w: voce.w, h: voce.h,
        nome: f.nome || '', codice: f.codice ? String(f.codice) : '', colore,
        nota: (f.nota || '').trim(), data: dataDaCartella(f.img),
      };
    }).filter(Boolean);
    return { id: t.id, titolo: t.titolo || t.id, ambiente: t.ambiente || '', nota: (t.nota || '').trim(), foto };
  }).filter(t => t.foto.length);

  function preparaFoto(img) {
    const src = path.resolve(sorgente, espandi(img));
    const vecchia = cache[img];
    if (!fs.existsSync(src)) {
      if (vecchia && fs.existsSync(path.join(outDir, vecchia.file))) {
        console.warn(`⚠️  ${img}: originale non trovato, resta la copia già pubblicata`);
        return vecchia;
      }
      console.warn(`⚠️  ${img}: originale non trovato, foto saltata`);
      return null;
    }
    const sha = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
    const file = crypto.createHmac('sha256', key).update(sha + '|' + FORMATO).digest('hex').slice(0, 24) + '.bin';
    const out = path.join(outDir, file);
    if (vecchia && vecchia.file === file && fs.existsSync(out)) return vecchia;
    const conv = converti(src);
    // IV derivato dal contenuto: stessa foto → stesso file, quindi git non vede modifiche a ogni build
    const iv = crypto.createHmac('sha256', key).update('iv|').update(conv.dati).digest().subarray(0, 12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    fs.writeFileSync(out, Buffer.concat([iv, cipher.update(conv.dati), cipher.final(), cipher.getAuthTag()]));
    nuove++;
    return { file, mime: conv.mime, w: conv.w, h: conv.h };
  }

  // Le foto tolte dai temi spariscono dal sito (gli originali restano in casa-3d)
  let rimosse = 0;
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.bin') && !usati.has(f)) { fs.unlinkSync(path.join(outDir, f)); rimosse++; }
  }
  fs.writeFileSync(cacheFile, JSON.stringify(nuovaCache, null, 1));

  const nFoto = temi.reduce((s, t) => s + t.foto.length, 0);
  console.log(`✓ Render: ${temi.length} temi, ${nFoto} foto (${nuove} nuove, ${rimosse} tolte)${CWEBP ? '' : ' — cwebp assente, uso JPEG'}`);
  segnalaProveFuori(sorgente, config.temi || []);

  return { key: key.toString('base64'), temi };
}

function converti(src) {
  const { w, h } = dimensioni(src);
  const scala = Math.min(1, LATO_MAX / Math.max(w, h));
  const W = Math.round(w * scala), H = Math.round(h * scala);
  const tmp = path.join(os.tmpdir(), `casa-render-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  try {
    if (CWEBP) {
      const args = ['-quiet', '-q', String(QUALITA), '-m', '6', '-metadata', 'none'];
      if (scala < 1) args.push('-resize', String(W), String(H));
      execFileSync(CWEBP, [...args, src, '-o', tmp]);
      return { dati: fs.readFileSync(tmp), mime: 'image/webp', w: W, h: H };
    }
    const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITA)];
    if (scala < 1) args.push('-Z', String(LATO_MAX));
    execFileSync('sips', [...args, src, '--out', tmp], { stdio: 'ignore' });
    return { dati: fs.readFileSync(tmp), mime: 'image/jpeg', w: W, h: H };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function dimensioni(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  const w = Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1]);
  const h = Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  if (!w || !h) throw new Error(`Dimensioni non leggibili: ${file}`);
  return { w, h };
}

function chiave(envFile) {
  const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const m = env.match(/^RENDER_KEY=(\S+)\s*$/m);
  if (m) {
    const k = Buffer.from(m[1], 'base64');
    if (k.length !== 32) throw new Error('RENDER_KEY in .env non valida: servono 32 byte in base64');
    return k;
  }
  const k = crypto.randomBytes(32);
  fs.appendFileSync(envFile, (env && !env.endsWith('\n') ? '\n' : '') + 'RENDER_KEY=' + k.toString('base64') + '\n');
  console.log('🔑 RENDER_KEY generata e salvata in .env (non cambiarla: le foto già pubblicate usano questa)');
  return k;
}

function trovaCwebp() {
  try { return execFileSync('which', ['cwebp'], { encoding: 'utf8' }).trim() || null; } catch {}
  return ['/opt/homebrew/bin/cwebp', '/usr/local/bin/cwebp'].find(p => fs.existsSync(p)) || null;
}

const espandi = p => String(p).replace(/^~(?=$|\/)/, os.homedir());

// "cucina/2026-09-15_163014_ral-8007/dal_pranzo.png" → "2026-09-15T16:30"
function dataDaCartella(img) {
  const m = String(img).match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})\d{2}/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : null;
}

// Promemoria per chi cura i temi: le prove più recenti che non sono ancora in nessun tema.
function segnalaProveFuori(sorgente, temi) {
  if (!fs.existsSync(sorgente)) return;
  const usate = new Set(temi.flatMap(t => (t.foto || []).map(f => path.dirname(String(f.img)))));
  const fuori = [];
  for (const sez of fs.readdirSync(sorgente, { withFileTypes: true })) {
    if (!sez.isDirectory()) continue;
    for (const d of fs.readdirSync(path.join(sorgente, sez.name), { withFileTypes: true })) {
      if (d.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{6}_/.test(d.name) && !usate.has(sez.name + '/' + d.name)) {
        fuori.push(sez.name + '/' + d.name);
      }
    }
  }
  if (!fuori.length) return;
  fuori.sort((a, b) => b.split('/')[1].localeCompare(a.split('/')[1]));
  console.log(`  ${fuori.length} prove non ancora in un tema, le più recenti: ${fuori.slice(0, 4).join(', ')}`);
}
