# Fase 1 — Resultado de implementación y pruebas

Estado: propuesta probada localmente; nuevo backend todavía no desplegado ni medido en Google. No se inició fase 2.

## Cambios

- `apps-script/Code.gs`: copia versionada sin credenciales de respaldo, lectura solo de columna ID más fila encontrada, índice lógico en memoria y reutilización de cabeceras/filas dentro del request. Invalidación al escribir y reinicio después de adquirir el lock. No se guardan saldos/perfiles entre requests.
- `requireOperationalSheets_` valida esquema antes de escribir; initSheets se mantiene como operación administrativa explícita. Un esquema incompleto produce error sin autoformatear ni sembrar en una compra.
- `PERF_LOG=true` en Script Properties activa métricas agregadas de lecturas, celdas y tiempo. No registra IDs, contraseñas, payloads ni perfiles. Los contadores de operaciones con lock comienzan después de adquirirlo; no incluyen espera del lock ni comprobación previa del esquema.
- `assets/js/api-client.js`: comparte ranking por 15 s y solicitudes concurrentes idénticas. Invalida antes/después de POST y al salir. No conserva perfiles. Timeout de 30 s y errores HTTP; ninguna repetición automática de escrituras.
- `index.html`: usa el transporte y descarta respuestas de perfil que llegan después de una nueva selección/navegación; desactiva compra mientras carga.

No se cambia diseño, contrato de API, IDs, QR ni reglas de puntos. Retirar fallback vacío cierra acceso administrativo sin configuración: requiere credencial existente en Config o ADMIN_PASSWORD en Script Properties. SPREADSHEET_ID debe configurarse explícitamente en proyectos no vinculados.

## Comparación reproducible

| Operación | Lecturas antes → después | Celdas antes → después |
|---|---:|---:|
| Perfil | 15 → 12 | 4686 → 1325 |
| ID inexistente | 2 → 2 | 1173 → 73 |
| Ranking | 3 → 3 | 1203 → 1203 |
| Todos con detalle | 603 → 11 | 175353 → 2402 |
| Stats | 8 → 7 | 3484 → 2334 |
| Búsqueda | 3 → 3 | 1203 → 1203 |
| Compra | 58 → 29 | 8449 → 2679 |
| Canje | 52 → 25 | 6149 → 1560 |
| Alta | 48 → 17 | 6113 → 2536 |

Perfil: 71,7 % menos celdas; compra: 50 % menos lecturas. En compra/canje/alta se eliminan 45 operaciones de formato del fixture. Ranking y búsqueda no mejoran su lectura en servidor: siguen recorriendo clientes. El índice de ID sigue siendo O(N), aunque transfiere solo una columna; no equivale a un índice PostgreSQL.

Recorrido web: 31 → 25 requests por tamaño, reducción 19,4 %. PASS en cinco tamaños, sin excepciones JS. La suite sigue simulando API/cámara y no escribe en producción.

## Pruebas

`node tests/backend.cjs`: respuestas idénticas frente al fixture legacy para perfil, ID inexistente, ranking, listado detallado, estadísticas, búsqueda, compra, canje y alta. Verifica compra del mismo día, saldo insuficiente, configuración, eliminación, datos antiguos, ausencia de caché entre requests, credencial vacía rechazada, esquema incompleto sin escrituras y saldo modificado durante espera de lock.

`node tests/transport.cjs`: deduplicación, invalidación después de mutar, respuestas anteriores sin contaminar caché nuevo, errores HTTP, timeout, ausencia de reintentos y perfiles fuera de orden.

`tests/regression.cjs`: mismos recorridos existentes en cinco tamaños; requiere Playwright y servidor local, sin añadir dependencias de producción.

## Límites y riesgos pendientes

La mejora en segundos aún no está medida. Se verificó acceso al editor y coincidencia con el código original, se creó un respaldo privado de Sheets y se guardó el código optimizado en una copia del proyecto. Su ejecución quedó pendiente de completar la autorización de Google. Por preferencia del propietario, el flujo continúa con GitHub y entrega de texto para copiar/pegar, sin navegador. Falta validación real y medición posterior al despliegue. No se asegura reducción de 5,8 s a ningún tiempo concreto. No se ejecutó testAPI: inicializa/modifica datos.

Se conserva deliberadamente el contrato de acceso legacy en esta propuesta de rendimiento: perfil/listados públicos, campo WhatsApp del ranking y canje sin autenticar siguen siendo riesgos conocidos. El plan inicial contemplaba corregirlos en fase 1, pero cerrar esos accesos requiere acordar y entregar un mecanismo de identidad de cliente; hacerlo solo en frontend no protege datos, y exigir contraseña administrativa a todo cliente rompe el flujo actual. Esta parte queda pendiente explícita, no se declara resuelta. La retirada de contraseña de respaldo sí está implementada.

Tampoco se agregan transacciones, idempotencia ni corrección de la racha semanal; los fallos parciales del backend original siguen siendo posibles. Cachear el ranking 15 s implica esa posible demora en reflejar operaciones de otros dispositivos; se invalida inmediatamente para las escrituras de esta pestaña.

Base técnica consultada: [buenas prácticas oficiales de Apps Script](https://developers.google.com/apps-script/guides/support/best-practices), minimizar accesos externos y trabajar por lotes. Aquí se prefiere memoria del request para no introducir un caché compartido de saldos con invalidación incierta.
