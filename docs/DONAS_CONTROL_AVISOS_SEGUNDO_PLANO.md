# Avisos fuera de la app: investigación del14octubre2026

El usuario con A23 informa que un pedido no avisa después de al menos un minuto y aparece al abrir la app. Este recorrido continúa sin resolver/verificar; corregir la renovación de sesión no certifica la entrega FCM.

## Hallazgos comprobados

- El emisor envía data FCM de alta prioridad. StaffMessagingService muestra primero el aviso genérico y después programa la consulta; StaffInboxWorker también avisa de pendientes al sincronizar. Por eso un aviso al abrir no demuestra recepción push.
- [FCM intenta entregar alta prioridad inmediatamente](https://firebase.google.com/docs/cloud-messaging/android-message-priority), incluso en Doze; no ofrece un plazo garantizado. No existe una espera fija de un minuto en la app. El cron de servidor revisa pendientes elegibles cada minuto con backoff; WorkManager de30min es respaldo y no el mecanismo de llegada inmediata.
- El test real del sistema recibido y la recuperación programada fueron confirmados anteriormente por el usuario. No hay todavía prueba de pedido recibido con pantalla bloqueada ni diagnóstico exacto actual del teléfono.
- El reintento protegido respondía programado después de enqueueDispatch; no esperaba la reclamación/envío/ACK. La ejecución asíncrona solo registraba un evento genérico al fallar y no contadores de éxito. Esto impedía identificar el eslabón desde los logs.
- Los registros recientes consultados no contenían un POST/orders correlacionable con el pedido nuevo informado. No se deduce que no exista: falta su código/hora/consulta SQL. Brave detecta la pestaña, pero getTab falla por timeout CDP. env run de Vercel no entrega la clave Supabase protegida; no se descargaron archivos de secretos ni se intentó eludir esa protección. No se pudo consultar la cola privada directamente.

## Cambio del servidor

El endpoint POST order-notifications?dispatch=1 conserva CRON_SECRET y ahora espera dispatch antes de responder: configured, processed, accepted, retryable, invalidTokens y errores FCM agregados. Accepted significa aceptación del proveedor, no visualización en Android. El envío inicial después de confirmar pedido mantiene waitUntil y la cola SQL duradera. Se registran resultados agregados y códigos de error SQL/FCM seguros, sin IDs/cliente/token/encabezados/clave ni texto de excepciones. No se cambia el payload FCM, el APK2.1.1, Room, stock, pedidos, roles o secretos.

pg_net del instalador03 tiene timeout HTTP10s; una conexión lenta puede superarlo aunque Vercel siga ejecutando hasta su límite. Un intento inconcluso conserva lease y se recupera al vencer. No se ajustó SQL/cron en producción ni se promete un plazo de entrega.

## Consulta necesaria

Ejecutar completa [05_delivery_diagnosis.sql](../supabase/sql-editor/orders-v2/05_delivery_diagnosis.sql) en SQL Editor del proyecto yopntnzhcfudaabudbld. Es solo SELECT sobre tablas ya instaladas; no requiere migración, no cambia filas ni permisos. Devuelve hasta12 filas con código/fecha/estado del pedido, número de dispositivos autorizados, versión/mode/activo del dispositivo, intentos y aceptación/error. No devuelve datos personales ni tokens. Puede compartirse su resultado.

Interpretación: authorized_devices=0 señala que falta alta vigente; attempts nulo indica que no hay job para esa fila;0 indica que aún no se reclamó; last_error identifica un rechazo; accepted_by_fcm_at significa que el proveedor aceptó. Aceptación sin aviso requiere probar recepción Android/red/prioridad/canal con el diagnóstico del A23. No diagnosticar batería ni cambiar a notificaciones automáticas sin distinguir estos casos.

## Validación y límites

PASS local API/espera real del reintento, proveedor, nueva suite de lease/errores/privacidad, lookup de pedido, renovación y sintaxis web. PostgreSQL aislado prueba la consulta en transacción READ ONLY con registros legacy y archivo histórico, mostrando pedido sin job/dispositivo revocado y sin datos privados. No se ejecutó esa consulta en producción. CI/despliegue se registrarán al verificarlos. Falta la línea Avisos externos actual, resultado de prueba fuera de app y evidencia SQL del pedido real. No hay resolución física declarada.
