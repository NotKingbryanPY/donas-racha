# Historial de decisiones y documentación

## 2026-10-14 — verificación continuada

El usuario compartió después DAILY_V2_READY con todos los controles de jornada/permisos/RLS/trigger/integridad correctos. Se actualiza el estado de activación a validada por resultado del usuario; sigue pendiente la operación autenticada desde el APK y la lectura coincidente en web. No se ejecutó SQL privado por el agente, no se cambia código/stock/APK y no se pide repetir la instalación.

Usuario reporta instalador01 sin error y último resultado de02:39 disponibles contadas, sin reservas. No se declara autenticación/recorrido físico verificados. 02_verify se convierte en un único SELECT con permisos de ambas RPC, RLS, trigger diario, integridad e inventario, evitando que Studio oculte checks anteriores; sin escrituras ni cambios del APK. Conteo de pg_trigger distingue objetos reales de múltiples eventos en information_schema. Se registra push histórico presente sin restaurarlo ni borrar sus datos.

El conjunto final local pasó 113 pruebas, lint estricto debug/official y build/R8. APK oficial 2.0.0/código15, 5,398,339 bytes, misma firma anterior; SHA256 y análisis de secretos en DONAS_CONTROL_2_RESULTADOS. La copia de distribución/sha se publica en downloads. CI e0d0d14 aprobó Android API23/35, web/concurrencia y conocimiento. PR41 integrado en main/e2a7ff1, Vercel Production success; HTTP y descarga/hash comprobados a las06:24UTC. Producción SQL sigue sin ejecución real por fallo del kernel Browser/Computer. Activación y recorrido físico permanecen pendientes.

109 de111 pruebas Android pasaron en el primer conjunto completo. Se corrigieron dos fixtures: orden de qualifiers para captura y WorkManager inicializado dos veces en la prueba histórica. Las pruebas de negocio/Room/reintentos ya habían pasado. CI de documentación detectó diferencia CRLF en README/licencia vendor; se corrigió normalización preservando bytes del bundle JS. Ese resultado parcial fue reemplazado por la validación final anterior; no equivale a SQL real activado.

## 2026-10-13 — Donas Control 2

Base web70164c4. Se leyó la guía anterior y se preservó copia local en outputs/knowledge-before-donas-control-2. Se consolidan guías/modelo/diagramas para nueva app diaria: Supabase compartido, Room6 preservado, UUID/outbox, compras configurables, ventas/pago dividido, consumo, costo central y cierre seguro. Cambia explícitamente el alcance retirado el12octubre; no se rehabilitan flujos móviles antiguos.

SQL aditivo probado con el archivo móvil presente; backend reutiliza router sin nueva función Vercel; Dashboard añade lectura de datos confirmados. Ejemplo visual generado antes de UI. Evidencia/activación pendientes en VALIDATION y OPEN_ISSUES. Cada cambio posterior debe registrar pruebas, riesgo/limitación y actualización documental en la misma entrega.

## Historia recuperada

8octubre: guía de conocimiento inicial sobre web, Room5, contabilidad por instalación, Firebase/preferencias/FCM; fuente93643ed. 1.4.2 d304e46 mejoró recuperación push, pero faltaban credenciales de emisión. 12octubre fe8bcbb retiró integración móvil/cron; web1.5.0 Supabase independiente. 13octubre PR40/main70164c4 publicó web1.5.1, conservando cero/borradores y cancelación en camino. Los informes fechados se mantienen en docs y Git. Esta historia no certifica costo/datos de cada teléfono ni esquema privado actual.

## 2026-10-14 — prioridad Pedidos y notificaciones2.1

Usuario amplía alcance: recepción fuera de app y pedidos nativos son prioridad. Se documentaron causas antes de código: servicio FCM no registrado/dispatcher retirado y credenciales históricamente faltantes. Nueva ruta staff y reutilización de cola, registro individual de sesión Supabase, FCM data alta prioridad/dedupe/tap, caché Room7 por cuenta, gestión central de estados sin segundo cobro/stock; diarios preservados. Cron privado Supabase y SDK waitUntil sustituyen dependencia del cron GitHub retirado. Habilidades Firebase y documentación oficial consultadas.

117 pruebas Android y contratos API/proveedor/SQL con preservación/revocación pasaron. Lint detectó ajustes de notificaciones API26 usados sin fallback; se añadió ruta compatible23. Registro respeta permisos y limita espera token. La repetición final aprobó117 pruebas, lint y build/R8; firma oficial, APK de5,381,996 bytes, hash y escaneo verificados en DONAS_CONTROL_2_1_PEDIDOS. El timeout intermedio HTTP de un fixture se recuperó sin aumentar tiempos de producción. CI6f40f61 web/concurrencia/browser, conocimiento, compilación Android y emuladores API23/35 aprobados. Emisor privado, SQL2.1 y recepción Honor no declarados activados. Se actualiza el fixture de inventario para registrar/reclamar el transporte staff nuevo; no se habilitan dispositivos antiguos para conservar una expectativa histórica de test.
