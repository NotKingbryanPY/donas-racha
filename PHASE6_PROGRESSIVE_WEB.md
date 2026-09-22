# Donas Racha — fase 6: migración progresiva de lecturas

## Primera lectura migrada

El ranking público usa `GET /api/ranking`, respaldado por PostgreSQL. Mantiene la misma forma de datos que Apps Script para no reescribir la interfaz.

La web conserva un retorno inmediato:

```text
Supabase/Vercel responde -> usar ranking nuevo
Supabase/Vercel falla    -> consultar Apps Script
```

Agregar `?backend=legacy` a la URL desactiva las lecturas nuevas para esa sesión de página sin redesplegar. Agregar `?compareReads=1` activa una comparación en segundo plano y registra únicamente tipo, coincidencia y cantidades; no registra nombres, IDs ni teléfonos.

## Banderas

`assets/js/feature-flags.js` define:

- `useSupabaseRanking: true`;
- `useSupabaseProducts: true`;
- `useSupabaseUserLookup: false`;
- `compareLegacyReads: false` salvo parámetro de diagnóstico.

Productos se precargan desde Supabase para la siguiente fase. El perfil por ID continúa en Apps Script: conocer un ID o QR no autentica al titular. Se activará cuando la web tenga una sesión Supabase vinculada mediante el flujo seguro de reclamación de cuenta.

## Modelo de lectura

`loyalty_accounts` incorpora `purchase_count` y `redemption_count`, preservados desde Sheets. La función `api_public_ranking` acepta cinco órdenes, limita la respuesta a 100 filas y solo puede ejecutarse con `service_role` desde Vercel.

## Reversión

1. Usar `?backend=legacy` para retorno inmediato del navegador.
2. Cambiar `useSupabaseRanking` a `false` para un retorno global.
3. Aplicar `supabase/rollback/202609220002_web_read_models_down.sql` únicamente si también se retira el endpoint nuevo.

Google Sheets y Apps Script continúan operativos.
