# Flujos y reconciliación

Cada mutación recibe el propietario esperado de la cola. El transporte captura token y propietario bajo el mismo lock de login/logout/refresh y mantiene ese vínculo también al renovar un401. Cambiar de cuenta durante un envío no permite continuar la cola antigua con credenciales de otra persona. Una prueba HTTP verifica que ese cambio no envíe la petición.

Una respuesta de autorización 401/403 en el worker corta la sesión local, conserva las colas y requiere entrar de nuevo; no se sigue registrando offline tras una revocación ya conocida. La UI valida los mismos máximos de precio/importe que la API. Las consultas usan pendientes y recibos todavía no incorporados, sin cargar todo el libro en RAM.

La paginación histórica local de la pantalla se reinicia cuando llegan recibos nuevos, para no mezclar dos ventanas de secuencias ni ocultar registros entre ellas.

El envío usa el orden de inserción durable de SQLite, no el reloj del teléfono: una corrección de hora no puede enviar una venta antes de la compra pendiente de la que depende. Una prueba específica reproduce timestamps que retroceden.

La UI no ofrece repetir ciegamente un payload de jornada cerrada o revisión antigua: explica que el rechazo debe revisarse/descartarse explícitamente y registrarse de nuevo con la jornada/revisión actual. Para stock temporalmente insuficiente o conteo faltante, se conserva el reintento del mismo UUID después de resolver la causa.

[Contexto](AI_CONTEXT.md) · [Sincronización](diagrams/03-sync.md)

## Registro Android

1. Entra una vez con la cuenta ADMIN/SELLER del Dashboard. Refresh token en Keystore; contraseña no persistida. No se concede un rol por registro Firebase.
2. Primera consulta autorizada obtiene jornada, resumen, catálogo e inventario; caché Room por usuario. Sin esa copia no se aceptan operaciones. Autorización offline local limitada a 24 h desde la última consulta; una revocación central se comprueba al reconectar.
3. Compra: cajas × composición por sabor; conserva el mix usado. Venta: unidades/precio y efectivo + Yappy = total exacto. Consumo: salida sin ingresos. UUID/payload quedan durables en daily_outbox; borrador de formulario local conserva UUID. No alterar el payload para reintentar.
4. Worker conectado refresca, envía por orden de inserción, valida operationId/serverSequence antes de ACK, refresca otra vez. Timeout conserva PENDING y el mismo UUID; el servidor devuelve replay sin otra escritura. Cache/recibos se vinculan a la cuenta y no se envían con otra cuenta.
5. Stock/jornada/revisión inválidos producen CONFLICT visible. Detiene operaciones dependientes. Reintentar conserva UUID; descartar exige confirmación y conserva registro CANCELLED local. No descartar un envío incierto ni una venta confirmada. Tras cierre remoto, revisar/descartar el rechazo explícito y registrar en la jornada correcta manualmente; no moverlo automáticamente.

La proyección local usa stock físico menos reservas, sin ocultar un déficit detrás de cero; suma pendientes aún no incluidos en snapshot. ACK/ID/secuencia impiden descontar un envío dos veces en la copia. Un pendiente no garantiza stock central: otro vendedor o pedido puede ganar la reserva al reconectar.

## Cierre/corrección

Cierre online y sin pendientes/conflictos locales; expectedRevision y expectedSequence protegen contra cambios conocidos. SQL guarda resumen/inventario del cierre y crea jornada nueva; replay no vuelve a cerrar. Conserva el stock restante. Otros teléfonos desconectados no se detectan remotamente: sus operaciones sobre la jornada cerrada requieren revisión. Jornada con fecha Panamá se cierra explícitamente; no se descarta inventario ni se cierra automáticamente a medianoche.

Corrección ADMIN con motivo y delta firmado, online/revisión vigente, sin pendientes. No representa compra ni ingreso; aumento de unidades sin costo conocido crea cobertura de costo desconocido. Conteos web conservan su flujo existente; la cobertura de lotes se reconcilia contra unidades reales en la próxima operación, sin reescribir stock.

## Pedidos y web

Se conserva creación idempotente y reserva central, confirmación verificable/animación/WhatsApp, seguimiento propietario, cancelación en estados abiertos y entrega pagada. zz_daily_web_sale se ejecuta después de los triggers existentes al completar pedido: registra ingreso y costo una vez por order_id. No agrega otro movimiento de unidades, cobro ni puntos. No importa pedidos ya completados al instalar.

Dashboard muestra resumen/últimos recibos confirmados del mismo RPC que Android; cantidades disponibles siguen en inventory_by_flavor y API pública. Catálogo usa Realtime para invalidar y HTTP para datos; stock/reservas usan respaldo visible. Tutorial y jerarquía de puntos disponibles permanecen.

## Costos

FIFO por sabor. El costo total de compra se distribuye uniformemente por unidad, precisión decimal 8, redondeo a centavos al presentar el resumen. La composición queda en payload y per_box_quantity; nombres/SKU/precios son snapshots. Stock anterior sin costo no se fabrica como compra. Utilidad comercial es ingresos − costo vendido; si la venta incluye costo desconocido, profitCents=null. Consumo/corrección no generan venta y su costo se muestra separado.

## Pedido y aviso2.1

Web POST/orders verifica cliente, confirma pedido/reserva/evento+job atómicos, devuelve éxito y programa waitUntil de FCM. Backend reclama lease para tokens nuevos autorizados; envía data de alta prioridad y confirma solo aceptación. Fallo conserva pedido/job; cron protegido recupera pendientes elegibles sin esperar app abierta. Un registro nuevo recupera pendientes de últimas24h; pedidos más antiguos permanecen consultables.

StaffMessagingService valida propietario/dispositivo/UUID, publica aviso inmediatamente sin fetch y después pide WorkManager. El tap pasa owner/UUID a DailyActivity; otra cuenta no muestra sus datos. StaffInbox pagina API existente y actualiza solo su cache, conserva anterior ante error/cambio de propietario. Estados/cobro/cancelación online usan mismas transacciones web; no bookRemoteOrder ni segundo descuento.

Permiso/canal bloqueado desactiva el registro al comprobarlo; reactivar vuelve a registrar. Registro token tiene timeout30s/backoff; falta emisor/SQL no causa bucle infinito. Offline no llegan pedidos; abrir/reconectar recupera activos. No se promete tiempo exacto, ni recepción tras detención forzosa de Android.

2.1.1: request de registro devuelve el UUID real de WorkManager. La comprobación manual observa ese WorkInfo con el lifecycle del Activity, muestra espera de red/cola/reintento y finaliza con SUCCEEDED/FAILED/CANCELLED; no confunde finalización de la consulta con entrega física. El botón queda deshabilitado mientras ese trabajo está pendiente y se habilita al terminar. Recreación conserva UUID/propietario; cambio de cuenta descarta seguimiento visual anterior. El diagnóstico persistente PushHealth continúa separado del feedback de pedidos. Cola/renovación y transacciones comerciales no cambian.

Renovación de sesión: Android conserva el refresh cifrado y renueva por POST /api/auth/session antes de consultar avisos/pedidos. Se acepta input opaco no vacío/acotado/sin espacios, incluidos12 caracteres; Supabase valida/rota y se vuelve a comprobar ADMIN/SELLER. El mínimo20 anterior producía400 antes de registrar FCM. No se recrea una cuenta ni se limpia Room para corregirlo.

Investigación de avisos fuera de app: usuario A23 informa pedido sin aviso tras1min y recuperación al abrir. FCM ya usa alta prioridad/data y el worker también genera avisos por consulta; abrir no prueba push. Se corrige el reintento protegido para esperar dispatch/ACK y devolver aceptación/errores agregados; el envío inicial mantiene waitUntil y logs de códigos/contadores sin tokens/IDs. Accepted no significa mostrado. Consulta orders-v2/05_delivery_diagnosis.sql solo SELECT permite distinguir falta de dispositivo/job, intentos/rechazo/aceptación. No se pudo leer la cola real por timeout de Brave y clave protegida no exportable en env run; no se eludió protección. Mantener APK2.1.1/Room7/secretos/stock. Ver docs/DONAS_CONTROL_AVISOS_SEGUNDO_PLANO.md; falta diagnóstico actual del A23 y consulta real, sin solución física afirmada.

## Seguimiento del cliente Drachas

GET customer/orders autentica dr1, deriva customer_id y lee activos50/historial10 por página. Caché solo en memoria, updated_at preciso, respuestas de generaciones viejas descartadas. Cambio real anuncia una vez; baseline silencioso. Sin activos/oculta/offline se detiene; al volver recupera. stock/cart se refrescan por otro flujo. Una transición que cruza ambas consultas se resuelve por versión, sin otra escritura.

POST conserva payload/UUID por dueño en sessionStorage. Solo rechazos conocidos liberan; timeout incierto recupera el mismo envío. Logout borra formulario/caché/DOM y cancela lecturas, conservando el intento de su dueño. Recibo confirmado carga detalle privado; error de lectura no fabrica éxito ni deshace la creación. Enlace de pedido sobrevive a recarga con autenticación; no expone actores/notas internas. Dedupe mínimo100códigos por cliente en localStorage, Web Locks/storage events cuando existen, sin tokens/direcciones. No Web Push. [Detalle](../DRACHAS_WEB_2026-10-18.md).


## Portada de recompensas — 18 octubre 2026

Portada: anónimo sin lectura privada ni saldo supuesto. ID/token guardados → getCliente autenticado → verificar propietario/forma/generación → nextRewardState → seis tramos visuales y texto en puntos. RenderProfilePreview alimenta el mismo componente tras consultas/canjes. Cambio de identidad aborta/limpia y descarta respuestas antiguas. Solo memoria; sin polling. Precio y disponibilidad mantienen renderPublicCatalog.

La portada limpia su snapshot en pagehide antes de BFCache y vuelve a verificar la identidad en pageshow.persisted. Se comprueba con eventos de historial simulados; no se afirma una prueba física de Safari.

## Rankings — 27 octubre 2026

Público: api/ranking → api_public_ranking → render compartido Hall of Fame, sin IDs ni acciones a perfiles privados. Perfil conserva la misma API pública; cada cambio de categoría invalida respuestas anteriores. Semanal: enlace staff → login existente si falta sesión → adminRequest con renovación existente → requireStaff → rate limit → api_staff_weekly_ranking con actor verificado → ledger PURCHASE_EARN por semana Panamá. El RPC solo lee; no acredita ni altera compras. Semana nueva usa intervalo nuevo, historia sigue en SQL. UI selecciona semanas y conserva URL; limpiar al salir/logout evita render tardío privado. [Detalle](../RANKING_2026-10-27.md).
