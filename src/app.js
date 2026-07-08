(function () {
  if (typeof APP_DATA === 'string') {
    console.error('APP_DATA non sostituito dal build');
    return;
  }
  const D = APP_DATA;
  const $ = (sel) => document.querySelector(sel);

  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const MESI_FULL = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function dataLunga(s) {
    const d = parseISO(s);
    return d.getDate() + ' ' + MESI_FULL[d.getMonth()] + ' ' + d.getFullYear();
  }
  function dataBreve(s) {
    const d = parseISO(s);
    return d.getDate() + ' ' + MESI[d.getMonth()];
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // escape + **grassetto** → <strong>
  function fmt(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  const STATO_LABEL = {
    critico: 'Urgente', 'in-corso': 'In corso', 'in-attesa': 'In attesa',
    pianificato: 'Pianificato', fatto: 'Fatto', futuro: 'Più avanti',
  };

  // ── Header ──────────────────────────────────────────
  $('#last-update').textContent = 'Aggiornato al ' + dataLunga(D.aggiornamento);

  // ── Stats ───────────────────────────────────────────
  $('#stats').innerHTML = [
    { v: D.stats.fatte, l: 'cose fatte' },
    { v: D.stats.daFare, l: 'da fare' },
    { v: D.stats.inAttesa, l: 'in attesa di altri' },
  ].map(s => '<div class="stat"><div class="value">' + s.v + '</div><div class="label">' + s.l + '</div></div>').join('');

  if (D.notaIngresso) $('#nota-ingresso').textContent = D.notaIngresso;

  // ── Agenda ──────────────────────────────────────────
  $('#agenda-list').innerHTML = D.appuntamenti.map(a => {
    const d = parseISO(a.data);
    const past = d < oggi;
    return '<li' + (past ? ' class="agenda-past"' : '') + '>' +
      '<div class="agenda-date"><div class="day">' + d.getDate() + '</div><div class="month">' + MESI[d.getMonth()] + '</div></div>' +
      '<div class="agenda-text">' + fmt(a.testo) + '</div></li>';
  }).join('');

  // ── Roadmap ─────────────────────────────────────────
  $('#fasi').innerHTML = D.fasi.map(f => {
    const inCorso = f.stato === 'in-corso';
    return '<li class="fase ' + esc(f.stato) + '">' +
      '<span class="fase-dot"></span>' +
      '<div class="fase-quando">' + esc(f.nome) + '</div>' +
      '<div class="fase-titolo">' + esc(f.titolo) + '</div>' +
      '<div class="fase-desc">' + fmt(f.descrizione || '') + '</div>' +
      (inCorso ? '<span class="fase-tag">Siamo qui</span>' : '') +
      '</li>';
  }).join('');

  // ── Card ────────────────────────────────────────────
  function renderTask(t) {
    const cls = t.done ? 't-done' : (t.waiting ? 't-wait' : '');
    let flags = '';
    if (!t.done && t.waiting) flags += '<span class="flag wait">in attesa</span>';
    if (!t.done && t.prio === 'critica') flags += '<span class="flag prio">priorità</span>';
    if (!t.done && t.due) {
      const overdue = parseISO(t.due) < oggi;
      flags += '<span class="flag ' + (overdue ? 'overdue' : 'due') + '">entro il ' + dataBreve(t.due) + '</span>';
    }
    if (t.done && t.doneDate) flags += '<span class="flag due">' + dataBreve(t.doneDate) + '</span>';
    return '<li class="' + cls + '">' +
      '<span class="tbox">' + (t.done ? '✓' : (t.waiting ? '⏳' : '')) + '</span>' +
      '<span class="ttext">' + fmt(t.text) + (flags ? '<span class="tflags">' + flags + '</span>' : '') + '</span>' +
      '</li>';
  }

  function renderCard(c) {
    const pct = c.tot ? Math.round(100 * c.done / c.tot) : 0;
    const aperti = c.tasks.filter(t => !t.done);
    const chiusi = c.tasks.filter(t => t.done);
    const faseNome = (D.fasi.find(f => f.id === c.fase) || {}).nome || '';

    let body = '';
    if (c.sintesi) body += '<p class="card-sintesi">' + fmt(c.sintesi) + '</p>';
    if (aperti.length) body += '<h4>Da fare</h4><ul class="tlist">' + aperti.map(renderTask).join('') + '</ul>';
    if (c.decisioni.length) body += '<h4>Decisioni aperte</h4><ul class="dlist">' + c.decisioni.map(d => '<li>' + fmt(d) + '</li>').join('') + '</ul>';
    if (c.materiali.length) body += '<h4>Materiale da procurare</h4><ul class="mlist">' + c.materiali.map(m => '<li>' + fmt(m) + '</li>').join('') + '</ul>';
    if (chiusi.length) body += '<h4>' + (c.stato === 'fatto' ? 'Tappe chiuse' : 'Già fatto') + '</h4><ul class="tlist">' + chiusi.map(renderTask).join('') + '</ul>';

    return '<details class="card s-' + esc(c.stato) + '" data-stato="' + esc(c.stato) + '">' +
      '<summary class="card-head">' +
      '<span class="card-emoji">' + c.emoji + '</span>' +
      '<span class="card-title">' + esc(c.titolo) + '</span>' +
      '<span class="card-meta"><span class="badge ' + esc(c.stato) + '">' + STATO_LABEL[c.stato] + '</span>' +
      (faseNome ? '<span>' + esc(faseNome) + '</span>' : '') + '</span>' +
      '<span class="chev">▼</span>' +
      '<span class="card-bar"><span class="meter"><span style="width:' + pct + '%"></span></span>' +
      '<span class="count">' + c.done + '/' + c.tot + '</span></span>' +
      '</summary>' +
      '<div class="card-body">' + body + '</div>' +
      '</details>';
  }

  $('#cards').innerHTML = D.cards.map(renderCard).join('');

  // ── Filtri ──────────────────────────────────────────
  const chips = document.querySelectorAll('#filters .chip');
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const v = chip.dataset.value;
    document.querySelectorAll('#cards .card').forEach(card => {
      const st = card.dataset.stato;
      const show = v === 'all' || st === v || (v === 'in-corso' && st === 'critico');
      card.classList.toggle('hidden', !show);
    });
  }));

  // ── Apri/chiudi tutto ───────────────────────────────
  const toggleBtn = $('#toggle-all');
  let allOpen = false;
  toggleBtn.addEventListener('click', () => {
    allOpen = !allOpen;
    document.querySelectorAll('#cards .card:not(.hidden)').forEach(c => { c.open = allOpen; });
    toggleBtn.textContent = allOpen ? 'Chiudi tutto' : 'Apri tutto';
  });
})();
