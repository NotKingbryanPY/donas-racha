# Donas Racha — modelo operativo actualizado

Donas preparadas para reventa por sabor. Catálogo central con cuatro SKUs existentes de chocolate/vainilla y sus versiones con chispas. Precio de catálogo inicial B/.1 por unidad; ventas presenciales pueden registrar el precio efectivamente cobrado. La composición inicial de compra es4/4/2/2=12, modificable por compra; el costo total se reparte por unidad y el recibo conserva el mix.

Supabase mantiene existencias físicas, reservas y disponibilidad comercial separadas. Desactivar un sabor no cambia las unidades. Compras agregan, ventas/consumos descuentan, correcciones tienen motivo. Disponible = físico − reservas, con déficit detectado; no se fabrican unidades para cubrir reservas. Las columnas históricas purchased_quantity/sold_quantity de la vista agrupan movimientos positivos/negativos: no son por sí solas inversión o ventas del resumen financiero.

Estados web: PENDING → ACCEPTED → OUT_FOR_DELIVERY → COMPLETED, con cancelación desde cualquiera de los tres abiertos. COMPLETED confirma pago y entrega en transacción existente, salida por sabor/fidelidad una sola vez. El bloqueo histórico ACCOUNTING_NOT_READY ya no describe el código vigente. Cancelar en camino libera reserva; un pago confirmado no se borra ni se considera reembolsado automáticamente.

Pago web: efectivo o Yappy recibido por el operador; no hay cobro bancario automático. Donas Control2 permite efectivo/Yappy dividido en venta presencial. Los pedidos web completados tras activar v2 generan un recibo WEB_SALE sin repetir inventario, cobro ni puntos.

Inversión = compras; ingresos = ventas; costo vendido = FIFO de unidades vendidas; utilidad = ingresos − costo vendido. Consumo/corrección se muestra separado y su costo reduce el resultado operativo. Inventario restante conserva su valor y no se imputa como pérdida. Sin costo histórico verificable, utilidad correspondiente queda pendiente. Flujo de caja = ingresos − compras y no equivale a utilidad.

Cierre explícito de jornada (fecha Panamá): guarda resumen/inventario y abre jornada nueva, sin borrar historia ni existencias. No se cierra automáticamente a medianoche mientras puedan existir pendientes offline. Leer [guía IA](knowledge/AI_CONTEXT.md) y [activación v2](DONAS_CONTROL_2_ACTIVACION.md). No reactivar los flujos móviles antiguos para hacer funcionar el libro nuevo.
