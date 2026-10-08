# Recuperar el paquete SQL 02 tras el error de Studio

El error enviado se corta al terminar el `WHERE` de `api_unregister_push_device`. Faltaban el `return`, el cierre `end; $$;` y las migraciones posteriores. El archivo original tenía 609 líneas; no basta con completar esa función a mano. El texto `ALTER TABLE donas_cutover_before ENABLE ROW LEVEL SECURITY` fue añadido por Studio para una tabla temporal que se eliminaba al hacer commit.

La copia actualizada conserva la misma transacción y siete migraciones. Guarda la comparación de inventario en una variable de transacción, evitando crear esa tabla temporal. Todas las tablas privadas reales siguen con RLS activado y sus permisos limitados. No se modifican semillas, usuarios ni puntos.

## 1. Comprobar qué quedó instalado

En PowerShell, copia el archivo completo al portapapeles:

```powershell
Get-Content -LiteralPath 'C:\Users\Administrator\Documents\ChatGPT\Donas racha y Donas contral\supabase\sql-editor\phase18\02_check_after_error.sql' -Raw | Set-Clipboard
```

En SQL Editor del proyecto `yopntnzhcfudaabudbld`, crea una consulta, pega el contenido y ejecuta todo. `ROLLBACK` cancela únicamente una transacción pendiente de esa conexión; no revierte datos ya confirmados. El resto de la consulta lee el esquema, sin consultar clientes ni credenciales.

| `status` devuelto | Acción |
|---|---|
| `READY_TO_RETRY_FULL_02` | No aparecen los objetos nuevos ni las columnas de conversión. Se puede reintentar el paquete completo; sus guardas revisan también el contrato y los permisos antes de cambiar datos. |
| `OBJECTS_PRESENT_DO_NOT_REPEAT_02_RUN_05` | Los objetos principales están presentes. Ejecutar 05 para comprobar integridad y funciones; no repetir 02. Este estado por sí solo no demuestra que cada RPC esté correcto. |
| `STOP_PARTIAL_STATE_EXPORT_00` | Hay señales de instalación parcial. Compartir el resultado y ejecutar 00 para inspeccionar el esquema antes de continuar. |

## 2. Reintentar solamente si corresponde

Conserva el respaldo y realiza el cambio en una ventana breve sin ventas ni conteos. Revisa las colas de teléfonos que aún no hayan sincronizado.

Si el estado fue `READY_TO_RETRY_FULL_02`, copia la versión actualizada:

```powershell
Get-Content -LiteralPath 'C:\Users\Administrator\Documents\ChatGPT\Donas racha y Donas contral\supabase\sql-editor\phase18\02_apply_missing_20261008.sql' -Raw | Set-Clipboard
```

Dentro del editor SQL, reemplaza el texto completo de la consulta con el portapapeles. Comprueba que al final está:

```sql
-- END DONAS_APPLY_02_COMPLETE
```

Ejecuta la consulta completa. Debe devolver `status = APPLIED`. Si aparece un error o `STOP_*`, conserva el error y vuelve al diagnóstico del paso 1; no repitas el paquete sin comprobar el estado.

## 3. Continuación

Después de `APPLIED`, ejecutar `03_firebase_identity_bridge.sql`, opcionalmente `04_optional_realtime.sql`, y finalmente `05_verify_export.sql`. Los archivos 06/07 son de cierre de acceso; no son pasos de instalación. Comparte el resultado de 05 antes de desplegar la API/web actualizada.

La vista previa aportada por el usuario mantiene `availability_delta=0` en los cuatro sabores. Chocolate con chispas conserva un déficit de dos unidades reservadas y se marcará pendiente de conciliación (`counted=false`); requiere un conteo físico real o una resolución explícita de esos pedidos. No se inventa stock para eliminar el aviso.

## Validación ejecutada

`tests/preflight-cutover-postgres.mjs` reprodujo el corte exacto y el error 42601, comprobó el diagnóstico después del error, y verificó rollback tras un fallo tardío durante la ejecución. El archivo actualizado completo pasó conservando disponibilidad, reservas, pedidos, cobros y puntos. El diagnóstico distingue una instalación presente y el paquete rechaza su repetición. Pruebas aisladas PGlite; aún falta comprobar el estado del proyecto real.
