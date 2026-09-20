// In-memory Sheets contract tests. Never calls Google or reads production data.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const fixed = '2026-09-19T12:00:00.000Z';
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return new Date(fixed).getTime(); } }
function runtime(file) {
  const metrics = { reads:0, cells:0, writes:0, formats:0 };
  const sheets = new Map();
  class Sheet {
    constructor(name, data=[]) { this.name=name; this.data=data; }
    getName() { return this.name; }
    getLastRow() { return this.data.length; }
    getLastColumn() { return Math.max(0,...this.data.map(r=>r.length)); }
    getRange(row,col,n=1,m=1) {
      const sh=this;
      return {
        getValues() { metrics.reads++; metrics.cells+=n*m; return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sh.data[row+i-1]?.[col+j-1] ?? '')); },
        getValue() { return this.getValues()[0][0]; },
        setValues(values) { metrics.writes++; values.forEach((r,i)=>r.forEach((v,j)=>{ sh.data[row+i-1] ||= []; sh.data[row+i-1][col+j-1]=v; })); return this; },
        setValue(value) { return this.setValues([[value]]); },
        setFontWeight() { metrics.formats++; return this; }, setBackground() { metrics.formats++; return this; }, setFontColor() { metrics.formats++; return this; }
      };
    }
    appendRow(row) { metrics.writes++; this.data.push([...row]); }
    deleteRow(row) { metrics.writes++; this.data.splice(row-1,1); }
    setFrozenRows() { metrics.formats++; }
    autoResizeColumns() { metrics.formats++; }
  }
  const spreadsheet = { getSheetByName:n=>sheets.get(n)||null, insertSheet:n=>{ const s=new Sheet(n); sheets.set(n,s); return s; } };
  const cache = new Map();
  const props = new Map([['SPREADSHEET_ID','test-only']]);
  const ctx=vm.createContext({ Date:Clock, console:{log(){}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null})},
    SpreadsheetApp:{openById:()=>spreadsheet,getActiveSpreadsheet:()=>spreadsheet},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    ScriptApp:{getService:()=>({getUrl:()=> 'https://example.invalid/exec'})},
    Utilities:{sleep(){}}, Logger:{log(){}},
    ContentService:{MimeType:{JSON:'json',TEXT:'text'},createTextOutput:text=>({text,setMimeType(){return this;}})}
  });
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
  const spec=JSON.parse(vm.runInContext(`JSON.stringify({Clientes:CLIENTES_HEADERS,Registros:REGISTROS_HEADERS,Config:['Clave','Valor','Descripción'],Insignias:INSIGNIAS_HEADERS,ClienteInsignias:CLIENTE_INSIGNIAS_HEADERS,TemporadasRacha:TEMPORADAS_HEADERS,Migracion:MIGRACION_HEADERS,TiendaRecompensas:TIENDA_HEADERS,Canjes:CANJES_HEADERS})`,ctx));
  Object.entries(spec).forEach(([name,headers])=>sheets.set(name,new Sheet(name,[headers])));
  const add=(name,obj)=>sheets.get(name).data.push(spec[name].map(h=>obj[h]??''));
  JSON.parse(vm.runInContext('JSON.stringify(CONFIG_ROWS)',ctx)).forEach(r=>sheets.get('Config').data.push(r));
  sheets.get('Config').data.find(r=>r[0]==='ADMIN_PASSWORD')[1]='fixture-password';
  JSON.parse(vm.runInContext('JSON.stringify(DEFAULT_SHOP_ITEMS)',ctx)).forEach(i=>add('TiendaRecompensas',{ItemID:i.id,Nombre:i.nombre,Emoji:i.emoji,CostoPuntos:i.costo,Tipo:i.tipo,Valor:i.valor,Activa:'TRUE',Descripcion:i.descripcion,Orden:i.orden}));
  for(let i=0;i<50;i++) add('Clientes',{ID:'C'+i,Nombre:'Fixture '+i,WhatsApp:'test-'+i,FechaRegistro:'2026-01-01',TotalCompras:18,RachaActual:2,UltimaCompra:'2026-09-17',PuntosTotales:180,PuntosDisponibles:180,PuntosPorCompras:180,NivelClave:'BRONCE',NivelNombre:'Bronce',NivelEmoji:'🥉',ProgresoNivelPct:90,PuntosSiguienteNivel:20,TemporadaActual:1,MigradoV2:'TRUE'});
  for(let i=0;i<100;i++) add('Registros',{IDRegistro:'R'+i,IDCliente:'C'+(i%50),NombreCliente:'Fixture',FechaHora:'2026-09-17',Tipo:'purchase',PuntosOtorgados:10});
  add('ClienteInsignias',{ID:'B1',ClienteID:'C0',InsigniaID:'PRIMER_MORDISCO',Nombre:'Primer Mordisco',Emoji:'🥉',FechaAsignacion:'2026-01-01',Fuente:'fixture'});
  add('Canjes',{CanjeID:'J1',ClienteID:'C0',ItemID:'DESC_10',PuntosGastados:60,FechaHora:'2026-01-02',Estado:'pendiente_entrega'});
  const reset=()=>Object.keys(metrics).forEach(k=>metrics[k]=0);
  const call=(action,params={},post=false)=>JSON.parse(post?ctx.doPost({postData:{contents:JSON.stringify({action,...params})}}).text:ctx.doGet({parameter:{action,...params}}).text);
  return {call,metrics,reset,sheets,ctx,props,cache,add};
}
const legacy=path.join(__dirname,'fixtures/legacy.gs');
const optimized=path.join(root,'apps-script/Code.gs');
const reports=[];
for(const [action,args] of [['getCliente',{id:'C0'}],['getCliente',{id:'missing'}],['getRanking',{type:'puntos',limit:10}],['getTodosClientes',{details:'true'}],['getStats',{}],['buscarCliente',{q:'Fixture 1'}]]) {
  const before=runtime(legacy), after=runtime(optimized);
  const a=before.call(action,args),b=after.call(action,args);
  assert.deepEqual(b,a,action+' response parity');
  assert.equal(after.metrics.writes,0,action+' must not write');
  reports.push({action,...(args.id?{case:args.id==='missing'?'missing':'existing'}:{}),before:{...before.metrics},after:{...after.metrics}});
}
for(const [action,args] of [['registrarCompra',{clientId:'C0'}],['canjearRecompensa',{clientId:'C0',itemId:'DONA_GRATIS'}],['nuevoCliente',{name:'New fixture',whatsapp:'999'}]]) {
  const before=runtime(legacy),after=runtime(optimized);
  const body={adminPassword:'fixture-password',...args};
  const a=before.call(action,body,true),b=after.call(action,body,true);
  assert.equal(b.ok,true,JSON.stringify(b)); assert.deepEqual(b,a,action+' response parity');
  assert.equal(after.metrics.formats,0,'normal writes must not initialize sheets');
  reports.push({action,before:{...before.metrics},after:{...after.metrics}});
  assert.deepEqual(after.call('getCliente',{id:b.client.id}),before.call('getCliente',{id:a.client.id}),'fresh response after write');
  if(action==='registrarCompra') assert.equal(after.call(action,body,true).alreadyToday,true);
  if(action==='canjearRecompensa') assert.equal(after.call(action,body,true).error,'Puntos insuficientes');
}
{
  const app=runtime(optimized);
  assert.equal(app.call('registrarCompra',{clientId:'C0'},true).ok,false);
  assert.equal(app.metrics.writes,0);
  app.sheets.get('Config').data.find(r=>r[0]==='ADMIN_PASSWORD')[1]=''; app.cache.clear();
  assert.equal(app.call('verificarPassword',{password:''}).ok,false,'empty configuration must fail closed');
  app.props.set('ADMIN_PASSWORD','property-password');
  assert.equal(app.call('verificarPassword',{password:'property-password'}).ok,true);
}
{
  const app=runtime(optimized);
  app.call('getCliente',{id:'C0'});
  const sh=app.sheets.get('Clientes'); sh.data[1][sh.data[0].indexOf('PuntosDisponibles')]=123;
  assert.equal(app.call('getCliente',{id:'C0'}).client.pointsAvailable,123,'no snapshots across requests');
  app.sheets.delete('Canjes'); app.reset();
  assert.equal(app.call('registrarCompra',{clientId:'C0',adminPassword:'fixture-password'},true).ok,false);
  assert.equal(app.metrics.writes,0,'missing schema fails before writes');
}
{
  const a=runtime(legacy),b=runtime(optimized);
  for(const app of [a,b]) app.add('Registros',{IDRegistro:'old',IDCliente:'C0',NombreCliente:'2026-09-19T12:00:00Z',FechaHora:'purchase'});
  assert.deepEqual(b.call('getCliente',{id:'C0'}),a.call('getCliente',{id:'C0'}),'legacy shifted dates');
  assert.equal(b.call('getCliente',{id:'C0'}).client.purchasedToday,true);
}
{
  const app=runtime(optimized);
  app.call('getCliente',{id:'C0'});
  assert.equal(app.call('saveConfig',{adminPassword:'fixture-password',config:{PUNTOS_RACHA_3:24}},true).ok,true);
  const purchase=app.call('registrarCompra',{clientId:'C0',adminPassword:'fixture-password'},true);
  assert.equal(purchase.pointsEarned,24,'config invalidation');
  assert.equal(purchase.client.pointsAvailable,204);
  const deleted=app.call('eliminarCliente',{id:'C0',adminPassword:'fixture-password'},true);
  assert.equal(deleted.ok,true);
  assert.equal(app.call('getCliente',{id:'C0'}).ok,false);
}
{
  const app=runtime(optimized);
  // A concurrent writer changes the balance while this request waits for the lock.
  app.ctx.LockService.getScriptLock=()=>({releaseLock(){},waitLock(){
    const sh=app.sheets.get('Clientes');
    sh.data[1][sh.data[0].indexOf('PuntosDisponibles')]=40;
  }});
  const result=app.call('canjearRecompensa',{clientId:'C0',itemId:'DONA_GRATIS'},true);
  assert.equal(result.error,'Puntos insuficientes');
  assert.equal(app.metrics.writes,0);
}
fs.writeFileSync(path.join(__dirname,'backend-results.json'),JSON.stringify({passed:true,fixture:{clients:50,historyRows:100},reports},null,2));
console.log(JSON.stringify({passed:true,reports},null,2));


