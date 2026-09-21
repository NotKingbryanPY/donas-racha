# Donas Racha — seguridad y autenticación

## Modelo de identidad

Supabase Auth representa a la persona autenticada en `auth.users`. `customers` representa al cliente del negocio y conserva el ID público heredado. La relación se establece con `customers.auth_user_id`, que es única y puede ser nula durante la migración.

Solo existen dos roles en esta fase:

- `CUSTOMER`: cliente vinculado a un registro de negocio.
- `ADMIN`: operador con acceso completo al dominio actual.

No se crean todavía los roles `SELLER` ni `PARTNER`. Se añadirán únicamente cuando Dona Control o los flujos operativos demuestren que necesitan permisos distintos.

## Vinculación segura de clientes existentes

Conocer un ID público, teléfono o QR no permite reclamar una cuenta. La vinculación usa un token aleatorio de 256 bits, guardado únicamente como SHA-256, válido entre 5 minutos y 24 horas y utilizable una sola vez.

1. Un administrador autenticado genera el token para un cliente todavía no vinculado mediante `issue_customer_claim_token`.
2. El token se entrega al titular por un canal controlado. La base solo guarda su hash.
3. El cliente inicia sesión mediante Supabase Auth y llama `claim_customer_account` con el token.
4. La función bloquea la fila, confirma vigencia, enlaza `auth.uid()` y consume el token dentro de la misma transacción.
5. Un usuario, token o cliente ya vinculado no puede reutilizarse.

La API de fase 4 deberá limitar intentos y registrar correlación sin guardar el token. Los tokens no deben aparecer en URLs, logs o analítica.

## Matriz de acceso

| Recurso | Anónimo | Cliente autenticado | Admin autenticado |
|---|---|---|---|
| Niveles, insignias, recompensas activas | Lectura | Lectura | Administración |
| Productos, variantes y retiros activos | Lectura | Lectura | Administración |
| Perfil del cliente | Ninguno | Solo propio | Todos |
| Saldo, libro de puntos, racha e insignias | Ninguno | Solo propios | Todos |
| Canjes | Ninguno | Solo propios | Administración |
| Pedidos, items, eventos y pagos | Ninguno | Solo pedidos propios | Administración |
| Alias, tokens de vinculación | Ninguno | Ninguno | Administración |
| Roles | Ninguno | Solo roles propios | Administración |

Los clientes no tienen escritura directa sobre pedidos, precios, puntos, roles, pagos o canjes. Esas operaciones se implementarán como transacciones validadas del lado servidor en la fase 4.

## Controles implementados

- RLS permanece activo en todas las tablas públicas.
- `anon` solo recibe `SELECT` sobre catálogos activos.
- `authenticated` recibe privilegios SQL, pero cada operación sigue limitada por políticas RLS.
- Las funciones auxiliares son `SECURITY DEFINER`, tienen `search_path` vacío y usan nombres totalmente calificados.
- Las funciones sensibles no pueden ejecutarse como `anon`.
- Las referencias a `auth.users` usan `ON DELETE SET NULL` para conservar historia de negocio; los roles se eliminan con la cuenta Auth.
- La asignación de `ADMIN` no se deriva de metadatos editables por el usuario.
- No se añade ninguna clave `service_role` al navegador, Android o repositorio.

## Amenazas y mitigaciones

| Amenaza | Mitigación actual | Trabajo posterior |
|---|---|---|
| Un usuario conoce el ID/QR de otra persona | El ID y QR no autentican; se exige sesión y token de un uso | Entrega controlada y rate limiting en fase 4 |
| Lectura cruzada entre clientes | Políticas comparan el cliente enlazado con `auth.uid()` | Pruebas remotas antes de activar la web |
| Cliente se concede rol admin | No existe política de inserción propia en roles | Administración de roles solo por flujo privilegiado |
| Cliente modifica saldo o precio | No hay políticas de escritura para clientes | Funciones transaccionales en fase 4 |
| Token robado o filtrado | 256 bits, hash, expiración y un solo uso | Evitar URL/logs; revocación operativa |
| `service_role` expuesta | No se usa en frontend; solo backend futuro | Secretos en entorno de servidor |
| Ranking filtra WhatsApp | No existe política pública sobre clientes | Crear proyección pública mínima en fase 4 |
| Borrado de cuenta destruye historia | Enlaces históricos usan `SET NULL` o negocio separado | Definir política de retención y anonimización |

## Bootstrap del primer administrador

El primer administrador requiere una cuenta creada en Supabase Auth y una inserción manual controlada. No se debe usar correo o ID público como prueba de rol.

```sql
insert into public.app_user_roles (auth_user_id, role)
values ('UUID_DE_AUTH_USERS', 'ADMIN');
```

Este paso se hace una sola vez desde SQL Editor por el propietario. Los administradores posteriores deberán gestionarse mediante una operación auditada del backend.

## Límites de esta fase

La web actual sigue usando Apps Script y no inicia sesión con Supabase. Las políticas quedan preparadas, pero no se activa tráfico de usuarios. No se crearon cuentas, no se migraron clientes y no se almacenaron secretos en GitHub.

