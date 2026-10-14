# Donas Control 2.1 — pedidos y avisos externos

## Cambio de alcance y diagnóstico previo

El usuario aclaró el14octubre2026 que Pedidos y avisos del sistema con pantalla bloqueada/app cerrada son prioridad, además del registro diario. Esto amplía2.0; no elimina compras, ventas, consumo, inventario o cierre. Supabase continúa siendo autoridad comercial y Firebase se usa para FCM, no como inventario paralelo.

Confirmado en código2.0: manifest no registra FirebaseMessagingService; DonasApp cancela el sincronizador y registro históricos; endpoint devices responde410 y api/orders/index.js no dispara emisor tras confirmar la transacción. El usuario aportó new_order_push en preflight, pero una cola PostgreSQL no envía FCM por sí sola. Históricamente faltaban FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY en Vercel; su estado actual privado aún no se verificó. El permiso Android habilitado en Honor no resuelve esas causas.

Firebase MCP confirmó proyecto donascontrol-1f5df, aplicación com.bryan.donas.control y certificado oficial. Se leyeron firebase-basics/firebase-auth-basics y documentación oficial de recepción/prioridad FCM. Firebase Auth anterior no se rehabilita: la cuenta ADMIN/SELLER Supabase existente autoriza cada registro y operación.

## Arquitectura que se implementa

Pedidos como entrada Android; caché Room separada por propietario y conservación de datos anteriores. Las acciones aceptar/en camino/cobrar-entregar/cancelar usan la API y transacciones web existentes. No se realiza un segundo descuento, cobro o alta contable Android.

Registro individual revocable del tokenFCM bajo sesión Supabase verificada, por un endpoint nuevo del router existente. Cola/tabla push existentes se reutilizan con marca de autorización nueva; registros históricos no se habilitan automáticamente. Alta de pedido confirma SQL antes de programar el envío del servidor. Mensajes de alta prioridad generan inmediatamente un aviso genérico con sonido/canal y PendingIntent al pedido; WorkManager recupera caché después, sin llamadas de red dentro del callback ni servicios permanentes.

UUID pedido/dispositivo y recibo local evitan repetición del mismo aviso. Token inválido se desactiva; rol o dispositivo revocado no recibe nuevos envíos. Cola persiste fallos, lease y backoff; un fallo de notificación conserva el pedido. Reintento de servidor requiere programación protegida; no se repone el workflow GitHub que enviaba errores por secretos faltantes.

## Validación y límites

Estado inicial: diseño en implementación, sin nuevo APK ni push real verificado. Compilar/test/lint, migración Room, contratos API/SQL, duplicados y navegación deben comprobarse antes de publicar. App cerrada/pantalla bloqueada en Honor requiere prueba física y emisor FCM configurado. FCM/red/Android pueden retrasar entrega; detener forzosamente desde Ajustes exige volver a abrir. Wi-Fi o datos móviles sirven; offline no llegan pedidos nuevos. No se piden exclusiones generales de batería.

Fuentes: [recepción Android](https://firebase.google.com/docs/cloud-messaging/android/receive-messages), [prioridad FCM](https://firebase.google.com/docs/cloud-messaging/android-message-priority), [emisor HTTPv1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [tareas posteriores a respuesta Vercel](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).

## Activación ordenada

El SQL diario ya dio DAILY_V2_READY según el usuario; no se repite. No se ejecutó el SQL nuevo de avisos en producción. Código2.1 no convierte esa validación anterior en ORDER_NOTIFICATIONS_SQL_READY.

| Orden | Archivo orders-v2 | Objetivo y dependencia | Riesgo/verificación |
|---|---|---|---|
| 0 | 00_preflight.sql | Solo lectura, un resultado con columnas/triggers, sin tokens. | Confirmar proyecto y objetos; si hay drift detener/revisar. |
| 1 | 01_apply.sql | Copia de migration202610140001; añade metadata y6 RPC, reutiliza cola, trigger y registros existentes. | Transacción, lock5s/statement60s. No modifica pedidos/stock/puntos ni activa dispositivosLEGACY. Termina END_STAFF_ORDER_NOTIFICATIONS_COMPLETE; copiar completo. |
| 2 | 02_verify.sql | Un resultado: RLS, RPC cerradas, trigger, revocación. | ORDER_NOTIFICATIONS_SQL_READY, checks true; registered_v2_devices puede0 antes de conectar APK. No certifica FCM. |
| 3 | 03_retry_scheduler.sql | Instala pg_cron/pg_net/Vault y helperADMIN privado; todavía no introduce un secreto. | Puede fallar si faltan permisos de extensión/net: rollback y compartir error, no abrir grants públicos. Net guarda headers descifrados; se revoca acceso cliente a schema/tablas/funciones. No cambia otros cron. |
| suspensión | 04_suspend.sql | Inactiva avisos nuevos y cron propio; conserva historia/negocio. | No revierte cobros ni stock. Reaplicar01 y registrar explícitamente teléfonos para reanudar; no bajar APK/Room7 a6. |

Ejecutar cada archivo completo en consulta nueva de Supabase SQL Editor. No seeds ni paquete02antiguo. No pegar claves FCM en SQL. Las tablas viejas pueden permanecer públicas protegidas o archivadas; ambos escenarios se probaron sin restaurar provisión/Firebase/sync contable.

## Configurar emisor protegido

Firebase existente donascontrol-1f5df, paquete com.bryan.donas.control y firma oficial ya verificados. FCM HTTPv1 necesita una cuenta de servicio con permiso de envío (Firebase Cloud Messaging API Admin en ese proyecto). No hace falta habilitar Blaze/Cloud Functions ni escribir compras en Firestore. Guardar únicamente en Vercel donas-racha/king-entertainment Production: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY, CRON_SECRET aleatorio≥32 caracteres. Nunca ponerlos enAPK/frontend/Git ni enviar sus valores al chat.

CLI Vercel64 verificó Logged out. Computer primero solo inventarió navegador interno; luego detectó Brave con las pestañas del usuario, pero los enlaces devolvieron timeout/Debugger unattached y no se pudieron leer. No se afirmó lectura/configuración privada del proyecto. Para automatizar transferencia, autorizar Vercel CLI con `npx -y vercel@64.0.2 login` y ejecutar `scripts/configure-order-notifications.ps1 -ServiceAccountPath <ruta privada local>`. Script valida archivo/proyecto, usa stdin y opciones--sensitive, oculta salida cruda; no copia la cuenta servicio al repositorio. Cada ejecución rota CRON_SECRET y exige volver a activar recuperación. Redesplegar proyecto existente después de cambiar variables.

Tras SQL/emisor: instalarAPK2.1 como actualización sin borrar datos, entrar con cuentaSupabase ADMIN/SELLER, permitir notificaciones/canal; pulsar Activar/comprobar avisos. Una validación FCM exitosa reactiva jobs agotados del propio teléfono (pendientes<24h, sin lease activo), sin reenviar aceptados. ADMIN pulsa Activar recuperación del servidor: API guarda CRON_SECRET desde su entorno enVault y programa solo cron propio cada minuto, invocando únicamente cuando hay jobs elegibles. No viaja secreto por el cliente. Pulsar Enviar prueba a este teléfono y comprobar aviso real; FCM_ACCEPTED no basta.

## Recorrido de aceptación físico

Con un pedido real autorizado verificar app abierta, fuera de pantalla, segundo plano y teléfono bloqueado con Wi-Fi/datos; aviso con sonido, tap al UUID y estado. Repetir respuesta perdida sin otra orden/cobro/reserva/aviso. Aceptar→en camino→cobrado-entregado o cancelar también en camino; comprobar web/diario/puntos/stock únicos. Desconectar: no llegan pedidos nuevos; reconectar/abrir recupera activos. Probar sesión sin rol, token inválido y revocar avisos del teléfono; revocar avisos no revoca la cuentaSupabase ni recalls de mensajes ya aceptados. Para quitar acceso a datos, retirar rol/invalidate sesión enSupabase. No crear ventas/clientes ficticios en producción para aparentar pruebas.

Enlaces antiguos de notificación/widget a MainActivity/OrdersActivity se redirigen mediante alias a DailyActivity: no reactivan los escritores contables retirados. Se preserva su código/datos para recuperación.

Si un pedido ya tiene pago confirmado, Cobrado y entregado pide confirmar solo la entrega y conserva el método registrado; no vuelve a pedir un cobro ni permite cambiarlo silenciosamente.

El detalle toma la versión más nueva del pedido y la actualización vuelve a consultarlo por UUID, evitando que un objeto de detalle viejo oculte estados cambiados en la web.
