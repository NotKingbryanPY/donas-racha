# Pedidos solo para clientes registrados

## Qué cambia

La portada lleva a `/customer.html`. Una persona entra con correo y contraseña de Supabase Auth y vincula su cuenta a un cliente ya registrado mediante un código temporal emitido por un administrador que verificó su identidad. El pedido usa el nombre y WhatsApp guardados en `public.customers`; el navegador no puede cambiarlos. La API y la función SQL rechazan pedidos anónimos. Crear el pedido no acredita puntos ni racha. El abono automático al cobrar y completar la entrega pertenece al cierre conjunto de la fase 10, todavía no publicado en `main`.

Los seis endpoints de cliente comparten `api/customer/[route].js` para mantener el despliegue dentro del límite de 12 funciones del plan Vercel Hobby. Sus URLs públicas no cambian.

## Preparación antes de publicar

1. Revisar en Supabase SQL Editor cuántos clientes del negocio están realmente en la tabla central:

   ```sql
   select count(*) as clientes_activos,
          count(*) filter (where whatsapp_e164 is null) as sin_whatsapp,
          count(*) filter (where auth_user_id is not null) as vinculados
   from public.customers where status = 'ACTIVE';
   ```

   El registro antiguo en Apps Script no basta: los clientes que vayan a pedir necesitan estar migrados a `public.customers`, con nombre y WhatsApp reales. No crear clientes automáticamente a partir de un ID público ni de un número que escriba el visitante.

2. Confirmar que existe una cuenta administradora en Supabase Auth con rol `ADMIN` en `public.app_user_roles`, y que el correo de registro de Supabase Auth funciona. La contraseña del panel de Apps Script es independiente.
3. Ejecutar `supabase/migrations/202609250001_customer_only_delivery.sql` en un proyecto de prueba y comprobar permisos y reintentos. Después aplicarla en el proyecto productivo antes de desplegar la web. La migración conserva los pedidos previos, pero bloquea nuevos pedidos sin cliente vinculado.
4. Desplegar la web y la API juntas. Entrar como administrador en `/admin-claims.html`, buscar el ID de un cliente existente, verificar su identidad presencialmente y entregarle el código temporal. El cliente crea acceso por correo en `/customer.html`, inicia sesión, vincula el código y hace su pedido dentro del perfil.
5. Verificar en base de datos que el pedido tiene `customer_id`, `customer_name_snapshot` y `customer_phone_snapshot` correspondientes al registro, y que un `POST /api/orders` sin sesión devuelve 401. Confirmar que aparece en el panel del vendedor antes de aceptar pedidos reales.

El código de vinculación dura 30 minutos y se usa una sola vez. No debe enviarse por un canal público. Los clientes que ya tienen `auth_user_id` pueden iniciar sesión directamente; los demás requieren vinculación. Los pedidos antiguos con `customer_id` nulo quedan como histórico, sin asignarse automáticamente a nadie.
