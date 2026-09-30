# Usuarios memorables y activación del perfil

## Comportamiento preparado

- `customers.public_id` continúa como clave técnica para pedidos, fidelidad, enlaces antiguos y Android. La migración `202609290002_customer_usernames.sql` añade `username`, lo rellena en clientes existentes y lo genera en altas nuevas. Usa las dos primeras palabras del nombre, minúsculas, sin tildes, y añade `1`, `2`, etc. cuando hay colisión.
- El login web acepta `username` sin distinguir mayúsculas. Acepta también el ID `C...` antiguo para no romper enlaces guardados.
- Un perfil sin contraseña ya no recibe una sesión de cliente. Para crear o recuperar la contraseña, la API envía un OTP al WhatsApp registrado mediante Supabase Auth y verifica el teléfono antes de cambiar el hash. La migración `202609290003_customer_phone_password.sql` hace esta última comprobación dentro de PostgreSQL y aumenta la versión de credenciales para invalidar sesiones anteriores.
- El alta web requiere WhatsApp. Los perfiles existentes sin teléfono necesitan completar ese dato antes de activar su contraseña. El endpoint anterior de código de vendedor permanece como vía de recuperación heredada en la API; la web ya no lo presenta en su flujo normal.

## Estado de producción comprobado el 29 de septiembre de 2026

Las tres migraciones `202609290001` a `202609290003` se aplicaron manualmente en el SQL Editor del proyecto Supabase de producción. El proyecto no tenía `supabase_migrations.schema_migrations`; por tanto, **no ejecutar `supabase db push` sobre estas mismas migraciones sin reparar antes el historial de migraciones de la CLI**. La verificación posterior encontró 82 clientes y 82 usuarios únicos.

La publicación web/API sigue pendiente. Phone Auth aparece desactivado y los campos de Twilio están vacíos. De 82 clientes activos, 81 no tienen contraseña y 4 no tienen WhatsApp. Publicar el login obligatorio en estas condiciones impediría el acceso a casi todos los clientes.

## Comprobaciones previas al despliegue

En Supabase SQL Editor, inspeccionar la cantidad de clientes activos que no podrán usar el nuevo flujo:

```sql
select count(*) as clientes_sin_whatsapp
from public.customers
where status = 'ACTIVE' and whatsapp_e164 is null;
```

Preparar un método de actualización del número para cada caso antes de publicar la contraseña obligatoria. Confirmar que los teléfonos existentes pertenecen a sus clientes: el primer OTP da acceso a quien controla ese número.

En Supabase Dashboard, habilitar Phone Auth y configurar Twilio Verify con canal WhatsApp. La API usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` que el proyecto ya necesita; no añadir estas claves al frontend. Hacer una prueba real de envío y verificación en un proyecto de prueba antes de producción.

## Orden de publicación

1. Aplicar en Supabase las migraciones pendientes en orden. En este trabajo son `202609290001_redemption_management.sql`, `202609290002_customer_usernames.sql` y `202609290003_customer_phone_password.sql`. Revisar `supabase migration list` antes de `supabase db push` para no repetir migraciones ya aplicadas por otra vía.
2. Configurar y comprobar WhatsApp OTP.
3. Revisar clientes sin WhatsApp. Evitar publicar el login obligatorio hasta tener una salida para ellos.
4. Publicar web/API y probar: registro, usuario duplicado, primer acceso, código erróneo, acceso con contraseña, recuperación, enlace antiguo `C...`, pedidos y perfil Android.

La aplicación de SQL no activa por sí sola el nuevo login. Revisar el estado actual de GitHub y Vercel antes de considerar completo el despliegue.
