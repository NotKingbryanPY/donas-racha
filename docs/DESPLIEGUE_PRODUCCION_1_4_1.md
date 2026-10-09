# Donas Racha 1.4.1 publicada — 8 octubre 2026

La actualización de web y API está publicada en [www.dracha.store](https://www.dracha.store/). [PR 37](https://github.com/NotKingbryanPY/donas-racha/pull/37) se integró en `main` mediante el commit `6f751376f26d43462301c39587e11b041c962a23`. [El despliegue de producción Vercel](https://vercel.com/king-entertainment/donas-racha/83SGkpiP9K5tqmwf7G3E6ULaxwju) terminó con estado success. El usuario confirmó las tres variables Supabase en Production y Preview antes de autorizar la publicación.

## Comprobaciones reales después de publicar

Todas fueron de lectura o intentos sin autorización rechazados. No se crearon pedidos, cobros, conteos ni cuentas de prueba en producción.

| Comprobación | Resultado |
|---|---|
| Página principal y nuevos scripts de catálogo/confirmación | HTTP 200, assets actuales presentes. |
| `/api/products` | HTTP 200, `ok=true`, catálogo del producto existente. |
| `/api/products?view=inventory` | HTTP 200; disponibles 18/0/20/0, reservas 2/2/0/0. Chocolate con chispas conserva `counted=false`. |
| `/api/products?view=realtime` | HTTP 200, habilitado, proyecto `yopntnzhcfudaabudbld`; devuelve configuración pública, sin campos de claves privadas. |
| Pedidos administrativos, catálogo administrativo, invitaciones, dispositivos y `/api/sync` sin sesión | HTTP 401 `AUTH_REQUIRED`. |
| Crear un pedido sin sesión, con cuerpo vacío | HTTP 401 `AUTH_REQUIRED`; sin escritura. |
| Chromium contra la web real | Carga el SDK oficial propio, establece suscripción Realtime contra el proyecto correcto, desconecta offline y vuelve a suscribirse al recuperar Internet. |
| Página pública en 390/768/1440 px | Sin desbordamiento horizontal; cero errores JavaScript y cero errores de consola durante esa prueba. |

La suscripción real y su reconexión están comprobadas. La entrega de un evento después de editar un sabor autorizado todavía debe verificarse en el recorrido manual; no se modificó un sabor de producción para aparentar esa prueba.

## CI aprobado antes de integrar

El head revisado fue `7cf4e0a8912cf8f2f21cd531fd4cbf7d13bdf1bb`. Las cuatro ejecuciones terminaron con success:

- [Android](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078377): build y pruebas en emuladores API 23 y 35.
- [API, SQL, concurrencia PostgreSQL real y navegador](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078462).
- [Reglas Firestore en emulador](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078401).
- [iOS y contabilidad existentes](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078482).

El APK de CI tiene una firma temporal de validación. Para actualizar el teléfono, usar el APK oficial firmado permanentemente: `outputs/Donas-Control-1.4.1-oficial.apk`, 5 366 740 bytes. SHA-256: `f0213df8560ce646d8faf9c420317af8555aa6db0889182044c25ac6954fd431`. Su firma, alineación y configuración pública Firebase ya están verificadas; las 99 pruebas locales y lint pasaron. Instalar sobre la app oficial existente sin borrar sus datos.

## Pruebas que debe completar el operador

1. Entrar en la web con la cuenta ADMIN existente. Abrir **Dispositivos autorizados → Crear invitación**, elegir ADMIN/SELLER y usar la invitación de 15 minutos únicamente en el teléfono de confianza. No enviarla al chat.
2. Abrir el APK oficial, autorizar el dispositivo desde Pedidos y comprobar los pedidos existentes. En **Cuenta · Correo o Google**, verificar y vincular la cuenta si se usa Firebase; registrarse por sí solo no concede permisos administrativos.
3. Crear un pedido identificable desde la web con un sabor disponible; comprobar confirmación, código, WhatsApp y recuperación tras recargar. Confirmar que llega al teléfono y que los estados coinciden. No cobrar/completar una prueba como una venta real sin recibir el pago.
4. Editar/deshabilitar un sabor autorizado y verificar el cambio en la web, incluido el regreso tras perder conectividad. Oferta comercial y unidades físicas son métricas diferentes.
5. Consultar Room offline, registrar únicamente operaciones permitidas, cerrar el proceso y recuperar conexión; comprobar pendientes, reintentos, conflictos y ausencia de duplicación.
6. Configurar el emisor FCM del servidor y los reintentos según los pasos 5/6 de [la guía de activación](DESPLIEGUE_WEB_1_4_1.md). Después probar app abierta, segundo plano, pantalla bloqueada, sonido y apertura del pedido concreto.
7. Revocar un dispositivo de prueba y verificar la denegación al reconectar. Revisar físicamente las dos reservas de chocolate con chispas antes de corregir el conteo. Al terminar, ejecutar solo el script de lectura 05 para comprobar integridad.

La web está desplegada y sus comprobaciones públicas pasaron. La integración completa sigue pendiente de estas pruebas con una cuenta autorizada, de las credenciales protegidas del emisor FCM/reintentos y del rendimiento en un teléfono físico. Android/FCM pueden retrasar avisos; no se prometió entrega instantánea ni se instalaron servicios permanentes para evitar sus restricciones.
