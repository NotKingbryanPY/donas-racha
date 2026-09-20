/* Transport shared by the existing screens; no persistent customer cache. */
(() => {
  'use strict';
  const rankings = new Map();
  let generation = 0;
  const invalidate = () => { generation++; rankings.clear(); };
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error('No se pudo conectar con el servicio (' + response.status + ').');
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(options.method === 'POST'
        ? 'La respuesta tardó demasiado. Verifica el resultado antes de repetir la operación.'
        : 'La consulta tardó demasiado. Intenta nuevamente.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  window.DonasApi = {
    invalidate,
    get(base, action, params = {}) {
      const url = new URL(base);
      url.searchParams.set('action', action);
      Object.keys(params).sort().forEach(k => url.searchParams.set(k, params[k]));
      if (action !== 'getRanking') return request(url.toString());
      const key = url.toString();
      const cached = rankings.get(key);
      if (cached && (cached.pending || cached.expires > Date.now())) return cached.promise;
      const entry = { pending:true, expires:0, promise:null };
      const version = generation;
      entry.promise = request(key).then(data => {
        entry.pending = false;
        entry.expires = Date.now() + 15000;
        if (!data.ok || version !== generation) {
          if (rankings.get(key) === entry) rankings.delete(key);
        }
        return data;
      }, error => {
        if (rankings.get(key) === entry) rankings.delete(key);
        throw error;
      });
      rankings.set(key, entry);
      return entry.promise;
    },
    async post(base, payload) {
      invalidate();
      try { return await request(base, { method:'POST', body:JSON.stringify(payload) }); }
      finally { invalidate(); }
    }
  };
})();

