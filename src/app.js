(function () {
  if (typeof APP_DATA === 'string') {
    console.error('APP_DATA non sostituito dal build');
    return;
  }
  const data = APP_DATA;

  // Last update
  const lu = document.getElementById('last-update');
  if (lu && data.ultimoAggiornamento) {
    const d = new Date(data.ultimoAggiornamento);
    const fmt = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    lu.textContent = `Aggiornato al ${fmt}`;
  }

  // Stats overview
  const completate = data.lavorazioni.filter(l => l.stato === 'completato').length;
  const inCorso = data.lavorazioni.filter(l => l.stato === 'in-corso').length;
  const totLav = data.lavorazioni.length;
  const avgFasi = data.fasi.reduce((s, f) => s + (f.avanzamento || 0), 0) / data.fasi.length;
  const budgetTot = data.lavorazioni.reduce((s, l) => s + (l.budget || 0), 0);

  const statsEl = document.getElementById('stats');
  statsEl.innerHTML = `
    <div class="stat">
      <span class="stat-value">${Math.round(avgFasi)}%</span>
      <span class="stat-label">Avanzamento medio</span>
    </div>
    <div class="stat">
      <span class="stat-value">${completate}/${totLav}</span>
      <span class="stat-label">Lavorazioni completate</span>
    </div>
    <div class="stat">
      <span class="stat-value">${inCorso}</span>
      <span class="stat-label">In corso</span>
    </div>
    <div class="stat">
      <span class="stat-value">€${budgetTot.toLocaleString('it-IT')}</span>
      <span class="stat-label">Budget totale</span>
    </div>
  `;

  // Timeline fasi
  const tl = document.getElementById('timeline');
  tl.innerHTML = data.fasi.map(f => `
    <div class="fase stato-${f.stato}">
      <div class="fase-card">
        <div class="fase-head">
          <span class="fase-id">Fase ${f.id}</span>
          <h3 class="fase-nome">${escapeHtml(f.nome)}</h3>
          <span class="fase-periodo">${escapeHtml(f.periodo || '')}</span>
        </div>
        ${f.focus ? `<p class="fase-focus">${escapeHtml(f.focus)}</p>` : ''}
        ${f.nota ? `<p class="fase-nota">${escapeHtml(f.nota)}</p>` : ''}
        <div class="progress">
          <div class="progress-fill" style="width: ${f.avanzamento || 0}%"></div>
        </div>
        <div class="progress-label">
          <span>${labelStato(f.stato)}</span>
          <span>${f.avanzamento || 0}%</span>
        </div>
      </div>
    </div>
  `).join('');

  // Cards lavorazioni
  const cardsEl = document.getElementById('cards');
  function renderCards(filterStato) {
    const filtered = filterStato === 'all'
      ? data.lavorazioni
      : data.lavorazioni.filter(l => l.stato === filterStato);

    if (filtered.length === 0) {
      cardsEl.innerHTML = '<p style="color: var(--text-soft); grid-column: 1/-1; text-align: center; padding: 40px 0;">Nessuna lavorazione con questo stato.</p>';
      return;
    }

    cardsEl.innerHTML = filtered.map(l => `
      <div class="card stato-${l.stato}" data-id="${l.id}">
        <div class="card-head">
          <h3 class="card-titolo">${escapeHtml(l.titolo)}</h3>
          <span class="badge badge-${l.stato}">${labelStato(l.stato)}</span>
        </div>
        <div class="card-meta">
          ${l.fase != null ? `<span>Fase ${l.fase}</span>` : ''}
          ${l.fase != null && l.budget ? '<span class="sep">·</span>' : ''}
          ${l.budget ? `<span>€${l.budget.toLocaleString('it-IT')}</span>` : ''}
        </div>
        ${l.nota ? `<p class="card-nota">${escapeHtml(l.nota)}</p>` : ''}
        <div class="progress">
          <div class="progress-fill" style="width: ${l.avanzamento || 0}%"></div>
        </div>
        <div class="progress-label">
          <span>${l.avanzamento || 0}% completato</span>
          ${l.tasksTot > 0 ? `<span>${l.tasksDone}/${l.tasksTot} attivita</span>` : ''}
        </div>
        ${l.descrizione ? `<p class="card-descrizione">${escapeHtml(l.descrizione)}</p>` : ''}
      </div>
    `).join('');

    // Click to expand
    cardsEl.querySelectorAll('.card').forEach(c => {
      c.addEventListener('click', () => c.classList.toggle('expanded'));
    });
  }

  renderCards('all');

  // Filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards(btn.dataset.value);
    });
  });

  function labelStato(s) {
    return ({
      'completato': 'Completato',
      'in-corso': 'In corso',
      'pianificato': 'Pianificato',
      'bloccato': 'Bloccato',
    })[s] || s;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
