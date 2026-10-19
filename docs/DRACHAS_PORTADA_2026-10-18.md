# Portada Drachas: recompensas y pedidos

18 de octubre de 2026. Referencia del usuario aplicada conservando logo, dominio, rutas, tecnología y datos existentes.

## Diseño

Dos columnas desde 900 px: titular «Cada antojo / suma.» y tarjeta de recompensas. En móvil se ordenan titular, descripción, acceso a recompensas, tarjeta y pedidos. Fondo #100E17, superficie #17121F, texto #F8F5FC/#C6BDCF, acento #BE8AEE, botones #7928C4/#8B3BD4, borde de recompensa #AC73D3 y divisores #332A3E. Nunito local permanece. landing.css limita los estilos a la portada para conservar Perfil, Dashboard y sus controles.

Se retiran del DOM público la dona flotante, órbitas, etiquetas flotantes y torre de donas. Los archivos usados por otras pantallas se preservan. La portada ya no participa en el movimiento por puntero ni en revelados de tarjetas; motion.js conserva las interacciones privadas. Sin efectos de humo, neón o sombras nuevas.

## Rutas y datos

Sabores conserva #sabores; Ranking llama a showPublicRanking. Mi perfil usa `?profile=1` y Ver mis recompensas usa `?profile=1&view=shop`. El arranque existente restaura una sesión o pide entrar conservando la vista solicitada. Hacer pedido mantiene beginCustomerOrder y la entrega existente.

Precio, disponibilidad y moneda continúan en renderPublicCatalog y `/api/products`. No se fija B/.1.00 si cambia el catálogo. Agotado, precios diferentes y fallo de lectura conservan su manejo actual. Entrega en Edificio 4 y efectivo/Yappy son los textos y reglas existentes; no había una lectura de configuración remota para esos textos.

## Recompensas reales

El programa canjea con puntos; no existe una recompensa por seis compras. nextRewardState extrae la selección que antes hacía renderProfilePreview: premio activo de menor costo y saldo disponible después de canjes. Perfil y portada comparten esa función; puntos históricos, ranking, compras y saldos no cambian.

Seis círculos representan tramos visuales del objetivo en puntos: floor(min(1, disponibles/costo) × 6). Texto y progressbar accesible usan puntos reales, nunca «5 de 6 compras». Sin identidad verificada se muestran contornos vacíos y «Tu progreso, en tu perfil», sin saldo numérico ni atributos de progreso inventados. Los sellos son decorativos para el lector de pantalla; el estado anuncia puntos y premio.

landing.js recibe el perfil verificado desde el render existente. Al abrir la portada con sesión guardada puede realizar una sola lectura autenticada de `/api/backend?action=getCliente&id=…`, que ya comprueba identidad y propietario. El componente valida de nuevo ID, token vigente, saldo y catálogo. AbortController, generación e identidad descartan respuestas tardías y cambios de cuenta. Espera máxima15s, sin polling, endpoint nuevo, perfiles en localStorage o segunda base.

La copia en memoria es el último perfil verificado; no es una suscripción en tiempo real. Error, ausencia de sesión o datos incompletos muestran acceso al perfil. Salir o cambiar de cuenta limpia el progreso. El servidor continúa autorizando canjes y calculando saldos.

pagehide limpia saldo y lectura antes de que el navegador guarde la página en su historial; pageshow con persisted vuelve a verificar la identidad actual. Evita recuperar una tarjeta privada antigua al volver desde otra sesión con el botón Atrás.

## Imagen de producto: ilustración autorizada

El usuario solicitó después generar una imagen realista e integrarla en el espacio vacío. image_gen (herramienta integrada, sin CLI/API propia) creó la pareja: chocolate izquierda y vainilla derecha, papel claro, fondo beige y luz natural. Es una ilustración fotográfica; figcaption muestra «Imagen ilustrativa» y no se afirma que sea una fotografía de los productos reales del negocio. Logo y catálogo no cambian.

Activos locales: assets/images/drachas-doughnuts-natural-480.webp (480×320,23872bytes), -960.webp (960×640,79622bytes) y -1536.webp (1536×1024,169584bytes). Pillow del runtime de desarrollo solo redimensionó/comprimió el original1536×1024, sin recorte ni retoque creativo; no se añade una dependencia a la web. El PNG original se conserva en el directorio de imágenes generadas de Codex.

La figura reemplaza cámara/texto de reserva por picture/img con srcset, sizes, dimensiones, loading=lazy y decoding=async. Proporción3:2 completa en todos los anchos; en escritorio la imagen se centra verticalmente si el texto requiere más altura. Etiquetas HTML Chocolate/Vainilla y nota de procedencia debajo, imagen encima del texto en móvil. landing.css?v=2 renueva caché. No requiere SQL, credenciales, Firebase o cambios de rutas.

Mantenimiento: conservar ambos sabores completos y la relación de aspecto al sustituir los WebP. Actualizar nombres/srcset/sizes, dimensiones y procedencia si cambia el origen; solo retirar la nota de ilustración si se dispone de una fotografía real verificada.

### Prompt final usado

Use case: photorealistic-natural. Asset type: landscape food photograph for the Drachas website order card. Primary request: exactly two simple ring doughnuts placed side by side on lightly crinkled pale bakery parchment on a plain warm beige tabletop. The chocolate-glazed doughnut is on the left and the vanilla-glazed doughnut is on the right, matching HTML flavor labels below the photograph. Natural small bakery products, modest thin coating, soft golden dough, believable slight imperfections and authentic texture. Composition: landscape 3:2, photographed from nearly overhead with a subtle angle; both doughnuts entirely visible, similar size, central horizontal pair with generous paper around the edges to allow responsive cropping. Soft natural window light, restrained warm colors, gentle realistic shadows, sharp edible detail without excessive gloss. Calm professional editorial food photography. No sprinkles, no extra doughnuts, no stacks, no trays, no props, no hands, no floating objects, no dramatic background, no text, no logos, no watermark. This is a standalone photograph asset, not a website mockup.

## Verificación

landing-web.cjs verifica320/390/768/1024/1440px: seis sellos dentro del ancho, orden responsive, precio real del fixture, rutas a Ranking/tienda/pedidos, foco, puntos disponibles frente a históricos/compras, canje reflejado y limpieza al salir. Otro caso restaura sesión y cambia de cuenta con una lectura retenida: la respuesta antigua no repone el saldo anterior.

El primer arranque local de Chromium agotó30s al cargar. La repetición completa pasó sin ampliar tiempos ni relajar aserciones; un diagnóstico posterior confirmó servidor200 y documento completo. Capturas locales con fixtures en test-output/landing; no son cuentas o compras de producción. Regresiones de pedidos, navegación, catálogo y movimiento se ejecutan aparte. Evidencia de CI y publicación en la PR de esta entrega; sin prueba física de Safari iPad o lector de pantalla afirmada.

Verificación de la imagen añadida: landing-web.cjs pasó a320/390/768/1024/1440, decodificando cada recurso seleccionado y comprobando proporción completa3:2, ausencia del placeholder, posición móvil/escritorio y rutas existentes. Capturas390/1440 inspeccionadas visualmente. srcset ajusta naturalWidth/naturalHeight por densidad; se valida proporción y carga, no se confunde ese valor con el ancho físico del archivo. Evidencia CI y publicación en la PR de esta actualización.
