(function () {
  if (typeof APP_DATA === 'string') {
    console.error('APP_DATA non sostituito dal build');
    return;
  }
  const D = APP_DATA;

  // ── Helper ──────────────────────────────────────────
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const MESI_FULL = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dataLunga = s => { const d = parseISO(s); return d.getDate() + ' ' + MESI_FULL[d.getMonth()] + ' ' + d.getFullYear(); };
  const dataBreve = s => { const d = parseISO(s); return d.getDate() + ' ' + MESI[d.getMonth()]; };
  const dataGiorno = s => { const d = parseISO(s); return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()]; };

  const GIORNI_FULL = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  // tronca a fine parola, per le liste compatte
  function corto(s, max) {
    if (s.length <= max) return s;
    let cut = s.slice(0, max).replace(/\*\*[^*]*$/, '').replace(/\s+\S*$/, '');
    const bolds = (cut.match(/\*\*/g) || []).length;
    if (bolds % 2) cut += '**';
    return cut + '…';
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const STATO_LABEL = {
    critico: 'Urgente', 'in-corso': 'In corso', 'in-attesa': 'In attesa di altri',
    pianificato: 'Pianificato', fatto: 'Fatto', futuro: 'Più avanti',
  };
  const STATO_ORDER = ['critico', 'in-corso', 'in-attesa', 'pianificato', 'fatto', 'futuro'];

  const CHEV = '<span class="chev-r"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>';

  const faseDi = id => D.fasi.find(f => f.id === id) || null;
  const cardDi = id => D.cards.find(c => c.id === id) || null;

  // ── Blocchi riusabili ───────────────────────────────
  function pillsDi(t) {
    let out = '';
    if (!t.done && t.due) {
      const overdue = parseISO(t.due) < oggi;
      out += overdue
        ? '<span class="pill overdue">scaduto — era per ' + dataGiorno(t.due) + '</span>'
        : '<span class="pill due">entro ' + dataGiorno(t.due) + '</span>';
    }
    if (!t.done && t.prio === 'critica') out += '<span class="pill prio">priorità massima</span>';
    if (!t.done && t.prio === 'alta') out += '<span class="pill prio">alta priorità</span>';
    if (!t.done && t.waiting) out += '<span class="pill">in attesa di risposta</span>';
    if (t.done && t.doneDate) out += '<span class="pill donedate">fatto il ' + dataBreve(t.doneDate) + '</span>';
    return out;
  }

  function taskRow(t) {
    const cls = t.done ? 't-done' : (t.waiting ? 't-wait' : '');
    const pills = pillsDi(t);
    return '<li class="' + cls + '">' +
      '<span class="tbox">' + (t.done ? '✓' : (t.waiting ? '⏳' : '')) + '</span>' +
      '<div class="tmain"><div class="ttext">' + fmt(t.text) + '</div>' +
      (pills ? '<div class="tmeta">' + pills + '</div>' : '') +
      '</div></li>';
  }

  function cardRef(c) {
    return '<a class="cardref" href="#/lavoro/' + c.id + '">' + c.emoji + ' ' + esc(c.titolo) + '</a>';
  }

  function tile(c) {
    const pct = c.tot ? Math.round(100 * c.done / c.tot) : 0;
    const fase = faseDi(c.fase);
    return '<a class="tile g-' + esc(c.stato) + '" href="#/lavoro/' + c.id + '">' +
      '<span class="tile-emoji">' + c.emoji + '</span>' +
      '<div class="row-main"><div class="tile-title">' + esc(c.titolo) + '</div>' +
      '<div class="tile-meta">' +
      '<span class="tile-bar"><span style="width:' + pct + '%"></span></span>' +
      '<span class="tile-count">' + c.done + '/' + c.tot + '</span>' +
      (fase ? '<span class="tile-fase">· ' + esc(fase.nome) + '</span>' : '') +
      '</div></div>' + CHEV + '</a>';
  }

  function secHeader(label, n) {
    return '<h3 class="sec">' + label + (n !== undefined ? ' <span class="n">' + n + '</span>' : '') + '</h3>';
  }

  // ── Da non perdere (aggregato cross-card) ───────────
  function urgenti() {
    const rows = [];
    D.cards.forEach(c => {
      if (c.stato === 'futuro' || c.stato === 'fatto') return;
      c.tasks.forEach(t => {
        if (t.done) return;
        const due = t.due ? parseISO(t.due) : null;
        const overdue = !!due && due < oggi;
        const soon = !!due && !overdue && (due - oggi) / 86400000 <= 14;
        if (overdue || soon || (t.prio === 'critica' && !t.waiting && !due)) {
          rows.push({ t, c, due, overdue });
        }
      });
    });
    rows.sort((a, b) => (a.due ? a.due.getTime() : Infinity) - (b.due ? b.due.getTime() : Infinity));
    return rows.slice(0, 8);
  }

  // ── Schermate ───────────────────────────────────────
  function screenHome() {
    let h = '<div class="screen">';
    h += '<h1 class="screen-title">Il punto</h1>';
    h += '<p class="screen-sub">' + GIORNI_FULL[oggi.getDay()] + ' ' + oggi.getDate() + ' ' + MESI_FULL[oggi.getMonth()] + '</p>';

    h += '<div class="stats">' + [
      { v: D.stats.fatte, l: 'cose fatte' },
      { v: D.stats.daFare, l: 'da fare' },
      { v: D.stats.inAttesa, l: 'in attesa di altri' },
    ].map(s => '<div class="stat"><div class="value">' + s.v + '</div><div class="label">' + s.l + '</div></div>').join('') + '</div>';

    if (D.notaIngresso) h += '<p class="nota">' + fmt(D.notaIngresso) + '</p>';

    const urg = urgenti();
    if (urg.length) {
      h += secHeader('Da non perdere', urg.length);
      h += '<div class="panel rows">' + urg.map(r =>
        '<a class="tile" href="#/lavoro/' + r.c.id + '">' +
        (r.due
          ? '<div class="datebox' + (r.overdue ? ' overdue' : '') + '"><div class="day">' + r.due.getDate() + '</div><div class="month">' + MESI[r.due.getMonth()] + '</div></div>'
          : '<div class="datebox"><div class="day">!</div><div class="month">prio</div></div>') +
        '<div class="row-main"><div class="row-text">' + fmt(corto(r.t.text, 90)) + '</div>' +
        '<div class="row-sub">' + (r.overdue ? '<span class="overdue">scaduto</span>' : '') +
        '<span class="cardref">' + r.c.emoji + ' ' + esc(r.c.titolo) + '</span></div>' +
        '</div>' + CHEV + '</a>').join('') + '</div>';
    }

    h += secHeader('Prossimi appuntamenti', D.appuntamenti.length);
    h += '<div class="panel rows">' + D.appuntamenti.map(a => {
      const d = parseISO(a.data);
      const past = d < oggi;
      return '<div><div class="datebox' + (past ? ' past' : '') + '"><div class="day">' + d.getDate() + '</div><div class="month">' + MESI[d.getMonth()] + '</div></div>' +
        '<div class="row-main"><div class="row-text">' + fmt(a.testo) + '</div></div></div>';
    }).join('') + '</div>';

    h += '<p class="foot">Pagina privata di Andrea &amp; Priscilla — per domande chiedete ad Andrea.</p>';
    return h + '</div>';
  }

  function screenRoadmap() {
    let h = '<div class="screen">';
    h += '<h1 class="screen-title">La roadmap</h1>';
    h += '<p class="screen-sub">I lavori vanno in ordine: sporco prima di pulito, nascosto prima di visibile. Invertire vuol dire rifare.</p>';
    h += '<ol class="fasi">' + D.fasi.map(f => {
      const cardsFase = D.cards.filter(c => c.fase === f.id && c.stato !== 'fatto');
      return '<li class="fase ' + esc(f.stato) + '">' +
        '<span class="fase-dot"></span>' +
        '<div class="fase-quando">' + esc(f.nome) + '</div>' +
        '<div class="fase-titolo">' + esc(f.titolo) + '</div>' +
        (f.stato === 'in-corso' ? '<div><span class="fase-tag">Siamo qui</span></div>' : '') +
        '<div class="fase-desc">' + fmt(f.descrizione || '') + '</div>' +
        (cardsFase.length ? '<div class="fase-cards">' + cardsFase.map(c =>
          '<a href="#/lavoro/' + c.id + '">' + c.emoji + ' ' + esc(c.titolo) + '</a>').join('') + '</div>' : '') +
        '</li>';
    }).join('') + '</ol>';
    return h + '</div>';
  }

  function screenLavori() {
    let h = '<div class="screen">';
    h += '<h1 class="screen-title">I lavori</h1>';
    h += '<p class="screen-sub">Tocca un lavoro per aprire la sua pagina: cose da fare, decisioni e materiale.</p>';
    STATO_ORDER.forEach(st => {
      const group = D.cards.filter(c => c.stato === st);
      if (!group.length) return;
      h += secHeader(STATO_LABEL[st], group.length);
      h += '<div class="panel rows">' + group.map(tile).join('') + '</div>';
    });
    return h + '</div>';
  }

  function screenLavoro(id) {
    const c = cardDi(id);
    if (!c) { location.hash = '#/lavori'; return ''; }
    const pct = c.tot ? Math.round(100 * c.done / c.tot) : 0;
    const fase = faseDi(c.fase);
    const aperti = c.tasks.filter(t => !t.done);
    const chiusi = c.tasks.filter(t => t.done);

    let h = '<div class="screen">';
    h += '<div class="dhead"><span class="tile-emoji">' + c.emoji + '</span>' +
      '<div><div class="dhead-title">' + esc(c.titolo) + '</div>' +
      '<div class="dhead-meta"><span class="badge ' + esc(c.stato) + '">' + STATO_LABEL[c.stato] + '</span>' +
      (fase ? '<span>' + esc(fase.nome) + ' — ' + esc(fase.titolo) + '</span>' : '') +
      '</div></div></div>';

    h += '<div class="dprog' + (c.stato === 'fatto' ? ' done' : '') + '"><div class="bar"><span style="width:' + pct + '%"></span></div>' +
      '<span class="pct">' + c.done + ' su ' + c.tot + ' · ' + pct + '%</span></div>';

    if (c.sintesi) h += '<p class="dsintesi">' + fmt(c.sintesi) + '</p>';

    // Sezioni standard, sempre nello stesso ordine
    h += secHeader('Da fare', aperti.length);
    h += aperti.length
      ? '<div class="panel dsec-body"><ul class="tlist">' + aperti.map(taskRow).join('') + '</ul></div>'
      : '<div class="panel dsec-empty">Niente da fare al momento.</div>';

    h += secHeader('Decisioni aperte', c.decisioni.length);
    h += c.decisioni.length
      ? '<div class="panel dsec-body"><ul class="dlist">' + c.decisioni.map(d => '<li>' + fmt(d) + '</li>').join('') + '</ul></div>'
      : '<div class="panel dsec-empty">Nessuna decisione aperta.</div>';

    h += secHeader('Materiale da procurare', c.materiali.length);
    h += c.materiali.length
      ? '<div class="panel dsec-body"><ul class="mlist">' + c.materiali.map(m => '<li>' + fmt(m) + '</li>').join('') + '</ul></div>'
      : '<div class="panel dsec-empty">Nessun materiale in lista.</div>';

    h += secHeader('Fatto', chiusi.length);
    h += chiusi.length
      ? '<div class="panel dsec-body"><ul class="tlist">' + chiusi.map(taskRow).join('') + '</ul></div>'
      : '<div class="panel dsec-empty">Ancora niente di completato qui.</div>';

    // Navigazione precedente / successivo
    const i = D.cards.indexOf(c);
    const prev = D.cards[i - 1], next = D.cards[i + 1];
    if (prev || next) {
      h += '<div class="dnav">' +
        (prev ? '<a href="#/lavoro/' + prev.id + '"><span class="dir">‹ precedente</span><span class="name">' + prev.emoji + ' ' + esc(prev.titolo) + '</span></a>' : '<span></span>') +
        (next ? '<a class="next" href="#/lavoro/' + next.id + '"><span class="dir">successivo ›</span><span class="name">' + next.emoji + ' ' + esc(next.titolo) + '</span></a>' : '') +
        '</div>';
    }
    return h + '</div>';
  }

  // ── Router ──────────────────────────────────────────
  const $screen = document.getElementById('screen');
  const $tbTitle = document.getElementById('tb-title');
  const $tbMeta = document.getElementById('tb-meta');
  const $tbBack = document.getElementById('tb-back');
  const tabs = document.querySelectorAll('.tabbar a');

  function router() {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    let html, tab = 'home', title = 'Borgo Veneto', meta = 'agg. ' + dataBreve(D.aggiornamento), back = null;

    if (parts[0] === 'roadmap') { html = screenRoadmap(); tab = 'roadmap'; title = 'Borgo Veneto'; }
    else if (parts[0] === 'lavori') { html = screenLavori(); tab = 'lavori'; }
    else if (parts[0] === 'lavoro' && parts[1]) {
      const c = cardDi(parts[1]);
      html = screenLavoro(parts[1]);
      tab = 'lavori';
      if (c) { title = c.titolo; back = '#/lavori'; meta = ''; }
    }
    else { html = screenHome(); }

    if (html === '') return; // redirect già fatto
    $screen.innerHTML = html;
    $tbTitle.textContent = title;
    $tbMeta.textContent = meta;
    if (back) { $tbBack.hidden = false; $tbBack.setAttribute('href', back); }
    else $tbBack.hidden = true;
    tabs.forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', router);
  router();
})();
