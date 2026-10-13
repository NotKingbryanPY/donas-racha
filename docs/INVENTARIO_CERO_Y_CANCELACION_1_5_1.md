# Inventario y cancelación — 1.5.1

El usuario confirmó `WEB_INVENTORY_READY`, server_can_save=true y anon_can_save=false el 13 de octubre. La reparación SQL 01 ya está aplicada según ese resultado. No se necesita otra migración para esta actualización de pantalla/API.

El campo vacío se debía a que counted=false también describe faltantes de reservas o conciliación, no solo ausencia de conteo. La API administrativa añade has_count usando los identificadores de inventory_manual_counts existentes. No expone counted_by ni concede permisos nuevos. La vista de inventario existente ya requiere SELECT de esa tabla para el rol de servidor. El cero guardado se muestra como valor real aunque counted=false; los faltantes se muestran por separado. Nunca se fabrica un conteo para una fila ausente.

Un borrador, incluido el cero, sobrevive a Volver a consultar. Si el servidor cambia de revisión, se conserva el borrador, se muestran las cifras consultadas y se bloquea guardar hasta He revisado el conteo. El servidor sigue comprobando la revisión al escribir. Los inputs se bloquean durante el envío; una respuesta de guardado confirmada limpia el borrador. Un refresco posterior fallido no anuncia una escritura fallida ni permite reutilizar una revisión antigua.

En camino ofrece Cancelar pedido junto a Cobrado y entregado. Usa la transición existente OUT_FOR_DELIVERY → CANCELLED, con confirmación, sin nuevo RPC. La cancelación libera reservas una sola vez; no crea stock ni acredita puntos. Si el pago está confirmado, la pantalla advierte que cancelar no borra ni reembolsa el pago. Pedidos completados no reciben esa acción.

Pruebas locales: API distingue cero registrado de conteo inexistente; PostgreSQL aislado valida cancelación en camino, repetición sin eventos/stock duplicados, pago conservado, cero puntos adicionales y rechazo de cancelar un completado. Dashboard Chromium a 360/768/1440 verifica cero inicial, borradores al refrescar, revisión explícita, guardado/doble clic y confirmación de cancelación. Se renuevan las URLs de JS/CSS a 1.5.1 para evitar assets antiguos.

Las pruebas de navegador usan proveedores simulados y PostgreSQL es aislado. La verificación privada real de guardar un conteo y cancelar un pedido queda a cargo de un ADMIN/SELLER con sesión, sin usar pedidos reales como pruebas desechables. El despliegue debe confirmarse en dracha.store por los assets 1.5.1 y el control de revisión; integrar el PR por sí solo no demuestra publicación.
