// ============================================================
//  DONAS RACHA V2 CORE — Backend API Google Apps Script
//  PWA + Fidelización + Gamificación + Migración segura
// ============================================================

const SHEET_ID_FALLBACK = ''; // Configure SPREADSHEET_ID in Script Properties.
const APP_PASSWORD_FALLBACK = ''; // No built-in administrative credential.
const SYSTEM_VERSION = '2.1.1-performance';

const SHEETS = {
  CLIENTES: 'Clientes',
  REGISTROS: 'Registros',
  CONFIG: 'Config',
  INSIGNIAS: 'Insignias',
  CLIENTE_INSIGNIAS: 'ClienteInsignias',
  TEMPORADAS: 'TemporadasRacha',
  MIGRACION: 'Migracion',
  TIENDA: 'TiendaRecompensas',
  CANJES: 'Canjes'
};

const CLIENTES_HEADERS = [
  'ID','Nombre','WhatsApp','FechaRegistro','RachaActual','TotalCompras','RecompensasGanadas','CanjesRealizados','UltimaCompra','QR_URL',
  'PuntosTotales','PuntosDisponibles','PuntosPorCompras','NivelClave','NivelNombre','NivelEmoji','ProgresoNivelPct',
  'PuntosSiguienteNivel','HitosRacha','TemporadaActual','TemporadasCompletadas','FechaActualizacion','MigradoV2'
];

const REGISTROS_HEADERS = [
  'IDRegistro','IDCliente','NombreCliente','FechaHora','Tipo','RachaResultante','PuntosOtorgados','NivelResultante','PremioGenerado','Fuente','Notas'
];

const CONFIG_ROWS = [
  ['MODO_RACHA', 'diario', 'Modo de racha: diario o semanal'],
  ['DIAS_TOLERANCIA', 3, 'Días máximos sin comprar antes de romper racha'],
  ['COMPRAS_RECOMPENSA', 0, 'LEGACY: premio automático desactivado; la tienda usa canjes por puntos'],
  ['NOMBRE_NEGOCIO', 'Donas Racha UTP', 'Nombre mostrado en la app'],
  ['PRECIO_DONA', 1, 'Precio de venta por dona'],
  ['ACTIVO', 'TRUE', 'Sistema activo: TRUE/FALSE'],
  ['ADMIN_PASSWORD', APP_PASSWORD_FALLBACK, 'Contraseña de vendedor/admin; cambia este valor después de migrar'],
  ['PUNTOS_POR_COMPRA', 10, 'LEGACY: puntos base por compra; usa PUNTOS_RACHA_BASE para el sistema nuevo'],
  ['PUNTOS_RACHA_BASE', 10, 'Puntos por compra con racha 1-2'],
  ['PUNTOS_RACHA_3', 12, 'Puntos por compra desde racha 3'],
  ['PUNTOS_RACHA_7', 15, 'Puntos por compra desde racha 7'],
  ['PUNTOS_RACHA_14', 17, 'Puntos máximos por compra desde racha 14 en adelante'],
  ['MIGRACION_V2_COMPLETA', 'FALSE', 'Marca si la migración v2 ya fue completada'],
  ['FECHA_MIGRACION_V2', '', 'Fecha de la migración v2'],
  ['VERSION_SISTEMA', SYSTEM_VERSION, 'Versión lógica del backend']
];

const INSIGNIAS_HEADERS = ['InsigniaID','Nombre','Emoji','Tipo','CondicionCampo','CondicionValor','Activa','Descripcion','Orden'];
const CLIENTE_INSIGNIAS_HEADERS = ['ID','ClienteID','InsigniaID','Nombre','Emoji','FechaAsignacion','Fuente'];
const TEMPORADAS_HEADERS = ['TemporadaID','ClienteID','NumeroTemporada','FechaInicio','FechaFin','RachaCompletada','HitosAlcanzados','PuntosConservados','NivelConservado','Estado','Fuente'];
const MIGRACION_HEADERS = ['ID','Fecha','Version','ClientesProcesados','ClientesActualizados','InsigniasAsignadas','TemporadasCreadas','Estado','Detalle'];
const TIENDA_HEADERS = ['ItemID','Nombre','Emoji','CostoPuntos','Tipo','Valor','Activa','Descripcion','Orden'];
const CANJES_HEADERS = ['CanjeID','ClienteID','NombreCliente','ItemID','NombreItem','PuntosGastados','FechaHora','Estado','Fuente','Notas'];

const LEVELS = [
  { key:'BRONCE',  name:'Bronce',          emoji:'🥉', min:0 },
  { key:'PLATA',   name:'Plata',           emoji:'🥈', min:200 },
  { key:'ORO',     name:'Oro',             emoji:'🥇', min:500 },
  { key:'DIAMANTE',name:'Diamante',        emoji:'💎', min:1000 },
  { key:'MAESTRO', name:'Maestro Donero',  emoji:'👑', min:2000 }
];

const HITO_RACHA = [3, 7, 14, 21, 30];
const CACHE_TTL_SECONDS = 60;

let __ssCache = null;
let __configCache = null;
let __request = null;

// Memoization is strictly bounded to one HTTP request, never a cross-user cache.
function beginRequest_() {
  __ssCache = null;
  __configCache = null;
  __request = { headers:new Map(), rows:new Map(), clients:new Map(), ids:null,
    reads:0, cells:0, readMs:0, started:Date.now() };
}
function invalidateSheet_(sh) {
  if (!__request) return;
  __request.headers.delete(sh.getName());
  __request.rows.delete(sh.getName());
  if (sh.getName() === SHEETS.CLIENTES) { __request.clients.clear(); __request.ids = null; }
}
function readValues_(range) {
  const start = Date.now();
  const values = range.getValues();
  if (__request) {
    __request.reads++;
    __request.cells += values.length * (values[0] || []).length;
    __request.readMs += Date.now() - start;
  }
  return values;
}
function finishRequest_() {
  if (__request && PropertiesService.getScriptProperties().getProperty('PERF_LOG') === 'true') {
    console.log(JSON.stringify({ event:'request_performance', reads:__request.reads,
      cells:__request.cells, sheetReadMs:__request.readMs, totalMs:Date.now()-__request.started }));
  }
  __request = null;
}
// Initialization remains an explicit administrative action, not part of every sale.
function requireOperationalSheets_() {
  const expected = [ [SHEETS.CLIENTES,CLIENTES_HEADERS], [SHEETS.REGISTROS,REGISTROS_HEADERS],
    [SHEETS.CONFIG,['Clave','Valor']], [SHEETS.CLIENTE_INSIGNIAS,CLIENTE_INSIGNIAS_HEADERS],
    [SHEETS.TEMPORADAS,TEMPORADAS_HEADERS], [SHEETS.CANJES,CANJES_HEADERS], [SHEETS.TIENDA,TIENDA_HEADERS] ];
  expected.forEach(([name, headers]) => {
    const sh = getSpreadsheet().getSheetByName(name);
    if (!sh || headers.some(h => !getHeaderMap_(sh)[h])) {
      throw new Error('Esquema incompleto. Un administrador debe ejecutar initSheets antes de operar.');
    }
  });
}

const DEFAULT_BADGES = [
  { id:'PRIMER_MORDISCO', nombre:'Primer Mordisco', emoji:'🥉', tipo:'compras', campo:'TotalCompras', valor:1, descripcion:'Primera compra registrada.', orden:1 },
  { id:'CLIENTE_FRECUENTE', nombre:'Cliente Frecuente', emoji:'🥈', tipo:'compras', campo:'TotalCompras', valor:5, descripcion:'5 compras acumuladas.', orden:2 },
  { id:'DONA_LOVER', nombre:'Dona Lover', emoji:'🥇', tipo:'compras', campo:'TotalCompras', valor:20, descripcion:'20 compras acumuladas.', orden:3 },
  { id:'REY_DONAS', nombre:'Rey de las Donas', emoji:'👑', tipo:'compras', campo:'TotalCompras', valor:50, descripcion:'50 compras acumuladas.', orden:4 },
  { id:'MAESTRO_RACHAS', nombre:'Maestro de Rachas', emoji:'🔥', tipo:'racha', campo:'RachaActual', valor:30, descripcion:'Completar una temporada de racha de 30 compras.', orden:5 },
  { id:'CLIENTE_VIP', nombre:'Cliente VIP', emoji:'🎉', tipo:'compras', campo:'TotalCompras', valor:100, descripcion:'100 compras acumuladas.', orden:6 }
];

// Edita esta lista para cambiar fácilmente los productos de la tienda.
// También puedes modificar la hoja "TiendaRecompensas" después de ejecutar initSheets.
const DEFAULT_SHOP_ITEMS = [
  { id:'DONA_GRATIS', nombre:'Dona gratis', emoji:'🍩', costo:150, tipo:'producto', valor:'1 dona', descripcion:'Canjeable por una dona gratis.', orden:1 },
  { id:'DESC_10', nombre:'10% de descuento', emoji:'🏷️', costo:60, tipo:'descuento', valor:'10%', descripcion:'Descuento de 10% en una compra.', orden:2 },
  { id:'DESC_25', nombre:'25% de descuento', emoji:'💸', costo:130, tipo:'descuento', valor:'25%', descripcion:'Descuento de 25% en una compra.', orden:3 },
  { id:'DONA_PREMIUM', nombre:'Dona especial', emoji:'✨', costo:220, tipo:'producto', valor:'1 dona premium', descripcion:'Canje por una dona especial o edición limitada.', orden:4 },
  { id:'PACK_AMIGO', nombre:'Pack amigo', emoji:'🎁', costo:300, tipo:'producto', valor:'2 donas', descripcion:'Canje por dos donas para compartir.', orden:5 }
];

// ============================================================
//  Spreadsheet / HTTP helpers
// ============================================================

function getSpreadsheet() {
  if (__ssCache) return __ssCache;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID') || SHEET_ID_FALLBACK;
  __ssCache = (id && id !== 'PEGA_AQUI_TU_SPREADSHEET_ID')
    ? SpreadsheetApp.openById(id)
    : SpreadsheetApp.getActiveSpreadsheet();
  return __ssCache;
}

function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function corsResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  beginRequest_();
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || '';
  try {
    if (!action) return corsResponse({ ok:true, app:'Donas Racha API', version:SYSTEM_VERSION });
    if (action === 'verificarPassword') return corsResponse({ ok: verificarPassword(params.password || '') });

    let result;
    switch (action) {
      case 'getCliente':       result = getCliente(params); break;
      case 'buscarCliente':    result = buscarCliente(params); break;
      case 'getTodosClientes': result = getTodosClientes(params); break;
      case 'getRanking':       result = getRanking(params); break;
      case 'getStats':         result = getStats(); break;
      case 'getConfig':        result = getConfigPublic(); break;
      case 'getTienda':        result = getTienda(params); break;
      case 'getPublicData':    result = getRanking({ type:'racha', limit:10 }); break;
      default: result = { ok:false, error:'Acción desconocida: ' + action };
    }
    return corsResponse(result);
  } catch (err) {
    return corsResponse({ ok:false, error:String(err && err.message ? err.message : err) });
  } finally {
    finishRequest_();
  }
}

function doPost(e) {
  beginRequest_();
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = body.action || '';
    let result;

    switch (action) {
      case 'initSheets':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = initSheets();
        break;
      case 'migrarClientesExistentes':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = migrarClientesExistentes();
        break;
      case 'registrarCompra':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = registrarCompra(body);
        break;
      case 'canjearRecompensa':
      case 'canjearItem':
        result = canjearRecompensa(body);
        break;
      case 'nuevoCliente':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = nuevoCliente(body);
        break;
      case 'eliminarCliente':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = eliminarCliente(body);
        break;
      case 'saveConfig':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = saveConfig(body);
        break;
      case 'getAdminDashboard':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = getAdminDashboard(body);
        break;
      case 'recalcularNivelCliente':
        if (!requireAdmin(body)) return corsResponse({ ok:false, error:'No autorizado' });
        result = recalcularNivelCliente(body.id || body.clientId);
        break;
      default:
        result = { ok:false, error:'Acción desconocida: ' + action };
    }
    return corsResponse(result);
  } catch (err) {
    return corsResponse({ ok:false, error:String(err && err.message ? err.message : err) });
  } finally {
    finishRequest_();
  }
}

function requireAdmin(body) {
  return verificarPassword((body && (body.adminPassword || body.password)) || '');
}

function verificarPassword(password) {
  const cfg = getConfig();
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || cfg.ADMIN_PASSWORD;
  return !!expected && String(password || '') === String(expected);
}

// ============================================================
//  Inicialización de hojas sin borrar datos existentes
// ============================================================

function initSheets() {
  const ss = getSpreadsheet();
  ensureSheet_(ss, SHEETS.CLIENTES, CLIENTES_HEADERS, '#4a4a8a');
  ensureSheet_(ss, SHEETS.REGISTROS, REGISTROS_HEADERS, '#2d6a4f');
  ensureSheet_(ss, SHEETS.CONFIG, ['Clave','Valor','Descripción'], '#E8683A');
  ensureSheet_(ss, SHEETS.INSIGNIAS, INSIGNIAS_HEADERS, '#6D28D9');
  ensureSheet_(ss, SHEETS.CLIENTE_INSIGNIAS, CLIENTE_INSIGNIAS_HEADERS, '#7C3AED');
  ensureSheet_(ss, SHEETS.TEMPORADAS, TEMPORADAS_HEADERS, '#C2410C');
  ensureSheet_(ss, SHEETS.MIGRACION, MIGRACION_HEADERS, '#111827');
  ensureSheet_(ss, SHEETS.TIENDA, TIENDA_HEADERS, '#0F766E');
  ensureSheet_(ss, SHEETS.CANJES, CANJES_HEADERS, '#BE123C');
  seedConfig_();
  seedInsignias_();
  seedTienda_();
  clearRuntimeCaches_();
  if (__request) { __request.headers.clear(); __request.rows.clear(); __request.clients.clear(); __request.ids = null; }
  return { ok:true, message:'Hojas creadas/actualizadas sin borrar datos ✅', version:SYSTEM_VERSION };
}

function ensureSheet_(ss, name, headers, color) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const lastCol = Math.max(sh.getLastColumn(), 1);
    let existing = readValues_(sh.getRange(1, 1, 1, lastCol))[0].map(h => String(h || '').trim());
    if (existing.every(h => !h)) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      existing = headers.slice();
    }
    const missing = headers.filter(h => existing.indexOf(h) === -1);
    if (missing.length) {
      sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  }

  const headerRange = sh.getRange(1, 1, 1, sh.getLastColumn());
  headerRange.setFontWeight('bold').setBackground(color).setFontColor('white');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, Math.min(sh.getLastColumn(), 12));
  return sh;
}

function seedConfig_() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.CONFIG);
  const map = keyRowMap_(sh, 'Clave');
  CONFIG_ROWS.forEach(row => {
    const key = row[0];
    if (map[key]) {
      const current = sh.getRange(map[key], 2).getValue();
      if (isBlank_(current)) sh.getRange(map[key], 2).setValue(row[1]);
      sh.getRange(map[key], 3).setValue(row[2]);
    } else {
      sh.appendRow(row);
    }
  });
}

function seedInsignias_() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.INSIGNIAS);
  const map = keyRowMap_(sh, 'InsigniaID');
  DEFAULT_BADGES.forEach(b => {
    const row = [b.id, b.nombre, b.emoji, b.tipo, b.campo, b.valor, 'TRUE', b.descripcion, b.orden];
    if (map[b.id]) {
      sh.getRange(map[b.id], 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
  });
}

function seedTienda_() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.TIENDA);
  const map = keyRowMap_(sh, 'ItemID');
  DEFAULT_SHOP_ITEMS.forEach(item => {
    const row = [item.id, item.nombre, item.emoji, item.costo, item.tipo, item.valor, 'TRUE', item.descripcion, item.orden];
    if (!map[item.id]) sh.appendRow(row);
  });
}

// ============================================================
//  Configuración
// ============================================================

function getConfig() {
  if (__configCache) return Object.assign({}, __configCache);

  const cache = getScriptCache_();
  if (cache) {
    const cached = cache.get('donas_config_v2');
    if (cached) {
      __configCache = normalizeConfig_(JSON.parse(cached));
      return Object.assign({}, __configCache);
    }
  }

  const defaults = {};
  CONFIG_ROWS.forEach(r => defaults[r[0]] = r[1]);
  const sh = getSpreadsheet().getSheetByName(SHEETS.CONFIG);
  if (!sh || sh.getLastRow() < 2) {
    __configCache = normalizeConfig_(defaults);
    return Object.assign({}, __configCache);
  }
  const data = readValues_(sh.getRange(2, 1, sh.getLastRow() - 1, 2));
  const cfg = Object.assign({}, defaults);
  data.forEach(r => {
    const key = String(r[0] || '').trim();
    if (key) cfg[key] = r[1];
  });
  __configCache = normalizeConfig_(cfg);
  if (cache) cache.put('donas_config_v2', JSON.stringify(__configCache), CACHE_TTL_SECONDS);
  return Object.assign({}, __configCache);
}

function normalizeConfig_(cfg) {
  cfg.DIAS_TOLERANCIA = toInt_(cfg.DIAS_TOLERANCIA, 3);
  cfg.COMPRAS_RECOMPENSA = toInt_(cfg.COMPRAS_RECOMPENSA, 0);
  cfg.PRECIO_DONA = toFloat_(cfg.PRECIO_DONA, 1);
  cfg.PUNTOS_POR_COMPRA = toInt_(cfg.PUNTOS_POR_COMPRA, 10);
  cfg.PUNTOS_RACHA_BASE = toInt_(cfg.PUNTOS_RACHA_BASE, cfg.PUNTOS_POR_COMPRA || 10);
  cfg.PUNTOS_RACHA_3 = toInt_(cfg.PUNTOS_RACHA_3, 12);
  cfg.PUNTOS_RACHA_7 = toInt_(cfg.PUNTOS_RACHA_7, 15);
  cfg.PUNTOS_RACHA_14 = toInt_(cfg.PUNTOS_RACHA_14, 17);
  cfg.ACTIVO = String(cfg.ACTIVO).toUpperCase() !== 'FALSE';
  return cfg;
}

function getConfigPublic() {
  const cfg = getConfig();
  delete cfg.ADMIN_PASSWORD;
  return { ok:true, config:cfg };
}

function saveConfig(body) {
  if (__request) { __request.headers.clear(); __request.rows.clear(); }
  const sh = getSpreadsheet().getSheetByName(SHEETS.CONFIG);
  if (!sh) return { ok:false, error:'Hoja Config no encontrada' };
  const incoming = body.config || {};
  const rows = keyRowMap_(sh, 'Clave');
  Object.keys(incoming).forEach(key => {
    if (key === 'ADMIN_PASSWORD' && !incoming[key]) return;
    if (rows[key]) sh.getRange(rows[key], 2).setValue(incoming[key]);
    else sh.appendRow([key, incoming[key], 'Agregado desde panel admin']);
  });
  clearRuntimeCaches_();
  return { ok:true, message:'Configuración guardada' };
}

// ============================================================
//  Clientes / Perfil
// ============================================================

function getClientesSheet() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.CLIENTES);
  if (!sh) throw new Error('Hoja Clientes no encontrada. Ejecuta initSheets primero.');
  return sh;
}

function getCliente(params) {
  const id = params.id || params.clientId || '';
  if (!id) return { ok:false, error:'ID requerido' };
  const found = findClientById_(id);
  if (!found) return { ok:false, error:'Cliente no encontrado' };
  return { ok:true, client: clientRowToObj_(found.row, found.map, true) };
}

function buscarCliente(params) {
  const q = String(params.q || '').toLowerCase().trim();
  if (!q) return { ok:false, error:'Búsqueda vacía' };
  const sh = getClientesSheet();
  const map = getHeaderMap_(sh);
  const rows = getRows_(sh);
  const clients = rows
    .filter(r => String(get_(r, map, 'Nombre') || '').toLowerCase().includes(q) || String(get_(r, map, 'WhatsApp') || '').includes(q))
    .map(r => clientRowToObj_(r, map, false));
  return { ok:true, clients:clients };
}

function getTodosClientes(params) {
  const sh = getClientesSheet();
  const map = getHeaderMap_(sh);
  const includeDetails = String((params && params.details) || '').toLowerCase() === 'true';
  const clients = getRows_(sh).map(r => clientRowToObj_(r, map, includeDetails));
  return { ok:true, clients:clients };
}

function nuevoCliente(body) {
  requireOperationalSheets_();
  const sh = getClientesSheet();
  const map = getHeaderMap_(sh);
  const name = String(body.name || '').trim();
  const whatsapp = String(body.whatsapp || '').trim();
  if (!name) return { ok:false, error:'Nombre requerido' };
  if (whatsapp && existsClientByWhatsapp_(whatsapp)) return { ok:false, error:'Ya existe un cliente con ese WhatsApp' };

  const id = 'C' + Date.now();
  const now = new Date();
  const points = 0;
  const level = calcularProgresoNivel(points);
  const qrUrl = buildQrUrl_(id);

  appendObject_(sh, {
    ID:id,
    Nombre:name,
    WhatsApp:whatsapp,
    FechaRegistro:now,
    RachaActual:0,
    TotalCompras:0,
    RecompensasGanadas:0,
    CanjesRealizados:0,
    UltimaCompra:'',
    QR_URL:qrUrl,
    PuntosTotales:0,
    PuntosDisponibles:0,
    PuntosPorCompras:0,
    NivelClave:level.current.key,
    NivelNombre:level.current.name,
    NivelEmoji:level.current.emoji,
    ProgresoNivelPct:level.progressPct,
    PuntosSiguienteNivel:level.pointsToNext,
    HitosRacha:'',
    TemporadaActual:1,
    TemporadasCompletadas:0,
    FechaActualizacion:now,
    MigradoV2:'TRUE'
  });

  const created = findClientById_(id);
  return { ok:true, client:clientRowToObj_(created.row, created.map, true) };
}

function eliminarCliente(body) {
  const id = body.id || body.clientId || '';
  if (!id) return { ok:false, error:'ID requerido' };
  const sh = getClientesSheet();
  const found = findClientById_(id);
  if (!found) return { ok:false, error:'Cliente no encontrado' };
  invalidateSheet_(sh);
  sh.deleteRow(found.rowNum);
  return { ok:true, message:'Cliente eliminado' };
}

function clientRowToObj_(row, map, includeDetails) {
  const cfg = getConfig();
  const id = String(get_(row, map, 'ID') || '');
  const total = toInt_(get_(row, map, 'TotalCompras'), 0);
  const rewards = toInt_(get_(row, map, 'RecompensasGanadas'), 0);
  const redemptions = toInt_(get_(row, map, 'CanjesRealizados'), rewards);
  const currentStreak = toInt_(get_(row, map, 'RachaActual'), 0);
  const fallbackPoints = total * cfg.PUNTOS_RACHA_BASE;
  const pointsTotal = toInt_(get_(row, map, 'PuntosTotales'), fallbackPoints);
  const pointsAvailable = toInt_(get_(row, map, 'PuntosDisponibles'), pointsTotal);
  const level = calcularProgresoNivel(pointsTotal);
  const hitos = parseHitos_(get_(row, map, 'HitosRacha'));
  const regDate = get_(row, map, 'FechaRegistro');
  const lastPurchase = get_(row, map, 'UltimaCompra');

  const client = {
    id:id,
    name:String(get_(row, map, 'Nombre') || ''),
    whatsapp:String(get_(row, map, 'WhatsApp') || ''),
    registrationDate:toIso_(regDate),
    currentStreak:currentStreak,
    totalPurchases:total,
    rewardsEarned:redemptions,
    redemptionsMade:redemptions,
    lastPurchase:toIso_(lastPurchase),
    qrUrl:String(get_(row, map, 'QR_URL') || buildQrUrl_(id)),
    purchasedToday:includeDetails ? isPurchasedToday(id) : false,
    pointsTotal:pointsTotal,
    pointsAvailable:pointsAvailable,
    pointsFromPurchases:toInt_(get_(row, map, 'PuntosPorCompras'), fallbackPoints),
    levelKey:String(get_(row, map, 'NivelClave') || level.current.key),
    levelName:String(get_(row, map, 'NivelNombre') || level.current.name),
    levelEmoji:String(get_(row, map, 'NivelEmoji') || level.current.emoji),
    progressLevelPct:toInt_(get_(row, map, 'ProgresoNivelPct'), level.progressPct),
    pointsToNextLevel:toInt_(get_(row, map, 'PuntosSiguienteNivel'), level.pointsToNext),
    nextLevel:level.next,
    hitosRacha:hitos,
    temporadaActual:toInt_(get_(row, map, 'TemporadaActual'), 1),
    temporadasCompletadas:toInt_(get_(row, map, 'TemporadasCompletadas'), 0),
    purchasesForReward:0,
    progressToReward:0,
    nextPurchasePoints:calcularPuntosPorRacha_(Math.max(1, currentStreak + 1), cfg),
    pointsRules:getPointRulesPublic_(cfg)
  };

  if (includeDetails) {
    client.badges = getBadgesForClient_(id);
    client.recentHistory = getRecentHistory(id, 8);
    client.shopItems = getTienda({ activeOnly:'true' }).items;
    client.recentRedemptions = getRedemptionsForClient_(id, 8);
  }
  return client;
}

// ============================================================
//  Compras / puntos / rachas / insignias
// ============================================================

function registrarCompra(body) {
  requireOperationalSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  beginRequest_();
  try {
    const cfg = getConfig();
    if (!cfg.ACTIVO) return { ok:false, error:'Sistema inactivo temporalmente' };
    const clientId = body.clientId || body.id || '';
    if (!clientId) return { ok:false, error:'clientId requerido' };
    if (isPurchasedToday(clientId)) return { ok:false, error:'Ya tiene una compra registrada hoy', alreadyToday:true };

    const found = findClientById_(clientId);
    if (!found) return { ok:false, error:'Cliente no encontrado' };

    const sh = found.sheet;
    const map = found.map;
    const row = found.row;
    const rowNum = found.rowNum;
    const now = new Date();
    const name = String(get_(row, map, 'Nombre') || '');
    const oldTotal = toInt_(get_(row, map, 'TotalCompras'), 0);
    const oldStreak = toInt_(get_(row, map, 'RachaActual'), 0);
    const oldPoints = toInt_(get_(row, map, 'PuntosTotales'), oldTotal * cfg.PUNTOS_RACHA_BASE);
    const oldAvailable = toInt_(get_(row, map, 'PuntosDisponibles'), oldPoints);
    const oldPurchasePoints = toInt_(get_(row, map, 'PuntosPorCompras'), oldPoints);
    const oldRewards = toInt_(get_(row, map, 'RecompensasGanadas'), 0);
    const oldCanjes = toInt_(get_(row, map, 'CanjesRealizados'), oldRewards);
    const oldHitos = parseHitos_(get_(row, map, 'HitosRacha'));

    const newTotal = oldTotal + 1;
    const rawNewStreak = calcNewStreak_(row, map, now, cfg);
    const puntosGanados = calcularPuntosPorRacha_(rawNewStreak, cfg);
    const newPoints = oldPoints + puntosGanados;
    const newAvailable = oldAvailable + puntosGanados;
    const newPurchasePoints = oldPurchasePoints + puntosGanados;
    const progress = calcularProgresoNivel(newPoints);

    const newHitos = union_(oldHitos, calcularHitosRacha(rawNewStreak));
    const completedSeason = rawNewStreak >= 30;
    const temporadaActual = toInt_(get_(row, map, 'TemporadaActual'), 1);
    const temporadasCompletadas = toInt_(get_(row, map, 'TemporadasCompletadas'), 0);
    const currentStreakToSave = completedSeason ? 0 : rawNewStreak;
    const nextSeason = completedSeason ? temporadaActual + 1 : temporadaActual;
    const completedCount = completedSeason ? temporadasCompletadas + 1 : temporadasCompletadas;

    updateObject_(sh, rowNum, map, {
      RachaActual:currentStreakToSave,
      TotalCompras:newTotal,
      RecompensasGanadas:oldCanjes,
      CanjesRealizados:oldCanjes,
      UltimaCompra:now,
      PuntosTotales:newPoints,
      PuntosDisponibles:newAvailable,
      PuntosPorCompras:newPurchasePoints,
      NivelClave:progress.current.key,
      NivelNombre:progress.current.name,
      NivelEmoji:progress.current.emoji,
      ProgresoNivelPct:progress.progressPct,
      PuntosSiguienteNivel:progress.pointsToNext,
      HitosRacha:newHitos.join(','),
      TemporadaActual:nextSeason,
      TemporadasCompletadas:completedCount,
      FechaActualizacion:now,
      MigradoV2:'TRUE'
    });

    if (completedSeason) {
      registrarTemporada_(clientId, temporadaActual, rawNewStreak, newHitos, newPoints, progress.current.name, 'compra');
    }

    const badgesResult = asignarInsigniasAutomaticas(clientId, {
      totalPurchases:newTotal,
      currentStreak:rawNewStreak,
      completedSeason:completedSeason,
      source:'compra'
    });

    appendObject_(getSpreadsheet().getSheetByName(SHEETS.REGISTROS), {
      IDRegistro:'R' + Date.now(),
      IDCliente:clientId,
      NombreCliente:name,
      FechaHora:now,
      Tipo:'purchase',
      RachaResultante:rawNewStreak,
      PuntosOtorgados:puntosGanados,
      NivelResultante:progress.current.name,
      PremioGenerado:'FALSE',
      Fuente:'app',
      Notas:(completedSeason ? 'Temporada de 30 completada; racha reiniciada. ' : '') + 'Puntos por racha: +' + puntosGanados
    });

    const updated = findClientById_(clientId);
    return {
      ok:true,
      rewardEarned:false,
      completedSeason:completedSeason,
      pointsEarned:puntosGanados,
      newStreak:currentStreakToSave,
      rawStreakReached:rawNewStreak,
      newTotal:newTotal,
      rewardsEarned:oldCanjes,
      badgesAssigned:badgesResult.assigned,
      client:clientRowToObj_(updated.row, updated.map, true)
    };
  } finally {
    lock.releaseLock();
  }
}

function calcNewStreak_(row, map, now, cfg) {
  const lastPurchase = get_(row, map, 'UltimaCompra');
  const current = toInt_(get_(row, map, 'RachaActual'), 0);
  if (!lastPurchase) return 1;
  const last = toDate_(lastPurchase);
  if (!last) return 1;
  last.setHours(0,0,0,0);
  const n = new Date(now); n.setHours(0,0,0,0);
  const diffD = Math.floor((n.getTime() - last.getTime()) / 86400000);
  const modo = String(cfg.MODO_RACHA || 'diario').toLowerCase();
  if (modo === 'semanal' || modo === 'weekly') {
    const lastWeek = getWeekNumber_(last);
    const thisWeek = getWeekNumber_(n);
    return (thisWeek - lastWeek <= 1) ? current + 1 : 1;
  }
  return diffD <= cfg.DIAS_TOLERANCIA + 1 ? current + 1 : 1;
}

function calcularHitosRacha(streak) {
  const s = toInt_(streak, 0);
  return HITO_RACHA.filter(h => s >= h);
}

function calcularPuntosPorRacha_(streak, cfg) {
  const s = toInt_(streak, 1);
  const c = cfg || getConfig();
  let points = toInt_(c.PUNTOS_RACHA_BASE, toInt_(c.PUNTOS_POR_COMPRA, 10));
  if (s >= 3) points = toInt_(c.PUNTOS_RACHA_3, 12);
  if (s >= 7) points = toInt_(c.PUNTOS_RACHA_7, 15);
  if (s >= 14) points = toInt_(c.PUNTOS_RACHA_14, 17);
  return points;
}

function getPointRulesPublic_(cfg) {
  const c = cfg || getConfig();
  return [
    { minStreak:1, label:'Racha 1-2', points:toInt_(c.PUNTOS_RACHA_BASE, 10) },
    { minStreak:3, label:'Racha 3+', points:toInt_(c.PUNTOS_RACHA_3, 12) },
    { minStreak:7, label:'Racha 7+', points:toInt_(c.PUNTOS_RACHA_7, 15) },
    { minStreak:14, label:'Racha 14+', points:toInt_(c.PUNTOS_RACHA_14, 17) }
  ];
}

function getTienda(params) {
  const activeOnly = String((params && params.activeOnly) || 'true').toLowerCase() !== 'false';
  const sh = getSpreadsheet().getSheetByName(SHEETS.TIENDA);
  if (!sh || sh.getLastRow() < 2) {
    return { ok:true, items:DEFAULT_SHOP_ITEMS.map(shopItemFromDefault_) };
  }
  const map = getHeaderMap_(sh);
  const items = getRows_(sh)
    .filter(r => String(get_(r, map, 'ItemID') || '').trim())
    .map(r => shopRowToObj_(r, map))
    .filter(item => !activeOnly || item.active)
    .sort((a,b) => a.order - b.order || a.cost - b.cost);
  return { ok:true, items:items };
}

function shopItemFromDefault_(item) {
  return {
    id:item.id,
    name:item.nombre,
    emoji:item.emoji,
    cost:toInt_(item.costo, 0),
    type:item.tipo,
    value:item.valor,
    active:true,
    description:item.descripcion,
    order:toInt_(item.orden, 999)
  };
}

function shopRowToObj_(row, map) {
  return {
    id:String(get_(row, map, 'ItemID') || '').trim(),
    name:String(get_(row, map, 'Nombre') || ''),
    emoji:String(get_(row, map, 'Emoji') || '🎁'),
    cost:toInt_(get_(row, map, 'CostoPuntos'), 0),
    type:String(get_(row, map, 'Tipo') || 'recompensa'),
    value:String(get_(row, map, 'Valor') || ''),
    active:String(get_(row, map, 'Activa') || 'TRUE').toUpperCase() !== 'FALSE',
    description:String(get_(row, map, 'Descripcion') || ''),
    order:toInt_(get_(row, map, 'Orden'), 999)
  };
}

function canjearRecompensa(body) {
  requireOperationalSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  beginRequest_();
  try {
    const clientId = body.clientId || body.id || '';
    const itemId = body.itemId || body.rewardId || '';
    if (!clientId) return { ok:false, error:'IDCliente requerido' };
    if (!itemId) return { ok:false, error:'Recompensa requerida' };

    const found = findClientById_(clientId);
    if (!found) return { ok:false, error:'Cliente no encontrado' };
    const item = (getTienda({ activeOnly:'true' }).items || []).find(i => String(i.id) === String(itemId));
    if (!item) return { ok:false, error:'Recompensa no disponible' };

    const sh = found.sheet;
    const map = found.map;
    const row = found.row;
    const rowNum = found.rowNum;
    const now = new Date();
    const name = String(get_(row, map, 'Nombre') || '');
    const available = toInt_(get_(row, map, 'PuntosDisponibles'), 0);
    const cost = toInt_(item.cost, 0);
    if (cost <= 0) return { ok:false, error:'Costo inválido de recompensa' };
    if (available < cost) return { ok:false, error:'Puntos insuficientes', pointsAvailable:available, cost:cost };

    const oldRewards = toInt_(get_(row, map, 'RecompensasGanadas'), 0);
    const oldCanjes = toInt_(get_(row, map, 'CanjesRealizados'), oldRewards);
    const newAvailable = available - cost;
    const newCanjes = oldCanjes + 1;

    updateObject_(sh, rowNum, map, {
      PuntosDisponibles:newAvailable,
      RecompensasGanadas:newCanjes,
      CanjesRealizados:newCanjes,
      FechaActualizacion:now
    });

    const canjeId = 'CJE' + Date.now();
    appendObject_(getSpreadsheet().getSheetByName(SHEETS.CANJES), {
      CanjeID:canjeId,
      ClienteID:clientId,
      NombreCliente:name,
      ItemID:item.id,
      NombreItem:item.name,
      PuntosGastados:cost,
      FechaHora:now,
      Estado:'pendiente_entrega',
      Fuente:'cliente',
      Notas:item.description || ''
    });

    appendObject_(getSpreadsheet().getSheetByName(SHEETS.REGISTROS), {
      IDRegistro:'CJ' + Date.now(),
      IDCliente:clientId,
      NombreCliente:name,
      FechaHora:now,
      Tipo:'redeem',
      RachaResultante:toInt_(get_(row, map, 'RachaActual'), 0),
      PuntosOtorgados:-cost,
      NivelResultante:String(get_(row, map, 'NivelNombre') || ''),
      PremioGenerado:'TRUE',
      Fuente:'tienda',
      Notas:'Canje: ' + item.name
    });

    const updated = findClientById_(clientId);
    return {
      ok:true,
      canjeId:canjeId,
      item:item,
      pointsSpent:cost,
      pointsAvailable:newAvailable,
      client:clientRowToObj_(updated.row, updated.map, true),
      message:'Canje realizado. El vendedor debe entregar: ' + item.name
    };
  } finally {
    lock.releaseLock();
  }
}

function getRedemptionsForClient_(clientId, limit) {
  const sh = getSpreadsheet().getSheetByName(SHEETS.CANJES);
  if (!sh || sh.getLastRow() < 2) return [];
  const map = getHeaderMap_(sh);
  return getRows_(sh)
    .filter(r => String(get_(r, map, 'ClienteID')) === String(clientId))
    .map(r => ({
      id:String(get_(r, map, 'CanjeID') || ''),
      itemId:String(get_(r, map, 'ItemID') || ''),
      itemName:String(get_(r, map, 'NombreItem') || ''),
      points:toInt_(get_(r, map, 'PuntosGastados'), 0),
      date:toIso_(get_(r, map, 'FechaHora')),
      status:String(get_(r, map, 'Estado') || ''),
      notes:String(get_(r, map, 'Notas') || '')
    }))
    .sort((a,b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit || 8);
}


function asignarInsigniasAutomaticas(clientId, state) {
  const found = findClientById_(clientId);
  if (!found) return { ok:false, error:'Cliente no encontrado' };
  const total = state && state.totalPurchases !== undefined ? toInt_(state.totalPurchases, 0) : toInt_(get_(found.row, found.map, 'TotalCompras'), 0);
  const streak = state && state.currentStreak !== undefined ? toInt_(state.currentStreak, 0) : toInt_(get_(found.row, found.map, 'RachaActual'), 0);
  const completedSeason = !!(state && state.completedSeason) || streak >= 30 || toInt_(get_(found.row, found.map, 'TemporadasCompletadas'), 0) > 0;
  const source = (state && state.source) || 'auto';

  const sh = getSpreadsheet().getSheetByName(SHEETS.CLIENTE_INSIGNIAS);
  let assigned = [];
  DEFAULT_BADGES.forEach(b => {
    let eligible = false;
    if (b.id === 'MAESTRO_RACHAS') eligible = completedSeason;
    else eligible = total >= b.valor;
    if (eligible && !clienteTieneInsignia_(clientId, b.id)) {
      appendObject_(sh, {
        ID:'CI' + Date.now() + '_' + b.id,
        ClienteID:clientId,
        InsigniaID:b.id,
        Nombre:b.nombre,
        Emoji:b.emoji,
        FechaAsignacion:new Date(),
        Fuente:source
      });
      assigned.push({ id:b.id, name:b.nombre, emoji:b.emoji });
      Utilities.sleep(5);
    }
  });
  return { ok:true, assigned:assigned };
}

function recalcularNivelCliente(clientId) {
  if (!clientId) return { ok:false, error:'ID requerido' };
  requireOperationalSheets_();
  const found = findClientById_(clientId);
  if (!found) return { ok:false, error:'Cliente no encontrado' };
  const cfg = getConfig();
  const total = toInt_(get_(found.row, found.map, 'TotalCompras'), 0);
  const points = toInt_(get_(found.row, found.map, 'PuntosTotales'), total * cfg.PUNTOS_RACHA_BASE);
  const progress = calcularProgresoNivel(points);
  set_(found.sheet, found.rowNum, found.map, 'NivelClave', progress.current.key);
  set_(found.sheet, found.rowNum, found.map, 'NivelNombre', progress.current.name);
  set_(found.sheet, found.rowNum, found.map, 'NivelEmoji', progress.current.emoji);
  set_(found.sheet, found.rowNum, found.map, 'ProgresoNivelPct', progress.progressPct);
  set_(found.sheet, found.rowNum, found.map, 'PuntosSiguienteNivel', progress.pointsToNext);
  set_(found.sheet, found.rowNum, found.map, 'FechaActualizacion', new Date());
  return { ok:true, level:progress };
}

function calcularProgresoNivel(points) {
  const p = toInt_(points, 0);
  let current = LEVELS[0];
  let next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (p >= LEVELS[i].min) current = LEVELS[i];
    if (p < LEVELS[i].min) { next = LEVELS[i]; break; }
  }
  if (!next) return { current:current, next:null, progressPct:100, pointsToNext:0 };
  const span = next.min - current.min;
  const done = p - current.min;
  const pct = span > 0 ? Math.max(0, Math.min(100, Math.round((done / span) * 100))) : 100;
  return { current:current, next:next, progressPct:pct, pointsToNext:Math.max(0, next.min - p) };
}

function registrarTemporada_(clientId, numeroTemporada, racha, hitos, points, levelName, source) {
  const sh = getSpreadsheet().getSheetByName(SHEETS.TEMPORADAS);
  if (temporadaRegistrada_(clientId, numeroTemporada)) return false;
  appendObject_(sh, {
    TemporadaID:'T' + Date.now(),
    ClienteID:clientId,
    NumeroTemporada:numeroTemporada,
    FechaInicio:'',
    FechaFin:new Date(),
    RachaCompletada:racha,
    HitosAlcanzados:(hitos || []).join(','),
    PuntosConservados:points,
    NivelConservado:levelName,
    Estado:'completada',
    Fuente:source || 'app'
  });
  return true;
}

// ============================================================
//  Migración segura de clientes existentes
// ============================================================

function migrarClientesExistentes() {
  initSheets();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  beginRequest_();
  try {
    const cfg = getConfig();
    if (String(cfg.MIGRACION_V2_COMPLETA).toUpperCase() === 'TRUE') {
      return { ok:true, alreadyMigrated:true, message:'La migración V2 ya está marcada como completa. No se realizaron cambios.' };
    }

    const sh = getClientesSheet();
    const map = getHeaderMap_(sh);
    const rows = getRows_(sh);
    let processed = 0;
    let updated = 0;
    let badgeCount = 0;
    let seasonCount = 0;
    const now = new Date();

    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const id = String(get_(row, map, 'ID') || '').trim();
      if (!id) return;
      processed++;
      if (String(get_(row, map, 'MigradoV2') || '').toUpperCase() === 'TRUE') return;

      const total = toInt_(get_(row, map, 'TotalCompras'), 0);
      const streak = toInt_(get_(row, map, 'RachaActual'), 0);
      const retroPoints = total * cfg.PUNTOS_RACHA_BASE;
      const progress = calcularProgresoNivel(retroPoints);
      const hitos = calcularHitosRacha(streak);
      const completedSeason = streak >= 30;
      const temporadaActual = toInt_(get_(row, map, 'TemporadaActual'), 1);

      set_(sh, rowNum, map, 'PuntosTotales', retroPoints);
      set_(sh, rowNum, map, 'PuntosDisponibles', retroPoints);
      set_(sh, rowNum, map, 'PuntosPorCompras', retroPoints);
      set_(sh, rowNum, map, 'NivelClave', progress.current.key);
      set_(sh, rowNum, map, 'NivelNombre', progress.current.name);
      set_(sh, rowNum, map, 'NivelEmoji', progress.current.emoji);
      set_(sh, rowNum, map, 'ProgresoNivelPct', progress.progressPct);
      set_(sh, rowNum, map, 'PuntosSiguienteNivel', progress.pointsToNext);
      set_(sh, rowNum, map, 'HitosRacha', hitos.join(','));
      set_(sh, rowNum, map, 'TemporadaActual', temporadaActual || 1);
      set_(sh, rowNum, map, 'TemporadasCompletadas', completedSeason ? 1 : 0);
      set_(sh, rowNum, map, 'FechaActualizacion', now);
      set_(sh, rowNum, map, 'MigradoV2', 'TRUE');

      const b = asignarInsigniasAutomaticas(id, { totalPurchases:total, currentStreak:streak, completedSeason:completedSeason, source:'migracion_v2' });
      badgeCount += (b.assigned || []).length;
      if (completedSeason && registrarTemporada_(id, temporadaActual || 1, streak, hitos, retroPoints, progress.current.name, 'migracion_v2')) seasonCount++;
      updated++;
    });

    const cfgSheet = getSpreadsheet().getSheetByName(SHEETS.CONFIG);
    const cfgRows = keyRowMap_(cfgSheet, 'Clave');
    if (cfgRows.MIGRACION_V2_COMPLETA) cfgSheet.getRange(cfgRows.MIGRACION_V2_COMPLETA, 2).setValue('TRUE');
    if (cfgRows.FECHA_MIGRACION_V2) cfgSheet.getRange(cfgRows.FECHA_MIGRACION_V2, 2).setValue(now);
    if (cfgRows.VERSION_SISTEMA) cfgSheet.getRange(cfgRows.VERSION_SISTEMA, 2).setValue(SYSTEM_VERSION);

    appendObject_(getSpreadsheet().getSheetByName(SHEETS.MIGRACION), {
      ID:'M' + Date.now(),
      Fecha:now,
      Version:SYSTEM_VERSION,
      ClientesProcesados:processed,
      ClientesActualizados:updated,
      InsigniasAsignadas:badgeCount,
      TemporadasCreadas:seasonCount,
      Estado:'completada',
      Detalle:'Puntos retroactivos = TotalCompras × ' + cfg.PUNTOS_RACHA_BASE + '; premios automáticos desactivados; tienda habilitada'
    });

    return { ok:true, processed:processed, updated:updated, badgesAssigned:badgeCount, seasonsCreated:seasonCount, message:'Migración V2 completada sin duplicar clientes ✅' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
//  Rankings / Stats / Historial
// ============================================================

function getRanking(params) {
  const type = String((params && params.type) || 'racha').toLowerCase();
  const limit = Math.max(1, Math.min(100, toInt_((params && params.limit), 10)));
  const sh = getClientesSheet();
  const map = getHeaderMap_(sh);
  let clients = getRows_(sh).filter(r => get_(r, map, 'ID')).map(r => clientRowToObj_(r, map, false));
  const levelIndex = obj => LEVELS.findIndex(l => l.key === obj.levelKey);
  clients.sort((a,b) => {
    if (type === 'compras') return b.totalPurchases - a.totalPurchases;
    if (type === 'puntos') return b.pointsTotal - a.pointsTotal;
    if (type === 'premios' || type === 'canjes') return (b.redemptionsMade || b.rewardsEarned || 0) - (a.redemptionsMade || a.rewardsEarned || 0);
    if (type === 'nivel') return (levelIndex(b) - levelIndex(a)) || (b.pointsTotal - a.pointsTotal);
    return b.currentStreak - a.currentStreak;
  });
  return { ok:true, type:type, ranking:clients.slice(0, limit) };
}

function getStats() {
  const now = new Date();
  const today = new Date(now); today.setHours(0,0,0,0);
  const week = new Date(today); week.setDate(today.getDate() - 7);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const clientes = getRows_(getClientesSheet()).filter(r => r[0]).length;
  const registros = getNormalizedRegistros_();
  const purchases = registros.filter(r => r.tipo === 'purchase');
  const canjes = getAllRedemptions_();
  const todayCount = purchases.filter(r => r.date && r.date >= today).length;
  const weekCount = purchases.filter(r => r.date && r.date >= week).length;
  const monthCount = purchases.filter(r => r.date && r.date >= month).length;

  const sh = getClientesSheet();
  const map = getHeaderMap_(sh);
  const rows = getRows_(sh);
  const pointsDelivered = rows.reduce((sum, r) => sum + toInt_(get_(r, map, 'PuntosPorCompras'), 0), 0);
  const migrationState = getConfig().MIGRACION_V2_COMPLETA;

  return { ok:true, stats:{
    today:todayCount,
    week:weekCount,
    month:monthCount,
    totalClients:clientes,
    pointsDelivered:pointsDelivered,
    pointsSpent:canjes.reduce((sum, c) => sum + toInt_(c.points, 0), 0),
    rewardsDelivered:canjes.length,
    redemptionsDelivered:canjes.length,
    migrationComplete:String(migrationState).toUpperCase() === 'TRUE'
  }};
}

function getAdminDashboard(body) {
  const type = String((body && body.rankingType) || 'compras').toLowerCase();
  const limit = Math.max(1, Math.min(50, toInt_((body && body.limit), 20)));
  return {
    ok:true,
    stats:getStats().stats,
    ranking:getRanking({ type:type, limit:limit }).ranking,
    rankingType:type,
    clients:getTodosClientes({ details:false }).clients,
    config:getConfigPublic().config
  };
}

function getAllRedemptions_() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.CANJES);
  if (!sh || sh.getLastRow() < 2) return [];
  const map = getHeaderMap_(sh);
  return getRows_(sh).map(r => ({
    id:String(get_(r, map, 'CanjeID') || ''),
    clientId:String(get_(r, map, 'ClienteID') || ''),
    itemId:String(get_(r, map, 'ItemID') || ''),
    itemName:String(get_(r, map, 'NombreItem') || ''),
    points:toInt_(get_(r, map, 'PuntosGastados'), 0),
    date:toDate_(get_(r, map, 'FechaHora')),
    status:String(get_(r, map, 'Estado') || '')
  })).filter(r => r.clientId);
}

function getRecentHistory(clientId, limit) {
  return getNormalizedRegistros_()
    .filter(r => String(r.clientId) === String(clientId))
    .sort((a,b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0))
    .slice(0, limit || 8)
    .map(r => ({ date:toIso_(r.date), type:r.tipo, points:r.points, notes:r.notes }));
}

function isPurchasedToday(clientId) {
  const found = findClientById_(clientId);
  if (found) {
    const last = toDate_(get_(found.row, found.map, 'UltimaCompra'));
    if (last) {
      const d = new Date(last); d.setHours(0,0,0,0);
      const t = new Date(); t.setHours(0,0,0,0);
      if (d.getTime() === t.getTime()) return true;
    }
  }
  const today = new Date(); today.setHours(0,0,0,0);
  return getNormalizedRegistros_().some(r => {
    if (String(r.clientId) !== String(clientId)) return false;
    if (r.tipo !== 'purchase' || !r.date) return false;
    const d = new Date(r.date); d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });
}

// ============================================================
//  Internal helpers
// ============================================================

function getScriptCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (err) {
    return null;
  }
}

function clearRuntimeCaches_() {
  __configCache = null;
  const cache = getScriptCache_();
  if (cache) cache.remove('donas_config_v2');
}

function getHeaderMap_(sh) {
  if (__request && __request.headers.has(sh.getName())) return __request.headers.get(sh.getName());
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = readValues_(sh.getRange(1, 1, 1, lastCol))[0];
  const map = {};
  headers.forEach((h, i) => { const key = String(h || '').trim(); if (key) map[key] = i + 1; });
  if (__request) __request.headers.set(sh.getName(), map);
  return map;
}

function getRows_(sh) {
  if (!sh) return [];
  if (__request && __request.rows.has(sh.getName())) return __request.rows.get(sh.getName());
  const lastRow = sh.getLastRow();
  const rows = lastRow < 2 ? [] : readValues_(sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()));
  if (__request) __request.rows.set(sh.getName(), rows);
  return rows;
}

function get_(row, map, key) {
  const col = map[key];
  return col ? row[col - 1] : '';
}

function set_(sh, rowNum, map, key, value) {
  invalidateSheet_(sh);
  if (!map[key]) {
    const newCol = sh.getLastColumn() + 1;
    sh.getRange(1, newCol).setValue(key);
    map[key] = newCol;
  }
  sh.getRange(rowNum, map[key]).setValue(value);
}

function updateObject_(sh, rowNum, map, obj) {
  invalidateSheet_(sh);
  Object.keys(obj).forEach(key => {
    if (!map[key]) {
      const newCol = sh.getLastColumn() + 1;
      sh.getRange(1, newCol).setValue(key);
      map[key] = newCol;
    }
  });
  const lastCol = sh.getLastColumn();
  const values = readValues_(sh.getRange(rowNum, 1, 1, lastCol))[0];
  Object.keys(obj).forEach(key => {
    values[map[key] - 1] = obj[key];
  });
  sh.getRange(rowNum, 1, 1, lastCol).setValues([values]);
}

function appendObject_(sh, obj) {
  invalidateSheet_(sh);
  const map = getHeaderMap_(sh);
  const headers = readValues_(sh.getRange(1, 1, 1, sh.getLastColumn()))[0].map(h => String(h || '').trim());
  const row = headers.map(h => Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '');
  sh.appendRow(row);
}

function keyRowMap_(sh, keyHeader) {
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  const headers = getHeaderMap_(sh);
  const keyCol = headers[keyHeader] || 1;
  const data = readValues_(sh.getRange(2, keyCol, sh.getLastRow() - 1, 1));
  data.forEach((r, i) => { const key = String(r[0] || '').trim(); if (key) map[key] = i + 2; });
  return map;
}

function findClientById_(id) {
  const key = String(id);
  if (__request && __request.clients.has(key)) return __request.clients.get(key);
  const sh = getClientesSheet();
  const map = getHeaderMap_(sh);
  if (!map.ID) return null;
  let ids = __request && __request.ids;
  if (!ids) {
    ids = new Map();
    const loaded = __request && __request.rows.get(sh.getName());
    const count = sh.getLastRow() - 1;
    const rows = loaded || (count > 0 ? readValues_(sh.getRange(2, map.ID, count, 1)) : []);
    rows.forEach((r,i) => {
      const value = String(r[loaded ? map.ID - 1 : 0]);
      if (!ids.has(value)) ids.set(value, i + 2); // Preserve legacy first-match behavior.
    });
    if (__request) __request.ids = ids;
  }
  const rowNum = ids.get(key);
  const loaded = __request && __request.rows.get(sh.getName());
  const found = rowNum ? { sheet:sh, map:map, rowNum:rowNum,
    row:loaded ? loaded[rowNum - 2] : readValues_(sh.getRange(rowNum,1,1,sh.getLastColumn())) } : null;
  if (found && !loaded) found.row = found.row[0];
  if (__request) __request.clients.set(key, found);
  return found;
}

function existsClientByWhatsapp_(whatsapp) {
  const w = normalizePhone_(whatsapp);
  if (!w) return false;
  const sh = getClientesSheet();
  const map = getHeaderMap_(sh);
  return getRows_(sh).some(r => normalizePhone_(get_(r, map, 'WhatsApp')) === w);
}

function normalizePhone_(v) {
  return String(v || '').replace(/\D/g, '');
}

function getBadgesForClient_(clientId) {
  const sh = getSpreadsheet().getSheetByName(SHEETS.CLIENTE_INSIGNIAS);
  if (!sh || sh.getLastRow() < 2) return [];
  const map = getHeaderMap_(sh);
  return getRows_(sh)
    .filter(r => String(get_(r, map, 'ClienteID')) === String(clientId))
    .map(r => ({
      id:String(get_(r, map, 'InsigniaID')),
      name:String(get_(r, map, 'Nombre')),
      emoji:String(get_(r, map, 'Emoji')),
      date:toIso_(get_(r, map, 'FechaAsignacion')),
      source:String(get_(r, map, 'Fuente'))
    }))
    .sort((a,b) => String(a.id).localeCompare(String(b.id)));
}

function clienteTieneInsignia_(clientId, badgeId) {
  const sh = getSpreadsheet().getSheetByName(SHEETS.CLIENTE_INSIGNIAS);
  if (!sh || sh.getLastRow() < 2) return false;
  const map = getHeaderMap_(sh);
  return getRows_(sh).some(r => String(get_(r, map, 'ClienteID')) === String(clientId) && String(get_(r, map, 'InsigniaID')) === String(badgeId));
}

function temporadaRegistrada_(clientId, numeroTemporada) {
  const sh = getSpreadsheet().getSheetByName(SHEETS.TEMPORADAS);
  if (!sh || sh.getLastRow() < 2) return false;
  const map = getHeaderMap_(sh);
  return getRows_(sh).some(r => String(get_(r, map, 'ClienteID')) === String(clientId) && toInt_(get_(r, map, 'NumeroTemporada'), 0) === toInt_(numeroTemporada, 0));
}

function getNormalizedRegistros_() {
  const sh = getSpreadsheet().getSheetByName(SHEETS.REGISTROS);
  if (!sh || sh.getLastRow() < 2) return [];
  const map = getHeaderMap_(sh);
  return getRows_(sh).map(r => {
    let date = get_(r, map, 'FechaHora');
    let tipo = String(get_(r, map, 'Tipo') || '').toLowerCase();
    // Compatibilidad con filas antiguas donde la fecha quedó en NombreCliente y tipo en FechaHora.
    if ((date === 'purchase' || date === 'reward') && !tipo) {
      tipo = String(date).toLowerCase();
      date = get_(r, map, 'NombreCliente');
    }
    return {
      id:String(get_(r, map, 'IDRegistro') || ''),
      clientId:String(get_(r, map, 'IDCliente') || ''),
      name:String(get_(r, map, 'NombreCliente') || ''),
      date:toDate_(date),
      tipo:tipo,
      points:toInt_(get_(r, map, 'PuntosOtorgados'), 0),
      notes:String(get_(r, map, 'Notas') || '')
    };
  }).filter(r => r.clientId);
}

function buildQrUrl_(id) {
  let base = '';
  try { base = ScriptApp.getService().getUrl(); } catch (err) { base = ''; }
  const clientUrl = (base || 'https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec') + '?action=getCliente&id=' + encodeURIComponent(id);
  return 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(clientUrl) + '&format=png&margin=10';
}

function parseHitos_(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => toInt_(v, 0)).filter(Boolean);
  return String(value).split(',').map(s => toInt_(s.trim(), 0)).filter(Boolean).sort((a,b) => a-b);
}

function union_(a, b) {
  const set = {};
  (a || []).concat(b || []).forEach(v => { const n = toInt_(v, 0); if (n) set[n] = true; });
  return Object.keys(set).map(Number).sort((x,y) => x-y);
}

function getWeekNumber_(d) {
  const date = new Date(d);
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function toDate_(v) {
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return new Date(v);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function toIso_(v) {
  const d = toDate_(v);
  return d ? d.toISOString() : '';
}

function toInt_(v, fallback) {
  const n = parseInt(v, 10);
  return isNaN(n) ? (fallback || 0) : n;
}

function toFloat_(v, fallback) {
  const n = parseFloat(v);
  return isNaN(n) ? (fallback || 0) : n;
}

function isBlank_(v) {
  return v === null || v === '' || typeof v === 'undefined';
}

// ============================================================
//  Pruebas rápidas desde editor GAS
// ============================================================

function testAPI() {
  Logger.log(JSON.stringify(initSheets()));
  Logger.log(JSON.stringify(getConfigPublic()));
  Logger.log(JSON.stringify(getStats()));
  Logger.log(JSON.stringify(getRanking({ type:'puntos', limit:5 })));
  Logger.log(JSON.stringify(getTienda({ activeOnly:'true' })));
}
