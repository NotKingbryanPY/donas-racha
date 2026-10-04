Donas Control 1.3.0 piloto: sesión persistente, resumen de pedidos/ventas, inventario compartido, sincronización por Wi‑Fi estable y soporte FCM. Cada caja incorpora 4 chocolate, 4 vainilla y 2 de cada sabor con chispas. Conserva widget, efectivo/Yappy, escáner y cierre de pedidos con cobro confirmado.

El cobro, entrega y puntos se confirman juntos en Supabase. Aceptar no da puntos. Fidelidad por QR y venta contable siguen siendo acciones distintas. El inventario compartido requiere las migraciones del 3 de octubre y la API nueva; las ventas offline lo actualizan al sincronizar. Push con app cerrada requiere Firebase en la build y claves FCM en el servidor; sin ellas siguen los avisos al consultar. Véase `docs/DONAS_CONTROL_1.3.0_ANALISIS_Y_ACTIVACION.md`.

Descarga el archivo `.apk` desde Assets en el teléfono. Esta variante usa el paquete `com.bryan.donas.pilot` y no sustituye la aplicación original. Conserva una copia de seguridad antes de actualizar. Si Android indica conflicto de firma con otro piloto, no desinstales sin exportar sus datos; la firma de los pilotos anteriores puede ser distinta.

El flujo de escaneo depende de Google Play Services; en la primera apertura puede descargar su módulo. Si no está disponible, usa la búsqueda por ID. Pendiente validar el escáner en un teléfono físico. El archivo `.sha256` permite comprobar la integridad de la descarga.
