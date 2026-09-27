# 7. Movimiento propuesto — implementación completa

Corrección tras la revisión del acceso real: **Entrando… → Listo → bienvenida Donas Racha → perfil**. El saludo usa 26–34 px, en lugar de los 16 px anteriores.

La referencia visual se traduce a recursos SVG y animación nativa CSS/JavaScript. Los datos del perfil siguen viniendo de la API; el boceto no se usa para inventar puntos, premios, compras ni existencias.

| Interacción | Implementación | Criterio de aceptación |
| --- | --- | --- |
| Bienvenida después del acceso | Dona violeta con rebote de 0–250 ms, giro a la izquierda de 250–500 ms, marca de 500–800 ms y cortina ascendente de 800–1100 ms. | Se inicia después de mostrar “Listo”. El perfil se prepara detrás de la cortina a los 800 ms y queda visible al finalizar. No se consume al abrir la web. |
| Visitas posteriores | La intro pertenece a un acceso explícito correcto por ID o QR, también si ya hubo otro acceso en la misma sesión. | No se ejecuta al recargar, navegar, vender o cambiar de pestaña. Un marcador antiguo en sessionStorage no puede ocultarla. |
| Acceso operativo / widget | El flujo de vendedor no llama la bienvenida. También se omite con `?source=widget`. | El widget Android sigue siendo nativo; no se modifica su APK ni se añaden esperas a sus ventas. |
| Navegación | Desvanecimiento y desplazamiento de 10–12 px durante 200 ms. | El botón de sección conserva el foco; si su panel queda oculto, el foco pasa al destino. El campo de ID conserva el foco al abrir el acceso. |
| Acceso por ID o QR | Círculo giratorio durante las peticiones de sesión y perfil. Tras el éxito de ambas, botón turquesa con check y “Listo” durante 450 ms; luego bienvenida y perfil. | El perfil no se abre mientras la API está pendiente. Errores y cancelaciones no muestran check ni intro. Doble envío bloqueado. No se retrasa el inicio de las peticiones ni se simula carga. |
| Botones | Presión de escala 0,97 en 100 ms; brillo discreto solo con hover y puntero fino. | Funciona con toque y teclado, con foco visible y sin depender de hover. Reduced motion y ahorro de datos suprimen la presión. |
| Cambio de stock | Fondo violeta breve, 650 ms, solo en la cifra disponible o reservada que cambió. | Compara la última respuesta por SKU/variante. No destaca la primera carga ni datos idénticos ni cambios de cantidad del carrito. No anima el contenedor ni mueve la pantalla. |
| Accesibilidad | `prefers-reduced-motion` y `saveData` detienen el giro y omiten el movimiento decorativo. | “Listo” sigue siendo legible antes de entrar. La memoria declarada y 2G no suprimen estas animaciones ligeras. El único bucle es el indicador funcional mientras existe una petición pendiente; se detiene al terminar o cancelar. Escape permite terminar la cortina. |

## Identidad y recursos

El acceso y el perfil incorporan **Animaciones → Automáticas / Activadas / Reducidas**. Automáticas conserva la accesibilidad del dispositivo. Activadas es una elección explícita solo para esta web y permite ver la bienvenida incluso cuando el navegador comunica movimiento reducido. La elección se guarda en este navegador, sin cambiar Windows ni otros sitios. Diagnóstico y pruebas: [BROWSER_MOTION_DIAGNOSIS.md](BROWSER_MOTION_DIAGNOSIS.md).

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
node tests/customer-login-sequence.cjs
node tests/regression.cjs
```

Las pruebas de navegador interceptan la API. `customer-login-sequence.cjs` verifica la secuencia real, el giro durante respuestas lentas, el botón turquesa antes de navegar, repetición por QR, cancelación y accesibilidad; genera capturas y un video de los datos simulados. Cubren las cuatro etapas, recarga, movimiento reducido, ahorro de datos, almacenamiento bloqueado, entrada operativa, carga y error de acceso, foco, cifras de stock y ausencia de bucles decorativos. La regresión recorre 360, 390, 412, 768 y 1440 px. No requieren ni generan ventas reales.
