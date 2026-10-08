/* Progressive decoration. No requests or data calculations. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const connection = navigator.connection;
  const lite = () => reduced.matches || !!connection?.saveData;
  const syncMotion = () => {
    document.documentElement.classList.toggle('motion-lite', !!lite());
    if (lite()) document.getAnimations().forEach(a => { if (a.effect?.getTiming().iterations === Infinity) a.cancel(); else { try { a.finish(); } catch (_) { a.cancel(); } } });
    document.dispatchEvent(new Event('donas:motionchange'));
  };
  reduced.addEventListener('change', syncMotion);
  connection?.addEventListener?.('change', syncMotion);
  syncMotion();
  // The brand entrance belongs to a completed customer login, never page load.
  function customerWelcome({signal, reveal}) {
    if (signal.aborted) return Promise.resolve();
    if (lite() || new URLSearchParams(location.search).get('source') === 'widget') {
      reveal(); return Promise.resolve();
    }
    // A background tab cannot show the entrance. Play it when the customer returns.
    if (document.hidden) return new Promise(resolve => {
      const cleanup = () => {
        document.removeEventListener('visibilitychange', visible);
        signal.removeEventListener('abort', abort);
      };
      const visible = () => {
        if (document.hidden) return;
        cleanup(); resolve(customerWelcome({signal, reveal}));
      };
      const abort = () => { cleanup(); resolve(); };
      document.addEventListener('visibilitychange', visible);
      signal.addEventListener('abort', abort, {once:true});
    });
    return new Promise((resolve,reject) => {
      const intro = document.createElement('div');
      intro.className='brand-intro brand-intro--login'; intro.setAttribute('aria-hidden','true');
      intro.innerHTML='<div class="intro-lockup"><span class="intro-donut"><span class="brand-mark"></span></span><span class="brand-wordmark">DONAS<span>RACHA<span class="brand-dot">.</span></span></span></div>';
      const login = document.getElementById('userOverlay');
      login.inert = true;
      let revealed = false, done = false, revealTimer, endTimer;
      let revealRemaining = 800, endRemaining = 1100, runningSince = 0;
      const cleanup = () => {
        clearTimeout(revealTimer); clearTimeout(endTimer); intro.remove();
        login.inert = login.classList.contains('hidden');
        signal.removeEventListener('abort',abort);
        document.removeEventListener('visibilitychange',onVisibility);
        document.removeEventListener('keydown',skip,true);
        document.removeEventListener('donas:motionchange',onPreferenceChange);
        reduced.removeEventListener('change',onPreferenceChange);
        connection?.removeEventListener?.('change',onPreferenceChange);
      };
      const showProfile = () => {
        if (revealed || signal.aborted) return;
        revealed = true;
        try { reveal(); } catch (error) { done = true; cleanup(); reject(error); }
      };
      const finish = () => { if (done) return; showProfile(); if (done) return; done = true; cleanup(); resolve(); };
      const abort = () => { if (done) return; done = true; cleanup(); resolve(); };
      const skip = event => { if (event.key === 'Escape') { event.preventDefault(); finish(); } };
      // Prepare the profile behind the curtain before its final 300 ms lift.
      const schedule = () => {
        runningSince = performance.now();
        if (!revealed) revealTimer = setTimeout(showProfile,revealRemaining);
        endTimer = setTimeout(finish,endRemaining);
      };
      const onVisibility = () => {
        if (done) return;
        if (document.hidden) {
          const elapsed = performance.now() - runningSince;
          revealRemaining = Math.max(0,revealRemaining-elapsed);
          endRemaining = Math.max(0,endRemaining-elapsed);
          clearTimeout(revealTimer); clearTimeout(endTimer);
          intro.getAnimations({subtree:true}).forEach(animation => animation.pause());
        } else {
          intro.getAnimations({subtree:true}).forEach(animation => animation.play());
          schedule();
        }
      };
      const onPreferenceChange = () => { if (lite()) finish(); };
      signal.addEventListener('abort',abort,{once:true});
      document.addEventListener('visibilitychange',onVisibility);
      document.addEventListener('keydown',skip,true);
      document.addEventListener('donas:motionchange',onPreferenceChange);
      reduced.addEventListener('change',onPreferenceChange);
      connection?.addEventListener?.('change',onPreferenceChange);
      intro.addEventListener('animationend',event=>{if(event.target===intro)finish();});
      document.body.append(intro);
      schedule();
    });
  }
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
  document.addEventListener('donas:motionchange', resetTilt);
  let progressObserver, progressAnimation, progressCanStart=false;
  const stockSnapshots = new Map();
  const stockAnimations = new WeakMap();
  window.DonasMotion = {
    enabled: () => !lite(),
    customerWelcome,
    async profileReady({signal} = {}) {
      if (lite() || document.hidden || signal?.aborted) return;
      // Let the profile's intersection observer start its real progress animation.
      await new Promise(resolve => {
        let first, second, finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(first); cancelAnimationFrame(second);
          signal?.removeEventListener('abort', done);
          resolve();
        };
        signal?.addEventListener('abort', done, {once:true});
        first = requestAnimationFrame(() => { second = requestAnimationFrame(done); });
      });
      if (signal?.aborted || document.hidden) return;
      progressCanStart=false; progressObserver?.disconnect();
      const animation = progressAnimation;
      if (!animation || animation.playState !== 'running') return;
      await new Promise(resolve => {
        const done = () => { signal?.removeEventListener('abort', done); resolve(); };
        signal?.addEventListener('abort', done, {once:true});
        animation.finished.then(done, done);
      });
    },
    stock(root, scope) {
      const previous = stockSnapshots.get(scope) || new Map();
      const next = new Map();
      root.querySelectorAll('[data-stock-key]').forEach(el => {
        const key = el.dataset.stockKey, value = el.dataset.stockValue;
        next.set(key, value);
        if (!previous.has(key) || previous.get(key) === value || !Number.isFinite(Number(value)) || value === '' || previous.get(key) === '' || lite()) return;
        clearTimeout(stockAnimations.get(el));
        el.classList.remove('stock-changed'); void el.offsetWidth;
        el.classList.add('stock-changed');
        stockAnimations.set(el, setTimeout(() => el.classList.remove('stock-changed'), 650));
      });
      stockSnapshots.set(scope, next);
    },
    panel(next) {
      // Keep the focused tab/button unless the action hid its originating panel.
      const active = document.activeElement;
      if (active && active !== document.body && active.getClientRects().length) return;
      const target = next?.querySelector('h1,h2,h3') || next;
      if (target) { target.tabIndex = -1; target.focus({preventScroll:true}); }
    },
    profile(client) {
      const bar = document.getElementById('levelProgress');
      const pct = Math.max(0, Math.min(100, Number(client.progressLevelPct) || 0));
      bar.parentElement.setAttribute('aria-valuenow', String(pct));
      document.getElementById('clientStreak').parentElement.classList.toggle('streak-active', Number(client.currentStreak) > 0);
      progressObserver?.disconnect(); progressAnimation?.cancel(); progressCanStart=true;
      if (!lite() && 'IntersectionObserver' in window && bar.animate) {
        progressObserver = new IntersectionObserver(entries => {
          if (!progressCanStart || !entries.some(e => e.isIntersecting)) return;
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
        if (heading && !next.contains(document.activeElement)) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
        if (!overlay) window.scrollTo({top:0,behavior:'instant'});
      }
    }
    document.querySelectorAll('.tabs .tab').forEach(btn => btn.setAttribute('aria-pressed', String(btn.classList.contains('active'))));
  }
  const views = new MutationObserver(syncViews);
  document.querySelectorAll('.overlay,.screen,.tab').forEach(el => views.observe(el, {attributes:true,attributeFilter:['class']}));
  syncViews();
})();
