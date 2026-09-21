# Validación de fase 2

## Resultado local

Las tres migraciones se aplicaron sin modificar en un motor PostgreSQL embebido (PGlite): se crearon 18 tablas, todas reportaron RLS activo, se cargaron los cinco niveles y quedaron cero privilegios de tabla para `anon`/`authenticated`. Una inserción con `public_id` inválido fue rechazada. Después se ejecutó la reversión y quedaron cero tablas en `public`.

Además se ejecutó `tests/schema-contract.cjs`:

```text
PASS schema contract: 3 migrations, 18 tables, RLS closed by default
```

## Alcance validado

- Orden determinista de tres migraciones y una reversión.
- Todas las tablas usan PK y timestamps; las relaciones críticas tienen FK.
- UUID para entidades; `bigint identity` solo para la secuencia interna de eventos.
- Constraints para IDs, teléfonos E.164, valores monetarios, cantidades, saldos, estados terminales y metadatos JSON.
- Índices para IDs públicos, alias, historial, estado/fecha, cliente/fecha, producto y pedido.
- RLS habilitado y permisos revocados a `anon`/`authenticated` hasta fase 3.
- Datos de referencia alineados con `Code.gs`: cinco niveles, seis insignias y cinco recompensas.
- Script de reversión en orden inverso de dependencias.

## Validación externa pendiente

No había un proyecto Supabase de desarrollo conectado durante esta fase. Por eso no se declara una ejecución real de `supabase db reset` en la plataforma. Antes de aprobar el uso del esquema fuera del repositorio se debe aplicar en una base Supabase vacía y ejecutar:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select key, minimum_lifetime_points
from public.loyalty_levels
order by display_order;
```

El primer resultado debe mostrar RLS activo en las 18 tablas; el segundo debe devolver los cinco niveles actuales. Las políticas de acceso no se añaden hasta fase 3.

