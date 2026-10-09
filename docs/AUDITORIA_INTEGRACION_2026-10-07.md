# Auditoría Donas Racha / Donas Control — 7 octubre 2026

Diagnóstico entregado antes de cambios importantes. Se revisaron migraciones, API, Room, Kotlin, manifiesto, web, tutorial y workflows. `customer.html` redirige; interfaz real: `index.html`. El adjunto solo contiene políticas RLS, no columnas, RPCs ni historial aplicado. Las guías iniciales son anteriores al código actual. No se ejecutó SQL de producción.

## Arquitectura encontrada
Web HTML/JS y API Node en Vercel. Android llama `https://www.dracha.store`; web usa mismo origen. Proyecto Supabase depende de variables del servidor, aún no verificadas en Studio. Clientes usan usuario/contraseña con hash, sesión HMAC propia, vencimiento de siete días y versión de credencial; operadores Supabase Auth con ADMIN/SELLER y refresh token cifrado. Solo servidor guarda service role. Android tiene Keystore, Room v4, FIFO, cola persistente `sync_outbox`, cursor incremental y WorkManager. SQL transaccional confirma pedidos, pagos, reservas, puntos y entrega con idempotencia.

## Causas comprobadas
- Subidas requieren UNMETERED y StableWifi: red móvil no sincroniza ventas.
- Refresco web de stock conserva nombre/available anteriores y catálogo inicial elimina deshabilitados.
- Android solo permite conteo físico, no editar nombre/oferta comercial.
- PendingIntent usa requestCode 0 sin orderId ni URI; abre lista, no pedido.
- Registro FCM usa coroutine efímera, silencia errores y no tiene reintento persistente.
- Firebase confirmado por el usuario: donascontrol-1f5df / 476925718096; faltan App ID Android, API key pública y emisor servidor. Código presente no implica notificaciones activas.
- Workflow de reintentos apunta donas-racha.vercel.app mientras Android usa www.dracha.store.
- Launcher abre MainActivity contable, no Pedidos.
- Perfil destaca lifetime_points aunque backend separa correctamente available_points.
- Confirmación carece de animación/WhatsApp; clave del intento está solo en memoria y controles pueden cambiar durante envío.
- Cursor convierte microsegundos PostgreSQL a milisegundos Date JS: puede repetir páginas.
- Revocación app_devices se verifica al subir pero no en todas las lecturas con cuenta tradicional.

## Qué se conserva
Contabilidad, FIFO, backups, widget, idempotencia, conciliación de rechazadas, entrega/pago transaccional, recompensas, ranking/niveles históricos y tutorial de ocho pasos con IDs/data-tour/progreso servidor y marcador local.

## Offline real
Room permite consultar pedidos guardados, inventario local y registrar operaciones contables locales. Sin red no llegan pedidos nuevos ni se confirman pagos/entregas globales. Ventas pendientes pueden rechazarse: no equivalen a confirmadas. Conteo global y puntos requieren servidor. Variantes centralizadas en products/product_variants: UUID en pedidos, SKU estable en contabilidad. `available` (oferta) se distingue de movimientos/conteos/reservas (stock).

## Plan presentado
Reutilizar WorkManager/Keystore/Room, aceptar red validada y backoff. Añadir cola comercial persistente con versión esperada, RPC idempotente y conflictos visibles. Aprovisionamiento único con invitación aleatoria, credencial individual revocable y rol acotado; apertura directa de Pedidos. FCM principal, respaldo periódico, tap al pedido y renovación persistente. Jerarquía de perfil/navegación y confirmación posterior a éxito verificable con recuperación y WhatsApp. Tutorial mínimo: conservar versión, IDs y progreso.

## Riesgos y límites
Sin conexión no se puede garantizar inventario físico consistente entre varios vendedores; SQL rechaza/concilia al reconectar. Revocar corta servidor y push, no borra remotamente un teléfono offline. Ningún secreto privilegiado en APK. Firebase requiere proyecto externo y configuración de servidor/compilación. Android/FCM/batería/red pueden retrasar avisos. Migraciones serán aditivas, con RLS, preflight y pruebas aisladas; no se ejecutan destructivas. APK debe conservar firma de distribución y migrar Room sin borrar.

## Evidencia remota pendiente
Studio no accesible: navegador falla al iniciar con setup refresh had errors. Pendiente contrastar columnas, migraciones aplicadas, backend Vercel/Supabase, RLS SELLER/dispositivos, publicación Realtime y prueba física de push/pedidos. No afirmar validación integral de producción.

## Verificación remota de solo lectura
www.dracha.store y /api/products devuelven HTTP 200. Catálogo central devuelve los cuatro SKUs estables; /api/products?view=inventory confirma oferta y conteo para los cuatro. /api/admin/orders y /api/sync devuelven HTTP 401 AUTH_REQUIRED sin credenciales. No se creó un pedido ni se cambió producción. Esto confirma el catálogo existente: no repetir seed_donut_flavors.sql. Aún no permite establecer todas las migraciones/RLS/URL Supabase reales.
