# Drachas — propuesta de identidad y plan de aplicación

Estado: **C elegida por el usuario e implementada en código el18octubre**. [Informe vigente](DRACHAS_WEB_2026-10-18.md) para validación y publicación; se conserva la exploración original como referencia.
Fecha: 17 de octubre de 2026.

## Encargo y decisiones de partida

El usuario aprobó la propuesta de confirmación, seguimiento y avisos dentro de la web y después eligió la opción C, Dona tipográfica, autorizando su aplicación junto con Pedidos. El nombre visible es **Drachas**. Las alternativas A/B se conservan como historia del diseño.

Nombre visible: Drachas, D-r-a-c-h-a-s. La opción C aprobada integra dona y glaseado en una unión D/r; achas completa el nombre. Se adaptó a un recurso trazado, sin fuentes externas en el SVG, manteniendo la idea aprobada y los colores actuales.

Conservar la familia cromática actual: fondo berenjena #100D17, superficies #1D1728, lavanda #C5A3EE, rosa #D986B4 y texto #FAF6FF. Las imágenes generadas son aproximaciones visuales; la versión vectorial fijará los valores exactos.

Objetivo: símbolo profesional, simple, reconocible en tamaños pequeños, con glaseado controlado y tipografía legible. Las propuestas son imágenes raster de1536×1024; todavía no son maestros SVG ni archivos de impresión.

## Propuestas generadas

| Opción | Archivo | Idea | Revisión necesaria |
|---|---|---|---|
| A · R glaseada | [PNG](previews/drachas/concepto-a-r-glaseada.png) | Dona con agujero reconocible; caída de glaseado y pierna diagonal forman R. Símbolo independiente junto a Drachas. | Recomendación inicial por cercanía al encargo. Ajustar espesor, simplificar brillo/detalles y comprobar icono16/24/32px. |
| B · Monograma DR | [PNG](previews/drachas/concepto-b-monograma-dr.png) | Símbolo compacto con curva y contraforma, acompañado del nombre completo. | Más abstracto. Revisar expresamente que la diagonal no haga leer Q en vez de DR antes de elegirlo como monograma. |
| C · Dona tipográfica | [PNG](previews/drachas/concepto-c-dona-tipografica.png) | Dona inicial y glaseado se unen a la r; achas completa el nombre. | Revisar lectura de D frente a O y legibilidad del conjunto a tamaño pequeño. |

Generación de propuestas: herramienta integrada image_gen, una llamada por dirección, fondo opaco para comparar oscuro/monocromo. [Prompts](previews/drachas/prompts.json). Las láminas no se cargan como logos del runtime: se usa el SVG y sus variantes derivadas de la C elegida.

Estas son alternativas para discutir. La versión elegida se refina por geometría y legibilidad; no se instala directamente una lámina con título/fondo como logo del sitio.

## Plan de implementación después de elegir

### 1. Cerrar la identidad

- Elegir A/B/C o combinación; definir símbolo separado o integrado.
- Refinar agujero, glaseado, proporciones, espaciado y letras. Tipografía coherente con Nunito de la interfaz o dibujo del logotipo con licencia comprobada si se usa una fuente nueva.
- Comprobar nombre completo, silueta reconocible, contraste y versiones de una tinta. El glaseado no debe borrar el agujero ni confundir D/R con O/Q.
- Ensayar icono16/24/32/48px, encabezado móvil, fondo claro/oscuro y reproducción simple. No se afirma todavía que estas pruebas estén aprobadas.

Salida: identidad elegida y versión refinada aprobada visualmente.

### 2. Preparar un paquete reutilizable

- SVG real y editable del símbolo/logotipo; texto final convertido a trazados cuando corresponda.
- PNG con transparencia, versiones horizontal/compacta/monocroma e iconos para favicon y vistas compartidas.
- Guía breve: colores exactos, área de protección, tamaño mínimo y usos que eviten deformación o bajo contraste.
- Recursos nuevos con nombres propios/versionados; conservar los anteriores hasta verificar todas las referencias. No empaquetar las láminas de propuesta como recursos de producción.

Salida: carpeta de identidad lista para web y adaptaciones de app, sin depender de un PNG grande para cada uso.

### 3. Aplicar a la web junto con Pedidos

Inventario observado: index.html, customer.html, assets/js/order-confirmation.js, assets/js/client-tour.js y assets/js/daily-business.js contienen textos de marca. El logotipo, símbolo, tipografía, colores e introducción están en assets. Android conserva nombre visible en strings.xml. Los textos de una ruta móvil retirada son historia, no motivo para reactivar esa ruta.

- Actualizar logo y nombre en portada, acceso, perfil, pedidos, Dashboard, tutorial, favicon, título, descripción y mensajes nuevos para WhatsApp. Revisar textos de accesibilidad y recursos de compartir que realmente existan.
- Integrar la propuesta de Pedidos aprobada: activos primero, detalle, avisos internos, error HTTP tipado, recuperación idempotente, recibo contextual y movimiento reducido.
- Adaptar la animación al símbolo elegido: dona/glaseado forma letra, transición a check después de confirmación real del servidor. No celebrar al renderizar, recargar o recuperar un pedido anterior.
- Mantener IDs/data-tour y progreso del tutorial; ajustar únicamente textos/pasos afectados. No reiniciarlo por un cambio de logo.
- Aplicar marca a los mensajes visibles futuros, preservando las descripciones históricas de pedidos y movimientos.

Salida: preview verificable del conjunto, con comparación móvil/escritorio y estados de pedido. Ningún cambio de inventario, pagos o puntos para facilitar la presentación.

### 4. Validar y publicar

- Pruebas de navegación, privacidad entre clientes, crear/recuperar sin duplicar, cambio de estados, cancelación, desconexión, WhatsApp, tutorial, teclado y movimiento reducido.
- Comprobar todos los SVG/iconos, recortes, cachés y enlaces; revisar320/360/390/768/1440px y zoom200%.
- Buscar referencias visibles obsoletas sin reemplazar globalmente nombres técnicos o registros históricos.
- Actualizar docs/knowledge y ejecutar report/generate/check/review/check --fresh; publicar después de verificar la preview.

La primera publicación sería web. La adaptación del nombre/icono visible de Android puede seguir con el mismo paquete y firma; no reconstruir la autorización ni cambiar Firebase para un cambio visual. La recepción FCM histórica continúa pendiente de prueba física independiente.

## Fronteras que preservan el funcionamiento

Un rebranding visual no requiere cambiar el dominio dracha.store, comprar otro, mover Vercel/Supabase/Firebase ni renombrar repositorios o secretos. No se modifica DNS en esta propuesta.

Preservar UUID, SKU, códigos DR-, claves de almacenamiento y sesiones, tablas/RPC, roles, endpoints, reservas, pagos, puntos y snapshot histórico. Mantener paquete Android com.bryan.donas.control, firma, Room y datos instalados para conservar compatibilidad de actualización. Cualquier renombre técnico posterior se evalúa como migración separada, no como sustitución global de palabras.

Supabase continúa como autoridad comercial. La nueva marca no activa Firebase Auth/Firestore paralelos ni restaura provisión/cron retirados. No se ejecutó SQL ni se desplegó código por generar estas propuestas.

## Evidencia de esta entrega

- Tres propuestas originales generadas e inspeccionadas: nombre Drachas completo en las tres; direcciones diferentes y familia cromática actual.
- Copias PNG de1536×1024 verificadas por metadatos. Prompts guardados para reproducir o refinar.
- Limitaciones visuales B/C documentadas; SVG, transparencia final, tamaños pequeños y licencia tipográfica por cerrar tras elección.
- Esta entrega no cambia el comportamiento de la web ni certifica el futuro flujo de pedidos. Las pruebas de la auditoría anterior siguen siendo la evidencia disponible del runtime actual.

Relacionado: [auditoría y propuesta de Pedidos](PEDIDOS_WEB_PROPUESTA_2026-10-17.md).
