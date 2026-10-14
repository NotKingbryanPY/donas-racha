# Interfaz y diseño

La inspección de renders nativos corrigió la acción Consumo que partía una palabra en pantallas pequeñas, eliminó códigos internos de estado como PURCHASE del encabezado y añadió indicador lavanda de navegación activa. Los teclados de cantidades/cajas son enteros; importes permiten decimales. La prueba de captura comprueba texto y el número de líneas de esa acción.

[Contexto](AI_CONTEXT.md) · [Pantallas](diagrams/06-ui.md)

DailyActivity nativa con Views/Material: Hoy, Inventario, Historial. Hoy tiene hero de ingresos y acciones Compra/Venta/Consumo, resumen y cierre. Formularios preservan borrador/UUID, muestran total por caja y permiten pago dividido. Inventario diferencia físico/reservado/disponible/proyección pendiente. Historial muestra conflictos y confirmados/cierres. La sesión inicial usa cuenta del Dashboard y no registra capital.

Paleta del perfil dracha.store: #100d17 fondo, #1d1728 tarjeta, #30213f hero, #c5a3ee lavanda, #d986b4 rosa. Texto claro/contraste, superficies redondeadas, touch targets 48dp+, ScrollView con insets de barras/teclado, vista oscura sin motor de animación adicional. Android usa tipografía nativa; la web conserva Nunito local. Ejemplo raster previo [concepto](../previews/donas-control-2-concept.png), cifras ilustrativas, no datos del negocio.

Web conserva perfil/pedidos claros, puntos disponibles principales y acumulados secundarios, tutorial por IDs/data-tour, confirmación de pedido después de servidor y WhatsApp, reducción de movimiento. daily-business.js agrega un panel staff aislado; no cambia DOM del tutorial. Los drafts de conteo web 1.5.1 y cancelación en camino se conservan.

La imagen generada es una propuesta, no captura del APK. Los resultados de render/pruebas reales se registran en VALIDATION. No se requiere descargar imágenes pesadas para operar.
