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
      h += '<div class="dcard"><ul class="mlist">' + c.materiali.map(m => '<li><span>' + fmt(m) + '</span></li>').join('') + '</ul></div>';
    }
    if (chiusi.length) {
      h += sez('Fatto', 'verde', chiusi.length);
      h += '<div class="dcard done"><ul class="tlist">' + chiusi.map(taskRow).join('') + '</ul></div>';
    }
    return h + '</div>';
  }

  // ── Render ──────────────────────────────────────────
  // Le foto stanno cifrate (AES-GCM) in docs/r/. La chiave arriva dentro APP_DATA, quindi solo a chi
  // ha passato la password; si scaricano e si decifrano quando entrano a schermo.
  const R = D.render && D.render.temi && D.render.temi.length ? D.render : null;
  const temaDi = id => (R && R.temi.find(t => t.id === id)) || null;
  const fotoPerSrc = new Map();
  if (R) R.temi.forEach(t => t.foto.forEach(f => fotoPerSrc.set(f.src, f)));

  const SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14.5V3.5"/><path d="M7.5 8 12 3.5 16.5 8"/><path d="M5 12v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12"/></svg>';
  const CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const PREV = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  const NEXT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

  let chiaveP = null;
  const decifrate = new Map();   // src → Promise dell'URL dell'immagine in chiaro

  function apriFoto(f) {
    if (!decifrate.has(f.src)) {
      const p = Promise.resolve().then(() => {
        if (!chiaveP) {
          const raw = Uint8Array.from(atob(R.key), c => c.charCodeAt(0));
          chiaveP = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
        }
        return fetch(f.src);
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(buf => chiaveP.then(k => crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(buf, 0, 12) }, k, new Uint8Array(buf, 12))))
        .then(dati => URL.createObjectURL(new Blob([dati], { type: f.mime })));
      p.catch(() => decifrate.delete(f.src));   // alla prossima apertura riprova
      decifrate.set(f.src, p);
    }
    return decifrate.get(f.src);
  }

  function mostraIn(img, f) {
    const box = img.parentNode;
    img.onload = () => box.classList.add('ok');
    apriFoto(f).then(url => { img.src = url; }, () => box.classList.add('ko'));
  }

  let osservatore = null;
  function caricaFoto() {
    if (osservatore) { osservatore.disconnect(); osservatore = null; }
    const imgs = $screen.querySelectorAll('img[data-foto]');
    const carica = img => mostraIn(img, fotoPerSrc.get(img.dataset.foto));
    if (!('IntersectionObserver' in window)) { imgs.forEach(carica); return; }
    osservatore = new IntersectionObserver(voci => voci.forEach(v => {
      if (!v.isIntersecting) return;
      osservatore.unobserve(v.target);
      carica(v.target);
    }), { rootMargin: '600px 0px' });
    imgs.forEach(img => osservatore.observe(img));
  }

  // "2026-09-21T12:59" → "21 set, 12:59"
  const quando = s => s ? dataBreve(s.slice(0, 10)) + ', ' + s.slice(11, 16) : '';
  const tinta = f => f.colore ? '<span class="swatch" style="background:' + esc(f.colore) + '"></span>' : '';

  function fotoBox(f, proporzioni) {
    return '<div class="rfoto"' + (proporzioni ? ' style="aspect-ratio:' + f.w + '/' + f.h + '"' : '') + '>' +
      '<img data-foto="' + esc(f.src) + '" alt="' + esc(f.nome) + '"></div>';
  }

  function didascalia(f) {
    const meta = [quando(f.data), esc(f.nota)].filter(Boolean).join(' · ');
    return (f.codice ? '<div class="rcode">' + tinta(f) + '<span>' + esc(f.codice) + '</span></div>' : '') +
      '<div class="rname' + (f.codice ? '' : ' solo') + '">' + esc(f.nome) + '</div>' +
      (meta ? '<div class="rmeta">' + meta + '</div>' : '');
  }

  function screenRender() {
    let h = '<div class="screen">';
    h += '<div class="kicker">Il modello 3D</div>';
    h += '<h1 class="screen-title small">Render</h1>';
    h += '<p class="screen-sub">Le prove fatte sul modello 3D della casa, divise per tema. In ogni tema una foto per variante, con il suo codice.</p>';
    const ambienti = [];
    R.temi.forEach(t => { if (!ambienti.includes(t.ambiente)) ambienti.push(t.ambiente); });
    ambienti.forEach(a => {
      const temi = R.temi.filter(t => t.ambiente === a);
      h += sez(esc(a || 'Altro'), null, temi.length);
      h += '<div class="rtemi">' + temi.map(t => {
        const ultima = t.foto.map(f => f.data).filter(Boolean).sort().pop();
        const colori = t.foto.filter((f, i, tutte) => f.colore && tutte.findIndex(g => g.colore === f.colore) === i);
        return '<a class="rtema" href="#/render/' + t.id + '">' + fotoBox(t.foto[0], false) +
          '<div class="rtema-body"><div class="rtema-name">' + esc(t.titolo) + '</div>' +
          '<div class="rmeta">' + t.foto.length + ' foto' + (ultima ? ' · ultima prova il ' + dataBreve(ultima.slice(0, 10)) : '') + '</div>' +
          (colori.length ? '<div class="rtinte">' + colori.map(tinta).join('') + '</div>' : '') +
          '</div></a>';
      }).join('') + '</div>';
    });
    return h + '</div>';
  }

  function screenTema(id) {
    const t = temaDi(id);
    if (!t) { location.replace('#/render'); return ''; }
    let h = '<div class="screen">';
    h += '<div class="rtop"><a class="dback" href="#/render"><span class="circ">' + BACK + '</span>Tutti i render</a>' +
      '<button type="button" class="rshare" data-share="' + t.id + '">' + SHARE + '<span>Condividi</span></button></div>';
    if (t.ambiente) h += '<div class="kicker">' + esc(t.ambiente) + '</div>';
    h += '<h1 class="screen-title small">' + esc(t.titolo) + '</h1>';
    if (t.nota) h += '<p class="screen-sub">' + fmt(t.nota) + '</p>';
    h += '<div class="rgrid">' + t.foto.map((f, i) =>
      '<a class="rvar" href="#/render/' + t.id + '/' + (i + 1) + '">' + fotoBox(f, true) +
      '<div class="rvar-body">' + didascalia(f) + '</div></a>').join('') + '</div>';
    return h + '</div>';
  }

  // Foto a schermo intero: #/render/<tema>/<n>. Frecce, tastiera e swipe scorrono le varianti del tema.
  const $viewer = document.createElement('div');
  $viewer.className = 'viewer';
  $viewer.hidden = true;
  $viewer.setAttribute('role', 'dialog');
  $viewer.setAttribute('aria-modal', 'true');
  document.body.appendChild($viewer);
  let aperta = null;          // { t, i } della foto a schermo intero
  let apertaDaClick = false;  // aperta dalla griglia: "chiudi" torna indietro nella cronologia

  function mostraFoto(t, i) {
    aperta = { t, i };
    const f = t.foto[i];
    const molte = t.foto.length > 1;
    $viewer.innerHTML =
      '<div class="vw-top"><span class="vw-count">' + (molte ? (i + 1) + ' / ' + t.foto.length : '') + '</span>' +
      '<button type="button" class="vw-btn" data-v="chiudi" aria-label="Chiudi">' + CLOSE + '</button></div>' +
      '<div class="vw-stage"><img alt="' + esc(f.nome) + '"></div>' +
      (molte ? '<button type="button" class="vw-nav prev" data-v="-1" aria-label="Foto precedente">' + PREV + '</button>' +
        '<button type="button" class="vw-nav next" data-v="1" aria-label="Foto successiva">' + NEXT + '</button>' : '') +
      '<div class="vw-cap">' + didascalia(f) + '</div>';
    $viewer.hidden = false;
    document.body.classList.add('noscroll');
    mostraIn($viewer.querySelector('img'), f);
    if (molte) [i - 1, i + 1].forEach(j => apriFoto(t.foto[(j + t.foto.length) % t.foto.length]).catch(() => {}));
  }

  function chiudiFoto() {
    aperta = null;
    $viewer.hidden = true;
    $viewer.innerHTML = '';
    document.body.classList.remove('noscroll');
  }

  function scorri(delta) {
    const n = aperta.t.foto.length;
    if (n < 2) return;
    const j = (aperta.i + delta + n) % n;
    history.replaceState(null, '', '#/render/' + aperta.t.id + '/' + (j + 1));
    mostraFoto(aperta.t, j);
  }

  function esci() {
    if (!aperta) return;
    if (apertaDaClick) history.back();
    else location.replace('#/render/' + aperta.t.id);
  }

  function syncFoto(id, n, daClick) {
    const t = temaDi(id), i = Number(n) - 1;
    if (t && Number.isInteger(i) && i >= 0 && i < t.foto.length) {
      if (!aperta) apertaDaClick = daClick;
      mostraFoto(t, i);
    } else if (aperta) chiudiFoto();
  }

  $viewer.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    if (b.dataset.v === 'chiudi') esci(); else scorri(Number(b.dataset.v));
  });
  let tocco = null;
  $viewer.addEventListener('touchstart', e => {
    tocco = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  $viewer.addEventListener('touchend', e => {
    if (!tocco || !aperta) return;
    const dx = e.changedTouches[0].clientX - tocco.x, dy = e.changedTouches[0].clientY - tocco.y;
    tocco = null;
    const zoom = window.visualViewport ? window.visualViewport.scale : 1;
    if (zoom < 1.05 && Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) scorri(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', e => {
    if (!aperta) return;
    if (e.key === 'Escape') esci();
    else if (e.key === 'ArrowRight') scorri(1);
    else if (e.key === 'ArrowLeft') scorri(-1);
  });

  // Condividi: sul telefono apre il foglio di condivisione (WhatsApp ecc.), altrimenti copia il link
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-share]');
    if (!b) return;
    const t = temaDi(b.dataset.share);
    const url = location.href.split('#')[0] + '#/render/' + t.id;
    const etichetta = b.querySelector('span');
    const conferma = () => { etichetta.textContent = 'Link copiato'; setTimeout(() => { etichetta.textContent = 'Condividi'; }, 2200); };
    if (navigator.share) navigator.share({ title: t.titolo, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(conferma, () => window.prompt('Copia il link:', url));
    else window.prompt('Copia il link:', url);
  });

  // ── Router ──────────────────────────────────────────
  const $screen = document.getElementById('screen');
  if (!R) { const t = document.querySelector('.tabbar a[data-tab="render"]'); if (t) t.remove(); }
  const tabs = document.querySelectorAll('.tabbar a');
  let schermata = null;   // pagina a schermo: se cambia solo la foto aperta non si ridisegna

  function router(evt) {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');

    // stesso tema già a schermo: si apre o si chiude solo la foto, la pagina resta dov'era
    if (R && parts[0] === 'render' && parts[1] && schermata === 'render/' + parts[1]) {
      syncFoto(parts[1], parts[2], !!evt);
      return;
    }
    if (aperta) chiudiFoto();

    let html, tab = 'home';
    if (parts[0] === 'roadmap') { html = screenRoadmap(); tab = 'roadmap'; }
    else if (parts[0] === 'budget') { html = screenBudget(); tab = 'budget'; }
    else if (parts[0] === 'lavori') { html = screenLavori(); tab = 'lavori'; }
    else if (parts[0] === 'lavoro' && parts[1]) { html = screenLavoro(parts[1]); tab = 'lavori'; }
    else if (parts[0] === 'render' && R) { html = parts[1] ? screenTema(parts[1]) : screenRender(); tab = 'render'; }
    else { html = screenHome(); }

    if (html === '') return; // redirect già fatto
    $screen.innerHTML = html;
    $screen.classList.toggle('wide', tab === 'render');
    schermata = tab === 'render' && parts[1] ? 'render/' + parts[1] : parts[0];
    tabs.forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    window.scrollTo(0, 0);
    if (tab === 'render') {
      caricaFoto();
      // link diretto a una foto: chiudendola si resta sulla griglia del suo tema
      if (parts[2]) syncFoto(parts[1], parts[2], false);
    }
  }

  window.addEventListener('hashchange', router);
  router();
})();
