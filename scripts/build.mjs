// build.mjs — legge site-data.yaml + ../tasks.md e genera docs/index.html
// I task NON vanno duplicati nello yaml: la fonte di verità è tasks.md del vault.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOME = path.resolve(ROOT, '..');           // projects/home/
const TASKS_FILE = path.join(HOME, 'tasks.md');
const DATA_FILE = path.join(ROOT, 'site-data.yaml');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'docs');

const data = yaml.load(fs.readFileSync(DATA_FILE, 'utf8'));
const tasksRaw = fs.readFileSync(TASKS_FILE, 'utf8');

// ── Parser tasks.md ─────────────────────────────────────────
// Sezioni: "## <emoji> Titolo — suffisso". Task: "- [ ] testo 📅 data 🔺 #tag".
function parseSections(raw) {
  const sections = [];
  const parts = raw.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const [headingLine, ...rest] = part.split('\n');
    const heading = headingLine.trim();
    const tasks = [];
    for (const line of rest) {
      const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.*\S)\s*$/);
      if (!m) continue;
      const done = m[1] !== ' ';
      let text = m[2];
      const due = (text.match(/📅\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
      const doneDate = (text.match(/✅\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
      const prio = text.includes('🔺') ? 'critica'
                 : text.includes('⏫') ? 'alta'
                 : text.includes('🔽') ? 'bassa' : null;
      const waiting = /#aspetto\b/.test(text) || /^\*?\*?Aspetto:/i.test(text);
      text = text
        .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
        .replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '')
        .replace(/🔁[^#]*/g, '')
        .replace(/[🔺⏫🔽]/g, '')
        .replace(/#[\w-]+/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // link md → solo testo
        .replace(/^(\*\*)?Aspetto:\s*/i, '$1')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim()
        .replace(/[—\-–]\s*$/, '')
        .trim();
      tasks.push({ text, done, due, doneDate, prio, waiting });
    }
    sections.push({ heading, tasks });
  }
  return sections;
}

const sections = parseSections(tasksRaw);

function findSection(match) {
  const hit = sections.find(s => s.heading.toLowerCase().includes(match.toLowerCase()));
  if (!hit) console.warn(`⚠️  Sezione non trovata in tasks.md: "${match}"`);
  return hit || { heading: match, tasks: [] };
}

// ── Componi card ────────────────────────────────────────────
const cards = data.cards.map(c => {
  const matches = Array.isArray(c.sezione) ? c.sezione : [c.sezione];
  const tasks = matches.flatMap(m => findSection(m).tasks);
  const tot = tasks.length;
  const done = tasks.filter(t => t.done).length;
  return {
    id: c.id,
    emoji: c.emoji,
    titolo: c.titolo,
    stato: c.stato,
    fase: c.fase,
    sintesi: (c.sintesi || '').trim(),
    budget: c.budget ?? null,
    budgetNota: (c['budget-nota'] || '').trim(),
    decisioni: c.decisioni || [],
    materiali: c.materiali || [],
    tasks, tot, done,
  };
});

// ── Statistiche globali (escluse card "futuro") ─────────────
const attive = cards.filter(c => c.stato !== 'futuro');
const allTasks = attive.flatMap(c => c.tasks);
const stats = {
  fatte: allTasks.filter(t => t.done).length,
  daFare: allTasks.filter(t => !t.done && !t.waiting).length,
  inAttesa: allTasks.filter(t => !t.done && t.waiting).length,
};

// js-yaml parsa le date non quotate come Date → riportale a "YYYY-MM-DD"
function toISO(v) {
  if (v instanceof Date) {
    const p = n => String(n).padStart(2, '0');
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }
  return String(v);
}

const APP_DATA = {
  aggiornamento: toISO(data['ultimo-aggiornamento']),
  notaIngresso: (data['nota-ingresso'] || '').trim(),
  budgetNota: (data['budget-nota'] || '').trim(),
  fasi: data.fasi || [],
  appuntamenti: (data.appuntamenti || []).map(a => ({ ...a, data: toISO(a.data) })),
  attese: (data.attese || []).map(a => ({ ...a, dal: toISO(a.dal) })),
  cards, stats,
};

// ── Render template ─────────────────────────────────────────
const template = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
const json = JSON.stringify(APP_DATA).replace(/</g, '\\u003c');

const html = template
  .replace('/*__INLINE_CSS__*/', () => css)
  .replace('"__APP_DATA__"', () => json)
  .replace('/*__INLINE_JS__*/', () => js);

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);

console.log(`✓ docs/index.html generato (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  ${cards.length} card, ${allTasks.length} task attive — ${stats.fatte} fatte, ${stats.daFare} da fare, ${stats.inAttesa} in attesa di altri`);
