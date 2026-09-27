# Inventario manual y cierre de pedidos — 27 septiembre 2026

El inventario publicado se administra manualmente desde Administración → Inventario. Guardar los cuatro sabores reemplaza el conteo físico anterior de forma atómica. Se incluyen las donas apartadas para pedidos existentes; las reservas se descuentan aparte. Las compras y ventas offline de Android conservan su registro y sincronización contable, pero ya no cambian las existencias de la web.

Los pedidos web reservan unidades. Cancelar libera la reserva. Completar una entrega confirmada convierte la reserva en venta, sin descontar dos veces. Después de ventas presenciales o compras nuevas, el vendedor vuelve a contar y guarda el inventario actual. La web consulta al abrir Pedidos o pulsar Actualizar; Realtime queda pospuesto.

1. Aplicar `202609270001_manual_inventory_and_completion.sql` después de las migraciones anteriores. Es aditiva, preserva los conteos válidos existentes y deja sin inventar los sabores pendientes.
2. Publicar la web/API y el APK piloto 1.2.1. El panel nuevo guarda los cuatro sabores con `api_set_manual_inventory`.
3. Registrar el conteo físico real de los cuatro sabores, usando 0 cuando se agote uno. Entonces se activa la comprobación de stock al crear pedidos.
4. Pedido: Pendiente → Aceptar → En camino → Cobrado y entregado. El último paso confirma el método de pago y, en una sola transacción, registra cobro, entrega, inventario y fidelidad. Aceptar no da puntos. Las reglas de una compra acreditable por día y tolerancia de racha siguen vigentes.
5. Android mantiene widgets offline por sabor con −/cantidad/+, efectivo y Yappy. La contabilidad local no se mezcla con el conteo manual web. El piloto usa un paquete separado; exportar copia antes de actualizarlo y no desinstalar por conflictos de firma sin preservar datos.

Validación: `tests/manual-inventory-postgres.mjs` prueba migraciones, permisos, reserva, agotamiento, cierre atómico y reintentos en una base desechable. Compilación Android y lint en GitHub Actions. No se crean ventas ni pedidos de prueba en producción.
