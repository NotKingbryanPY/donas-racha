/* Customer-only introduction. Step content is deliberately separate from the overlay engine. */
(() => {
  'use strict';
  const VERSION = 1;
  const STEPS = [
    { title: 'Tu perfil', text: 'Aquí encuentras tu resumen y cambias entre Perfil y Pedidos. Dentro del perfil puedes abrir las demás secciones.', tab: 'profile', target: '[data-tour="profile-nav"]' },
    { title: 'Puntos, racha y nivel', text: 'Los puntos totales muestran lo acumulado; los disponibles son los que puedes usar en la tienda. Tu racha y tu nivel reflejan tu progreso según las reglas vigentes que aparecen en el perfil.', tab: 'profile', target: '[data-tour="points"]' },
    { title: 'Mi QR', text: 'Muéstrale este QR al vendedor cuando compres para que encuentre tu perfil. Puedes abrirlo ahora o seguir con el tutorial.', tab: 'profile', target: '[data-tour="qr"]', action: 'qr' },
    { title: 'Logros y próximo premio', text: 'Consulta aquí los logros que has conseguido y cuánto te falta para el próximo premio disponible.', tab: 'profile', target: '[data-tour="achievements"] h2' },
    { title: 'Tienda', text: 'En la tienda puedes ver las recompensas, sus costos y tus puntos disponibles para canjear.', tab: 'shop', target: '#client-tab-shop' },
    { title: 'Historial', text: 'Aquí puedes revisar tus compras, puntos y canjes recientes.', tab: 'history', target: '#client-tab-history' },
    { title: 'Ranking', text: 'Compara tu posición por compras, puntos, racha o nivel.', tab: 'ranking', target: '#client-tab-ranking' },
    { title: 'Pedidos', text: 'En Pedidos puedes elegir sabores disponibles, indicar un punto de entrega en el Edificio 4 y consultar tus pedidos. El pago es al recibir, en efectivo o por Yappy.', tab: 'delivery', target: '[data-tour="orders-tab"]' }
  ];

  let token = null, customerId = null, progress = null, sequence = 0, stepIndex = 0;
  let active = false, suspended = false, replay = false, layer = null, card = null, target = null;
  let returnTab = 'profile';
  let lastFocus = null, frame = 0, writeQueue = Promise.resolve();
  const panels = [];
  const key = id => `donas-tour:${VERSION}:${id}`;
  const remember = id => { try { localStorage.setItem(key(id), 'seen'); } catch (_) {} };
  const remembered = id => { try { return !!localStorage.getItem(key(id)); } catch (_) { return false; } };
  const safeProfile = () => !!(typeof openedAsUser !== 'undefined' && openedAsUser && currentClient && sessionStorage.getItem('donasCustomerToken'));
  const visibleTab = () => ['delivery', 'ranking', 'shop', 'history'].find(tab =>
    document.getElementById(`client${tab[0].toUpperCase()}${tab.slice(1)}Section`)?.style.display !== 'none') || 'profile';

  async function request(accessToken, method, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/customer/onboarding', {
        method, signal: controller.signal,
        headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error?.message || 'No se pudo guardar el tutorial.');
      return json.data;
    } finally { clearTimeout(timeout); }
  }

  function save(status, index) {
    if (replay && progress?.status === 'COMPLETED') return;
    const accessToken = token, id = customerId, writeSequence = sequence;
    if (!accessToken || !id) return;
    remember(id);
    progress = { ...progress, status, last_step: index };
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const result = await request(accessToken, 'POST', { status, lastStep: index });
      if (customerId === id && sequence === writeSequence) progress = result.progress;
    }).catch(() => { /* The profile and the local once-only marker remain usable. */ });
  }

  async function onLogin(id) {
    stop(false);
    const mySequence = ++sequence;
    customerId = id;
    token = sessionStorage.getItem('donasCustomerToken');
    progress = null;
    replay = false;
    writeQueue = Promise.resolve();
    const replayButton = document.getElementById('clientTourReplay');
    if (replayButton) { replayButton.hidden = false; replayButton.textContent = 'Ver tutorial'; }
    if (!id || !token || !safeProfile()) return;
    try {
      const result = await request(token, 'GET');
      if (mySequence !== sequence || !safeProfile()) return;
      progress = result.progress;
      replayButton.textContent = progress && progress.status !== 'COMPLETED' ? 'Retomar tutorial' : 'Ver tutorial';
      if (!progress && !remembered(id)) {
        remember(id);
        welcome();
      }
    } catch (_) {
      // A failed read must never auto-open repeatedly. The replay link still works.
      remember(id);
    }
  }

  function makeButton(label, action, className = '') {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `client-tour-button ${className}`;
    button.textContent = label; button.addEventListener('click', action);
    return button;
  }
  function baseCard() {
    layer = document.createElement('div'); layer.className = 'client-tour-layer';
    for (let i = 0; i < 4; i++) {
      const panel = document.createElement('div'); panel.className = 'client-tour-shade';
      layer.append(panel); panels.push(panel);
    }
    const ring = document.createElement('div'); ring.className = 'client-tour-ring'; layer.append(ring);
    card = document.createElement('section'); card.className = 'client-tour-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Tutorial del perfil');
    layer.append(card); document.body.append(layer);
    lastFocus = document.activeElement?.closest?.('.client-tour-layer')
      ? document.getElementById('clientTourReplay') : document.activeElement;
  }
  function welcome() {
    if (!safeProfile() || document.querySelector('dialog[open]')) return;
    stepIndex = 0;
    returnTab = visibleTab();
    save('NOT_STARTED', 0);
    active = true; baseCard(); layer.classList.add('is-welcome');
    card.innerHTML = '<span class="client-tour-count">Bienvenida</span><h2 tabindex="-1">¡Bienvenido a Donas Racha! 🍩</h2><p>Te mostramos dónde encontrar tus puntos, recompensas y pedidos.</p>';
    const actions = document.createElement('div'); actions.className = 'client-tour-actions';
    actions.append(makeButton('Ahora no', () => finish('POSTPONED'), 'secondary'));
    actions.append(makeButton('Conocer mi perfil', () => {
      save('IN_PROGRESS', 0); clearLayer(); start(false);
    }, 'primary'));
    card.append(actions); card.querySelector('h2').focus();
    attachListeners(); position();
  }
  function start(fromBeginning = progress?.status === 'COMPLETED') {
    if (!safeProfile() || document.querySelector('dialog[open]')) return;
    if (!active) returnTab = visibleTab();
    if (active) clearLayer();
    replay = !!fromBeginning;
    stepIndex = fromBeginning ? 0 : Math.max(0, Math.min(STEPS.length - 1, progress?.last_step || 0));
    active = true; suspended = false; baseCard(); attachListeners(); showStep(1);
  }
  function showStep(direction) {
    if (!active || suspended) return;
    while (stepIndex >= 0 && stepIndex < STEPS.length) {
      const step = STEPS[stepIndex];
      window.setClientTab(step.tab);
      target = document.querySelector(step.target);
      if (target && target.getClientRects().length && getComputedStyle(target).visibility !== 'hidden') break;
      stepIndex += direction;
    }
    if (stepIndex >= STEPS.length) return finish('COMPLETED');
    if (stepIndex < 0) { stepIndex = 0; return showStep(1); }
    const step = STEPS[stepIndex];
    card.replaceChildren();
    const count = document.createElement('span'); count.className = 'client-tour-count'; count.textContent = `Paso ${stepIndex + 1} de ${STEPS.length}`;
    const heading = document.createElement('h2'); heading.tabIndex = -1; heading.textContent = step.title;
    const copy = document.createElement('p'); copy.textContent = step.text;
    const actions = document.createElement('div'); actions.className = 'client-tour-actions';
    actions.append(makeButton('Salir', () => finish('POSTPONED'), 'secondary'));
    if (stepIndex) actions.append(makeButton('Anterior', () => move(-1), 'secondary'));
    actions.append(makeButton(stepIndex === STEPS.length - 1 ? 'Terminar' : 'Siguiente',
      () => stepIndex === STEPS.length - 1 ? finish('COMPLETED') : move(1), 'primary'));
    card.append(count, heading, copy, actions);
    target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
    requestAnimationFrame(() => { if (active && !suspended) { position(); heading.focus(); } });
  }
  function move(delta) {
    stepIndex += delta;
    if (!replay) save('IN_PROGRESS', Math.max(0, Math.min(7, stepIndex)));
    showStep(delta);
  }
  function position() {
    if (!layer || suspended) return;
    if (layer.classList.contains('is-welcome')) return;
    if (!target || !target.getClientRects().length) { move(1); return; }
    const width = innerWidth, height = innerHeight, pad = 7;
    const rect = target.getBoundingClientRect();
    const left = Math.max(0, Math.floor(rect.left - pad));
    const right = Math.min(width, Math.ceil(rect.right + pad));
    const top = Math.max(0, Math.floor(rect.top - pad));
    const bottom = Math.min(height, Math.ceil(rect.bottom + pad));
    const cardHeight = card.offsetHeight;
    if (bottom + cardHeight + 24 > height && top - cardHeight - 12 < 12) {
      const roomToScroll = Math.max(0, document.documentElement.scrollHeight - height - scrollY);
      const shift = Math.min(roomToScroll, Math.max(0, bottom + cardHeight + 24 - height), Math.max(0, top - 12));
      if (shift >= 1) {
        window.scrollTo({ top: scrollY + shift, behavior: 'instant' });
        schedulePosition();
        return;
      }
    }
    const boxes = [[0,0,width,top],[0,bottom,width,height-bottom],[0,top,left,bottom-top],[right,top,width-right,bottom-top]];
    panels.forEach((panel,i) => {
      const [x,y,w,h] = boxes[i];
      Object.assign(panel.style, { left:`${x}px`, top:`${y}px`, width:`${Math.max(0,w)}px`, height:`${Math.max(0,h)}px` });
    });
    const ring = layer.querySelector('.client-tour-ring');
    Object.assign(ring.style, { left:`${left}px`, top:`${top}px`, width:`${right-left}px`, height:`${bottom-top}px` });
    const cardWidth = Math.min(360, width - 24);
    let cardTop = bottom + 12;
    if (cardTop + cardHeight > height - 12) cardTop = top - cardHeight - 12;
    if (cardTop < 12) cardTop = Math.max(12, height - cardHeight - 12);
    const cardLeft = Math.max(12, Math.min(width - cardWidth - 12, (left + right - cardWidth) / 2));
    Object.assign(card.style, { width:`${cardWidth}px`, left:`${cardLeft}px`, top:`${cardTop}px` });
  }
  function schedulePosition() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; position(); });
  }
  function onKey(event) {
    if (!active || suspended) return;
    if (event.key === 'Escape') { event.preventDefault(); finish('POSTPONED'); return; }
    if (layer.classList.contains('is-welcome') && event.key !== 'Tab') return;
    if (!layer.classList.contains('is-welcome') && event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    if (!layer.classList.contains('is-welcome') && event.key === 'ArrowLeft' && stepIndex) { event.preventDefault(); move(-1); }
    if (event.key !== 'Tab') return;
    const focusable = [...card.querySelectorAll('button')];
    if (target?.matches('button')) focusable.push(target);
    if (!focusable.length) return;
    const current = focusable.indexOf(document.activeElement);
    const next = current < 0 ? (event.shiftKey ? focusable.at(-1) : focusable[0])
      : focusable[(current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
    event.preventDefault(); next.focus();
  }
  function onClick(event) {
    if (!active || suspended || STEPS[stepIndex]?.action !== 'qr' || !target?.contains(event.target)) return;
    requestAnimationFrame(() => {
      const dialog = document.getElementById('clientQrDialog');
      if (!active || !dialog?.open) return;
      suspended = true; layer.hidden = true;
      dialog.addEventListener('close', () => {
        if (!active) return;
        suspended = false; layer.hidden = false; move(1);
      }, { once: true });
    });
  }
  function attachListeners() {
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
  }
  function clearLayer() {
    window.removeEventListener('resize', schedulePosition);
    window.removeEventListener('scroll', schedulePosition, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onClick, true);
    cancelAnimationFrame(frame); frame = 0;
    layer?.remove(); layer = null; card = null; target = null; panels.length = 0;
    active = false; suspended = false;
  }
  function stop(invalidate = true) {
    const focus = lastFocus;
    clearLayer();
    if (invalidate) { sequence++; customerId = null; token = null; progress = null; }
    if (focus?.isConnected && !focus.closest('dialog[open]')) focus.focus();
    else if (!invalidate) document.getElementById('clientTourReplay')?.focus();
  }
  function finish(status) {
    if (!active) return;
    if (status === 'COMPLETED') save('COMPLETED', 7);
    else save('POSTPONED', Math.max(0, Math.min(7, stepIndex)));
    document.getElementById('clientTourReplay').textContent = status === 'COMPLETED' || replay ? 'Ver tutorial' : 'Retomar tutorial';
    window.setClientTab(returnTab);
    stop(false);
  }
  window.DonasTour = { onLogin, start, stop };
})();
