# Instalación y comprobación de fase 3

Aplicar `202609210001_auth_roles_and_rls.sql` después de las tres migraciones de fase 2. La migración añade dos tablas, tres claves foráneas, cuatro funciones y políticas RLS; no crea usuarios ni modifica clientes existentes.

## Comprobación

```sql
select count(*) as phase3_tables
from pg_tables
where schemaname = 'public'
  and tablename in ('app_user_roles', 'customer_claim_tokens');

select count(*) as phase3_functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_user_is_admin',
    'current_customer_id',
    'issue_customer_claim_token',
    'claim_customer_account'
  );

select count(*) as policies
from pg_policies
where schemaname = 'public';
```

Resultados esperados: `phase3_tables = 2`, `phase3_functions = 4` y `policies = 38`.

## Estado seguro inicial

- Sin una fila `ADMIN` en `app_user_roles`, nadie obtiene permisos administrativos.
- Sin vinculación, un usuario Auth no puede leer un cliente.
- `anon` solo puede leer catálogos activos.
- No se debe crear el primer admin hasta decidir qué cuenta Auth pertenece al propietario.

## Reversión

`supabase/rollback/202609210001_phase3_down.sql` elimina únicamente las políticas, funciones, tablas y claves foráneas de esta fase. No elimina usuarios Auth ni borra clientes. Si ya existen vínculos, los UUID permanecen en `customers.auth_user_id`, aunque se retira temporalmente su FK.

