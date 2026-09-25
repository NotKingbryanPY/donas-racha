# Corte definitivo a Supabase

La web opera con Supabase mediante las funciones `/api/*` de Vercel. Vercel valida las sesiones y guarda la clave de servicio en el servidor; el navegador nunca recibe esa clave. Clientes entran con su ID y contraseña opcional; vendedores/administradores entran con el correo y contraseña de Supabase. Las altas, compras liquidadas, puntos, rachas, insignias, canjes, pedidos, estadísticas y configuración se leen o escriben en Supabase. El código de Apps Script queda solo como fuente histórica para una exportación final.

## Antes de publicar

1. Respaldar el proyecto Supabase y las hojas. Aplicar `supabase/migrations/202609250003_supabase_loyalty_cutover.sql` en un proyecto de prueba primero y luego en producción. La migración crea las funciones transaccionales y los ajustes; no importa clientes ni modifica Apps Script.
2. Detener nuevas escrituras en Google Sheets (altas, compras y canjes) durante el corte. Mantener la web antigua sin publicitar nuevos pedidos. Exportar inmediatamente con `exportPhase5MigrationData()` desde el proyecto Apps Script original y descargar el JSON privado. La exportación del 22 de septiembre no sirve: faltan los clientes recientes. La exportación final debe tener menos de 24 horas.
3. En esta carpeta ejecutar:

   ```powershell
   node scripts/phase17-cutover.mjs --input "C:\ruta\al\export-reciente.json" --report "C:\ruta\privada\cutover-report.json" --sql-out "C:\ruta\privada\cutover.sql"
   ```

   Revisar `blockingErrors = 0`, cantidad de clientes, transacciones, canjes y fecha del export. No colocar el JSON, reporte ni SQL generado en Git; contienen datos personales.
4. Ejecutar el SQL generado en el SQL Editor del proyecto Supabase correcto. Es una transacción: si detecta IDs que pertenecen a otra cuenta, actividad de puntos nueva en Supabase/Android o pedidos liquidados después del export, se revierte entera. **No eliminar esos guardas**. Conciliar esa actividad y crear otro export antes de reintentar. El script conserva pedidos, vínculos de sesión y contraseñas opcionales; reemplaza solo los datos heredados de Sheets para los clientes del export.
5. Comprobar en Supabase que el ID registrado el día del fallo está en `public.customers` con `status = 'ACTIVE'`, que tiene fila en `loyalty_accounts` y `customer_streaks`, y que saldos, compras y canjes coinciden con la última hoja. Comprobar otros clientes representativos y el total de clientes. El panel mostrará migración completada después del SQL.
6. Desplegar la rama web después de la comprobación. Probar alta de un cliente de prueba, ingreso por ID, perfil, compra liquidada por vendedor, canje, pedido, pago presencial y finalización. Una orden pendiente no acredita puntos; la finalización pagada sí, como máximo una vez por día. Verificar el correo administrador ya configurado en Supabase; la antigua contraseña compartida de Sheets deja de autenticar.
7. Restringir o retirar la implementación web antigua de Apps Script. Hasta entonces, aunque la nueva web ya no la llama, la URL antigua sigue respondiendo y puede divulgar IDs y perfiles. Conservar el JSON y respaldo de Sheets fuera del repositorio para auditoría y recuperación.

El exportador de fase 5 no incluye la hoja `Config`. Se consultaron los valores públicos actuales de `getConfig`: modo diario, tolerancia 3 días, precio B/.1.00 y puntos 10/12/15/17; son los valores iniciales de `business_settings`. Antes de publicar, confirmar que no cambiaron durante el corte y ajustar la configuración desde el panel Supabase si hace falta. `COMPRAS_RECOMPENSA=5` es una clave heredada: el código actual de compras no la usa para entregar premios automáticos; los canjes por puntos permanecen disponibles.

Las pruebas locales cubren `tests/phase17-postgres.sql` en PostgreSQL 18 desechable y `tests/phase17-cutover.cjs`. Falta la ejecución en Supabase productivo con el export final y una prueba real de vendedor/cliente. No publicar a medias: desplegar la nueva web antes del import haría que IDs recientes siguieran fallando.
