# Pedidos fuera de la app — Donas Control 1.4.2

## Diagnóstico comprobado

El usuario tiene un Honor X7c, Donas Control 1.4.1 y notificaciones permitidas. El trabajo real de GitHub [37944131779](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37944131779), del 9 de octubre de 2026, registró `Order push dispatcher not configured.`. Faltaba el secreto del repositorio `ORDER_PUSH_CRON_SECRET`; el script anterior salía con código cero y mostraba éxito sin despachar. Esto confirma que el respaldo de reintentos estaba inactivo. No demuestra por sí solo si las tres variables FCM de Vercel existen o si sus credenciales son válidas.

En Android, el receptor FCM mostraba el aviso inmediatamente, pero pedía una descarga ordinaria con `KEEP`. Android podía demorarla, y una solicitud durante otra descarga podía descartarse. La cola contable se enviaba antes de consultar pedidos. El registro del teléfono no diferenciaba que el emisor FCM del servidor estuviera desactivado.

El navegador de esta sesión no pudo abrirse tras los intentos de recuperación admitidos. No se leyeron ni configuraron claves privadas Vercel/Firebase, y no se comprobó una entrega al teléfono físico. No se atribuyó el problema a Realtime ni a la batería del Honor sin evidencia.

## Implementación

- Se mantiene FCM HTTP v1 con datos mínimos y prioridad alta para pedidos existentes, encolados por el trigger transaccional Supabase. El pedido permanece aunque falle el envío.
- Tras un push alto, WorkManager solicita trabajo expedited en Android 12+. Si falta cuota, conserva el trabajo como ordinario. Android anteriores conservan trabajo ordinario; no se introduce un servicio permanente.
- Cada mensaje FCM deja trabajo persistente con identidad propia y etiqueta `donas-order-push`. Una nueva descarga no queda descartada ni bloqueada por el backoff de un mensaje anterior; las entregas repetidas del mismo mensaje se agrupan con `KEEP`. El mutex existente mantiene exclusión entre tareas. La consulta incremental de pedidos precede al envío contable; Room, la cola persistente y los identificadores existentes se conservan.
- `onDeletedMessages` solicita recuperación cuando FCM informa mensajes descartados. El monitor de 15 minutos existente sigue siendo un respaldo sujeto a restricciones Android, no un reloj exacto ni el emisor principal.
- Registro/token renovables con trabajo diario persistente, conectividad y backoff; se evita repetir el registro en cada reinicio del proceso si el registro de la versión es reciente. Los callbacks de renovación fuerzan el registro.
- «Comprobar avisos» registra el teléfono y consulta un diagnóstico privado. Usa `validate_only` de FCM: valida el emisor sin enviar un aviso ficticio ni crear un pedido. No confirma entrega física. El diagnóstico persiste configuración, resultado, fecha y último push, sin almacenar el token en esos metadatos.
- La UI observa también la descarga disparada por push y el monitor, detecta canal bloqueado y permite abrir los ajustes normales de notificaciones.
- El backend filtra el diagnóstico por propietario y dispositivo autorizado. Nunca devuelve el token ni una clave privada. Reutiliza una sola petición OAuth simultánea y distingue firma inválida/autorización fallida de interrupciones temporales.
- El despachador informa solicitudes aceptadas por FCM/APNs, errores reintentables y tokens inválidos. «Aceptado» no significa «mostrado en Android». El workflow falla explícitamente si falta el secreto, no hay emisor Android o el proveedor rechaza envíos reintentables.
- La sección administrativa web «Dispositivos autorizados» añade «Comprobar avisos Android», con indicadores del emisor y del secreto de reintentos del servidor. No afirma que el secreto del repositorio o su ejecución estén verificados solo por existir `CRON_SECRET` en Vercel.

Referencias: [prioridad FCM y WorkManager](https://firebase.google.com/docs/cloud-messaging/android-message-priority), [recepción y mensajes descartados](https://firebase.google.com/docs/cloud-messaging/android/receive-messages), [trabajo expedited y compatibilidad](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work), [validación HTTP v1](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send).

## Activación pendiente: no requiere otra migración SQL

El esquema push instalado ya tiene registro, jobs, leases, backoff, idempotencia y revocación. No repetir el paquete SQL 02 ni alterar stock para esta corrección.

1. Actualizar API/web desde el PR 1.4.2 y conservar las variables Supabase existentes.
2. En Vercel Production configurar `FCM_PROJECT_ID=donascontrol-1f5df`, `FCM_CLIENT_EMAIL` y `FCM_PRIVATE_KEY` del emisor autorizado, si faltan. La cuenta requiere `cloudmessaging.messages.create` sobre ese proyecto; usar el rol específico Firebase Cloud Messaging API Admin, no Owner/Editor. `google-services.json` es configuración pública Android y no sirve como clave privada del emisor. Guardar claves únicamente en el servidor, nunca en chat/Git/APK. Ver instrucciones de [activación del servidor](DESPLIEGUE_WEB_1_4_1.md).
3. Configurar el mismo secreto aleatorio privado (al menos 32 bytes) en Vercel Production `CRON_SECRET` y GitHub Actions `ORDER_PUSH_CRON_SECRET`. Redesplegar Vercel tras cambiar variables. El cron de GitHub expresa cada cinco minutos, pero GitHub puede retrasarlo; revisar ejecuciones reales. El envío inicial se intenta directamente después del pedido, sin depender de ese cron.
4. Instalar el APK oficial 1.4.2 encima del oficial 1.4.1, sin desinstalar ni borrar datos. Conserva el paquete y certificado. En Pedidos pulsar «Comprobar avisos» y comprobar el resultado FCM y la última sincronización.
5. Crear un pedido real de prueba identificable con un sabor disponible. Salir a inicio del teléfono, bloquearlo y comprobar aviso único, apertura del pedido exacto y copia Room. Repetir con app abierta, pérdida/recuperación de conexión y proceso retirado de memoria. No registrar pago/entrega ficticios. Distinguir cierre normal de «Forzar detención»: esta última puede bloquear FCM y trabajos hasta abrir de nuevo la app.

No solicitar exclusión global de batería ni mantener un proceso perpetuo. Si la configuración del servidor y el push recibido están comprobados pero el Honor aún retrasa la descarga, investigar la restricción concreta y registrar tiempos antes de cambiar sus ajustes.

## Validación

Resultados automatizados y APK se completan tras la compilación. Ya pasaron las pruebas del proveedor simulado FCM/APNs, diagnóstico privado/aislamiento, UI web del diagnóstico, sintaxis web, consulta exacta de pedido, autenticación de dispositivo y operaciones de inventario compartido en PostgreSQL aislado. Ninguna de ellas equivale a entrega FCM real con pantalla bloqueada.
