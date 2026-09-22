# Validación de fase 5

## Exportación

`Phase5Migration.gs` se analizó como JavaScript válido. Solo lee las siete hojas de negocio y crea un JSON privado en Google Drive. `Config`, contraseñas y secretos quedan fuera de la exportación.

## Transformación

El fixture cubre un cliente panameño, puntos por compra, un canje, una insignia y una temporada completa. El `DRY RUN` obtuvo:

```json
{
  "rowsProcessed": 7,
  "recordsPrepared": 12,
  "duplicates": 0,
  "invalid": 0,
  "errors": 0
}
```

Se comprobó:

- teléfono `6000-0000` convertido a `+50760000000`;
- UUID idénticos al repetir la transformación;
- saldo disponible final de 20 puntos;
- libro contable de `+30` por compra y `-10` por canje;
- nivel y temporada conservados;
- insignia y canje enlazados a sus definiciones;
- reporte sin nombres ni teléfonos.

## PostgreSQL 18

Se aplicó el fixture sobre las seis migraciones existentes. PostgreSQL aceptó un cliente, dos alias, cuenta, racha, dos movimientos de puntos, temporada, insignia y canje. Las aserciones de saldo y relaciones pasaron y la transacción terminó con `ROLLBACK`.

## Regresión

```text
PASS phase 5 migration: normalize, preserve balances, deterministic IDs and report
PASS API contract: validation, server pricing, idempotency, rate limits and 8 endpoints
PASS security contract: 38 RLS policies, hashed one-time claims, no customer writes
PASS schema contract: 6 migrations, 18 core tables, RLS closed by default
PASS backend fixture
PASS transport cache/timeouts/profile ordering
```

## Pendiente

La exportación real procesó 67 filas y preparó 150 registros. Se detectaron 14 subtotales heredados de puntos por compras superiores al total; se limitaron al total para conservar niveles y rankings. Una insignia pertenecía a un cliente eliminado y se omitió como dato huérfano. No hubo errores bloqueantes.

La migración se aplicó en Supabase el 22 de septiembre de 2026 dentro de una sola transacción. La consulta final confirmó:

```json
{
  "customers": 21,
  "accounts": 21,
  "transactions": 18,
  "badges": 16
}
```

Google Sheets y Apps Script no se modificaron. El reporte, el SQL aplicado y la reversión específica del lote se conservan fuera de Git porque contienen identificadores y datos privados.
