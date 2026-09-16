/* Progressive decoration. No requests, data calculations, or scanner lifecycle changes. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const connection = navigator.connection;
  const lite = () => reduced.matches || !!connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const syncMotion = () => {
    document.documentElement.classList.toggle('motion-lite', !!lite());
    if (lite()) document.getAnimations().forEach(a => { if (a.effect?.getTiming().iterations === Infinity) a.cancel(); else { try { a.finish(); } catch (_) { a.cancel(); } } });
  };
  reduced.addEventListener('change', syncMotion);
  connection?.addEventListener?.('change', syncMotion);
  syncMotion();
  const seen = new WeakSet();
  const reveals = ' .feature-card, #screen-client .card, #screen-client .stat-card, #screen-client .rank-item, #screen-client .shop-item, #screen-ranking .rank-item';
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(({target, isIntersecting}) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      if (!lite()) {
        const siblings = [...target.parentElement.children];
        target.style.animationDelay = `${Math.min(siblings.indexOf(target), 5) * 35}ms`;
        target.classList.add('motion-reveal');
        target.addEventListener('animationend', () => { target.classList.remove('motion-reveal'); target.style.removeProperty('animation-delay'); }, {once:true});
      }
    });
  }, {threshold:.12}) : null;
  function discover(root = document) {
    root.querySelectorAll(reveals).forEach(el => {
      if (!seen.has(el)) { seen.add(el); observer?.observe(el); }
    });
    root.querySelectorAll('.result-item[onclick], .rank-item[onclick]').forEach(el => {
      if (!el.getAttribute('onclick')) return;
      el.setAttribute('role', 'button'); el.tabIndex = 0;
    });
  }
  discover();
  ['searchResults','hitosWrap','shopItems','clientInlineRanking','clientRankingList','rankingList','home-ranking','adminRanking'].forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(() => discover(el.parentElement)).observe(el, {childList:true});
  });
  document.addEventListener('keydown', e => {
    const el = e.target.closest('.result-item[role="button"], .rank-item[role="button"]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
  });
  // Decorative pointer tilt only on fine pointers. Each frame is coalesced.
  let frame = 0, tilted = null;
  function resetTilt() {
    cancelAnimationFrame(frame); frame = 0;
    if (tilted) { tilted.style.removeProperty('transform'); tilted.style.removeProperty('will-change'); tilted = null; }
  }
  document.addEventListener('pointermove', e => {
    if (lite() || !fine.matches || e.pointerType === 'touch') { resetTilt(); return; }
    const target = e.target.closest('.hero-art, .feature-card, #screen-client .shop-item');
    if (!target) { resetTilt(); return; }
    const surface = target.matches('.hero-art') ? target.querySelector('.hero-media') : target;
    if (tilted !== surface) { resetTilt(); tilted = surface; }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (e.clientX-r.left)/r.width*2-1));
      const y = Math.max(-1, Math.min(1, (e.clientY-r.top)/r.height*2-1));
      surface.style.willChange = 'transform';
      surface.style.transform = `perspective(950px) rotateX(${-y*3}deg) rotateY(${x*3}deg)`;
    });
  }, {passive:true});
  document.documentElement.addEventListener('pointerleave', resetTilt);
  fine.addEventListener('change', resetTilt);
  reduced.addEventListener('change', resetTilt);
  let progressObserver, progressAnimation;
  window.DonasMotion = {
    profile(client) {
      const bar = document.getElementById('levelProgress');
      const pct = Math.max(0, Math.min(100, Number(client.progressLevelPct) || 0));
      bar.parentElement.setAttribute('aria-valuenow', String(pct));
      document.getElementById('clientStreak').parentElement.classList.toggle('streak-active', Number(client.currentStreak) > 0);
      progressObserver?.disconnect(); progressAnimation?.cancel();
      if (!lite() && 'IntersectionObserver' in window && bar.animate) {
        progressObserver = new IntersectionObserver(entries => {
          if (!entries.some(e => e.isIntersecting)) return;
          progressObserver.disconnect();
          progressAnimation = bar.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}], {duration:800,easing:'cubic-bezier(.22,.68,0,1)'});
        }, {threshold:.3});
        progressObserver.observe(bar.parentElement);
      }
    },
    purchase(previous, current) {
      if (lite()) return;
      const pop = (el, cls) => {
        el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
        el.addEventListener('animationend', () => el.classList.remove(cls), {once:true});
      };
      if (Number(current.currentStreak) > Number(previous.currentStreak)) pop(document.getElementById('clientStreak'), 'streak-pop');
      const old = new Set((previous.hitosRacha || []).map(Number));
      [...document.querySelectorAll('#hitosWrap .hito')].forEach((el, i) => {
        if (el.classList.contains('active') && !old.has([3,7,14,21,30][i])) pop(el, 'milestone-pop');
      });
    }
  };
  // Keep background screens out of keyboard and assistive technology navigation.
  let activeView;
  function syncViews() {
    const overlays = [...document.querySelectorAll('.overlay')];
    const overlay = overlays.find(el => !el.classList.contains('hidden'));
    document.querySelectorAll('.screen').forEach(el => { el.inert = !!overlay || !el.classList.contains('active'); });
    overlays.forEach(el => { el.inert = el !== overlay; });
    const next = overlay || document.querySelector('.screen.active');
    if (next !== activeView) {
      resetTilt(); activeView = next;
      if (next) {
        const heading = next.querySelector('h1,h2');
        if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
        if (!overlay) window.scrollTo({top:0,behavior:'instant'});
      }
    }
    document.querySelectorAll('.tabs .tab').forEach(btn => btn.setAttribute('aria-pressed', String(btn.classList.contains('active'))));
  }
  const views = new MutationObserver(syncViews);
  document.querySelectorAll('.overlay,.screen,.tab').forEach(el => views.observe(el, {attributes:true,attributeFilter:['class']}));
  syncViews();
})();
