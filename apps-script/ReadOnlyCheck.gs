// Run manually against the PRIVATE BACKUP/COPY configured in SPREADSHEET_ID.
// Does not initialize sheets, create customers, register purchases or redeem points.
function runPhase1ReadOnlyCheck() {
  beginRequest_();
  requireOperationalSheets_();
  const sh = getClientesSheet();
  const headers = getHeaderMap_(sh);
  const rows = getRows_(sh);
  const row = rows.find(r => String(get_(r, headers, 'ID') || ''));
  if (!row) throw new Error('La copia no contiene clientes para medir.');
  const id = String(get_(row, headers, 'ID'));
  const results = [];
  for (let i = 0; i < 3; i++) {
    beginRequest_();
    const started = Date.now();
    const result = getCliente({id:id});
    if (!result.ok) throw new Error('No se pudo leer el perfil de prueba.');
    results.push({sample:i+1,ms:Date.now()-started,reads:__request.reads,cells:__request.cells});
    finishRequest_();
  }
  console.log(JSON.stringify({ok:true,mode:'read_only',version:SYSTEM_VERSION,profiles:results}));
}
