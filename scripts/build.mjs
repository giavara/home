// build.mjs — legge dati dal vault Obsidian e genera dist/index.html

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import MarkdownIt from 'markdown-it';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOME = path.resolve(ROOT, '..');           // projects/home/
const LAV_DIR = path.join(HOME, 'lavorazioni');
const CRONO_FILE = path.join(HOME, 'context', 'cronoprogramma.md');
const STATUS_FILE = path.join(ROOT, 'site-status.yaml');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'docs');

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

const status = yaml.load(fs.readFileSync(STATUS_FILE, 'utf8'));

function parseLavorazione(id) {
  const file = path.join(LAV_DIR, `${id}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');

  const titoloMatch = raw.match(/^#\s+(.+?)\s*$/m);
  const titolo = titoloMatch ? titoloMatch[1].trim() : id;

  // Estrai budget dalla riga "| Budget ... | €X |"
  const budgetMatch = raw.match(/\|\s*Budget[^|]*\|\s*\*?\*?€\s*([\d.,]+)/i);
  let budget = null;
  if (budgetMatch) {
    const num = budgetMatch[1].replace(/[.,](?=\d{3})/g, '').replace(',', '.');
    budget = parseInt(num.replace(/\..*/, ''));
  }

  // Descrizione: primo paragrafo dopo "## Descrizione"
  let descrizione = '';
  const descMatch = raw.match(/##\s+Descrizione\s*\n+([^\n#][^\n]*(?:\n[^\n#][^\n]*)*)/);
  if (descMatch) descrizione = descMatch[1].trim().split(/\n\n/)[0];

  // Conta checkbox totali e completate
  const allTasks = raw.match(/^\s*-\s*\[[ xX]\]/gm) || [];
  const doneTasks = raw.match(/^\s*-\s*\[[xX]\]/gm) || [];
  const tasksTot = allTasks.length;
  const tasksDone = doneTasks.length;

  return { titolo, budget, descrizione, tasksTot, tasksDone };
}

function parseCronoFase(faseId) {
  if (!fs.existsSync(CRONO_FILE)) return null;
  const raw = fs.readFileSync(CRONO_FILE, 'utf8');
  const rx = new RegExp(`##\\s+FASE\\s+${faseId}\\s*[—-]([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const m = raw.match(rx);
  if (!m) return null;
  // Estrai prima riga "**Focus**: ..." e ripulisci il markdown
  const focusMatch = m[1].match(/\*\*Focus\*\*:\s*([^\n]+)/);
  const focus = focusMatch
    ? focusMatch[1].replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim()
    : '';
  return { focus };
}

const lavorazioni = status.lavorazioni.map(item => {
  const parsed = parseLavorazione(item.id);
  return {
    id: item.id,
    titolo: item.titolo || (parsed?.titolo) || item.id,
    budget: item.budget !== undefined ? item.budget : parsed?.budget ?? null,
    descrizione: item.descrizione || parsed?.descrizione || '',
    fase: item.fase ?? null,
    stato: item.stato || 'pianificato',
    avanzamento: item.avanzamento ?? 0,
    nota: item.nota || '',
    tasksTot: parsed?.tasksTot ?? 0,
    tasksDone: parsed?.tasksDone ?? 0,
  };
});

const fasi = status.fasi.map(f => {
  const crono = parseCronoFase(f.id);
  return {
    ...f,
    focus: f.focus || crono?.focus || '',
  };
});

// Ordina lavorazioni per fase
lavorazioni.sort((a, b) => (a.fase ?? 99) - (b.fase ?? 99));

const data = {
  ultimoAggiornamento: status['ultimo-aggiornamento'],
  fasi,
  lavorazioni,
};

// Carica template e inline CSS + JS
const template = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');

const html = template
  .replace('/*__INLINE_CSS__*/', css)
  .replace('/*__INLINE_JS__*/', js)
  .replace('"__APP_DATA__"', JSON.stringify(data));

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);

console.log(`Build OK → docs/index.html (${(html.length/1024).toFixed(1)} KB)`);
console.log(`  ${fasi.length} fasi, ${lavorazioni.length} lavorazioni`);
console.log(`  ultimo aggiornamento: ${data.ultimoAggiornamento}`);
