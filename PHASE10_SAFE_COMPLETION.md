# Fase 10: entrega y migración sin pérdida de datos

## Estado comprobado

El APK 1.1.1 usa `com.bryan.donas` y está firmado con un certificado debug distinto al de 1.2.0. Android no acepta la actualización directa. La variante `pilot` se instala como `com.bryan.donas.pilot`, con base y preferencias independientes, para probar 1.2.0 sin desinstalar 1.1.1. No debe usarse para duplicar las ventas reales de la app antigua.

La 1.1.1 solo exporta los asientos a CSV. Ese archivo carece de lotes FIFO, cantidades, configuración y otros datos necesarios para reconstruir la base. `android/donas-control/tools/export-legacy-debug-db.ps1` extrae una copia binaria de `donas.db` y sus WAL/SHM mediante `adb run-as`, siempre que la versión debug esté instalada en un teléfono autorizado. Todavía falta recibir y validar esa copia, construir la conversión del esquema antiguo al nuevo y comprobar saldos antes de reemplazar la instalación. No desinstalar la versión antigua.

## Pedido entregado

El código nuevo separa la confirmación del pago del cierre. `api_complete_order` comprueba el pago, consume la reserva, crea una venta única y acredita puntos dentro de una transacción PostgreSQL. `/api/admin/orders/:id/status` llama esta función para `COMPLETED` y Android muestra esa acción tras confirmar el pago. La compilación y pruebas instrumentadas pasaron en emulador; la migración aún no se ha aplicado en producción ni se ha probado con un teléfono. El sitio publicado conserva su estado anterior hasta el despliegue controlado.

## Comprobaciones antes de activar la venta

1. Respaldar la base, inventariar pedidos abiertos e históricos y conciliar ventas de dispositivos. La migración inicia el stock en cero y el modo de pedidos apagado; contar físicamente cada sabor antes de activarlo.
2. Probar las migraciones y la API contra un proyecto Supabase de prueba con operaciones paralelas. La prueba local PGlite verifica la lógica transaccional, pero no sustituye esta prueba.
3. Probar la instalación piloto, Room v3→v4, pérdida de red, reintentos, reversas y widget en emulador y teléfono. No instalar el APK nuevo sobre 1.1.1.
4. Confirmar que cada pedido cerrado tiene exactamente una venta, un pago confirmado, consumo de reserva y una sola acreditación de puntos; los pedidos anteriores no se reescriben.
5. Seguir `docs/ROLLOUT_2026-09-24.md` para despliegue, supervisión y reversión.

Los pedidos que se hubieran marcado `COMPLETED` antes de este bloqueo no se modifican automáticamente; necesitan una conciliación separada para evitar duplicar ventas o puntos.
