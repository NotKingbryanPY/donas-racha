# Desplegar Donas Racha 1.4.1 en el hosting existente

El repositorio `NotKingbryanPY/donas-racha` ya está vinculado al proyecto Vercel `king-entertainment/donas-racha`. El usuario confirmó acceso desde el iPad. Se continúa en ese proyecto y en `dracha.store`. La propuesta existente es [PR 37](https://github.com/NotKingbryanPY/donas-racha/pull/37), rama `codex/donas-control-ios-shared-stock`, base `main`. Su despliegue Preview permite revisar los cambios antes de pasarlos al dominio público.

## Estado antes de publicar

- Supabase: el usuario aplicó 02/03/04 y entregó 05 sin anomalías. No repetir 02. Los scripts 06/07 son cierres, no pasos siguientes.
- Firebase: Auth correo/contraseña y Google, certificados Android, Firestore privado Standard/us-east1 y API FCM HTTP v1 configurados.
- APK oficial 1.4.1: compilado, firmado y comprobado; 99 pruebas Android y lint pasaron. Está en `outputs/Donas-Control-1.4.1-oficial.apk`, fuera de Git.
- Web/API: cambios locales comprobados. La suscripción pública al catálogo usa el SDK oficial alojado en el sitio, recupera cambios al reconectar y conserva el carrito. Las pruebas de navegador simulan las API y WebSocket; todavía falta el recorrido en producción.
- FCM: faltan las credenciales privadas del emisor en Vercel, el secreto de reintentos en GitHub y la prueba en un teléfono autorizado.
- Inventario: chocolate con chispas tiene dos reservas sin unidades físicas conciliadas. Sigue sin permitir nuevas ventas de ese sabor. Revisar el conteo real y los pedidos reservados sin inventar unidades.

## 1. Revisar variables en Vercel desde el iPad

Abre [el proyecto Vercel](https://vercel.com/king-entertainment/donas-racha), **Settings → Environment Variables**. Comprueba la existencia de las siguientes variables en **Production** y **Preview**. Mantén los valores privados en sus campos protegidos, sin enviarlos al chat.

| Nombre | Valor / procedencia |
|---|---|
| `SUPABASE_URL` | `https://yopntnzhcfudaabudbld.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave pública anon o publishable del mismo proyecto. No usar service_role aquí. |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial de servidor del mismo proyecto, únicamente en Vercel. Conservar la existente si ya funciona. |
| `FIREBASE_AUTH_PROJECT_ID` | `donascontrol-1f5df` |

La API solo publica URL y clave pública para Realtime. Las claves de servidor no se incluyen en los assets ni en el APK. Preview puede apuntar al backend compartido para consultas; sus pruebas de navegación no deben modificar inventario/puntos de clientes reales.

Las variables nuevas solo se incorporan en un despliegue nuevo. Si se modificaron después de generar un Preview, vuelve a desplegar ese Preview. [Documentación de variables de Vercel](https://vercel.com/docs/environment-variables).

## 2. Revisar el Preview de GitHub

Abre PR 37 y revisa los checks. El enlace de Vercel aparece en los despliegues/checks del PR. Verifica que corresponde al último commit de la rama. En Vercel, conserva el proyecto, raíz y dominios existentes; la raíz del repositorio contiene `index.html`, `assets/` y `api/`. `package.json` fija Node 22 e instala el SDK Firebase Admin del servidor. Si Vercel tiene una versión de Node fijada en Settings, selecciona 22.x.

Los checks comprueban contratos API, SQL, concurrencia en PostgreSQL, navegador con proveedores simulados, reglas Firestore y Android. El APK de CI usa una firma temporal de validación; instalar el APK oficial ya generado para actualizar un teléfono existente.

En el Preview comprobar:

1. `/api/products`: JSON con `ok=true` y catálogo.
2. `/api/products?view=inventory`: cantidades compartidas actuales.
3. `/api/products?view=realtime`: `ok=true`, `data.enabled=true` y URL del proyecto correcto. Solo contiene configuración pública.
4. `/api/admin/orders` sin sesión: debe negar acceso (401/403).
5. Perfil/Pedidos, puntos disponibles/históricos, navegación móvil, «Retomar tutorial» y carrito.

Un 503 `API_NOT_CONFIGURED` exige revisar las variables y volver a desplegar. Un Preview protegido por Vercel puede exigir entrar con tu cuenta antes de probarlo; esa protección es distinta de la autorización de la API.

## 3. Publicar en dracha.store

Con checks aprobados, variables confirmadas y Preview revisado, integra PR 37 en `main`. La integración Git existente inicia el despliegue de Production; espera estado **Ready** en Vercel y comprueba que el commit corresponde a la integración. No basta con que GitHub haya aceptado el código. [Despliegues mediante Git en Vercel](https://vercel.com/docs/git).

Abre [Donas Racha](https://www.dracha.store/) y repite las comprobaciones de las tres API públicas y denegación de pedidos anónimos. La aparición de los nuevos botones y scripts confirma que se sirve la versión actual, pero no demuestra envío FCM.

## 4. Autorizar el teléfono una sola vez

En la web actualizada entra con tu cuenta ADMIN existente. En la sección **Dispositivos administrativos**, elige ADMIN o SELLER y genera una invitación. Pégala únicamente en el teléfono de confianza: vale 15 minutos y un uso. No enviarla al chat ni guardarla en Git.

Instala el APK oficial 1.4.1 sobre la app oficial existente, conservando Room. Introduce la invitación en Donas Control. La app abre Pedidos y conserva una credencial individual revocable durante 90 días. El registro Firebase por sí solo no concede permisos administrativos.

En **Cuenta · Correo o Google**, inicia sesión, verifica el correo cuando corresponda y usa **Vincular cuenta** con la autorización anterior. En las siguientes aperturas la sesión se restaura. Comprueba que aparecen los pedidos actuales y que un dispositivo sin autorización no puede consultarlos.

## 5. Activar el emisor FCM en el servidor

En el proyecto Google/Firebase `donascontrol-1f5df`, configura una cuenta de servicio dedicada al envío, con el rol **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`). La API HTTP v1 ya está habilitada. No otorgar Owner/Editor para este envío.

Si usas una clave JSON para el backend actual, descárgala en un entorno privado y traslada directamente a las variables protegidas de Vercel estos campos:

| Variable de Vercel | Campo |
|---|---|
| `FCM_PROJECT_ID` | `donascontrol-1f5df` |
| `FCM_CLIENT_EMAIL` | `client_email` de la cuenta de servicio |
| `FCM_PRIVATE_KEY` | `private_key` completa; el backend admite saltos de línea y secuencias `\n`. |

La cuenta de servicio debe pertenecer al proyecto esperado o tener el permiso FCM concedido explícitamente sobre él. Conservar y rotar la clave según tu gestión de credenciales; no dejar el JSON en una carpeta pública/sin protección ni incluirlo en el repositorio. La configuración pública `google-services.json` de Android no sustituye esta autorización. [Servidor FCM](https://firebase.google.com/docs/cloud-messaging/server-environment), [autorización HTTP v1](https://firebase.google.com/docs/cloud-messaging/auth-server).

Configura FCM en Production; activar un emisor Preview sobre la base de producción puede generar avisos reales durante pruebas. Después de cambiar variables, vuelve a desplegar Production. No hace falta contratar Cloud Functions ni cambiar a Blaze para usar este emisor existente.

## 6. Activar reintentos persistentes

Genera un secreto aleatorio de al menos 32 bytes en un gestor de contraseñas/terminal privado. Guarda el mismo valor en:

- Vercel Production: `CRON_SECRET`.
- GitHub del repositorio: **Settings → Secrets and variables → Actions → New repository secret**, nombre `ORDER_PUSH_CRON_SECRET`.

No publicar el valor en el chat ni en un archivo de código. Vuelve a desplegar Vercel para incorporar la variable. En GitHub **Actions → Retry queued order alerts → Run workflow**, ejecuta una vez y comprueba éxito. Después el workflow de `main` intenta despachar trabajos pendientes cada cinco minutos, sujeto a los retrasos de GitHub Actions. El endpoint no admite despacho anónimo.

## 7. Recorrido real y cierre de la validación

En un teléfono autorizado permite las notificaciones Android 13+, comprueba el canal y sonido. Crea un pedido real de prueba claramente identificable desde la web, con un sabor disponible; conserva su código. Comprueba respuesta del servidor, confirmación, WhatsApp, persistencia tras recargar, recepción Android y estados coherentes. No completar/cobrar un pedido de prueba como venta real salvo que se haya recibido el pago correspondiente.

Repite la recepción con app abierta, en segundo plano y pantalla bloqueada. Toca el aviso y confirma que abre ese pedido. FCM/Android pueden retrasar la entrega; forzar la detención de una app desde Ajustes puede impedir avisos hasta volver a abrirla.

Renombra o deshabilita un sabor autorizado y comprueba el cambio en una web visible; desconecta/reconecta para comprobar recuperación. Un cambio de oferta comercial no añade ni descuenta unidades físicas. Revisa el carrito para evitar cantidades nuevas del sabor deshabilitado.

Offline: consulta pedidos/catálogo ya guardados, registra operaciones permitidas, cierra el proceso y vuelve a abrir. Tras reconectar, comprueba la cola y que no se duplica venta/cobro/inventario. Una venta pendiente no debe presentarse como confirmada. Las pruebas físicas y los eventos Supabase reales deben registrarse por separado de las pruebas simuladas.

Revoca un dispositivo de prueba desde la web y comprueba la denegación al volver a conectarse. Finalmente ejecuta únicamente `05_verify_export.sql` (lectura) para verificar integridad después del recorrido. Si falla la aplicación nueva, Vercel permite volver al despliegue anterior; no eliminar tablas ni revertir movimientos de inventario ya registrados para simular esa vuelta.

Registrar código de pedido, versión/commit desplegado y resultado de cada escenario sin teléfonos de clientes, tokens, contraseñas ni claves privadas. Esta entrega permanece pendiente de validación integral hasta completar estos pasos en el hosting y un dispositivo físico.
