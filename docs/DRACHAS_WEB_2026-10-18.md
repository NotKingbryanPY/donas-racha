# Drachas: identidad C y seguimiento de pedidos

18 de octubre de 2026. Implementado en código; publicación y verificación final se registran al final de este informe.

## Alcance autorizado y resultado

El usuario eligió la propuesta C, Dona tipográfica, y autorizó aplicarla junto con las mejoras de Pedidos aprobadas. Drachas sustituye la marca visible Donas Racha en la web. La dona y su glaseado se unen a la r; achas completa el nombre. Colores actuales y Nunito del producto conservados.

La web mantiene dominio, backend y registros existentes. No se renombra el paquete Android, firma, Room, proyecto Firebase, tablas/RPC, SKU, códigos DR- o claves de sesión. No hay migración SQL, nueva función serverless, inventario paralelo ni cambio de secretos. Los avisos descritos aquí son para el cliente dentro de la web; el diagnóstico FCM Android sigue separado.

## Recursos de identidad

Maestro trazado: assets/images/drachas-logo.svg, adaptación vectorial de la propuesta C aprobada, sin fuentes externas ni imagen raster incrustada. Variantes derivadas: logo oscuro/monocromo, símbolo Dr, letras de acompañamiento para introducción, favicon SVG/PNG32, icono180, PNG transparente1020 y tarjeta social1200×630.

scripts/build-brand-assets.cjs deriva las variantes y rasteriza mediante @resvg/resvg-js2.6.2 de desarrollo. No añade una dependencia del sitio. Ejemplo con runtime local que ya contiene ese paquete:

```powershell
$env:RESVG_MODULE='C:\tmp\donas-test-runtime\node_modules\@resvg\resvg-js'
node scripts/build-brand-assets.cjs
```

Maestro SVG como única fuente de las variantes. Revisión visual realizada contra la propuesta C. Logo PNG17,370bytes y social19,810bytes en el primer render; las imágenes de propuesta de1MB permanecen en documentación, fuera del flujo de carga del sitio.

Se actualizan portada, acceso, encabezados, perfil, ranking, recuperación, tutorial, recibo y mensajes nuevos para compartir/WhatsApp. Se añaden metadatos sociales y favicon nuevo para evitar conservar el antiguo por la misma URL. Las descripciones históricas comerciales no se reescriben.

## Seguimiento y contrato de lectura

assets/js/customer-orders.js conserva caché en memoria por propietario/token, una lectura en vuelo y una generación de sesión. Consulta GET/api/customer/orders cada15s solo con pedidos activos y página visible/conectada. Se detiene sin activos, al ocultar, salir o perder red. Fallos conservan snapshot con advertencia y reintentan con backoff30–120s+jitter. Volver a la pestaña o reconectar recupera inmediatamente. La consulta no reconstruye catálogo ni formulario.

La API existente separa activos(PENDING/ACCEPTED/OUT_FOR_DELIVERY) y anteriores(COMPLETED/CANCELLED), siempre filtrados por customer_id derivado de la sesión dr1. Activos:50por página; anteriores:10. Parámetros activeOffset/historyOffset validados, lectura ligera view=active, indicadores hasMore y cache-control:no-store. No limita el seguimiento a los20 últimos pedidos mezclados. Dos lecturas REST pueden cruzar una transición; el cliente reconcilia por updated_at con precisión de microsegundos y da prioridad al snapshot más reciente. No altera transacciones de creación/pago/stock.

Tarjetas activas grandes antes del formulario, progreso de estados reales, total, pago, entrega y botón de detalle. Badge y acceso desde Perfil. Paginación explícita; sin ETA, ubicación GPS o estados inventados. La API de detalle usa el código público y vuelve a filtrar propietario. Ya no selecciona actor_type ni note de order_events: las notas internas no se muestran como motivo público.

Cuando un activo desaparece y no está en el histórico consultado, se verifica el detalle antes de anunciar un estado final. No se deduce que desaparecido significa entregado. Las versiones antiguas no revierten un estado terminal.

## Avisos y recuperación

Primer snapshot silencioso. En cambios de estado, banner persistente y toast accesible del pedido; el estado sigue legible en la tarjeta. Metadatos mínimos de dedupe por cliente/código/estado/versión en localStorage,100códigos; memoria acotada. Web Locks cuando está disponible y storage events coordinan avisos entre pestañas; si no hay soporte/almacenamiento, funciona con dedupe de la sesión. No se comparten tokens ni direcciones por canales públicos y no se pide permiso de notificaciones del sistema.

Son avisos mientras se usa la web, sin prometer entrega instantánea ni notificación con el navegador cerrado. No se añade Web Push, Firebase web, sonido automático o servicio permanente. Cada pestaña visible puede efectuar su lectura; la coordinación entre pestañas evita avisos repetidos y no se presenta como un único lector global.

customerRequest conserva status/code del error, aplica timeout con AbortController y descarta respuestas de otra identidad. Los errores SQL INVALID_PRODUCT_VARIANT/INVALID_ITEMS reales reciben códigos estables. Solo rechazos conocidos liberan el intento; timeout,503 u otros resultados inciertos conservan el UUID/payload exactos. Botones bloquean doble envío.

Cerrar sesión cancela lecturas, borra caché/DOM privado y limpia campos/cart del propietario anterior. Un rechazo 401/403 también oculta tarjetas y avisos; una nueva consulta verificada puede recuperarlos aunque el contenido sea idéntico al anterior. El intento pendiente confirmado/incierto se conserva en su namespace sessionStorage para que su dueño pueda recuperarlo; no se envía con otra cuenta. No se limpia la base ni las colas Android.

## Confirmación, enlaces y tutorial

Recibo después de respuesta de creación verificable. La animación usa el símbolo SVG, transform/opacity por1s y un check; respeta reduced motion y motion-lite. No depende del borde que eliminaba el agujero de la dona. Se registra la celebración por código; replay/render/recarga no celebran otra creación.

El detalle se consulta después con la API propietaria. Fallar esa lectura no inventa el resultado ni convierte en fallida una creación ya confirmada. Se muestran artículos, importe, pago, punto de entrega y estados/fechas disponibles. Encabezado contextual para Cancelado/Entregado y petición sin verificar; nunca un check de creación antes de confirmar.

Enlace privado ?profile=1&view=delivery&order=DR-… recuperable tras recargar/autenticar. Abrir/cerrar/volver mantiene navegación e historial. Diálogo nativo conserva teclado/Escape/foco. Los cambios idénticos no reconstruyen el detalle ni cierran su historial expandido.

WhatsApp usa50760887856 y mensaje Drachas con código codificado mediante encodeURIComponent. Pulsar abre WhatsApp; no envía mensajes automáticamente.

Tutorial conserva versión1, progreso, IDs/data-tour y Retomar tutorial. Se actualiza marca y descripción de Pedidos. stop solo restaura foco si había un tutorial activo; una carga tardía de onboarding completado no roba foco de la navegación. Carrito móvil usa dos columnas y controles en otra fila para no partir Chocolate letra a letra.

## Verificación y límites

Pasaron 17 suites de contratos/API y ocho de navegador con proveedores simulados. La suite nueva de API verifica activos antiguos, paginación, lectura ligera, timestamps, aislamiento entre propietarios, campos privados y códigos de rechazo SQL. La suite nueva de navegador recorre 320/390/768 px, actualización automática real por temporizador, avisos sin duplicados, desconexión/reconexión conservando carrito, cancelación, recarga/enlace/volver, pago, error 400 recuperable, WhatsApp y respuesta tardía tras salir. La parada de consulta con todos los pedidos finalizados se comprueba más allá de 15 s en 390 px.

Regresiones: integración de pedido360/768/1440, navegación, tutorial320/390/1280, interacción/foco/motion, catálogo SDK real con proveedor simulado, inventario Dashboard y panel diario. Se corrige un fixture de motion que omitía available=true y por tanto intentaba enfocar un botón deshabilitado. La prueba de foco añade un caso determinista de onboarding ya completado.

Capturas en test-output/drachas son fixtures ilustrativos, no pedidos reales. Las pruebas locales/CI no equivalen a la recepción física de un cliente ni de FCM Android. No se usaron credenciales de cliente ni pedidos artificiales en producción. La comprobación pública del despliegue verificará nombre, recursos, endpoints públicos y rechazo anónimo de privados.

Estado de la última ejecución, CI, PR y Production: pendiente de registrar después de completar los controles de esta entrega. No afirmar publicación o recorrido privado real a partir del build.
