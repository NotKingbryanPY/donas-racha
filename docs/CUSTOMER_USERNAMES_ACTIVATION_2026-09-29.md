# Usuarios memorables y activación del perfil

## Comportamiento preparado

- `customers.public_id` continúa como clave técnica para pedidos, fidelidad, enlaces antiguos y Android. La migración `202609290002_customer_usernames.sql` añade `username`, lo rellena en clientes existentes y lo genera en altas nuevas. Usa las dos primeras palabras del nombre, minúsculas, sin tildes, y añade `1`, `2`, etc. cuando hay colisión.
- El login web acepta `username` sin distinguir mayúsculas. Acepta también el ID `C...` antiguo para no romper enlaces guardados.
- Un perfil sin contraseña ya no recibe una sesión de cliente. Al primer acceso, quien conozca el usuario puede crear una contraseña directamente. La migración `202609300001_direct_customer_password.sql` hace que esta acción sea de un solo uso y atómica, incluso si dos personas lo intentan a la vez. No usa Supabase Phone Auth ni Twilio.
- Dentro de una sesión, cambiar la contraseña requiere la contraseña actual e invalida las sesiones anteriores. Si se olvida una contraseña ya creada, la web pide ayuda al administrador; el endpoint anterior con código administrativo permanece como vía de recuperación heredada en la API.
- El alta web sigue requiriendo WhatsApp para compartir los datos de registro. Los perfiles existentes sin teléfono pueden crear contraseña, aunque sus pedidos identificados siguen requiriendo teléfono por una regla anterior.
- **Riesgo aceptado por el propietario:** el usuario es predecible. Una persona ajena que lo conozca y acceda antes que el cliente puede reclamar un perfil aún sin contraseña. La limitación de intentos y el bloqueo de cambios posteriores no evitan ese primer reclamo.

## Estado de producción comprobado el 29 de septiembre de 2026

Las tres migraciones `202609290001` a `202609290003` se aplicaron manualmente en el SQL Editor del proyecto Supabase de producción. La nueva migración `202609300001` todavía debe aplicarse antes de publicar el frontend/API. El proyecto no tenía `supabase_migrations.schema_migrations`; por tanto, **no ejecutar `supabase db push` sobre estas migraciones sin reparar antes el historial de migraciones de la CLI**. La verificación posterior encontró 82 clientes y 82 usuarios únicos.

La publicación web/API sigue pendiente. De 82 clientes activos, 81 no tienen contraseña y 4 no tienen WhatsApp. El flujo directo permite activar también esos cuatro perfiles, pero se debe comunicar a los clientes su usuario para que lo reclamen antes que otra persona.

## Comprobaciones previas al despliegue

Aplicar `202609300001_direct_customer_password.sql` en SQL Editor y verificar que las dos RPC nuevas sean ejecutables solo por `service_role`. La migración elimina la RPC de verificación telefónica que nunca llegó a usar producción. No habilitar Phone Auth: el mensaje informativo de WhatsApp se comparte mediante el flujo existente y es independiente de la creación de contraseña.

## Orden de publicación

1. Aplicar solo la nueva migración `202609300001_direct_customer_password.sql` y verificar el resultado. Las tres anteriores ya están aplicadas en producción.
2. Publicar web/API y probar: registro, usuario duplicado, primer acceso sin teléfono, segundo intento de reclamar, acceso con contraseña, cambio dentro del perfil, enlace antiguo `C...`, pedidos y perfil Android.
3. Informar a los clientes existentes su usuario. Los cuatro sin WhatsApp necesitarán recibirlo por otra vía; además requieren completar el teléfono para hacer pedidos identificados.

La aplicación de SQL no activa por sí sola el nuevo login. Revisar el estado actual de GitHub y Vercel antes de considerar completo el despliegue.
