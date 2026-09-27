# Perfil y movimiento — implementación del boceto aprobado

La vista anterior conservaba el resumen grande y mostraba un ranking completo antes del QR. Ahora el perfil presenta las secciones del boceto en este orden:

1. Marca, Perfil/Pedidos como entradas independientes y saludo.
2. Puntos totales, racha y progreso real de nivel en una tarjeta compacta.
3. Resumen, Ranking, Historial y Tienda.
4. Tres insignias recientes como máximo y acceso a todas.
5. Premio activo de menor costo, calculado con los puntos disponibles después de canjes. Si alcanza, se ofrece ir a la tienda; no se canjea automáticamente.
6. QR y contraseña opcional en diálogos accesibles, con cierre y Escape.
7. Hasta tres compras del historial disponible. Saldos migrados, ajustes y reversos no se presentan como compras nuevas.
8. Reglas e hitos de racha, total de compras y fecha de registro en un desplegable.

Los datos del boceto son ilustrativos: no se inventan insignias, sabores ni precios. La vista de compras usa las entradas de fidelidad disponibles; no representa un libro completo de todas las ventas ni muestra sabores que esas entradas no contienen.

## Movimiento

Intro de 1,1 segundos: aparece 0–250 ms, rueda 250–500 ms, revela marca 500–800 ms y sube 800–1100 ms. Solo una vez por sesión. Transiciones de panel de 200 ms. El acceso muestra carga mientras responde y confirma el éxito en el perfil sin una espera artificial. Movimiento reducido y ahorro de datos omiten las animaciones.

## Archivos

- `index.html`: reorganización, diálogos, resumen de premios/historial y confirmación de acceso.
- `assets/css/redesign.css`: estilo móvil y escritorio, iconos y etapas de bienvenida.
- `assets/js/motion.js`: estructura y duración de la intro.
- `api/backend.js`: incorpora `entryType` en cada entrada del historial sin cambiar cálculos ni saldos.
- `tests/regression.cjs`: QR, contraseña, logros, perfiles vacíos, canjes y distinción de saldo migrado.
- `tests/profile-motion.mjs`: prueba visual de las cuatro etapas, una intro por sesión y accesibilidad.

Verificación: navegación y flujos existentes en 360, 390, 412, 768 y 1440 px con API simulada; acceso ID con/sin contraseña; canje, compra del vendedor, pedido y cierre; sin desbordamiento horizontal ni errores JS. Los datos productivos no se usan para generar compras de prueba.

Este cambio es de la PWA. No requiere otra migración SQL ni modifica el APK piloto 1.2.1. Se conserva la decisión posterior del dueño: inventario manual administrado en la web; Realtime queda para una etapa futura.
