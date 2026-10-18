# Historial de decisiones y documentación

## 2026-10-18 — portada de recompensas según referencia

Hero «Cada antojo / suma.», tarjeta de recompensas, navegación Sabores/Ranking/Mi perfil y panel de pedidos sobrio; logo y funciones existentes preservados. CSS público aislado y movimiento decorativo retirado de portada. nextRewardState comparte selección real con Perfil; seis sellos representan puntos disponibles, sin inventar seis compras. Una lectura privada al restaurar sesión, cancelación/generación y limpieza al cambiar identidad. Precio/disponibilidad conservan catálogo. Sin foto real verificada: espacio reemplazable identificado; imágenes flotante/torre fuera del DOM público. Nueva prueba responsive/rutas/saldo/identidad; [informe y límites](../DRACHAS_PORTADA_2026-10-18.md). Sin API/SQL/secretos/Android nuevos.

## 2026-10-18 — acceso a la confirmación más visible

El usuario mostró el botón Ver confirmación demasiado tenue y pegado a Confirmar pedido en iPad. Se ajustan solo HTML/CSS: tarjeta secundaria de ancho completo, recibo/ayuda, borde y foco visibles, altura mínima 76 px y separación 14 px. Nombre/descripción del control y relación con el diálogo nativo explícitos. `customer-orders.css?v=2` evita conservar el estilo anterior en caché. La recuperación pendiente recibe espacio/ancho propios. Regresión existente de pedidos y sintaxis PASS; inspección de navegador a360/768/1440 comprobó apertura con Enter y foco de3px. Sin cambios API, sesiones, pedidos, SQL o APK.

## 2026-10-18 — Drachas C y seguimiento del cliente implementados

El usuario eligió C y autorizó aplicar el rebranding y Pedidos. Logo Dr/dona trazado, variantes ligeras, favicon/social y marca visible Drachas. Activos destacados, contador/perfil, detalle propietario enlazable, historial paginado y avisos15s visible/con activos; caché/generación/abort/backoff, dedupe y offline explícitos. customerRequest conserva HTTP status, rechazos conocidos liberan intento y timeout conserva payload/UUID. Recibo solo después de confirmar, contextual, detalles/pago/WhatsApp y animación1s reducida/única. Tutorial1 conserva progreso y solo restaura foco si estaba activo. Sin SQL, secretos, APK o flujos retirados. [Informe y validación](../DRACHAS_WEB_2026-10-18.md); CI/publicación se registran al verificarse.

Publicación posterior comprobada: PR48/main23034c8; head db18b90 con CI completo PASS (API/SQL aislado/browser/concurrencia/conocimiento). Vercel dpl_7p5YzwzyG9CWXzaaZatKQ9VqkMH4 Production Ready, alias público y 12 recursos con hash idéntico comprobados. Portada/catálogo/inventario200, privados anónimos401, navegador público390/1440 sin errores ni desbordamiento y acceso al perfil funcional. El recorrido privado se probó con fixtures; no se afirma prueba real de pedido/FCM ni se escribió producción. Evidencia y límites en el informe.

## 2026-10-17 — aprobación visual de Pedidos y propuestas Drachas

El usuario aprobó la propuesta de Pedidos y solicitó primero plan/logos de rebranding a Drachas con los colores actuales. Se generaron e inspeccionaron tres PNG, guardados con sus prompts en docs/previews/drachas; [plan](../DRACHAS_REBRANDING_PROPUESTA.md). A/R glaseada recomendada como punto de partida; B/DR y C/D-r requieren refinar lectura. No hay logo elegido, vector final, cambio de runtime o despliegue. Se preservan datos, dominio, paquete/firma, sesiones y autoridad Supabase. Implementación de Pedidos pendiente junto con identidad final; FCM físico continúa como pendiente independiente.

## 2026-10-17 — auditoría y propuesta web, sin implementación

Se documenta [análisis de confirmación/seguimiento](../PEDIDOS_WEB_PROPUESTA_2026-10-17.md) solicitado antes de aprobar cambios. Verificados: refresco solo de catálogo/stock, sin avisos de pedidos, jerarquía débil, geometría de dona y pérdida del status HTTP (repro400 aislada). Pruebas existentes de navegador, navegación, tutorial y protección de rutas PASS. Propuesta interactiva con datos ficticios y marca actual; nueva arquitectura de seguimiento aún no activa. No cambia producción, APK, SQL ni el estado pendiente de FCM Android. Rebranding Drachas reservado para instrucciones posteriores.

## 2026-10-14 — publicación del diagnóstico de segundo plano

Verificación posterior14octubre21:43UTC: CI0b86b8d aprobado (web/API/SQL/browser/concurrencia y conocimiento), PR46 integrado en main6074252. Vercel dpl_HBYZRt4CtzXXeU6q7aTWxeEsN4bw Production Ready y alias www.dracha.store comprobados. Web/productos/inventario200; avisos/despacho/pedidos anónimos401. No se generó un pedido ni se modificó el APK/SQL/secretos. La consulta de logs del nuevo emisor no devolvió eventos correlacionables todavía; no demuestra cola vacía ni entrega. Se pidió SELECT de metadata y diagnóstico/prueba del A23. El fallo físico fuera de app sigue pendiente, no resuelto por esta instrumentación.

## 2026-10-14 — seguimiento de avisos fuera de app

Investigación de avisos fuera de app: usuario A23 informa pedido sin aviso tras1min y recuperación al abrir. FCM ya usa alta prioridad/data y el worker también genera avisos por consulta; abrir no prueba push. Se corrige el reintento protegido para esperar dispatch/ACK y devolver aceptación/errores agregados; el envío inicial mantiene waitUntil y logs de códigos/contadores sin tokens/IDs. Accepted no significa mostrado. Consulta orders-v2/05_delivery_diagnosis.sql solo SELECT permite distinguir falta de dispositivo/job, intentos/rechazo/aceptación. No se pudo leer la cola real por timeout de Brave y clave protegida no exportable en env run; no se eludió protección. Mantener APK2.1.1/Room7/secretos/stock. Ver docs/DONAS_CONTROL_AVISOS_SEGUNDO_PLANO.md; falta diagnóstico actual del A23 y consulta real, sin solución física afirmada. Pruebas locales de API/proveedor/dispatch/privacidad/renovación/sintaxis y SQL READ ONLY aislado PASS. CI/despliegue pendientes.

## 2026-10-14 — publicación verificada de renovación y APK2.1.1

Estado posterior14octubre21:25UTC: CI86b0971 completo PASS (Android/API23/API35, web/API/SQL/browser/concurrencia y conocimiento), PR44 integrado en main a6067d8. Vercel dpl_ZKUMjhaFUVXVKKb5etaNp1DPH6A1 Production Ready y www.dracha.store verificado. Token ficticio de12 ahora alcanza al proveedor (401/INVALID_CREDENTIALS); vacío400, pedidos/avisos/despacho anónimos401, web/catálogo/inventario200 y rutas retiradas410. APK2.1.1 público200, tamaño/hash idénticos. No equivale a renovar la sesión privada del A23 ni entregar pedido bloqueado; se pidió volver a comprobar avisos. Sin nueva SQL ni cambios de secretos.

## 2026-10-14 — renovación de sesión rechazada antes de FCM

Usuario informó FAILED visible en APK2.1.1. Logs Vercel sanitizados mostraron20 renovaciones400/VALIDATION_ERROR; api/auth/session imponía mínimo20 aunque Supabase Auth emite tokens opacos de12. Repro local falló400 antes del cambio y pasó después; prueba pública previa con token ficticio confirmó400. Se corrige solo validación de input, sin coerción/longitud mínima arbitraria, conservando rate limit, autenticidad/rotación Supabase y ADMIN/SELLER. Regresiones cubren token corto/largo/rotado, malformados, roles y errores definitivos/temporales. Pasaron nueve suites locales pertinentes. CI9d48f05 del APK aprobado en API23/35; actualización del servidor/CI nuevo y recorrido físico posterior pendientes. Sin APK/SQL adicional ni cambios de secretos; diagnóstico exacto del A23 solicitado sin claves.

## 2026-10-14 — comprobación de avisos2.1.1

Usuario desde Samsung A23 confirmó notificación Android de la prueba y confirmación de recuperación programada; informó texto Comprobando persistente. Causa: mensaje literal guardado en orderFeedback no se cerraba con el resultado de registro. Versión2.1.1/código17 separa feedback, devuelve UUID de WorkManager y observa sus estados con lifecycle, impide doble pulsación durante seguimiento y rehabilita el botón en estados terminales; conserva UUID/propietario al recrear. Diagnóstico de fallo de configuración también persiste desde el worker. Tres regresiones cubren éxito, fallo/reintento y resultado recibido al volver a pantalla. PASS120 pruebas/lintDebug/lintOfficial/build optimizado; APK oficial firmado/hash/alineación16KB/escaneo992 entradas aprobados. Informe2.1.1 registra archivo y límites; CI/publicación aún pendientes. Sin SQL ni emisor/secretos nuevos; datos/certificado/Room7 conservados. Fuera de app y rotación de clave siguen pendientes.

## 2026-10-14 — emisor FCM configurado

Usuario autorizó Vercel CLI desde su navegador remoto. Se validó el archivo de cuenta servicio sin imprimirlo y se guardaron FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY/CRON_SECRET como variables protegidas Production por stdin. Metadata confirmó proyecto/nombres/entorno; redeploy del mismo código306ff96 quedó Ready (AfrY4noC81swx6pD3pW8qa7Y26Bs) y promovido a www.dracha.store. OAuth/FCM validate_only200, lectura pública/protección y APK exacto comprobados. No avisos físicos ni cron efectivo afirmados. La clave fue adjunta al chat: rotación/revocación pendiente; no se modificaron claves/roles tras la comprobación IAM no concluyente. No cambió código/APK/negocio ni se copiaron credenciales al repositorio. Guías e índices actualizados.

## 2026-10-14 — activación SQL de avisos reportada

Usuario compartió preflight compatible, Success de01, ORDER_NOTIFICATIONS_SQL_READY de02 con cuatro controles=true y0 teléfonos, y ORDER_RETRY_SUPPORT_INSTALLED de03. Se actualizan informe, contexto, runbook, pendientes y evidencia; no se repiten instaladores ni se modifica runtime/APK/negocio. La instalación de helpers no acredita cron activo ni entrega FCM. El agente volvió a verificar Firebase ACTIVE, Vercel CLI Logged out y timeout del control de pestaña Brave. Pendientes: credenciales protegidas del emisor, registro del teléfono, activación ADMIN de recuperación y prueba física. Sin lectura de almacenes/valores privados ni ejecución SQL directa.

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

PR42/main db552f3 publicado, Vercel success y descarga/HTTP públicos verificados a19:21UTC. Guía y APK oficial disponibles. Se evita exportar argumentos de triggers en00_preflight, porque webhooks pueden contener encabezados privados; la prueba aislada comprueba esa exclusión. Sin cambios del runtime/APK ni escrituras SQL privadas en este seguimiento.
