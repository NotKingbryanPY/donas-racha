# Fase 10: entrega y migración sin pérdida de datos

## Estado comprobado

El APK 1.1.1 usa `com.bryan.donas` y está firmado con un certificado debug distinto al de 1.2.0. Android no acepta la actualización directa. La variante `pilot` se instala como `com.bryan.donas.pilot`, con base y preferencias independientes, para probar 1.2.0 sin desinstalar 1.1.1. No debe usarse para duplicar las ventas reales de la app antigua.

La 1.1.1 solo exporta los asientos a CSV. Ese archivo carece de lotes FIFO, cantidades, configuración y otros datos necesarios para reconstruir la base. `android/donas-control/tools/export-legacy-debug-db.ps1` extrae una copia binaria de `donas.db` y sus WAL/SHM mediante `adb run-as`, siempre que la versión debug esté instalada en un teléfono autorizado. Todavía falta recibir y validar esa copia, construir la conversión del esquema antiguo al nuevo y comprobar saldos antes de reemplazar la instalación. No desinstalar la versión antigua.

## Pedido entregado

Confirmar un pago en la API solo registra el pago. La función SQL actual `api_transition_order` cambia el estado del pedido, pero no crea una venta, descuenta existencias ni acredita puntos. Para evitar una entrega aparentemente cerrada con contabilidad incompleta, `/api/admin/orders/:id/status` devuelve `ACCOUNTING_NOT_READY` (409) al pedir `COMPLETED`. La app Android ya mantiene esa opción deshabilitada. Aceptar, cancelar y pasar a «En camino» siguen disponibles.

## Trabajo siguiente

1. Definir una tabla de existencias por sabor con cantidad inicial explícita, movimientos auditables y reserva por pedido. Reservar al crear el pedido, liberar al cancelar y consumir al completar, todo bajo bloqueos de fila en PostgreSQL. Sin cantidad inicial confirmada no se debe activar la venta web basada en unidades.
2. Sustituir la transición a `COMPLETED` por una función SQL idempotente que, en una transacción, verifique pago confirmado y reserva, registre la venta con un `order_id` único, consuma stock y registre una sola vez los puntos del cliente. Reintentos con la misma clave deben devolver el mismo resultado; claves distintas no pueden duplicar la venta del pedido.
3. Tratar Supabase como autoridad para los pedidos web. Enviar a Android el resultado contable con una clave de origen única y aplicarlo en Room de forma idempotente. Room y PostgreSQL no comparten una transacción global: si se interrumpe la red, el sincronizador debe reintentar y conciliar, nunca crear una segunda venta.
4. Sincronizar las ventas presenciales del widget con las existencias por sabor antes de publicar disponibilidad exacta. El widget actual registra cantidad total, sin desglose de sabores; se necesita selector de sabor o una asignación explícita de stock para esas ventas.
5. Verificar con pedidos reales de prueba: falta de stock, cancelación tras reserva, pago fallido, doble pulsación, reintento tras corte de red y conciliación entre inventario, pagos, ventas y puntos. Solo entonces habilitar `COMPLETED` en API y Android.

Los pedidos que se hubieran marcado `COMPLETED` antes de este bloqueo no se modifican automáticamente; necesitan una conciliación separada para evitar duplicar ventas o puntos.
