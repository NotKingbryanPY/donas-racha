# Donas Racha · Rediseño visual V3

## Alcance y auditoría

Base: `main`, commit `16ee43d533fcbface72157cf53f8e06230997c1b`.
El repositorio contiene únicamente `index.html` y `Donas_Racha_v2_Guia.md`.
La guía documenta un backend Apps Script y Sheets, pero el código `.gs` y la estructura `.xlsx` mencionados no están incluidos. La versión HTML publicada en Vercel se descargó y coincide byte por byte con la base (64.907 bytes).

Se conservan todos los IDs originales, las funciones públicas, la URL `/exec`, los parámetros GET, los payloads POST, sessionStorage, las reglas y los datos recibidos del backend. No se ejecutaron migraciones ni escrituras de prueba en producción.

| Flujo | Contrato conservado |
| --- | --- |
| Acceso vendedor | `verificarPassword`, `donasAuth`, `donasPass` |
| Acceso cliente | `getCliente` con ID escrito o extraído de QR |
| Búsqueda | `buscarCliente` con `q` |
| Perfil | puntos, racha, niveles, hitos, insignias e historial recibidos del backend |
| Ranking | `getRanking`, mismos tipos y límites |
| Tienda | catálogo del cliente y `canjearRecompensa` |
| Compras / registro | `registrarCompra`, `nuevoCliente` |
| Admin | `getAdminDashboard`, `getStats`, `getConfig`, `saveConfig`, `getTodosClientes` |
| Migraciones | `initSheets`, `migrarClientesExistentes`, sin ejecución real |
| QR | misma versión html5-qrcode, lectores, callbacks y configuración |

La guía menciona escaneo de archivos, pero no existe ese control en el HTML auditado. No se inventó una funcionalidad ni se eliminó ninguna existente.

## Diseño

HTML estático, CSS y JavaScript nativo. Sin build, framework, WebGL, fuentes remotas ni nuevas dependencias de producción.

- Fondo berenjena `#100d17`, superficies oscuras y violeta suave; rosa puntual, oro en logros.
- Hero editorial con imagen de producto, planos CSS, tipografía amplia y CTA visible en móvil.
- Perfil, tienda, ranking, QR y administración comparten tokens de diseño.
- Entradas de 240–650 ms; progreso de 800 ms; tilt limitado a 3° en puntero fino.
- Flotación del hero limitada a dos ciclos. Reveal con IntersectionObserver y sin listeners de scroll.
- Confetti solo en hitos, nivel, temporada, recompensa o canje exitoso. Reduced-motion y saveData lo desactivan.
- Reduced-motion, saveData, conexión 2G y memoria declarada de 2 GB o menos desactivan decoración.
- Zoom permitido, campos etiquetados, focus visible, regiones de estado y fondo de overlays inerte.
- Tablas admin con scroll interno y sin inclinación o decoración constante.

`assets/css/redesign.css` es la capa de presentación, conservando el CSS base para facilitar revisión y reversión. `assets/js/motion.js` no hace peticiones ni calcula puntos.

## Recursos y presupuesto

El logo UTP se copió sin alteración de sus píxeles ni proporciones. Se presenta como contexto universitario, con aclaración de emprendimiento independiente.

Hero generado mediante Higgsfield / GPT Image 2.5, basado en la fotografía real adjunta. Una sola generación, 2K, calidad media, coste estimado y saldo posterior verificados:

- Saldo inicial: 110 créditos.
- Consumo: 1,5 créditos.
- Saldo posterior: 108,5 créditos.
- Job: `7fe6a0f1-8f65-4bd3-903d-873d3b316b67`.
- `donut-hero.webp`: 960 × 960, 85.330 bytes.
- `donut-hero-small.webp`: 480 × 480, 30.726 bytes.
- `srcset` selecciona el recurso según viewport y densidad. Solo el hero tiene prioridad alta.

La imagen se inspeccionó visualmente antes de integrarla. La caja sirve de referencia de producto; no se adopta la marca de su fabricante. Se optó por CSS en lugar de vídeo o GLB para esta iteración: menor transferencia, forma estable y compatibilidad móvil. No se gastaron créditos en vídeo.

## Validación

Pruebas reproducibles: `tests/regression.cjs`. Requieren Playwright instalado en el entorno de desarrollo, no en producción.

```sh
python -m http.server 8765
# En otra terminal, con Playwright disponible:
node tests/regression.cjs
```

Variables opcionales: `TEST_URL`, `TEST_OUTPUT`, `CHROMIUM_PATH`.

La suite intercepta las peticiones externas: no registra ventas, crea clientes ni canjea premios reales. Comprueba 360, 390, 412, 768 y 1440 px, login correcto/incorrecto, ID válido/inválido, búsqueda y teclado, perfil, puntos, racha, nivel, progreso, compra e hitos, ranking, tienda, saldo de canje, historial, registro, dashboard y configuración. Los scanners se prueban con un doble de html5-qrcode (inicio, configuración, callback y parada, rechazo de cámara); esto no sustituye una prueba física de cámara.

Verificaciones reales de solo lectura: backend `getRanking` devolvió HTTP 200, `ok:true` y un array de ranking. El HTML de Vercel fue accesible. Las escrituras, contraseña real de admin y cámara física requieren una prueba final con cuenta de prueba antes de fusionar.

No se fusiona a `main` ni se publica en producción desde este cambio.

Resultado de la suite: PASS en los cinco tamaños (155 peticiones simuladas), sin excepciones de JavaScript ni overflow horizontal detectado. Reduced-motion y saveData verificados.
