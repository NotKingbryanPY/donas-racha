# Pedidos web: auditoría y propuesta para revisión

Fecha: 17 de octubre de 2026. Base inspeccionada: main/8819943.
Estado: **DISEÑO APROBADO E IMPLEMENTADO EN CÓDIGO EL18OCTUBRE**. Auditoría histórica de8819943; el [informe vigente](DRACHAS_WEB_2026-10-18.md) registra implementación, validación y publicación.

Aclaración posterior: el usuario aprobó el diseño de Pedidos, eligió la identidad C de **Drachas** y autorizó aplicar el conjunto. [Plan y logos](DRACHAS_REBRANDING_PROPUESTA.md). Este documento conserva el diagnóstico/propuesta originales; las afirmaciones sobre pruebas y despliegue actuales están en el informe18octubre.

## 1. Alcance solicitado

Mejorar confirmación después de comprar, protagonismo de pedidos activos y avisos de cambios de estado mientras el cliente utiliza la web. Se conserva la marca actual, el perfil, el tutorial, la autenticación y las transacciones existentes. El futuro rebranding a Drachas requiere la idea del usuario y una etapa aparte.

Esta entrega contiene diagnóstico, decisiones propuestas, plan y ejemplo interactivo con datos ficticios. No registra pedidos, cambia stock, ejecuta SQL, modifica el APK ni activa permisos o notificaciones reales.

## 2. Evidencia y límites

Se revisaron AGENTS, AI_CONTEXT, UI_ANIMATIONS, auditoría Android y arquitectura de pedidos 2.1; index.html, order-confirmation.js, shared-inventory-refresh.js, catalog-realtime.js, motion.js, client-tour.js, redesign.css y los handlers de creación, listado y detalle del cliente. Git conserva las implementaciones anteriores; se analiza el runtime vigente, sin restaurar flujos retirados.

Brave abrió www.dracha.store y mostró la portada y el acceso de cliente. No había una sesión de cliente para recorrer pedidos reales. Los estados autenticados se verificaron en código y en pruebas de navegador locales con respuestas simuladas. No se reprodujo una compra en producción ni un cambio administrativo real; no se afirma que todo error visual reportado haya sido reproducido físicamente.

### Hallazgos comprobados

| ID | Prioridad | Hallazgo y causa | Evidencia | Cambio propuesto |
|---|---|---|---|---|
| W01 | Alta | Los pedidos del cliente no se actualizan automáticamente. Entrar en Pedidos, Actualizar o Consultar mis pedidos llama al listado; el temporizador automático solo consulta stock/catálogo. | index.html:1167–1194; assets/js/shared-inventory-refresh.js:36–38; catalog-realtime.js suscribe únicamente product_variants | Controlador de seguimiento propio, activo durante la sesión de cliente; recuperar estado al volver a la pestaña o reconectar. |
| W02 | Alta | No existe comparación de cambios ni aviso al pasar a En camino o Cancelado. El texto de actualización automática corresponde al inventario. | render de clientOrdersList en index.html:1190–1192; scripts de actualización | Aviso persistente del estado, anuncio accesible y aviso breve deduplicado cuando se recibe un cambio real. |
| W03 | Alta | El formulario para un nuevo pedido ocupa la primera tarjeta. Los pedidos existentes están debajo, como filas pequeñas sin distinción activo/terminal. La pestaña tampoco indica actividad. | index.html:246–248,326–338 | Primero tarjeta de pedido activo; cantidad en Pedidos y acceso breve desde Perfil. Formulario nuevo después. |
| W04 | Media | La lista no ofrece abrir el detalle, aunque la API ya tiene artículos, pago y eventos. Solo muestra código, estado, importe y fecha. | index.html:1191; api/orders/[publicCode].js | Detalle expansible o pantalla vinculada al código, sin duplicar endpoints ni operaciones comerciales. |
| W05 | Alta | La dona de confirmación pierde su agujero: border-box global, ancho/alto40px y borde heredado20px dejan espacio interior0px. No coincide con el símbolo oficial. | index.html:45; redesign.css:147,526 | Animar el recurso de marca existente, con proporciones estables; transición corta hacia check. |
| W06 | Media | El recibo reutiliza siempre “¡Pedido realizado!” y “El pago se confirma al recibir”, incluso al recuperar pedidos cancelados o ya pagados. El botón recuperado captura un snapshot y no consulta al pulsarlo. | order-confirmation.js:10–17,28–35 | Separar confirmación de creación de seguimiento actual. Texto/pago según datos reales y refresco del pedido al abrir. |
| W07 | Alta | customerRequest no conserva response.status en el error. La condición error.status===400 de submitClientOrder no puede reconocer un rechazo400. OUT_OF_STOCK sí se reconoce por código; otros rechazos pueden dejar el intento pendiente y bloqueado. | index.html:780–790,1259 | Error tipado con status/code. Limpiar solo rechazos que el contrato asegure anteriores al commit; conservar el mismo intento ante timeout, error ambiguo o fallo posterior a un commit. |
| W08 | Media | El listado devuelve los20 pedidos más nuevos, sin consulta separada de activos. Un pedido antiguo todavía activo puede quedar desplazado por20 pedidos posteriores. Es un riesgo deducido de la consulta, no un caso privado observado. | api/_lib/customer_handlers/orders.js:query order/limit | Obtener activos explícitamente y paginar historial, con límites y propiedad del cliente. |
| W09 | Media | La consulta autenticada de listado y la restauración no tienen un plazo propio. Varias cargas pueden competir y sobrescribir resultados más nuevos; no hay cancelación/generación en loadClientDelivery. | index.html:1170–1194,780; order-confirmation.js:30 | Plazos acotados para lecturas, una consulta en vuelo, AbortController/generación por sesión y control de versiones. |
| W10 | Media | La creación exitosa limpia cantidades y abre el recibo, pero no invalida/refresca inmediatamente la lista de pedidos ni sus reservas. Cerrar con X deja el listado anterior hasta otra carga. | index.html:1254–1263; cierre343–349 | Invalidar y recuperar listado/stock después de confirmación real, conservando el recibo aunque falle el refresco secundario. |
| W11 | Media | La recuperación del último intento depende de sessionStorage por cliente; recargar la misma pestaña está cubierto. No equivale a conservar el intento al cerrar definitivamente esa sesión/pestaña. | order-confirmation.js:3–5 | Documentar el alcance; primero recuperar pedidos del servidor. Si se amplía la persistencia del intento, minimizar datos personales, caducar y aislar por cliente. |
| W12 | Baja | Hay varias capas de tamaños/estilos para navegación y componentes de pedidos, y estilos de una pantalla de pedido no usada por este flujo. No prueban por sí mismos un bug, pero complican la consistencia. | redesign.css:172,297–300,367–369,517–538 | Reglas encapsuladas del nuevo componente; eliminar estilos solo después de comprobar referencias y regresiones. |

Reproducción aislada W07: se ejecutó customerRequest en VM con fetch simulado devolviendo400/VALIDATION_ERROR. El error conserva code/message y status es undefined. No se alteró el código ni se envió una solicitud comercial.

### Lo que ya funciona y debe conservarse

- Éxito después de respuesta verificable de la API, sin mostrar confirmación ante fallo.
- Clave idempotente estable y payload exacto al recuperar; bloqueo de doble envío.
- Creación y reservas centrales en Supabase; fallo del push no deshace el pedido.
- Lectura de pedidos exige sesión de cliente y filtra customer_id en servidor.
- WhatsApp del negocio correcto, con código y encodeURIComponent.
- Movimiento reducido/saveData y restauración sin repetir automáticamente el diálogo tras recargar.
- Tutorial con versión1, progreso local/servidor, Retomar tutorial y selectores data-tour estables.

No se atribuye W01 a la ausencia de publicaciones SQL: el cliente ni siquiera intenta recibir o consultar cambios de pedidos automáticamente. El Realtime actual es de catálogo público; conectarlo a pedidos privados requeriría autorización independiente.

## 3. Propuesta de experiencia

### Dirección recomendada: Seguimiento primero

1. Perfil / Pedidos conservan su posición; Pedidos añade el número de activos. Perfil muestra una franja discreta con acceso al pedido.
2. Pedidos comienza con “Tienes un pedido activo”, estado grande, código, total, artículos, pago y punto de entrega. Varios pedidos activos se muestran individualmente; no se reduce todo al más reciente.
3. Progreso con los estados reales: Recibido(PENDING), Aceptado, En camino y Entregado. Cancelado se presenta como cierre alternativo, sin simular avance exitoso. No se inventa Preparando, ETA, GPS ni estado de pago.
4. Un banner informa “Tu pedido va en camino” o “Tu pedido fue cancelado”. Persiste el estado en la tarjeta; el aviso breve complementa, no sustituye, ese contenido.
5. Detalle accesible sin depender de hover. Historial separado y formulario nuevo debajo, disponible sin impedir hacer otro pedido intencionadamente.

### Confirmación después de crear

- Verificando: botón bloqueado y mensaje claro; ningún check todavía.
- Confirmado por servidor: animación una vez, de aproximadamente0.9–1.1s, dona de marca rodando y transición a check. El recibo y sus acciones se pueden leer inmediatamente; no esperar una animación para acceder a ellos.
- Recibo: número, cantidades/sabores, total, método y estado del pago, lugar de entrega; Ver mi pedido y Contactar por WhatsApp. El énfasis de las dos acciones se decide visualmente con el usuario.
- Al recuperar/reabrir: estado actual sin volver a celebrar una creación. Un pedido cancelado o entregado recibe su encabezado correspondiente.
- Timeout incierto: “Estamos comprobando este envío”, misma clave y recuperación segura. Rechazo definitivo: error accionable, sin éxito. Desconexión: último estado identificado como anterior.

Se conservan Nunito, fondo oscuro, superficies ciruela, lavanda/rosa y recursos oficiales actuales. Imágenes ligeras ya existentes y animaciones de transform/opacity; no vídeo, confeti continuo ni un segundo logo. No se ejecuta el rebranding todavía.

Se entrega una propuesta interactiva con dos composiciones: Seguimiento primero y Confirmación enfocada. Son vistas complementarias: recomendación de usar el primer diseño para Pedidos y el segundo para el recibo. Incluye Recibido/Aceptado/En camino/Cancelado/Entregado/Sin conexión y animación de muestra. Todas sus cifras, fechas y códigos son ficticios; los botones no registran operaciones ni envían mensajes.

## 4. Cómo funcionarían los avisos web

### Primera entrega recomendada: actualización automática autenticada

La sesión pública del cliente es un token propio dr1 firmado por el servidor, no una sesión Supabase Auth. No se debe pasar ese token al canal público de catálogo, abrir RLS de orders, ni incluir service_role para conseguir Realtime.

Propuesta concreta sin infraestructura nueva: un controlador de lectura de pedidos bajo customerRequest, separado del refresco de inventario. Durante una sesión visible con pedidos activos, consultar aproximadamente cada15s; una petición en vuelo como máximo. Con todos los pedidos terminales, detener el ciclo; al entrar al perfil, crear un pedido, volver a la pestaña, recuperar red o pulsar Actualizar, consultar inmediatamente. Ante fallos, conservar snapshot, indicar que no está actualizado y aplicar backoff con jitter. Abortar al cerrar sesión/cambiar propietario. Coordinar pestañas cuando sea compatible para evitar consultas y avisos repetidos.

Es una actualización periódica mientras se usa la página, **no entrega instantánea ni push con la web cerrada**. Cuatro consultas/minuto por cliente activo caben dentro del límite actual60/minuto; respetar también recuperación manual y varias pestañas. Las lecturas deben ser ligeras; no volver a cargar todo el catálogo/formulario en cada comprobación.

Extender el listado con identificador estable y updated_at ya existentes, separar activos/historial y usar versionado para descartar respuestas antiguas. Baseline inicial silencioso. Comparar contra estado confirmado anterior; avisar solo cambios reales. Si durante una desconexión hubo varios cambios, anunciar el último verificado, sin reproducir una cadena engañosa de estados antiguos. Identidad de aviso por cliente/pedido/versión/estado; no repetir al renderizar ni recargar. Estado desconocido se muestra como no reconocido, no como Recibido exitoso.

Los avisos dentro de la página no requieren permiso del navegador: banner, texto accesible aria-live y contador. Sonido suave solo como preferencia voluntaria tras interacción, sin prometer que el navegador lo permitirá en segundo plano. No mover el foco automáticamente ni tapar formularios/tutorial con diálogos de estado.

### Mejora posterior opcional: canal privado de eventos

Si se requiere menor latencia y menos consultas, diseñar un canal privado por cliente con Broadcast y autorización RLS usando un JWT corto y restringido emitido por un puente de sesión auditado. El token propio actual no sirve directamente como JWT Supabase. El evento solo invalida caché y la API autenticada recupera el pedido. Requiere diseñar firma/expiración/revocación/pruebas entre dos clientes y migración explícita; no activar una suscripción a orders con anon. Mantener comprobación de recuperación al reconectar y respaldo espaciado. No se presenta como implementación existente ni se mezcla con el FCM Android.

Notificaciones del sistema o con navegador cerrado constituyen otra capacidad (permiso voluntario, service worker y Web Push, compatibilidad por navegador/plataforma). No basta con new Notification en móviles. Queda fuera del núcleo inicial solicitado de avisos dentro de la página; se puede presupuestar tras aprobar la experiencia. Denegar el permiso jamás debe impedir seguir un pedido.

Referencias técnicas consultadas17octubre: [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API), [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization).

## 5. Plan de implementación, después de aprobar

| Etapa | Trabajo | Condición de salida |
|---|---|---|
| A. Acuerdo visual | Revisar propuesta, tamaño de tarjeta, énfasis de acciones, recibo y transiciones. | Diseño aprobado por el usuario. |
| B. Estado y errores | Módulo de pedidos del cliente, error HTTP tipado, timeout seguro, invalidación al crear, estados de pago correctos, lectura activos/historial. | Error antes/después del commit distinguido; mismo intento recuperable; ninguna compra ficticia. |
| C. Seguimiento | Tarjetas de activos, detalle, badge en Pedidos y acceso desde Perfil; URL de pedido autenticada que sobreviva a recarga. | Varios activos visibles; permisos entre clientes y navegación verificados. |
| D. Avisos | Ciclo15s solo con actividad visible, online/visibility, backoff, cancelación, deduplicación y aria-live. | En camino/cancelación actualizan tarjeta y avisan una vez; offline no simula datos nuevos. |
| E. Confirmación | Recurso de marca, transición corta, recibo completo, WhatsApp y variantes de recuperar/entregado/cancelado. | Una celebración por nueva confirmación; render/reload/replay no la repiten. |
| F. Regresión y publicación | Tutorial, accesibilidad y responsive; pruebas API/UI, conocimiento actualizado, preview Vercel y revisión. | Preview verificable; despliegue después de validar alcance y resultado. |

Esta propuesta inicial no necesita inventar tablas, modificar pagos/puntos ni cambiar stock. Antes de cualquier SQL futuro se revisará activación/esquema real. Cada cambio funcional debe registrar arquitectura, flujo, pruebas y límites en docs/knowledge, con report/generate/check/review/check --fresh.

## 6. Matriz de aceptación prevista

- Confirmación exitosa, error de validación antes del commit, falta de stock, servidor confirma pero se pierde la respuesta, recuperación y doble clic.
- Un activo y varios activos; activos antiguos no ocultos por historial; detalle y enlace directo con sesión válida.
- PENDING→ACCEPTED→OUT_FOR_DELIVERY→COMPLETED y cancelación desde estados abiertos. Comparación por versión, sin eventos ficticios ni motivos administrativos expuestos como texto público sin contrato.
- Aviso una vez por cambio, baseline silencioso, varias pestañas, respuestas fuera de orden, cambio de usuario, token vencido y401.
- Red perdida/recuperada, pestaña oculta/visible; detener consultas sin activos. No etiquetar conectado por navigator.onLine si falla la API.
- Pago pendiente/confirmado/fallido y pedido cancelado con datos coherentes. Un recibo de creación no equivale a pago confirmado.
- 320/360/390/768/1440px; zoom200%, teclado/foco/Escape, lector de pantalla, contraste, textos largos y movimiento reducido.
- Tutorial actual: data-tour orders-tab/orders/profile-nav, progreso, retomar y pantallas pequeñas; ningún reinicio de versión solo por CSS.
- WhatsApp abre número correcto con código codificado, sin envío automático de mensajes.
- Cliente A no lee pedido de B; ninguna información privada en canales públicos, logs, miniaturas ni almacenamiento persistente innecesario.

## 7. Verificación realizada en esta entrega

- PASS tests/integration-order-web.cjs: navegador360/768/1440, disponible/histórico de puntos, respuesta fallida sin éxito, recuperación con payload exacto, doble envío suprimido, WhatsApp, reduced motion y recarga.
- PASS tests/customer-navigation.cjs: URLs privadas, recarga, historial y salida, con API simulada.
- PASS tests/customer-tour-motion.cjs: tutorial espera introducción/perfil y encaja en móvil/escritorio.
- PASS tests/customer-order-auth.cjs: rechazo de rutas sin sesión de cliente.
- W07 reproducido aisladamente con400 simulado. W05 se deriva de valores CSS inspeccionados; no se afirma una reproducción física del movimiento de cada dispositivo.
- Propuesta aislada sin llamadas API: sintaxis JavaScript válida, recursos actuales incrustados, seis estados, recibo, acceso desde Perfil, cambio de composición y botón de animación revisados en Brave. Comprobados320/390/736px y escritorio; sin desborde horizontal en las mediciones320/736 y sin errores capturados de consola. Badges se ocultan en estados terminales; offline identifica el último estado. No es una prueba de datos reales de Supabase ni del sistema de notificaciones final.

Pendientes deliberados: aprobación visual, implementación, pruebas de transición real autenticada en entorno autorizado y despliegue. El fallo histórico de recepción FCM en segundo plano de Android conserva su estado abierto y no se considera resuelto por esta propuesta web.
