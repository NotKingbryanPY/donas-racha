# Flujos y reconciliación

Una respuesta de autorización 401/403 en el worker corta la sesión local, conserva las colas y requiere entrar de nuevo; no se sigue registrando offline tras una revocación ya conocida. La UI valida los mismos máximos de precio/importe que la API. Las consultas usan pendientes y recibos todavía no incorporados, sin cargar todo el libro en RAM.

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
