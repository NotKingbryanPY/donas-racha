(function configureDonasFlags(global) {
  'use strict';
  const query = new URLSearchParams(global.location.search);
  const forceLegacy = query.get('backend') === 'legacy';
  global.DonasFlags = Object.freeze({
    useSupabaseProducts: !forceLegacy,
    useSupabaseUserLookup: false
  });
})(window);
