// ============================================================
// DONAS RACHA — FASE 5: exportación privada de solo lectura
// Añade este archivo al mismo proyecto que Code.gs y ejecuta
// exportPhase5MigrationData desde el editor de Apps Script.
// ============================================================

const PHASE5_EXPORT_SHEETS = [
  'Clientes',
  'Registros',
  'Insignias',
  'ClienteInsignias',
  'TemporadasRacha',
  'TiendaRecompensas',
  'Canjes'
];

function exportPhase5MigrationData() {
  beginRequest_();
  requireOperationalSheets_();

  const ss = getSpreadsheet();
  const exportedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    source: 'GOOGLE_SHEETS',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetTimeZone: ss.getSpreadsheetTimeZone(),
    exportedAt: exportedAt,
    sheets: {}
  };

  PHASE5_EXPORT_SHEETS.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      payload.sheets[name] = { missing: true, headers: [], rows: [] };
      return;
    }
    const lastColumn = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    const headers = lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(value => String(value || '').trim())
      : [];
    const values = lastRow > 1 && lastColumn > 0
      ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
      : [];
    payload.sheets[name] = {
      missing: false,
      headers: headers,
      rows: values.map(row => row.map(phase5SerializableValue_))
    };
  });

  const json = JSON.stringify(payload);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, json, Utilities.Charset.UTF_8)
    .map(byte => (byte + 256).toString(16).slice(-2))
    .join('');
  const stamp = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd-HHmmss');
  const file = DriveApp.createFile(
    'donas-racha-phase5-' + stamp + '.json',
    json,
    MimeType.PLAIN_TEXT
  );

  return {
    ok: true,
    mode: 'READ_ONLY',
    fileId: file.getId(),
    fileName: file.getName(),
    fileUrl: file.getUrl(),
    sha256: digest,
    bytes: Utilities.newBlob(json).getBytes().length,
    rows: Object.keys(payload.sheets).reduce((result, name) => {
      result[name] = payload.sheets[name].rows.length;
      return result;
    }, {})
  };
}

function phase5SerializableValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value === null || typeof value === 'undefined') return '';
  return String(value);
}
