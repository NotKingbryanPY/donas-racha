(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
  const number = value => count(value).toLocaleString('es-PA');
  const trophy = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M19 9h26v19c0 10-6 15-13 15s-13-5-13-15V9Z" fill="currentColor"/><path d="M19 14H9v8c0 8 6 13 13 13m23-21h10v8c0 8-6 13-13 13M32 43v10m-12 4h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="m32 16 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" fill="#fff" fill-opacity=".65"/></svg>';
  const labels = {compras:'compras',puntos:'puntos',racha:'días de racha',nivel:'nivel',canjes:'canjes',weekly:'compras esta semana'};
  function score(customer, type) {
    if (type === 'nivel') return escape(customer.levelName || 'Bronce');
    return number(type === 'weekly' ? customer.weeklyPurchases : type === 'compras' ? customer.totalPurchases :
      type === 'puntos' ? customer.pointsTotal : type === 'canjes' ? customer.redemptionsMade ?? customer.rewardsEarned : customer.currentStreak);
  }
  function render(list, type, compact = false) {
    if (!list.length) return '<div class="empty">' + (type === 'weekly' ? 'Aún no hay compras acreditadas en esta semana.' : 'El próximo lugar puede ser tuyo. Aún no hay participantes.') + '</div>';
    const tones = ['gold','silver','bronze'];
    const rows = list.map((customer, index) => {
      const name = escape(customer.name || 'Cliente');
      const detail = type === 'weekly' ? `${number(customer.weeklyPoints)} puntos ganados` : `${escape(customer.levelName || 'Bronce')} · ${number(customer.totalPurchases)} compras`;
      const content = `<span class="hall-position">${index + 1}</span><span class="hall-avatar" aria-hidden="true">${escape(Array.from(customer.name || 'D')[0].toUpperCase())}</span><span class="hall-person"><strong>${name}</strong><small>${detail}</small></span><span class="hall-score"><b>${score(customer,type)}</b><small>${labels[type] || 'puntos'}</small></span>`;
      const privateClient = requireAuth() && /^C[0-9A-Z_-]{3,63}$/.test(customer.id || '');
      return `<li class="hall-row ${tones[index] || ''}">${privateClient ? `<button type="button" data-ranking-client="${escape(customer.id)}">${content}</button>` : `<div>${content}</div>`}</li>`;
    }).join('');
    if (compact) return `<ol class="hall-list hall-compact" aria-label="Clasificación">${rows}</ol>`;
    const podium = list.slice(0,3).map((customer,index) => `<li class="hall-contender ${tones[index]} place-${index + 1}"><div class="hall-statue">${trophy}<span class="hall-medal">${index + 1}</span></div><div class="hall-plinth"><span class="hall-laurel" aria-hidden="true">${index === 0 ? '✦ CAMPEÓN ✦' : index === 1 ? 'PLATA' : 'BRONCE'}</span><strong title="${escape(customer.name)}">${escape(customer.name || 'Cliente')}</strong><span>${score(customer,type)}</span><small>${labels[type] || 'puntos'}</small></div></li>`).join('');
    return `<section class="hall-of-fame" aria-label="Salón de la Fama"><div class="hall-intro"><span>DRACHAS · ${type === 'weekly' ? 'TEMPORADA SEMANAL' : 'NUESTROS IMPARABLES'}</span><h2>El antojo de llegar alto.</h2><p>${type === 'weekly' ? 'Una semana, un nuevo podio.' : 'Cada compra suma. Cada racha deja huella.'}</p></div><ol class="hall-podium" aria-label="Los tres primeros lugares">${podium}</ol><div class="hall-ribbon"><span aria-hidden="true">✦</span> Hall of Fame <span aria-hidden="true">✦</span></div><div class="hall-board"><div class="hall-board-heading"><h3>Salón de la Fama</h3><span>${labels[type] || 'puntos'} · TOP ${list.length}</span></div><ol class="hall-list" aria-label="Clasificación completa">${rows}</ol></div></section>`;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-ranking-client]');
    if (button && requireAuth()) openClient(button.dataset.rankingClient, false);
  });
  window.DrachasRanking = { render };

  let generation = 0;
  let selectedWeek = '';
  let currentWeek = '';
  const visible = () => document.getElementById('screen-weekly-ranking').classList.contains('active');
  const shiftWeek = (week, days) => { const date = new Date(week + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10); };
  const dateLabel = week => new Date(week + 'T12:00:00Z').toLocaleDateString('es-PA', {day:'numeric',month:'short',year:'numeric',timeZone:'America/Panama'});
  const rangeLabel = week => `${dateLabel(week)} – ${dateLabel(shiftWeek(week,6))}`;
  function clear() {
    generation++;
    selectedWeek = ''; currentWeek = '';
    document.getElementById('weeklyRankingList').replaceChildren();
    document.getElementById('weeklyRankingHistory').replaceChildren();
    document.getElementById('weeklyRankingPeriod').textContent = '';
    document.getElementById('weeklyRankingStatus').textContent = '';
    ['weeklyPrevious','weeklyNext','weeklyCurrent','weeklyRankingHistory'].forEach(id => document.getElementById(id).disabled = true);
  }
  async function load(week = '') {
    if (!requireAuth()) { clear(); goToAdminLogin(); return; }
    const version = ++generation;
    const list = document.getElementById('weeklyRankingList');
    const status = document.getElementById('weeklyRankingStatus');
    list.innerHTML = '<div class="empty">Cargando la clasificación semanal…</div>';
    status.textContent = '';
    ['weeklyPrevious','weeklyNext','weeklyCurrent','weeklyRankingHistory'].forEach(id => document.getElementById(id).disabled = true);
    try {
      const data = await adminRequest('/api/admin/customers/weekly-ranking' + (week ? '?week=' + encodeURIComponent(week) : ''));
      if (version !== generation || !visible() || !requireAuth()) return;
      selectedWeek = data.weekStart; currentWeek = data.currentWeek;
      const url = new URL(location.href); url.searchParams.set('week', selectedWeek); history.replaceState(null,'',url);
      document.getElementById('weeklyRankingPeriod').textContent = rangeLabel(selectedWeek);
      const historySelect = document.getElementById('weeklyRankingHistory');
      historySelect.replaceChildren(...data.weeks.map(value => new Option(rangeLabel(value) + (value === currentWeek ? ' · En curso' : ''),value)));
      historySelect.value = selectedWeek; historySelect.disabled = false;
      document.getElementById('weeklyPrevious').disabled = false;
      document.getElementById('weeklyNext').disabled = selectedWeek >= currentWeek;
      document.getElementById('weeklyCurrent').disabled = selectedWeek === currentWeek;
      status.textContent = selectedWeek === currentWeek ? 'Semana en curso · Se reinicia el lunes a las 00:00 (Panamá).' : 'Historial de compras acreditadas · Semana finalizada.';
      list.innerHTML = render(data.ranking || [], 'weekly');
    } catch (error) {
      if (version !== generation || !visible() || !requireAuth()) return;
      list.replaceChildren();
      status.textContent = error.message || 'No se pudo cargar el ranking.';
      document.getElementById('weeklyCurrent').disabled = false;
      if (error.status === 401 || error.status === 403) {
        status.textContent = 'Necesitas una sesión de vendedor o administrador para ver este ranking.';
      }
    }
  }
  document.getElementById('weeklyRankingHistory').addEventListener('change', event => load(event.target.value));
  document.getElementById('weeklyPrevious').addEventListener('click', () => load(shiftWeek(selectedWeek,-7)));
  document.getElementById('weeklyNext').addEventListener('click', () => load(shiftWeek(selectedWeek,7)));
  document.getElementById('weeklyCurrent').addEventListener('click', () => load());
  document.getElementById('weeklyRefresh').addEventListener('click', () => load(selectedWeek === currentWeek ? '' : selectedWeek));
  window.DrachasWeeklyRanking = { load, clear };
})();
