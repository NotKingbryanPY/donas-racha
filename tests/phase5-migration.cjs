const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const { transformExport, deterministicUuid } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts', 'phase5-migrate.mjs')));
  const headers = {
    Clientes: ['ID','Nombre','WhatsApp','FechaRegistro','RachaActual','TotalCompras','UltimaCompra','PuntosTotales','PuntosDisponibles','PuntosPorCompras','NivelClave','TemporadaActual'],
    Registros: ['IDRegistro','IDCliente','FechaHora','Tipo','RachaResultante','PuntosOtorgados','NivelResultante','Fuente','Notas'],
    Insignias: ['InsigniaID','Nombre','Emoji','Tipo','CondicionCampo','CondicionValor','Activa','Descripcion','Orden'],
    ClienteInsignias: ['ID','ClienteID','InsigniaID','FechaAsignacion','Fuente'],
    TemporadasRacha: ['TemporadaID','ClienteID','NumeroTemporada','FechaInicio','FechaFin','RachaCompletada','HitosAlcanzados','PuntosConservados','NivelConservado','Estado','Fuente'],
    TiendaRecompensas: ['ItemID','Nombre','Emoji','CostoPuntos','Tipo','Valor','Activa','Descripcion','Orden'],
    Canjes: ['CanjeID','ClienteID','ItemID','NombreItem','PuntosGastados','FechaHora','Estado','Fuente','Notas']
  };
  const payload = {
    schemaVersion: 1,
    source: 'GOOGLE_SHEETS',
    exportedAt: '2026-09-22T12:00:00.000Z',
    sheets: {
      Clientes: { headers: headers.Clientes, rows: [['C1234','Ana','6000-0000','2026-01-01T00:00:00.000Z',4,3,'2026-09-20T12:00:00.000Z',30,20,30,'BRONCE',1]] },
      Registros: { headers: headers.Registros, rows: [['R1','C1234','2026-09-19T12:00:00.000Z','purchase',3,30,'Bronce','app','Compra']] },
      Insignias: { headers: headers.Insignias, rows: [['PRIMER_MORDISCO','Primer Mordisco','🥉','compras','TotalCompras',1,'TRUE','Primera compra',1]] },
      ClienteInsignias: { headers: headers.ClienteInsignias, rows: [['CI1','C1234','PRIMER_MORDISCO','2026-09-19T12:00:00.000Z','auto']] },
      TemporadasRacha: { headers: headers.TemporadasRacha, rows: [['T1','C1234',1,'2026-01-01T00:00:00.000Z','2026-09-01T00:00:00.000Z',30,'3,7,14,21,30',30,'Bronce','completada','app']] },
      TiendaRecompensas: { headers: headers.TiendaRecompensas, rows: [['DESC_10','10% de descuento','🏷️',10,'descuento','10%','TRUE','Descuento',2]] },
      Canjes: { headers: headers.Canjes, rows: [['X1','C1234','DESC_10','10% de descuento',10,'2026-09-20T12:00:00.000Z','completado','app','Entregado']] }
    }
  };

  const first = transformExport(payload);
  const second = transformExport(payload);
  assert.equal(first.report.summary.invalid, 0);
  assert.equal(first.data.customers.length, 1);
  assert.equal(first.data.customers[0].whatsapp_e164, '+50760000000');
  assert.equal(first.data.accounts[0].available_points, 20);
  assert.equal(first.data.transactions.length, 2);
  assert.equal(first.data.badges[0].condition_type, 'PURCHASE_COUNT');
  assert.equal(first.data.rewards[0].reward_type, 'DISCOUNT');
  assert.deepEqual(first.data.transactions.map(item => item.balance_after), [30, 20]);
  assert.equal(first.data.seasons[0].preserved_level_key, 'BRONCE');
  assert.equal(first.data.customerBadges[0].badge_key, 'PRIMER_MORDISCO');
  assert.equal(first.data.redemptions[0].status, 'FULFILLED');
  assert.equal(first.data.redemptions[0].fulfilled_at, '2026-09-20T12:00:00.000Z');
  assert.equal(first.report.fingerprint, second.report.fingerprint);
  assert.equal(deterministicUuid('customer:C1234'), first.data.customers[0].id);
  console.log('PASS phase 5 migration: normalize, preserve balances, deterministic IDs and report');
})().catch(error => { console.error(error); process.exitCode = 1; });
