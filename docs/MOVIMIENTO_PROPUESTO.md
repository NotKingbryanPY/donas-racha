# 7. Movimiento propuesto — implementación completa

La referencia visual se traduce a recursos SVG y animación nativa CSS/JavaScript. Los datos del perfil siguen viniendo de la API; el boceto no se usa para inventar puntos, premios, compras ni existencias.

| Interacción | Implementación | Criterio de aceptación |
| --- | --- | --- |
| Primera bienvenida web | Dona violeta con rebote de 0–250 ms, giro a la izquierda de 250–500 ms, marca de 500–800 ms y cortina ascendente de 800–1100 ms. | Termina en 1,1 s; no retrasa peticiones, no recibe foco y se cierra al pulsar, tocar o usar el teclado. |
| Visitas posteriores | Se consume `donasBrandIntroSeen` en `sessionStorage`, incluso cuando se omite por preferencias. | No reaparece al recargar, navegar, vender o volver a la pestaña. Si se abandona la pestaña durante la intro, se retira. Una nueva sesión puede mostrarla de nuevo. |
| Acceso operativo / widget | Se omite con sesión de vendedor y con `?source=widget`. | La ruta de venta del widget Android es nativa y no ejecuta esta web. No se modifica el APK ni se añaden esperas a sus ventas. El parámetro protege futuros enlaces web operativos. |
| Navegación | Desvanecimiento y desplazamiento de 10–12 px durante 200 ms. | El botón de sección conserva el foco; si su panel queda oculto, el foco pasa al destino. El campo de ID conserva el foco al abrir el acceso. |
| Acceso por ID | Texto de estado y un indicador de una sola vuelta mientras la operación está pendiente. El botón sigue desactivado y marcado `aria-busy` hasta terminar. | “Listo” aparece en el perfil únicamente después de confirmar sesión y recibir el perfil. Los errores no muestran un check. No se usa un tiempo mínimo artificial. |
| Botones | Presión de escala 0,97 en 100 ms; brillo discreto solo con hover y puntero fino. | Funciona con toque y teclado, con foco visible y sin depender de hover. Reduced motion y ahorro de datos suprimen la presión. |
| Cambio de stock | Fondo violeta breve, 650 ms, solo en la cifra disponible o reservada que cambió. | Compara la última respuesta por SKU/variante. No destaca la primera carga ni datos idénticos ni cambios de cantidad del carrito. No anima el contenedor ni mueve la pantalla. |
| Accesibilidad | Se omite decoración por `prefers-reduced-motion`, `saveData`, 2G o poca memoria declarada. | Sin animaciones en bucle. Los estados siguen siendo legibles. Cambiar las preferencias también detiene el movimiento actual. Si el almacenamiento está bloqueado, se omite la intro. |

## Identidad y recursos

- `assets/images/donas-racha-mark.svg`: dona violeta con fondo transparente, utilizada por la web y como favicon.
- `assets/images/donas-racha-logo-light.svg`: logo completo para fondos oscuros.
- `assets/images/donas-racha-logo-dark.svg`: logo completo para fondos claros.
- `docs/previews/brand-motion.html`: demostración local, sin API, con reproducción manual y control de los 1100 ms. Utiliza los estilos reales de producción. Los datos de ejemplo se identifican explícitamente.

Los logos son vectores editables sin fuentes remotas ni dependencias de producción. Los logotipos completos usan Arial/Helvetica/sans-serif para su texto; la web conserva texto real accesible junto a la dona decorativa.

## Comprobación reproducible

Con Playwright disponible en el entorno de desarrollo y un servidor estático local:

```sh
python -m http.server 8765 --bind 127.0.0.1
node tests/web-script-syntax.cjs
node tests/profile-motion.mjs
node tests/motion-interactions.cjs
node tests/regression.cjs
```

Las pruebas de navegador interceptan la API. Cubren las cuatro etapas, recarga, movimiento reducido, ahorro de datos, almacenamiento bloqueado, entrada operativa, carga y error de acceso, foco, cifras de stock y ausencia de bucles. La regresión recorre 360, 390, 412, 768 y 1440 px. No requieren ni generan ventas reales.
