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
  const GIORNI_FULL = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dataLunga = s => { const d = parseISO(s); return d.getDate() + ' ' + MESI_FULL[d.getMonth()] + ' ' + d.getFullYear(); };
  const dataBreve = s => { const d = parseISO(s); return d.getDate() + ' ' + MESI[d.getMonth()]; };
  const dataGiorno = s => { const d = parseISO(s); return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()]; };
  const giorniDa = s => Math.max(0, Math.floor((oggi - parseISO(s)) / 86400000));

  // separatore migliaia manuale (toLocaleString non raggruppa i 4 cifre in it-IT)
  const euro = n => '€ ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  function corto(s, max) {
    const plain = s.replace(/\*\*/g, '');
    if (plain.length <= max) return plain;
    return plain.slice(0, max).replace(/\s+\S*$/, '').replace(/\s*[—–:,;-]+$/, '') + '…';
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // stato "critico" si presenta come "in corso" (l'urgenza vive nella hero di Oggi)
  const stEff = st => st === 'critico' ? 'in-corso' : st;
  const STATO_LABEL = {
    'in-corso': 'In corso', 'in-attesa': 'In attesa',
    pianificato: 'In programma', fatto: 'Completato', futuro: 'Più avanti',
  };
  const GRUPPI = [
    { st: 'in-corso', titolo: 'In corso' },
    { st: 'in-attesa', titolo: 'In attesa di altri' },
    { st: 'pianificato', titolo: 'In programma' },
    { st: 'futuro', titolo: 'Più avanti' },
    { st: 'fatto', titolo: 'Completati' },
  ];

  const CHEV = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const CLOCK = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const BACK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

  const faseDi = id => D.fasi.find(f => f.id === id) || null;
  const cardDi = id => D.cards.find(c => c.id === id) || null;
  const iniziali = s => {
    const parole = s.trim().split(/\s+/);
    return (parole.length > 1 ? parole.map(w => w[0]).join('') : parole[0].slice(0, 2)).slice(0, 2).toUpperCase();
  };

  function sez(label, colore, n) {
    return '<h3 class="sec' + (colore ? ' c-' + colore : '') + '">' + label +
      (n !== undefined ? ' <span class="n">' + n + '</span>' : '') + '</h3>';
  }

  function spill(st) {
    const e = stEff(st);
    return '<span class="spill s-' + e + '">' + STATO_LABEL[e] + '</span>';
  }

  // ── Urgenze aggregate (hero "Da fare adesso") ───────
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
    return rows.slice(0, 6);
  }

  // ── Oggi ────────────────────────────────────────────
  function screenHome() {
    let h = '<div class="screen">';
    h += '<div class="kicker">Casa in campagna</div>';
    h += '<h1 class="screen-title">Oggi</h1>';
    h += '<p class="screen-sub">' + GIORNI_FULL[oggi.getDay()] + ' ' + oggi.getDate() + ' ' + MESI_FULL[oggi.getMonth()] + ' ' + oggi.getFullYear() + '</p>';

    const urg = urgenti();
    if (urg.length) {
      const first = urg[0], rest = urg.slice(1);
      const metaFirst = (first.due
        ? (first.overdue ? 'Scaduto · era ' + dataBreve(first.t.due) : 'Entro ' + dataGiorno(first.t.due))
        : 'Priorità massima') + ' · ' + first.c.emoji + ' ' + esc(first.c.titolo);
      h += '<div class="htoday">' +
        '<div class="htoday-head"><span class="htoday-label">Da fare adesso</span><span class="htoday-count">' + urg.length + '</span></div>' +
        '<a class="htoday-first" href="#/lavoro/' + first.c.id + '">' +
        '<span class="t">' + esc(corto(first.t.text, 80)) + '</span>' +
        '<span class="m">' + metaFirst + '</span></a>' +
        (rest.length ? '<div class="htoday-rest">' + rest.map(r =>
          '<a class="htoday-row" href="#/lavoro/' + r.c.id + '">' +
          '<span class="d">' + (r.due ? dataBreve(r.t.due) : 'prio') + '</span>' +
          '<span class="t">' + esc(corto(r.t.text, 60)) + '</span>' + CHEV + '</a>').join('') + '</div>' : '') +
        '</div>';
    }

    const attese = (D.attese || []).slice().sort((a, b) => giorniDa(b.dal) - giorniDa(a.dal));
    if (attese.length) {
      h += sez('In attesa dagli altri', null, attese.length);
      h += '<div class="waitgrid">' + attese.map(a => {
        const gg = giorniDa(a.dal);
        const hot = gg >= 10;
        return '<a class="waitp' + (hot ? ' hot' : '') + '" href="#/lavoro/' + esc(a.card) + '">' +
          '<span class="ava">' + esc(iniziali(a.chi)) + '<span class="gg">' + gg + 'g</span></span>' +
          '<div class="cosa">' + esc(a.cosa) + '</div>' +
          '<div class="chi">' + esc(a.chi) + '</div></a>';
      }).join('') + '</div>';
    }

    h += '<p class="foot">Pagina di famiglia · aggiornata il ' + dataLunga(D.aggiornamento) + '</p>';
    return h + '</div>';
  }

  // ── I lavori ────────────────────────────────────────
  function tile(c) {
    const e = stEff(c.stato);
    const pct = c.tot ? Math.round(100 * c.done / c.tot) : 0;
    return '<a class="tile g-' + e + '" href="#/lavoro/' + c.id + '">' +
      '<div class="tile-band band-' + e + '">' + c.emoji + '</div>' +
      '<div class="tile-body">' +
      '<div class="tile-name">' + esc(c.titolo) + '</div>' +
      '<div class="tile-track"><span style="width:' + pct + '%"></span></div>' +
      '<div class="tile-foot">' + spill(c.stato) +
      '<span class="tile-count">' + c.done + '/' + c.tot + '</span></div>' +
      '</div></a>';
  }

  function screenLavori() {
    let h = '<div class="screen">';
    h += '<h1 class="screen-title small">I lavori</h1>';
    h += '<p class="screen-sub">Tocca una tessera per vedere attività, decisioni e materiale.</p>';
    GRUPPI.forEach(g => {
      const group = D.cards.filter(c => stEff(c.stato) === g.st);
      if (!group.length) return;
      h += sez(g.titolo, null, group.length);
      h += '<div class="tilegrid">' + group.map(tile).join('') + '</div>';
    });
    return h + '</div>';
  }

  // ── L'ordine dei lavori ─────────────────────────────
  function screenRoadmap() {
    let h = '<div class="screen">';
    h += '<h1 class="screen-title small">L\'ordine dei lavori</h1>';
    h += '<p class="screen-sub">Prima gli impianti nascosti, poi le finiture: invertire vuol dire rifare.</p>';
    h += '<ol class="fasi">' + D.fasi.map((f, i) => {
      const cardsFase = D.cards.filter(c => c.fase === f.id && c.stato !== 'fatto');
      return '<li class="fase ' + esc(f.stato) + '">' +
        '<span class="fase-dot"></span>' +
        '<div class="fase-quando">Fase ' + (i + 1) + ' — ' + esc(f.nome) + '</div>' +
        '<div class="fase-titolo">' + esc(f.titolo) + '</div>' +
        (f.stato === 'in-corso' ? '<div><span class="fase-tag">Siamo qui</span></div>' : '') +
        '<div class="fase-desc">' + fmt(f.descrizione || '') + '</div>' +
        (cardsFase.length ? '<div class="fase-cards">' + cardsFase.map(c =>
          '<a href="#/lavoro/' + c.id + '">' + c.emoji + ' ' + esc(c.titolo) + '</a>').join('') + '</div>' : '') +
        '</li>';
    }).join('') + '</ol>';
    return h + '</div>';
  }

  // ── Le spese ────────────────────────────────────────
  function screenBudget() {
    const voci = D.cards.filter(c => c.budget !== null || c.budgetNota);
    const conCifra = voci.filter(c => c.budget !== null).sort((a, b) => b.budget - a.budget);
    const daDefinire = voci.filter(c => c.budget === null);
    const tot = conCifra.reduce((s, c) => s + c.budget, 0);

    let h = '<div class="screen">';
    h += '<h1 class="screen-title small">Le spese</h1>';
    h += '<p class="screen-sub">Quanto è previsto per ogni lavoro.</p>';

    h += '<div class="bhero"><div class="bh-label">Previsto sui lavori mappati</div>' +
      '<div class="bh-value">' + euro(tot) + '</div>' +
      (daDefinire.length ? '<div class="bh-nota">Più ' + daDefinire.length + ' voci ancora da preventivare</div>' : '') +
      '</div>';

    h += sez('Con preventivo', null, conCifra.length);
    h += '<div class="blist">' + conCifra.map(c =>
      '<a class="brow" href="#/lavoro/' + c.id + '">' +
      '<span class="bemoji">' + c.emoji + '</span>' +
      '<div class="bmain"><div class="bname">' + esc(c.titolo) + '</div>' +
      (c.budgetNota ? '<div class="bnota">' + esc(corto(c.budgetNota, 70)) + '</div>' : '') +
      '</div><span class="bval">' + euro(c.budget) + '</span></a>').join('') +
      '<div class="brow btot"><div class="bmain"><div class="bname">Totale mappato</div></div><span class="bval">' + euro(tot) + '</span></div>' +
      '</div>';

    if (daDefinire.length) {
      h += sez('Ancora da preventivare', null, daDefinire.length);
      h += '<div class="blist">' + daDefinire.map(c =>
        '<a class="brow" href="#/lavoro/' + c.id + '">' +
        '<span class="bemoji">' + c.emoji + '</span>' +
        '<div class="bmain"><div class="bname">' + esc(c.titolo) + '</div>' +
        (c.budgetNota ? '<div class="bnota">' + esc(corto(c.budgetNota, 70)) + '</div>' : '') +
        '</div><span class="bval tbd">da definire</span></a>').join('') + '</div>';
    }

    if (D.budgetNota) h += '<p class="bfoot">' + fmt(D.budgetNota) + '</p>';
    return h + '</div>';
  }

  // ── Dettaglio lavoro ────────────────────────────────
  function taskRow(t) {
    const late = !t.done && t.due && parseISO(t.due) < oggi;
    const cls = (t.done ? 't-done' : (t.waiting ? 't-wait' : '')) + (late ? ' t-late' : '');
    let meta = '';
    if (!t.done && t.due) {
      meta += late
        ? '<span class="m late">Scaduto · era ' + dataGiorno(t.due) + '</span>'
        : '<span class="m">Entro ' + dataGiorno(t.due) + '</span>';
    }
    if (!t.done && t.prio === 'critica') meta += '<span class="m">priorità massima</span>';
    if (!t.done && t.prio === 'alta') meta += '<span class="m">alta priorità</span>';
    if (!t.done && t.waiting) meta += '<span class="m">in attesa di risposta</span>';
    if (t.done && t.doneDate) meta += '<span class="m">fatto il ' + dataBreve(t.doneDate) + '</span>';
    return '<li class="' + cls + '">' +
      '<span class="tbox">' + (t.done ? '✓' : (t.waiting ? '…' : '')) + '</span>' +
      '<div class="tmain"><div class="ttext">' + fmt(t.text) + '</div>' +
      (meta ? '<div class="tmeta">' + meta + '</div>' : '') +
      '</div></li>';
  }

  function screenLavoro(id) {
    const c = cardDi(id);
    if (!c) { location.hash = '#/lavori'; return ''; }
    const pct = c.tot ? Math.round(100 * c.done / c.tot) : 0;
    const fase = faseDi(c.fase);
    const aperti = c.tasks.filter(t => !t.done);
    const chiusi = c.tasks.filter(t => t.done);
    const attese = (D.attese || []).filter(a => a.card === c.id).sort((a, b) => giorniDa(b.dal) - giorniDa(a.dal));

    let h = '<div class="screen">';
    h += '<a class="dback" href="#/lavori"><span class="circ">' + BACK + '</span>Torna ai lavori</a>';

    h += '<div class="dhead"><span class="dhead-emoji">' + c.emoji + '</span>' +
      '<div><div class="dhead-name">' + esc(c.titolo) + '</div>' +
      '<div class="dhead-meta">' + spill(c.stato) +
      (fase ? '<span>' + esc(fase.nome) + ' — ' + esc(fase.titolo) + '</span>' : '') +
      '</div></div></div>';

    h += '<div class="dprog"><span class="ring' + (c.stato === 'fatto' ? ' done' : '') + '" style="--p:' + pct + '" data-pct="' + pct + '%"></span>' +
      '<div><div class="dp-count">' + c.done + ' su ' + c.tot + ' fatti</div>' +
      '<div class="dp-budget">' + (c.budget !== null ? 'Budget previsto ' + euro(c.budget) : (c.budgetNota ? 'Budget da definire' : '')) + '</div>' +
      '</div></div>';

    if (stEff(c.stato) === 'in-attesa' && attese.length) {
      const a = attese[0];
      const gg = giorniDa(a.dal);
      h += '<div class="dwait' + (gg >= 10 ? ' hot' : '') + '">' + CLOCK +
        '<span>In attesa: ' + esc(a.cosa) + ' (' + esc(a.chi) + ')</span>' +
        '<span class="gg">da ' + gg + ' gg</span></div>';
    }

    if (c.sintesi) h += '<p class="dsintesi">' + fmt(c.sintesi) + '</p>';

    if (aperti.length) {
      h += sez('Da fare', 'accent', aperti.length);
      h += '<div class="dcard"><ul class="tlist">' + aperti.map(taskRow).join('') + '</ul></div>';
    }
    if (c.decisioni.length) {
      h += sez('Decisioni aperte', 'ottone', c.decisioni.length);
      h += '<div class="dcard"><ul class="dlist">' + c.decisioni.map(d =>
        '<li><span class="q">?</span><span>' + fmt(d) + '</span></li>').join('') + '</ul></div>';
    }
    if (c.materiali.length) {
      h += sez('Materiale da procurare', 'salvia', c.materiali.length);
      h += '<ul class="mlist">' + c.materiali.map(m => '<li>' + fmt(m) + '</li>').join('') + '</ul>';
    }
    if (chiusi.length) {
      h += sez('Fatto', 'verde', chiusi.length);
      h += '<div class="dcard done"><ul class="tlist">' + chiusi.map(taskRow).join('') + '</ul></div>';
    }
    return h + '</div>';
  }

  // ── Router ──────────────────────────────────────────
  const $screen = document.getElementById('screen');
  const tabs = document.querySelectorAll('.tabbar a');

  function router() {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    let html, tab = 'home';

    if (parts[0] === 'roadmap') { html = screenRoadmap(); tab = 'roadmap'; }
    else if (parts[0] === 'budget') { html = screenBudget(); tab = 'budget'; }
    else if (parts[0] === 'lavori') { html = screenLavori(); tab = 'lavori'; }
    else if (parts[0] === 'lavoro' && parts[1]) { html = screenLavoro(parts[1]); tab = 'lavori'; }
    else { html = screenHome(); }

    if (html === '') return; // redirect già fatto
    $screen.innerHTML = html;
    tabs.forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', router);
  router();
})();
