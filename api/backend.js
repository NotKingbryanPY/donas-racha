const { randomBytes } = require('node:crypto');
const { ApiError, withApi } = require('./_lib/http');
const { requireAdmin, requireCustomer } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { customerByPublicId, normalizedPublicId } = require('./_lib/customer-id-session');
const { rpc, serviceRequest } = require('./_lib/supabase');
const { uuid } = require('./_lib/validation');

const query = fields => new URLSearchParams(fields).toString();
const rows = (table, fields) => serviceRequest(table, { query: query(fields) });
const first = async (table, fields) => (await rows(table, { ...fields, limit: '1' }))[0] || null;
async function allRows(table, fields, max = 10000) {
  const result = [];
  for (let offset = 0; offset < max; offset += 500) {
    const batch = await rows(table, { ...fields, limit:'500', offset:String(offset) });
    result.push(...batch);
    if (batch.length < 500) return result;
  }
  throw new ApiError(409,'RESULT_TOO_LARGE','Hay demasiados registros para este panel.');
}

async function settings() {
  const value = await first('business_settings', { select: '*', id: 'eq.true' });
  if (!value) throw new ApiError(503, 'SETTINGS_MISSING', 'Falta aplicar la migración de Supabase.');
  return value;
}

function publicSettings(s) {
  return {
    ACTIVO: s.active,
    DIAS_TOLERANCIA: s.streak_tolerance_days,
    PRECIO_DONA: s.donut_price_cents / 100,
    PUNTOS_RACHA_BASE: s.points_base,
    PUNTOS_RACHA_3: s.points_streak_3,
    PUNTOS_RACHA_7: s.points_streak_7,
    PUNTOS_RACHA_14: s.points_streak_14
  };
}

function panamaDay(value) {
  return value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(value)) : null;
}

function nextPoints(streak, s) {
  return streak >= 14 ? s.points_streak_14 : streak >= 7 ? s.points_streak_7 : streak >= 3 ? s.points_streak_3 : s.points_base;
}

function qrUrl(publicId) {
  const destination = `https://donas-racha.vercel.app/?profile=1&id=${encodeURIComponent(publicId)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(destination)}&format=png&margin=10`;
}

function brief(c, a, st, level) {
  return {
    id:c.public_id, name:c.display_name, whatsapp:c.whatsapp_e164 || '',
    registrationDate:c.registered_at, lastPurchase:c.last_purchase_at,
    currentStreak:st?.current_count || 0, totalPurchases:a?.purchase_count || 0,
    rewardsEarned:a?.redemption_count || 0, redemptionsMade:a?.redemption_count || 0,
    pointsTotal:a?.lifetime_points || 0, pointsAvailable:a?.available_points || 0,
    pointsFromPurchases:a?.purchase_points || 0,
    levelKey:level?.key || 'BRONCE', levelName:level?.name || 'Bronce', levelEmoji:level?.emoji || '🥉'
  };
}

async function clientDetails(customer) {
  const id = customer.id;
  const [account, streak, levels, badgeRows, history, rewardRows, redemptions, seasons, config] = await Promise.all([
    first('loyalty_accounts', { select:'*', customer_id:`eq.${id}` }),
    first('customer_streaks', { select:'*', customer_id:`eq.${id}` }),
    rows('loyalty_levels', { select:'key,name,emoji,minimum_lifetime_points', active:'eq.true', order:'minimum_lifetime_points.asc' }),
    rows('customer_badges', { select:'awarded_at,badges(key,name,emoji)', customer_id:`eq.${id}`, order:'awarded_at.desc' }),
    rows('loyalty_transactions', { select:'id,entry_type,points_delta,occurred_at,description', customer_id:`eq.${id}`, order:'occurred_at.desc', limit:'8' }),
    rows('rewards', { select:'key,name,emoji,points_cost,reward_type,reward_value,description,display_order', active:'eq.true', order:'display_order.asc' }),
    rows('reward_redemptions', { select:'id,reward_name_snapshot,points_cost_snapshot,status,created_at', customer_id:`eq.${id}`, order:'created_at.desc', limit:'8' }),
    rows('streak_seasons', { select:'status,season_number,milestones', customer_id:`eq.${id}`, order:'season_number.desc', limit:'30' }),
    settings()
  ]);
  if (!account || !streak) throw new ApiError(409, 'LOYALTY_ACCOUNT_MISSING', 'El cliente no tiene una cuenta de puntos completa.');
  const level = levels.find(item => item.key === account.level_key) || levels[0];
  const next = levels.find(item => item.minimum_lifetime_points > account.lifetime_points);
  const progressStart = level?.minimum_lifetime_points || 0;
  const progressEnd = next?.minimum_lifetime_points || progressStart;
  const progress = next ? Math.max(0, Math.min(100, Math.floor(100*(account.lifetime_points-progressStart)/(progressEnd-progressStart)))) : 100;
  const result = {
    ...brief(customer,account,streak,level), qrUrl:qrUrl(customer.public_id),
    purchasedToday:panamaDay(customer.last_purchase_at) === panamaDay(new Date()),
    progressLevelPct:progress, pointsToNextLevel:next ? next.minimum_lifetime_points-account.lifetime_points : 0,
    nextLevel:next ? { key:next.key,name:next.name,emoji:next.emoji } : null,
    hitosRacha:seasons.find(s => s.status==='ACTIVE')?.milestones || [3,7,14,21,30].filter(n => n <= streak.current_count),
    temporadaActual:streak.current_season_number,
    temporadasCompletadas:seasons.filter(s => s.status==='COMPLETED').length,
    nextPurchasePoints:nextPoints((streak.current_count || 0)+1,config),
    pointsRules:[
      { minStreak:1,label:'Racha 1-2',points:config.points_base },
      { minStreak:3,label:'Racha 3+',points:config.points_streak_3 },
      { minStreak:7,label:'Racha 7+',points:config.points_streak_7 },
      { minStreak:14,label:'Racha 14+',points:config.points_streak_14 }
    ],
    badges:badgeRows.map(item => ({ id:item.badges?.key, name:item.badges?.name, emoji:item.badges?.emoji, date:item.awarded_at })),
    recentHistory:history.map(item => ({ date:item.occurred_at, type:item.entry_type==='REDEMPTION_SPEND'?'redeem':'purchase', points:item.points_delta, notes:item.description })),
    shopItems:rewardRows.map(item => ({ id:item.key,name:item.name,emoji:item.emoji,cost:item.points_cost,type:item.reward_type,
      value:item.reward_value,description:item.description,order:item.display_order,active:true })),
    recentRedemptions:redemptions.map(item => ({ id:item.id,itemName:item.reward_name_snapshot,points:item.points_cost_snapshot,date:item.created_at,status:item.status }))
  };
  return result;
}

async function adminClients() {
  const [customers, accounts, streaks, levels] = await Promise.all([
    allRows('customers', { select:'id,public_id,display_name,whatsapp_e164,registered_at,last_purchase_at', status:'eq.ACTIVE', order:'created_at.desc,id.desc' }),
    allRows('loyalty_accounts', { select:'customer_id,available_points,lifetime_points,purchase_points,purchase_count,redemption_count,level_key', order:'customer_id.asc' }),
    allRows('customer_streaks', { select:'customer_id,current_count', order:'customer_id.asc' }),
    rows('loyalty_levels', { select:'key,name,emoji,minimum_lifetime_points' })
  ]);
  const byId = values => new Map(values.map(value => [value.customer_id,value]));
  const a = byId(accounts), st = byId(streaks), lv = new Map(levels.map(value => [value.key,value]));
  return customers.map(c => brief(c,a.get(c.id),st.get(c.id),lv.get(a.get(c.id)?.level_key)));
}

function sortedRanking(clients, type, limit) {
  const levels = { BRONCE:0, PLATA:1, ORO:2, DIAMANTE:3, MAESTRO:4 };
  const field = { compras:'totalPurchases', puntos:'pointsTotal', racha:'currentStreak', canjes:'redemptionsMade' }[type];
  return [...clients].sort((a,b) => ((type==='nivel' ? levels[b.levelKey]-levels[a.levelKey] : b[field]-a[field]) || b.pointsTotal-a.pointsTotal || a.name.localeCompare(b.name))).slice(0,limit);
}

async function customerForRequest(req, publicId) {
  const token = String(req.headers.authorization || '');
  if (token.startsWith('Bearer dr1.')) {
    const { customer } = await requireCustomer(req);
    if (customer.public_id !== publicId) throw new ApiError(403,'CUSTOMER_FORBIDDEN','No puedes abrir otro perfil.');
    return customer;
  }
  await requireAdmin(req);
  return customerByPublicId(publicId);
}

async function getAction(req, action) {
  if (action === 'getCliente') {
    const id = normalizedPublicId(req.query.id);
    await enforceRateLimit(req,'backend_profile',90,60,id);
    return { client:await clientDetails(await customerForRequest(req,id)) };
  }
  const admin = await requireAdmin(req);
  await enforceRateLimit(req,'backend_admin_read',120,60,admin.id);
  if (action === 'getConfig') return { config:publicSettings(await settings()) };
  if (action === 'getStats') return { stats:await rpc('api_business_stats',{}) };
  if (action === 'getTodosClientes') return { clients:await adminClients() };
  if (action === 'buscarCliente') {
    const search = String(req.query.q || '').trim().toLocaleLowerCase('es');
    if (!search || search.length > 120) throw new ApiError(400,'INVALID_SEARCH','Escribe un nombre, ID o WhatsApp.');
    const clients = await adminClients();
    return { clients:clients.filter(c => `${c.name} ${c.id} ${c.whatsapp}`.toLocaleLowerCase('es').includes(search)).slice(0,50) };
  }
  throw new ApiError(404,'UNKNOWN_ACTION','La acción no existe.');
}

function normalizedPhone(value) {
  const digits = String(value || '').replace(/\D/g,'');
  if (!digits) return null;
  const withCountry = digits.length===8 ? `507${digits}` : digits;
  if (!/^[1-9][0-9]{7,14}$/.test(withCountry)) throw new ApiError(400,'INVALID_PHONE','WhatsApp debe tener un número válido.');
  return `+${withCountry}`;
}

async function postAction(req, action, body) {
  if (action === 'canjearRecompensa') {
    const { customer } = await requireCustomer(req);
    if (customer.public_id !== normalizedPublicId(body.clientId)) throw new ApiError(403,'CUSTOMER_FORBIDDEN','No puedes canjear puntos de otro perfil.');
    await enforceRateLimit(req,'backend_redeem',15,60,customer.id);
    const rewardKey = String(body.itemId || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(rewardKey)) throw new ApiError(400,'INVALID_REWARD','La recompensa no es válida.');
    const key = uuid(body.idempotencyKey,'idempotencyKey');
    const result = await rpc('api_redeem_customer_reward',{p_customer_id:customer.id,p_reward_key:rewardKey,p_idempotency_key:key});
    return { ...result, message:'Canje realizado. El vendedor entregará tu recompensa.', client:await clientDetails(customer) };
  }
  const admin = await requireAdmin(req);
  await enforceRateLimit(req,'backend_admin_write',60,60,admin.id);
  if (action === 'nuevoCliente') {
    const name = String(body.name || '').trim();
    if (!name || name.length>120) throw new ApiError(400,'INVALID_NAME','Escribe un nombre de hasta 120 caracteres.');
    const whatsapp = normalizedPhone(body.whatsapp);
    const key = uuid(body.idempotencyKey,'idempotencyKey');
    const publicId = `C${randomBytes(9).toString('hex').toUpperCase()}`;
    const result = await rpc('api_register_customer',{p_public_id:publicId,p_name:name,p_whatsapp:whatsapp,p_idempotency_key:key});
    return { client:await clientDetails(Array.isArray(result)?result[0]:result) };
  }
  if (action === 'registrarCompra') {
    const publicId = normalizedPublicId(body.clientId);
    const customer = await customerByPublicId(publicId);
    const key = uuid(body.idempotencyKey,'idempotencyKey');
    const result = await rpc('api_credit_purchase',{p_customer_id:customer.id,p_idempotency_key:key,p_source:'SELLER'});
    if (!result.credited) throw new ApiError(409,'ALREADY_TODAY','Ya tiene una compra con puntos registrada hoy.');
    return { ...result,client:await clientDetails(customer) };
  }
  if (action === 'saveConfig') {
    const input = body.config || {};
    const map = {DIAS_TOLERANCIA:['streak_tolerance_days',0,30],PRECIO_DONA:['donut_price_cents',0.01,1000],
      PUNTOS_RACHA_BASE:['points_base',1,1000],PUNTOS_RACHA_3:['points_streak_3',1,1000],
      PUNTOS_RACHA_7:['points_streak_7',1,1000],PUNTOS_RACHA_14:['points_streak_14',1,1000]};
    const values = {};
    for (const [name,[column,min,max]] of Object.entries(map)) if (input[name]!==undefined) {
      const value = Number(input[name]);
      if (!Number.isFinite(value) || value<min || value>max || (name!=='PRECIO_DONA' && !Number.isInteger(value)))
        throw new ApiError(400,'INVALID_CONFIG',`Valor inválido: ${name}.`);
      values[column] = name==='PRECIO_DONA' ? Math.round(value*100) : value;
    }
    if (!Object.keys(values).length) throw new ApiError(400,'INVALID_CONFIG','No hay cambios de configuración.');
    const updated = await serviceRequest('business_settings',{method:'PATCH',query:'id=eq.true',body:values,prefer:'return=representation'});
    return { config:publicSettings(updated[0]) };
  }
  if (action === 'getAdminDashboard') {
    const type = String(body.rankingType || 'compras');
    if (!['compras','puntos','racha','nivel','canjes'].includes(type)) throw new ApiError(400,'INVALID_RANKING','Ranking inválido.');
    const limit = Math.max(1,Math.min(50,Number(body.limit)||20));
    const [clients,stats,config] = await Promise.all([adminClients(),rpc('api_business_stats',{}),settings()]);
    return { stats,config:publicSettings(config),clients,ranking:sortedRanking(clients,type,limit),rankingType:type };
  }
  throw new ApiError(404,'UNKNOWN_ACTION','La acción no existe.');
}

module.exports = withApi(['GET','POST'], async (req,context) => {
  const body = req.method==='POST' ? context.parseJsonBody(req,4096) : null;
  const action = String((body || req.query).action || '');
  const data = req.method==='GET' ? await getAction(req,action) : await postAction(req,action,body);
  return { ok:true,...data };
});
