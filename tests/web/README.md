# Prueba visual local

Esta prueba usa un Chrome local y respuestas API simuladas; no toca Supabase ni las cuentas productivas. Requiere `playwright-core` disponible en el entorno de desarrollo.

Desde la raíz del repositorio, iniciar `python -m http.server 8765` y luego ejecutar `node tests/web/smoke.cjs`. Verifica el conteo y modo venta del panel, el pedido de delivery desde un perfil autenticado, la vinculación con código temporal, puntos y QR del cliente, y unidades restantes en el catálogo. `node tests/customer-order-auth.cjs` verifica que las rutas de pedidos rechazan solicitudes anónimas. No sustituye las pruebas de API real ni de teléfono.
