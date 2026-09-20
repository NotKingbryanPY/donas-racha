# Fase 1 — Línea base

Base web: `23037e348a230b9ddfa401e0958aa4a43199e451`. Backend: archivo suministrado `2.1.0-tienda`, conservado como fixture de pruebas con identificador de spreadsheet y contraseña de respaldo retirados. La autenticación del fixture también acepta Script Properties para poder usarlo sin secretos; las operaciones medidas conservan la lógica original.

Medición HTTP real de fase 0: perfil existente 6569 / 5821 / 3746 ms (mediana 5821); ranking límite 1: 3495 / 2283 / 2260 ms; endpoint sin acción: 2063 / 1107 / 1198 ms. Son tiempos de pared desde este equipo, con redirecciones, no tiempos internos de Sheets. No se reprodujeron diez segundos ni se calculó p95. Los resultados no contienen datos identificables.

El perfil hacía dos lecturas completas de Clientes, una o dos de Registros y lecturas de insignias, tienda y canjes. Compra, canje y alta llamaban initSheets en cada operación. Ranking se solicitaba repetidamente después de renderizar y cambiar de pestaña. Existía CacheService para configuración (60 s), pero no reutilización de datos de hojas por solicitud.

La regresión web sin cambios pasó a 360/390/412/768/1440 px, 31 requests simulados por recorrido. El HTML de producción coincidía con el checkout normalizando CRLF/LF.

La comparación backend reproducible usa 50 clientes y 100 filas de historial, más catálogo, una insignia y un canje de fixture. Se cuentan llamadas getValues/getValue y celdas leídas; no se simula latencia de Google.

| Operación | Lecturas antes | Celdas antes | Escrituras antes | Operaciones de formato antes |
|---|---:|---:|---:|---:|
| Perfil existente | 15 | 4686 | 0 | 0 |
| ID inexistente | 2 | 1173 | 0 | 0 |
| Ranking | 3 | 1203 | 0 | 0 |
| Todos con detalle | 603 | 175353 | 0 | 0 |
| Stats | 8 | 3484 | 0 | 0 |
| Búsqueda | 3 | 1203 | 0 | 0 |
| Compra | 58 | 8449 | 25 | 45 |
| Canje | 52 | 6149 | 25 | 45 |
| Alta | 48 | 6113 | 23 | 45 |

Los contadores no incluyen todos los métodos remotos (por ejemplo getLastRow), y no deben convertirse en una predicción de segundos.
