# Interfaz y diseño

## Portada sobria de recompensas

Referencia18octubre en landing.css, aislada de Perfil/Dashboard. Hero y tarjeta en dos columnas desde900px; orden vertical móvil. Logo SVG y Nunito conservados. Fondo100E17/tarjetas17121F, lilaBE8AEE, botones7928C4/8B3BD4 y divisores332A3E. Se elimina el DOM de órbitas/dona flotante/torre y se limita el tilt/reveal a pantallas privadas. Sellos adaptables con valores reales en puntos; estado anónimo sin progreso ficticio. Pareja chocolate/vainilla generada por solicitud del usuario, con nota Imagen ilustrativa, WebP480/960/1536, dimensiones explícitas, carga diferida y proporción3:2 sin recorte. [Implementación y límites](../DRACHAS_PORTADA_2026-10-18.md).

## Implementación aprobada Drachas18octubre

C elegida: SVG Dr/dona y glaseado + achas, versiones ligeras e iconos, marca visible en web. Pedidos activos antes del formulario; badge/perfil, progreso real, detalles y anteriores. Recibo nativo contextual con consulta verificada, símbolo1s→check, reduced motion y celebración única. Sin re-render idéntico del detalle, conserva expansión/foco. Carrito320px en grid para que los nombres no se partan. Tutorial1 solo cambia marca/texto y evita foco al detener un tutorial inactivo. [Informe](../DRACHAS_WEB_2026-10-18.md).

Ver confirmación: sustituye el botón genérico estrecho, que quedaba pegado a Confirmar pedido, por una acción secundaria de ancho completo con superficie sólida, borde visible, icono de recibo y ayuda «Detalles y estado del último pedido». Altura mínima 76 px, separación superior 14 px, texto adaptable y outline de teclado de 3 px. `aria-labelledby`/`aria-describedby` separan nombre y ayuda; `aria-haspopup="dialog"`/`aria-controls` anuncian la apertura del diálogo existente. Sin desplazamiento al interactuar; transición de color desactivada con movimiento reducido. Recuperar envío también tiene ancho completo y separación propia. Se conserva el mismo ID, listener y estado hidden.

## Android y evolución anterior

La inspección de renders nativos corrigió la acción Consumo que partía una palabra en pantallas pequeñas, eliminó códigos internos de estado como PURCHASE del encabezado y añadió indicador lavanda de navegación activa. Los teclados de cantidades/cajas son enteros; importes permiten decimales. La prueba de captura comprueba texto y el número de líneas de esa acción.

[Contexto](AI_CONTEXT.md) · [Pantallas](diagrams/06-ui.md)

DailyActivity nativa con Views/Material: Hoy, Inventario, Historial. Hoy tiene hero de ingresos y acciones Compra/Venta/Consumo, resumen y cierre. Formularios preservan borrador/UUID, muestran total por caja y permiten pago dividido. Inventario diferencia físico/reservado/disponible/proyección pendiente. Historial muestra conflictos y confirmados/cierres. La sesión inicial usa cuenta del Dashboard y no registra capital.

Paleta del perfil dracha.store: #100d17 fondo, #1d1728 tarjeta, #30213f hero, #c5a3ee lavanda, #d986b4 rosa. Texto claro/contraste, superficies redondeadas, touch targets 48dp+, ScrollView con insets de barras/teclado, vista oscura sin motor de animación adicional. Android usa tipografía nativa; la web conserva Nunito local. Ejemplo raster previo [concepto](../previews/donas-control-2-concept.png), cifras ilustrativas, no datos del negocio.

Web conserva perfil/pedidos claros, puntos disponibles principales y acumulados secundarios, tutorial por IDs/data-tour, confirmación de pedido después de servidor y WhatsApp, reducción de movimiento. daily-business.js agrega un panel staff aislado; no cambia DOM del tutorial. Los drafts de conteo web 1.5.1 y cancelación en camino se conservan.

La imagen generada es una propuesta, no captura del APK. Los resultados de render/pruebas reales se registran en VALIDATION. No se requiere descargar imágenes pesadas para operar.

2.1 abre Pedidos; conserva Hoy/Stock/Historial y paleta oscura/lavanda. Lista activa/recientes, detalle, acciones y diagnóstico real de avisos. Notification tap abre UUID propietario; reduced motion web/tutorial no se alteran. Renders nativos de Pedidos/detalle son fixtures ilustrativos, no pedidos/recepción física de producción.

2.1.1 elimina el texto de comprobación persistente en orderFeedback. La tarjeta Avisos muestra el diagnóstico y un mensaje específico del WorkInfo manual; botón deshabilitado mientras espera/ejecuta y recuperado al finalizar. Se distingue pendiente de Android, falta de red, reintento y cancelación. Resultado de comprobación no equivale a recepción del aviso en pantalla. No añade animación, polling ni un servicio permanente.
