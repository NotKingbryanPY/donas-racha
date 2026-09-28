# Acceso de vendedores

El rol `SELLER` permite iniciar sesión con Supabase Auth en la web, registrar clientes y compras, consultar perfiles por ID/nombre y atender pedidos hasta cobro y entrega. El panel de vendedor muestra pedidos; inventario, configuración, ajustes de puntos/rachas y códigos de contraseña siguen reservados a `ADMIN`. La sincronización Android continúa requiriendo `ADMIN`.

## Publicación

En el SQL Editor del proyecto productivo, ejecutar **por separado y en este orden**:

1. `supabase/migrations/202609280001_seller_role.sql` (añade el valor al enum `app_role`).
2. `supabase/migrations/202609280002_seller_orders.sql` (acepta vendedores al completar pedidos y registra correctamente quién los atendió).

Después de verificar los dos resultados exitosos, publicar la web/API. No asignar cuentas de vendedor antes del segundo SQL: podrían iniciar sesión, pero el cierre de pedidos seguiría rechazándolas. Las migraciones son aditivas y mantienen el acceso de administradores.

## Alta de cuentas

Crear cada cuenta en **Authentication → Users** con su correo. La contraseña la establece el propietario o el vendedor en el flujo de Auth; no escribirla en SQL ni enviarla por chat. Con la lista definitiva de correos, ejecutar en el SQL Editor:

```sql
do $$
declare v_email text; v_user_id uuid;
begin
  for v_email in select email from (values
    ('vendedor1@ejemplo.com'),
    ('vendedor2@ejemplo.com')
  ) as vendedores(email) loop
    select id into v_user_id from auth.users where lower(email)=lower(trim(v_email));
    if v_user_id is null then
      raise exception 'No existe en Authentication → Users: %', v_email;
    end if;
    insert into public.app_user_roles(auth_user_id,role)
      values(v_user_id,'SELLER') on conflict(auth_user_id,role) do nothing;
  end loop;
end $$;
```

Reemplazar los correos de ejemplo antes de ejecutar. Si alguno falta, el bloque entero falla y no concede roles a nadie; se puede corregir y reintentar. El rol `ADMIN` de una cuenta existente no se elimina automáticamente.

Verificación:

```sql
select u.email, r.role, r.granted_at
from public.app_user_roles r join auth.users u on u.id=r.auth_user_id
where r.role='SELLER'
order by u.email;
```

No conceder `ADMIN` a vendedores para abrirles el panel. El backend comprueba el rol de cada petición; ocultar controles de la interfaz no sustituye esa comprobación. Para quitar el acceso de vendedor a una cuenta: `delete from public.app_user_roles where auth_user_id = (select id from auth.users where lower(email)=lower('correo@ejemplo.com')) and role='SELLER';`.

Pruebas locales: `node tests/seller-role-postgres.mjs`, `node tests/full-supabase-backend.cjs`, `node tests/admin-login-six-digit.cjs` y `node tests/seller-panel.cjs` con servidor estático de pruebas. No se han creado cuentas ni asignado roles de vendedores en producción durante estas pruebas.
