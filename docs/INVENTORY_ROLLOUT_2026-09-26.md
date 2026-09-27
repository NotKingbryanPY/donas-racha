# Inventario por sabor: activación gradual

La migración `202609260001_box_inventory.sql` agrega compras de cajas, ventas por sabor, conteos físicos, vista de disponibilidad y publicación Realtime. No borra pedidos, puntos ni datos previos. La caja aporta 4 chocolate, 4 vainilla, 2 chocolate con chispas y 2 vainilla con chispas. Los pedidos abiertos reducen las unidades reservables y la entrega confirmada registra la venta en la misma transacción que acredita la fidelidad.

1. Respaldar Supabase y aplicar las migraciones pendientes en orden. Comprobar que `/api/products?view=inventory` muestra cuatro sabores y que el perfil por ID sigue funcionando.
2. Sincronizar el Android piloto por Wi-Fi. Las operaciones nuevas de compra envían cantidad de cajas y las ventas envían sabor y cantidad. Los movimientos antiguos sin detalle generan una brecha de conciliación y exigen un nuevo conteo.
3. Contar físicamente los cuatro sabores en el panel Admin. Hacerlo después de sincronizar las operaciones pendientes. Mientras falte algún conteo, los pedidos conservan el flujo previo y el cliente ve «por confirmar» en vez de una cifra inventada. Al completar los cuatro conteos, se activa automáticamente el límite de stock.
4. Probar un pedido de cliente registrado, aceptación, cobro presencial y entrega. La solicitud sola no otorga puntos; la entrega completada sí. Verificar que la venta se descuenta una sola vez aunque se reintente.
5. Probar un lote de cajas nuevo y una venta desde el widget sin red, conectar a Wi-Fi y verificar el saldo por sabor en la web. Comparar luego el conteo físico con Supabase. La web consulta el saldo cada 20 segundos mientras «Pedidos» esté abierto.

Las ventas presenciales sin conexión pueden coincidir físicamente con reservas web antes de sincronizar. El total mostrado tiene piso 0 y el vendedor debe conciliar físicamente antes de aceptar más pedidos si hay un desfase. El widget mantiene contabilidad local por unidades totales; el conteo central por sabor se actualiza al sincronizar. La instalación piloto no sustituye el APK 1.1.1 ni sus datos.
