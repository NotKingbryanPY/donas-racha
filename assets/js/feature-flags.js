(function configureDonasFlags(global) {
  'use strict';
  const query = new URLSearchParams(global.location.search);
  const forceLegacy = query.get('backend') === 'legacy';
  global.DonasFlags = Object.freeze({
    useSupabaseRanking: !forceLegacy,
    useSupabaseProducts: !forceLegacy,
    useSupabaseUserLookup: false,
    compareLegacyReads: query.get('compareReads') === '1'
  });
})(window);
