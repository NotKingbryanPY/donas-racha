# Donas Racha — migración de Google Sheets a Supabase

La fase 5 conserva Google Sheets y Apps Script. El proceso crea una exportación privada, ejecuta un `DRY RUN`, genera `migration-report.json` y solo escribe en Supabase cuando el mismo archivo se confirma mediante su huella SHA-256.

## 1. Exportar desde Apps Script

1. Añadir `apps-script/Phase5Migration.gs` al mismo proyecto que `Code.gs`.
2. Ejecutar `exportPhase5MigrationData` desde el editor.
3. Autorizar el acceso a Drive. La función solo lee las cinco hojas de negocio y crea un archivo JSON privado en el Drive del propietario.
4. Descargar el archivo indicado en `fileUrl`.

La exportación incluye `Clientes`, `Registros`, `Insignias`, `ClienteInsignias`, `TemporadasRacha`, `TiendaRecompensas` y `Canjes`. No exporta `Config`, contraseñas ni secretos. No modifica celdas.

## 2. DRY RUN obligatorio

Guardar la exportación dentro de `migration-data/`, que está excluido de Git:

```powershell
node scripts/phase5-migrate.mjs --input migration-data/donas-racha-phase5.json --dry-run --report migration-report.json
```

El reporte contiene:

- filas procesadas;
- registros preparados;
- duplicados;
- filas inválidas;
- advertencias y errores por hoja y fila;
- la huella necesaria para autorizar la escritura.

El reporte no incluye nombres, teléfonos ni el contenido completo de las filas.

## 3. Aplicar

Solo cuando `invalid` sea `0`, configurar localmente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. La clave de servicio no se copia a GitHub, Apps Script, Android ni el navegador.

```powershell
node scripts/phase5-migrate.mjs `
  --input migration-data/donas-racha-phase5.json `
  --apply `
  --confirm HUELLA_DEL_DRY_RUN `
  --report migration-report.json `
  --rollback migration-rollback.sql
```

El importador usa identificadores UUID deterministas y referencias `GOOGLE_SHEETS`, por lo que una repetición no duplica datos. Los conflictos existentes se conservan y una inconsistencia detiene el lote.

## Normalización

- Conserva `Clientes.ID` como `customers.public_id` y alias `LEGACY_ID`.
- Convierte teléfonos panameños de ocho dígitos a E.164 con `+507`; valores ambiguos quedan vacíos y aparecen en el reporte.
- Conserva saldos, puntos acumulados, puntos por compras y nivel. Si el total no cubre un saldo derivado, lo eleva y registra una advertencia.
- Reconstruye el libro de puntos a partir de `Registros` y `Canjes`, añadiendo saldos de apertura o ajustes explícitos cuando el historial no alcanza el saldo actual.
- Preserva racha actual, mejor racha conocida, temporadas, definiciones y asignaciones de insignias, tienda de recompensas y canjes.
- Omite duplicados por ID público, referencia heredada, temporada o insignia y los informa.

## Reversión

Al aplicar, el importador crea `migration-rollback.sql` con los UUID y referencias exactos del lote. Debe conservarse junto al reporte, fuera de Git. La reversión falla de forma segura si pedidos u otros datos posteriores ya referencian clientes migrados.

## Datos originales

Google Sheets continúa como respaldo y fuente activa durante esta fase. No se borran hojas, filas, archivos ni el backend de Apps Script.
