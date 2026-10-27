# Catálogo SQL local

Declaraciones en migraciones ordenadas por nombre. **No es un esquema materializado ni una inspección de producción.** ALTER/rename/drop pueden cambiar estos objetos; consultar el historial completo y DATABASE.md.

[Modelo explicado](../DATABASE.md)

## 202609200001_core_customers_loyalty.sql

[supabase/migrations/202609200001_core_customers_loyalty.sql:L1](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L1)

### Tabla `customers`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L11](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L11) |
| `public_id` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L12](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L12) |
| `auth_user_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L13](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L13) |
| `display_name` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L14](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L14) |
| `whatsapp_e164` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L15](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L15) |
| `status` | `public.customer_status` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L16](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L16) |
| `registered_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L17](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L17) |
| `last_purchase_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L18](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L18) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L19](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L19) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L20](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L20) |

### Tabla `customer_aliases`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L30](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L30) |
| `customer_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L31](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L31) |
| `alias_type` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L32](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L32) |
| `alias_value` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L33](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L33) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L34](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L34) |

### Tabla `loyalty_levels`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `key` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L43](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L43) |
| `name` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L44](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L44) |
| `emoji` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L45](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L45) |
| `minimum_lifetime_points` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L46](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L46) |
| `display_order` | `smallint` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L47](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L47) |
| `active` | `boolean` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L48](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L48) |

### Tabla `loyalty_accounts`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `customer_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L55](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L55) |
| `available_points` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L56](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L56) |
| `lifetime_points` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L57](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L57) |
| `purchase_points` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L58](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L58) |
| `level_key` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L59](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L59) |
| `version` | `bigint` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L60](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L60) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L61](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L61) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L62](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L62) |

### Tabla `loyalty_transactions`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L71](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L71) |
| `customer_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L72](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L72) |
| `entry_type` | `public.loyalty_entry_type` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L73](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L73) |
| `points_delta` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L74](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L74) |
| `balance_after` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L75](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L75) |
| `idempotency_key` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L76](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L76) |
| `source_system` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L77](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L77) |
| `source_id` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L78](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L78) |
| `description` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L79](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L79) |
| `metadata` | `jsonb` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L80](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L80) |
| `occurred_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L81](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L81) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L82](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L82) |

### Tabla `customer_streaks`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `customer_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L96](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L96) |
| `current_count` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L97](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L97) |
| `best_count` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L98](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L98) |
| `current_season_number` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L99](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L99) |
| `last_qualified_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L100](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L100) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L101](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L101) |

### Tabla `streak_seasons`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L108](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L108) |
| `customer_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L109](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L109) |
| `season_number` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L110](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L110) |
| `started_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L111](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L111) |
| `ended_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L112](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L112) |
| `completed_streak` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L113](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L113) |
| `milestones` | `integer[]` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L114](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L114) |
| `preserved_points` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L115](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L115) |
| `preserved_level_key` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L116](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L116) |
| `status` | `public.streak_season_status` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L117](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L117) |
| `source_system` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L118](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L118) |
| `source_id` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L119](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L119) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L120](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L120) |

### Tabla `badges`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L134](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L134) |
| `key` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L135](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L135) |
| `name` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L136](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L136) |
| `emoji` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L137](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L137) |
| `condition_type` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L138](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L138) |
| `condition_threshold` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L139](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L139) |
| `description` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L140](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L140) |
| `display_order` | `smallint` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L141](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L141) |
| `active` | `boolean` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L142](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L142) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L143](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L143) |

### Tabla `customer_badges`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `customer_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L151](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L151) |
| `badge_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L152](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L152) |
| `awarded_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L153](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L153) |
| `source_system` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L154](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L154) |
| `source_id` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L155](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L155) |

### Tabla `rewards`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L163](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L163) |
| `key` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L164](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L164) |
| `name` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L165](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L165) |
| `emoji` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L166](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L166) |
| `points_cost` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L167](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L167) |
| `reward_type` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L168](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L168) |
| `reward_value` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L169](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L169) |
| `description` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L170](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L170) |
| `display_order` | `smallint` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L171](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L171) |
| `active` | `boolean` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L172](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L172) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L173](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L173) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L174](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L174) |

### Tabla `reward_redemptions`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L184](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L184) |
| `public_code` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L185](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L185) |
| `customer_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L186](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L186) |
| `reward_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L187](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L187) |
| `loyalty_transaction_id` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L188](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L188) |
| `points_cost_snapshot` | `integer` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L189](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L189) |
| `reward_name_snapshot` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L190](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L190) |
| `status` | `public.redemption_status` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L191](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L191) |
| `idempotency_key` | `uuid` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L192](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L192) |
| `source_system` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L193](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L193) |
| `source_id` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L194](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L194) |
| `notes` | `text` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L195](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L195) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L196](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L196) |
| `fulfilled_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L197](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L197) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200001_core_customers_loyalty.sql:L198](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L198) |

- index `customer_aliases_customer_idx` — [supabase/migrations/202609200001_core_customers_loyalty.sql:L40](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L40)
- index `loyalty_transactions_customer_time_idx` — [supabase/migrations/202609200001_core_customers_loyalty.sql:L91](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L91)
- index `loyalty_transactions_occurred_at_idx` — [supabase/migrations/202609200001_core_customers_loyalty.sql:L93](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L93)
- index `customer_badges_awarded_at_idx` — [supabase/migrations/202609200001_core_customers_loyalty.sql:L160](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L160)
- index `rewards_active_order_idx` — [supabase/migrations/202609200001_core_customers_loyalty.sql:L181](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L181)
- index `reward_redemptions_customer_time_idx` — [supabase/migrations/202609200001_core_customers_loyalty.sql:L207](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L207)
- index `reward_redemptions_status_time_idx` — [supabase/migrations/202609200001_core_customers_loyalty.sql:L209](../../../supabase/migrations/202609200001_core_customers_loyalty.sql#L209)

## 202609200002_catalog_orders.sql

[supabase/migrations/202609200002_catalog_orders.sql:L1](../../../supabase/migrations/202609200002_catalog_orders.sql#L1)

### Tabla `products`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L9](../../../supabase/migrations/202609200002_catalog_orders.sql#L9) |
| `slug` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L10](../../../supabase/migrations/202609200002_catalog_orders.sql#L10) |
| `name` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L11](../../../supabase/migrations/202609200002_catalog_orders.sql#L11) |
| `description` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L12](../../../supabase/migrations/202609200002_catalog_orders.sql#L12) |
| `image_url` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L13](../../../supabase/migrations/202609200002_catalog_orders.sql#L13) |
| `active` | `boolean` | [supabase/migrations/202609200002_catalog_orders.sql:L14](../../../supabase/migrations/202609200002_catalog_orders.sql#L14) |
| `display_order` | `smallint` | [supabase/migrations/202609200002_catalog_orders.sql:L15](../../../supabase/migrations/202609200002_catalog_orders.sql#L15) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L16](../../../supabase/migrations/202609200002_catalog_orders.sql#L16) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L17](../../../supabase/migrations/202609200002_catalog_orders.sql#L17) |

### Tabla `product_variants`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L26](../../../supabase/migrations/202609200002_catalog_orders.sql#L26) |
| `product_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L27](../../../supabase/migrations/202609200002_catalog_orders.sql#L27) |
| `sku` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L28](../../../supabase/migrations/202609200002_catalog_orders.sql#L28) |
| `name` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L29](../../../supabase/migrations/202609200002_catalog_orders.sql#L29) |
| `unit_price_cents` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L30](../../../supabase/migrations/202609200002_catalog_orders.sql#L30) |
| `currency_code` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L31](../../../supabase/migrations/202609200002_catalog_orders.sql#L31) |
| `active` | `boolean` | [supabase/migrations/202609200002_catalog_orders.sql:L32](../../../supabase/migrations/202609200002_catalog_orders.sql#L32) |
| `display_order` | `smallint` | [supabase/migrations/202609200002_catalog_orders.sql:L33](../../../supabase/migrations/202609200002_catalog_orders.sql#L33) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L34](../../../supabase/migrations/202609200002_catalog_orders.sql#L34) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L35](../../../supabase/migrations/202609200002_catalog_orders.sql#L35) |

### Tabla `pickup_locations`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L47](../../../supabase/migrations/202609200002_catalog_orders.sql#L47) |
| `code` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L48](../../../supabase/migrations/202609200002_catalog_orders.sql#L48) |
| `name` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L49](../../../supabase/migrations/202609200002_catalog_orders.sql#L49) |
| `instructions` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L50](../../../supabase/migrations/202609200002_catalog_orders.sql#L50) |
| `active` | `boolean` | [supabase/migrations/202609200002_catalog_orders.sql:L51](../../../supabase/migrations/202609200002_catalog_orders.sql#L51) |
| `display_order` | `smallint` | [supabase/migrations/202609200002_catalog_orders.sql:L52](../../../supabase/migrations/202609200002_catalog_orders.sql#L52) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L53](../../../supabase/migrations/202609200002_catalog_orders.sql#L53) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L54](../../../supabase/migrations/202609200002_catalog_orders.sql#L54) |

### Tabla `orders`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L60](../../../supabase/migrations/202609200002_catalog_orders.sql#L60) |
| `public_code` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L61](../../../supabase/migrations/202609200002_catalog_orders.sql#L61) |
| `customer_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L62](../../../supabase/migrations/202609200002_catalog_orders.sql#L62) |
| `pickup_location_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L63](../../../supabase/migrations/202609200002_catalog_orders.sql#L63) |
| `status` | `public.order_status` | [supabase/migrations/202609200002_catalog_orders.sql:L64](../../../supabase/migrations/202609200002_catalog_orders.sql#L64) |
| `payment_method` | `public.payment_method` | [supabase/migrations/202609200002_catalog_orders.sql:L65](../../../supabase/migrations/202609200002_catalog_orders.sql#L65) |
| `payment_status` | `public.payment_status` | [supabase/migrations/202609200002_catalog_orders.sql:L66](../../../supabase/migrations/202609200002_catalog_orders.sql#L66) |
| `currency_code` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L67](../../../supabase/migrations/202609200002_catalog_orders.sql#L67) |
| `subtotal_cents` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L68](../../../supabase/migrations/202609200002_catalog_orders.sql#L68) |
| `discount_cents` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L69](../../../supabase/migrations/202609200002_catalog_orders.sql#L69) |
| `total_cents` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L70](../../../supabase/migrations/202609200002_catalog_orders.sql#L70) |
| `customer_name_snapshot` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L71](../../../supabase/migrations/202609200002_catalog_orders.sql#L71) |
| `customer_phone_snapshot` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L72](../../../supabase/migrations/202609200002_catalog_orders.sql#L72) |
| `customer_notes` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L73](../../../supabase/migrations/202609200002_catalog_orders.sql#L73) |
| `idempotency_key` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L74](../../../supabase/migrations/202609200002_catalog_orders.sql#L74) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L75](../../../supabase/migrations/202609200002_catalog_orders.sql#L75) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L76](../../../supabase/migrations/202609200002_catalog_orders.sql#L76) |
| `completed_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L77](../../../supabase/migrations/202609200002_catalog_orders.sql#L77) |
| `cancelled_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L78](../../../supabase/migrations/202609200002_catalog_orders.sql#L78) |

### Tabla `order_items`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L101](../../../supabase/migrations/202609200002_catalog_orders.sql#L101) |
| `order_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L102](../../../supabase/migrations/202609200002_catalog_orders.sql#L102) |
| `product_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L103](../../../supabase/migrations/202609200002_catalog_orders.sql#L103) |
| `product_variant_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L104](../../../supabase/migrations/202609200002_catalog_orders.sql#L104) |
| `product_name_snapshot` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L105](../../../supabase/migrations/202609200002_catalog_orders.sql#L105) |
| `variant_name_snapshot` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L106](../../../supabase/migrations/202609200002_catalog_orders.sql#L106) |
| `sku_snapshot` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L107](../../../supabase/migrations/202609200002_catalog_orders.sql#L107) |
| `quantity` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L108](../../../supabase/migrations/202609200002_catalog_orders.sql#L108) |
| `unit_price_cents` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L109](../../../supabase/migrations/202609200002_catalog_orders.sql#L109) |
| `line_total_cents` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L110](../../../supabase/migrations/202609200002_catalog_orders.sql#L110) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L111](../../../supabase/migrations/202609200002_catalog_orders.sql#L111) |

### Tabla `order_events`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `bigint` | [supabase/migrations/202609200002_catalog_orders.sql:L123](../../../supabase/migrations/202609200002_catalog_orders.sql#L123) |
| `order_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L124](../../../supabase/migrations/202609200002_catalog_orders.sql#L124) |
| `from_status` | `public.order_status` | [supabase/migrations/202609200002_catalog_orders.sql:L125](../../../supabase/migrations/202609200002_catalog_orders.sql#L125) |
| `to_status` | `public.order_status` | [supabase/migrations/202609200002_catalog_orders.sql:L126](../../../supabase/migrations/202609200002_catalog_orders.sql#L126) |
| `actor_type` | `public.order_actor_type` | [supabase/migrations/202609200002_catalog_orders.sql:L127](../../../supabase/migrations/202609200002_catalog_orders.sql#L127) |
| `actor_user_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L128](../../../supabase/migrations/202609200002_catalog_orders.sql#L128) |
| `note` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L129](../../../supabase/migrations/202609200002_catalog_orders.sql#L129) |
| `metadata` | `jsonb` | [supabase/migrations/202609200002_catalog_orders.sql:L130](../../../supabase/migrations/202609200002_catalog_orders.sql#L130) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L131](../../../supabase/migrations/202609200002_catalog_orders.sql#L131) |

### Tabla `payments`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L139](../../../supabase/migrations/202609200002_catalog_orders.sql#L139) |
| `order_id` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L140](../../../supabase/migrations/202609200002_catalog_orders.sql#L140) |
| `method` | `public.payment_method` | [supabase/migrations/202609200002_catalog_orders.sql:L141](../../../supabase/migrations/202609200002_catalog_orders.sql#L141) |
| `status` | `public.payment_status` | [supabase/migrations/202609200002_catalog_orders.sql:L142](../../../supabase/migrations/202609200002_catalog_orders.sql#L142) |
| `amount_cents` | `integer` | [supabase/migrations/202609200002_catalog_orders.sql:L143](../../../supabase/migrations/202609200002_catalog_orders.sql#L143) |
| `currency_code` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L144](../../../supabase/migrations/202609200002_catalog_orders.sql#L144) |
| `external_reference` | `text` | [supabase/migrations/202609200002_catalog_orders.sql:L145](../../../supabase/migrations/202609200002_catalog_orders.sql#L145) |
| `idempotency_key` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L146](../../../supabase/migrations/202609200002_catalog_orders.sql#L146) |
| `confirmed_by` | `uuid` | [supabase/migrations/202609200002_catalog_orders.sql:L147](../../../supabase/migrations/202609200002_catalog_orders.sql#L147) |
| `created_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L148](../../../supabase/migrations/202609200002_catalog_orders.sql#L148) |
| `confirmed_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L149](../../../supabase/migrations/202609200002_catalog_orders.sql#L149) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609200002_catalog_orders.sql:L150](../../../supabase/migrations/202609200002_catalog_orders.sql#L150) |

- index `products_active_order_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L23](../../../supabase/migrations/202609200002_catalog_orders.sql#L23)
- index `product_variants_product_active_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L44](../../../supabase/migrations/202609200002_catalog_orders.sql#L44)
- index `orders_customer_time_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L96](../../../supabase/migrations/202609200002_catalog_orders.sql#L96)
- index `orders_status_time_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L97](../../../supabase/migrations/202609200002_catalog_orders.sql#L97)
- index `orders_created_at_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L98](../../../supabase/migrations/202609200002_catalog_orders.sql#L98)
- index `order_items_order_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L119](../../../supabase/migrations/202609200002_catalog_orders.sql#L119)
- index `order_items_product_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L120](../../../supabase/migrations/202609200002_catalog_orders.sql#L120)
- index `order_events_order_time_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L136](../../../supabase/migrations/202609200002_catalog_orders.sql#L136)
- index `payments_order_time_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L160](../../../supabase/migrations/202609200002_catalog_orders.sql#L160)
- index `payments_status_time_idx` — [supabase/migrations/202609200002_catalog_orders.sql:L161](../../../supabase/migrations/202609200002_catalog_orders.sql#L161)

## 202609200003_reference_data_and_rls.sql

[supabase/migrations/202609200003_reference_data_and_rls.sql:L1](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L1)

- trigger `customers_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L14](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L14)
- trigger `loyalty_accounts_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L16](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L16)
- trigger `customer_streaks_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L18](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L18)
- trigger `rewards_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L20](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L20)
- trigger `products_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L22](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L22)
- trigger `product_variants_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L24](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L24)
- trigger `pickup_locations_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L26](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L26)
- trigger `orders_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L28](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L28)
- trigger `payments_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L30](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L30)
- trigger `reward_redemptions_set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L32](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L32)
- función `set_updated_at` — [supabase/migrations/202609200003_reference_data_and_rls.sql:L3](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L3)
- cambio/permisos `alter table` (`customers`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L80](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L80)
- cambio/permisos `alter table` (`customer_aliases`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L81](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L81)
- cambio/permisos `alter table` (`loyalty_levels`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L82](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L82)
- cambio/permisos `alter table` (`loyalty_accounts`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L83](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L83)
- cambio/permisos `alter table` (`loyalty_transactions`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L84](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L84)
- cambio/permisos `alter table` (`customer_streaks`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L85](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L85)
- cambio/permisos `alter table` (`streak_seasons`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L86](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L86)
- cambio/permisos `alter table` (`badges`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L87](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L87)
- cambio/permisos `alter table` (`customer_badges`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L88](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L88)
- cambio/permisos `alter table` (`rewards`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L89](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L89)
- cambio/permisos `alter table` (`reward_redemptions`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L90](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L90)
- cambio/permisos `alter table` (`products`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L91](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L91)
- cambio/permisos `alter table` (`product_variants`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L92](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L92)
- cambio/permisos `alter table` (`pickup_locations`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L93](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L93)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L94](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L94)
- cambio/permisos `alter table` (`order_items`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L95](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L95)
- cambio/permisos `alter table` (`order_events`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L96](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L96)
- cambio/permisos `alter table` (`payments`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L97](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L97)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L99](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L99)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609200003_reference_data_and_rls.sql:L100](../../../supabase/migrations/202609200003_reference_data_and_rls.sql#L100)

## 202609210001_auth_roles_and_rls.sql

[supabase/migrations/202609210001_auth_roles_and_rls.sql:L1](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L1)

### Tabla `app_user_roles`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `auth_user_id` | `uuid` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L21](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L21) |
| `role` | `public.app_role` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L22](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L22) |
| `granted_by` | `uuid` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L23](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L23) |
| `granted_at` | `timestamptz` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L24](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L24) |

### Tabla `customer_claim_tokens`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L31](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L31) |
| `customer_id` | `uuid` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L32](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L32) |
| `token_hash` | `bytea` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L33](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L33) |
| `expires_at` | `timestamptz` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L34](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L34) |
| `used_at` | `timestamptz` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L35](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L35) |
| `used_by` | `uuid` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L36](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L36) |
| `created_by` | `uuid` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L37](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L37) |
| `created_at` | `timestamptz` | [supabase/migrations/202609210001_auth_roles_and_rls.sql:L38](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L38) |

- index `app_user_roles_role_idx` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L28](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L28)
- index `customer_claim_tokens_expiry_idx` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L49](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L49)
- policy `public_read_active_levels` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L202](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L202)
- policy `public_read_active_badges` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L204](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L204)
- policy `public_read_active_rewards` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L206](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L206)
- policy `public_read_active_products` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L208](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L208)
- policy `public_read_active_variants` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L210](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L210)
- policy `public_read_active_pickup_locations` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L217](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L217)
- policy `customer_read_own_profile` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L220](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L220)
- policy `customer_read_own_loyalty_account` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L222](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L222)
- policy `customer_read_own_loyalty_transactions` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L224](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L224)
- policy `customer_read_own_streak` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L226](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L226)
- policy `customer_read_own_streak_seasons` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L228](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L228)
- policy `customer_read_own_badges` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L230](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L230)
- policy `customer_read_own_redemptions` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L232](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L232)
- policy `customer_read_own_orders` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L234](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L234)
- policy `customer_read_own_order_items` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L236](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L236)
- policy `customer_read_own_order_events` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L244](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L244)
- policy `customer_read_own_payments` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L252](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L252)
- policy `user_read_own_roles` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L260](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L260)
- policy `admin_manage_customers` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L263](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L263)
- policy `admin_manage_customer_aliases` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L265](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L265)
- policy `admin_manage_loyalty_levels` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L267](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L267)
- policy `admin_manage_loyalty_accounts` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L269](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L269)
- policy `admin_manage_loyalty_transactions` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L271](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L271)
- policy `admin_manage_customer_streaks` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L273](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L273)
- policy `admin_manage_streak_seasons` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L275](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L275)
- policy `admin_manage_badges` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L277](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L277)
- policy `admin_manage_customer_badges` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L279](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L279)
- policy `admin_manage_rewards` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L281](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L281)
- policy `admin_manage_reward_redemptions` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L283](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L283)
- policy `admin_manage_products` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L285](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L285)
- policy `admin_manage_product_variants` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L287](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L287)
- policy `admin_manage_pickup_locations` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L289](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L289)
- policy `admin_manage_orders` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L291](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L291)
- policy `admin_manage_order_items` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L293](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L293)
- policy `admin_manage_order_events` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L295](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L295)
- policy `admin_manage_payments` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L297](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L297)
- policy `admin_manage_user_roles` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L299](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L299)
- policy `admin_manage_claim_tokens` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L301](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L301)
- función `current_user_is_admin` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L53](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L53)
- función `current_customer_id` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L68](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L68)
- función `issue_customer_claim_token` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L82](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L82)
- función `claim_customer_account` — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L125](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L125)
- cambio/permisos `alter table` (`customers`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L8](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L8)
- cambio/permisos `alter table` (`order_events`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L12](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L12)
- cambio/permisos `alter table` (`payments`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L16](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L16)
- cambio/permisos `alter table` (`app_user_roles`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L182](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L182)
- cambio/permisos `alter table` (`customer_claim_tokens`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L183](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L183)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L185](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L185)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L186](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L186)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L187](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L187)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L188](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L188)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L189](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L189)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L191](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L191)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L192](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L192)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L193](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L193)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L194](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L194)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210001_auth_roles_and_rls.sql:L196](../../../supabase/migrations/202609210001_auth_roles_and_rls.sql#L196)

## 202609210002_api_transactions.sql

[supabase/migrations/202609210002_api_transactions.sql:L1](../../../supabase/migrations/202609210002_api_transactions.sql#L1)

### Tabla `api_rate_limits`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `key_hash` | `text` | [supabase/migrations/202609210002_api_transactions.sql:L20](../../../supabase/migrations/202609210002_api_transactions.sql#L20) |
| `bucket` | `text` | [supabase/migrations/202609210002_api_transactions.sql:L21](../../../supabase/migrations/202609210002_api_transactions.sql#L21) |
| `window_start` | `timestamptz` | [supabase/migrations/202609210002_api_transactions.sql:L22](../../../supabase/migrations/202609210002_api_transactions.sql#L22) |
| `request_count` | `integer` | [supabase/migrations/202609210002_api_transactions.sql:L23](../../../supabase/migrations/202609210002_api_transactions.sql#L23) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609210002_api_transactions.sql:L24](../../../supabase/migrations/202609210002_api_transactions.sql#L24) |

- index `api_rate_limits_updated_at_idx` — [supabase/migrations/202609210002_api_transactions.sql:L32](../../../supabase/migrations/202609210002_api_transactions.sql#L32)
- función `consume_api_rate_limit` — [supabase/migrations/202609210002_api_transactions.sql:L35](../../../supabase/migrations/202609210002_api_transactions.sql#L35)
- función `api_create_order` — [supabase/migrations/202609210002_api_transactions.sql:L78](../../../supabase/migrations/202609210002_api_transactions.sql#L78)
- función `api_transition_order` — [supabase/migrations/202609210002_api_transactions.sql:L230](../../../supabase/migrations/202609210002_api_transactions.sql#L230)
- función `api_record_order_payment` — [supabase/migrations/202609210002_api_transactions.sql:L275](../../../supabase/migrations/202609210002_api_transactions.sql#L275)
- cambio/permisos `alter table` (`customers`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L5](../../../supabase/migrations/202609210002_api_transactions.sql#L5)
- cambio/permisos `alter table` (`customers`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L6](../../../supabase/migrations/202609210002_api_transactions.sql#L6)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L8](../../../supabase/migrations/202609210002_api_transactions.sql#L8)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L9](../../../supabase/migrations/202609210002_api_transactions.sql#L9)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L12](../../../supabase/migrations/202609210002_api_transactions.sql#L12)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L15](../../../supabase/migrations/202609210002_api_transactions.sql#L15)
- cambio/permisos `alter table` (`api_rate_limits`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L31](../../../supabase/migrations/202609210002_api_transactions.sql#L31)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L33](../../../supabase/migrations/202609210002_api_transactions.sql#L33)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L327](../../../supabase/migrations/202609210002_api_transactions.sql#L327)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L328](../../../supabase/migrations/202609210002_api_transactions.sql#L328)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L329](../../../supabase/migrations/202609210002_api_transactions.sql#L329)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L330](../../../supabase/migrations/202609210002_api_transactions.sql#L330)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L332](../../../supabase/migrations/202609210002_api_transactions.sql#L332)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L333](../../../supabase/migrations/202609210002_api_transactions.sql#L333)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L334](../../../supabase/migrations/202609210002_api_transactions.sql#L334)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609210002_api_transactions.sql:L335](../../../supabase/migrations/202609210002_api_transactions.sql#L335)

## 202609220001_delivery_orders.sql

[supabase/migrations/202609220001_delivery_orders.sql:L1](../../../supabase/migrations/202609220001_delivery_orders.sql#L1)

- index `product_variants_available_idx` — [supabase/migrations/202609220001_delivery_orders.sql:L10](../../../supabase/migrations/202609220001_delivery_orders.sql#L10)
- función `api_create_order` — [supabase/migrations/202609220001_delivery_orders.sql:L33](../../../supabase/migrations/202609220001_delivery_orders.sql#L33)
- función `api_transition_order` — [supabase/migrations/202609220001_delivery_orders.sql:L191](../../../supabase/migrations/202609220001_delivery_orders.sql#L191)
- cambio/permisos `alter type` (`order_status`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L3](../../../supabase/migrations/202609220001_delivery_orders.sql#L3)
- cambio/permisos `alter table` (`product_variants`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L7](../../../supabase/migrations/202609220001_delivery_orders.sql#L7)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L14](../../../supabase/migrations/202609220001_delivery_orders.sql#L14)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L15](../../../supabase/migrations/202609220001_delivery_orders.sql#L15)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L24](../../../supabase/migrations/202609220001_delivery_orders.sql#L24)
- cambio/permisos `alter table` (`orders`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L25](../../../supabase/migrations/202609220001_delivery_orders.sql#L25)
- cambio/permisos `drop function` (`if`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L29](../../../supabase/migrations/202609220001_delivery_orders.sql#L29)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L249](../../../supabase/migrations/202609220001_delivery_orders.sql#L249)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220001_delivery_orders.sql:L252](../../../supabase/migrations/202609220001_delivery_orders.sql#L252)

## 202609220002_web_read_models.sql

[supabase/migrations/202609220002_web_read_models.sql:L1](../../../supabase/migrations/202609220002_web_read_models.sql#L1)

- index `loyalty_accounts_purchase_ranking_idx` — [supabase/migrations/202609220002_web_read_models.sql:L11](../../../supabase/migrations/202609220002_web_read_models.sql#L11)
- index `loyalty_accounts_points_ranking_idx` — [supabase/migrations/202609220002_web_read_models.sql:L13](../../../supabase/migrations/202609220002_web_read_models.sql#L13)
- index `loyalty_accounts_redemption_ranking_idx` — [supabase/migrations/202609220002_web_read_models.sql:L15](../../../supabase/migrations/202609220002_web_read_models.sql#L15)
- index `customer_streaks_ranking_idx` — [supabase/migrations/202609220002_web_read_models.sql:L17](../../../supabase/migrations/202609220002_web_read_models.sql#L17)
- función `api_public_ranking` — [supabase/migrations/202609220002_web_read_models.sql:L20](../../../supabase/migrations/202609220002_web_read_models.sql#L20)
- cambio/permisos `alter table` (`loyalty_accounts`; abrir SQL para objeto completo) — [supabase/migrations/202609220002_web_read_models.sql:L3](../../../supabase/migrations/202609220002_web_read_models.sql#L3)
- cambio/permisos `alter table` (`loyalty_accounts`; abrir SQL para objeto completo) — [supabase/migrations/202609220002_web_read_models.sql:L7](../../../supabase/migrations/202609220002_web_read_models.sql#L7)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220002_web_read_models.sql:L79](../../../supabase/migrations/202609220002_web_read_models.sql#L79)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220002_web_read_models.sql:L80](../../../supabase/migrations/202609220002_web_read_models.sql#L80)

## 202609220003_android_sync.sql

[supabase/migrations/202609220003_android_sync.sql:L1](../../../supabase/migrations/202609220003_android_sync.sql#L1)

### Tabla `app_devices`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609220003_android_sync.sql:L4](../../../supabase/migrations/202609220003_android_sync.sql#L4) |
| `auth_user_id` | `uuid` | [supabase/migrations/202609220003_android_sync.sql:L5](../../../supabase/migrations/202609220003_android_sync.sql#L5) |
| `device_public_id` | `uuid` | [supabase/migrations/202609220003_android_sync.sql:L6](../../../supabase/migrations/202609220003_android_sync.sql#L6) |
| `name` | `text` | [supabase/migrations/202609220003_android_sync.sql:L7](../../../supabase/migrations/202609220003_android_sync.sql#L7) |
| `platform` | `text` | [supabase/migrations/202609220003_android_sync.sql:L8](../../../supabase/migrations/202609220003_android_sync.sql#L8) |
| `app_version` | `text` | [supabase/migrations/202609220003_android_sync.sql:L9](../../../supabase/migrations/202609220003_android_sync.sql#L9) |
| `status` | `text` | [supabase/migrations/202609220003_android_sync.sql:L10](../../../supabase/migrations/202609220003_android_sync.sql#L10) |
| `last_seen_at` | `timestamptz` | [supabase/migrations/202609220003_android_sync.sql:L11](../../../supabase/migrations/202609220003_android_sync.sql#L11) |
| `created_at` | `timestamptz` | [supabase/migrations/202609220003_android_sync.sql:L12](../../../supabase/migrations/202609220003_android_sync.sql#L12) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609220003_android_sync.sql:L13](../../../supabase/migrations/202609220003_android_sync.sql#L13) |

### Tabla `sync_operations`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609220003_android_sync.sql:L23](../../../supabase/migrations/202609220003_android_sync.sql#L23) |
| `server_sequence` | `bigint` | [supabase/migrations/202609220003_android_sync.sql:L24](../../../supabase/migrations/202609220003_android_sync.sql#L24) |
| `device_id` | `uuid` | [supabase/migrations/202609220003_android_sync.sql:L25](../../../supabase/migrations/202609220003_android_sync.sql#L25) |
| `client_operation_id` | `uuid` | [supabase/migrations/202609220003_android_sync.sql:L26](../../../supabase/migrations/202609220003_android_sync.sql#L26) |
| `operation_type` | `text` | [supabase/migrations/202609220003_android_sync.sql:L27](../../../supabase/migrations/202609220003_android_sync.sql#L27) |
| `request_hash` | `text` | [supabase/migrations/202609220003_android_sync.sql:L28](../../../supabase/migrations/202609220003_android_sync.sql#L28) |
| `payload` | `jsonb` | [supabase/migrations/202609220003_android_sync.sql:L29](../../../supabase/migrations/202609220003_android_sync.sql#L29) |
| `occurred_at` | `timestamptz` | [supabase/migrations/202609220003_android_sync.sql:L30](../../../supabase/migrations/202609220003_android_sync.sql#L30) |
| `status` | `text` | [supabase/migrations/202609220003_android_sync.sql:L31](../../../supabase/migrations/202609220003_android_sync.sql#L31) |
| `attempts` | `integer` | [supabase/migrations/202609220003_android_sync.sql:L32](../../../supabase/migrations/202609220003_android_sync.sql#L32) |
| `error_code` | `text` | [supabase/migrations/202609220003_android_sync.sql:L33](../../../supabase/migrations/202609220003_android_sync.sql#L33) |
| `received_at` | `timestamptz` | [supabase/migrations/202609220003_android_sync.sql:L34](../../../supabase/migrations/202609220003_android_sync.sql#L34) |
| `applied_at` | `timestamptz` | [supabase/migrations/202609220003_android_sync.sql:L35](../../../supabase/migrations/202609220003_android_sync.sql#L35) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609220003_android_sync.sql:L36](../../../supabase/migrations/202609220003_android_sync.sql#L36) |

- index `app_devices_auth_user_idx` — [supabase/migrations/202609220003_android_sync.sql:L20](../../../supabase/migrations/202609220003_android_sync.sql#L20)
- index `sync_operations_pending_idx` — [supabase/migrations/202609220003_android_sync.sql:L48](../../../supabase/migrations/202609220003_android_sync.sql#L48)
- index `sync_operations_device_received_idx` — [supabase/migrations/202609220003_android_sync.sql:L50](../../../supabase/migrations/202609220003_android_sync.sql#L50)
- trigger `app_devices_set_updated_at` — [supabase/migrations/202609220003_android_sync.sql:L53](../../../supabase/migrations/202609220003_android_sync.sql#L53)
- trigger `sync_operations_set_updated_at` — [supabase/migrations/202609220003_android_sync.sql:L55](../../../supabase/migrations/202609220003_android_sync.sql#L55)
- función `api_push_sync_operations` — [supabase/migrations/202609220003_android_sync.sql:L61](../../../supabase/migrations/202609220003_android_sync.sql#L61)
- función `api_pull_orders_for_device` — [supabase/migrations/202609220003_android_sync.sql:L137](../../../supabase/migrations/202609220003_android_sync.sql#L137)
- cambio/permisos `alter table` (`app_devices`; abrir SQL para objeto completo) — [supabase/migrations/202609220003_android_sync.sql:L58](../../../supabase/migrations/202609220003_android_sync.sql#L58)
- cambio/permisos `alter table` (`sync_operations`; abrir SQL para objeto completo) — [supabase/migrations/202609220003_android_sync.sql:L59](../../../supabase/migrations/202609220003_android_sync.sql#L59)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220003_android_sync.sql:L168](../../../supabase/migrations/202609220003_android_sync.sql#L168)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220003_android_sync.sql:L169](../../../supabase/migrations/202609220003_android_sync.sql#L169)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220003_android_sync.sql:L170](../../../supabase/migrations/202609220003_android_sync.sql#L170)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220003_android_sync.sql:L171](../../../supabase/migrations/202609220003_android_sync.sql#L171)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609220003_android_sync.sql:L172](../../../supabase/migrations/202609220003_android_sync.sql#L172)

## 202609230001_android_event_types.sql

[supabase/migrations/202609230001_android_event_types.sql:L1](../../../supabase/migrations/202609230001_android_event_types.sql#L1)

- cambio/permisos `alter table` (`sync_operations`; abrir SQL para objeto completo) — [supabase/migrations/202609230001_android_event_types.sql:L3](../../../supabase/migrations/202609230001_android_event_types.sql#L3)
- cambio/permisos `alter table` (`sync_operations`; abrir SQL para objeto completo) — [supabase/migrations/202609230001_android_event_types.sql:L6](../../../supabase/migrations/202609230001_android_event_types.sql#L6)

## 202609250001_customer_only_delivery.sql

[supabase/migrations/202609250001_customer_only_delivery.sql:L1](../../../supabase/migrations/202609250001_customer_only_delivery.sql#L1)

- función `api_create_order` — [supabase/migrations/202609250001_customer_only_delivery.sql:L10](../../../supabase/migrations/202609250001_customer_only_delivery.sql#L10)
- cambio/permisos `alter function` (`api_create_order`; abrir SQL para objeto completo) — [supabase/migrations/202609250001_customer_only_delivery.sql:L5](../../../supabase/migrations/202609250001_customer_only_delivery.sql#L5)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250001_customer_only_delivery.sql:L7](../../../supabase/migrations/202609250001_customer_only_delivery.sql#L7)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250001_customer_only_delivery.sql:L53](../../../supabase/migrations/202609250001_customer_only_delivery.sql#L53)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250001_customer_only_delivery.sql:L55](../../../supabase/migrations/202609250001_customer_only_delivery.sql#L55)

## 202609250002_customer_id_access.sql

[supabase/migrations/202609250002_customer_id_access.sql:L1](../../../supabase/migrations/202609250002_customer_id_access.sql#L1)

### Tabla `customer_web_access`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `customer_id` | `uuid` | [supabase/migrations/202609250002_customer_id_access.sql:L4](../../../supabase/migrations/202609250002_customer_id_access.sql#L4) |
| `password_salt` | `text` | [supabase/migrations/202609250002_customer_id_access.sql:L5](../../../supabase/migrations/202609250002_customer_id_access.sql#L5) |
| `password_hash` | `text` | [supabase/migrations/202609250002_customer_id_access.sql:L6](../../../supabase/migrations/202609250002_customer_id_access.sql#L6) |
| `credential_version` | `integer` | [supabase/migrations/202609250002_customer_id_access.sql:L7](../../../supabase/migrations/202609250002_customer_id_access.sql#L7) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609250002_customer_id_access.sql:L8](../../../supabase/migrations/202609250002_customer_id_access.sql#L8) |

### Tabla `customer_password_tokens`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609250002_customer_id_access.sql:L17](../../../supabase/migrations/202609250002_customer_id_access.sql#L17) |
| `customer_id` | `uuid` | [supabase/migrations/202609250002_customer_id_access.sql:L18](../../../supabase/migrations/202609250002_customer_id_access.sql#L18) |
| `token_hash` | `bytea` | [supabase/migrations/202609250002_customer_id_access.sql:L19](../../../supabase/migrations/202609250002_customer_id_access.sql#L19) |
| `created_by` | `uuid` | [supabase/migrations/202609250002_customer_id_access.sql:L20](../../../supabase/migrations/202609250002_customer_id_access.sql#L20) |
| `created_at` | `timestamptz` | [supabase/migrations/202609250002_customer_id_access.sql:L21](../../../supabase/migrations/202609250002_customer_id_access.sql#L21) |
| `expires_at` | `timestamptz` | [supabase/migrations/202609250002_customer_id_access.sql:L22](../../../supabase/migrations/202609250002_customer_id_access.sql#L22) |
| `used_at` | `timestamptz` | [supabase/migrations/202609250002_customer_id_access.sql:L23](../../../supabase/migrations/202609250002_customer_id_access.sql#L23) |

- función `issue_customer_password_token` — [supabase/migrations/202609250002_customer_id_access.sql:L31](../../../supabase/migrations/202609250002_customer_id_access.sql#L31)
- función `api_set_customer_password` — [supabase/migrations/202609250002_customer_id_access.sql:L56](../../../supabase/migrations/202609250002_customer_id_access.sql#L56)
- función `api_create_order_by_customer_id` — [supabase/migrations/202609250002_customer_id_access.sql:L84](../../../supabase/migrations/202609250002_customer_id_access.sql#L84)
- cambio/permisos `alter table` (`customer_web_access`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L12](../../../supabase/migrations/202609250002_customer_id_access.sql#L12)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L13](../../../supabase/migrations/202609250002_customer_id_access.sql#L13)
- cambio/permisos `alter table` (`customer_password_tokens`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L28](../../../supabase/migrations/202609250002_customer_id_access.sql#L28)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L29](../../../supabase/migrations/202609250002_customer_id_access.sql#L29)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L53](../../../supabase/migrations/202609250002_customer_id_access.sql#L53)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L54](../../../supabase/migrations/202609250002_customer_id_access.sql#L54)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L81](../../../supabase/migrations/202609250002_customer_id_access.sql#L81)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L82](../../../supabase/migrations/202609250002_customer_id_access.sql#L82)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L117](../../../supabase/migrations/202609250002_customer_id_access.sql#L117)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250002_customer_id_access.sql:L119](../../../supabase/migrations/202609250002_customer_id_access.sql#L119)

## 202609250003_supabase_loyalty_cutover.sql

[supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L1](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L1)

### Tabla `business_settings`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `boolean` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L5](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L5) |
| `active` | `boolean` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L6](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L6) |
| `streak_tolerance_days` | `integer` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L7](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L7) |
| `donut_price_cents` | `integer` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L8](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L8) |
| `points_base` | `integer` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L9](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L9) |
| `points_streak_3` | `integer` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L10](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L10) |
| `points_streak_7` | `integer` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L11](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L11) |
| `points_streak_14` | `integer` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L12](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L12) |
| `legacy_imported_at` | `timestamptz` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L13](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L13) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L14](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L14) |

### Tabla `customer_registration_requests`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `idempotency_key` | `uuid` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L24](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L24) |
| `customer_id` | `uuid` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L25](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L25) |
| `requested_name` | `text` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L26](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L26) |
| `requested_whatsapp` | `text` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L27](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L27) |
| `created_at` | `timestamptz` | [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L28](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L28) |

- trigger `business_settings_set_updated_at` — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L20](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L20)
- trigger `orders_credit_loyalty_after_completion` — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L250](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L250)
- función `api_register_customer` — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L33](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L33)
- función `api_credit_purchase` — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L69](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L69)
- función `api_redeem_customer_reward` — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L183](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L183)
- función `api_business_stats` — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L223](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L223)
- función `credit_completed_order_loyalty` — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L240](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L240)
- cambio/permisos `alter table` (`business_settings`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L17](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L17)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L18](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L18)
- cambio/permisos `alter table` (`customer_registration_requests`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L30](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L30)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L31](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L31)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L253](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L253)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L254](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L254)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L255](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L255)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L256](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L256)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L257](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L257)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L258](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L258)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L259](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L259)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L260](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L260)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609250003_supabase_loyalty_cutover.sql:L261](../../../supabase/migrations/202609250003_supabase_loyalty_cutover.sql#L261)

## 202609260001_box_inventory.sql

[supabase/migrations/202609260001_box_inventory.sql:L1](../../../supabase/migrations/202609260001_box_inventory.sql#L1)

### Tabla `box_purchases`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L6](../../../supabase/migrations/202609260001_box_inventory.sql#L6) |
| `boxes` | `integer` | [supabase/migrations/202609260001_box_inventory.sql:L7](../../../supabase/migrations/202609260001_box_inventory.sql#L7) |
| `purchased_at` | `timestamptz` | [supabase/migrations/202609260001_box_inventory.sql:L8](../../../supabase/migrations/202609260001_box_inventory.sql#L8) |
| `source_operation_id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L9](../../../supabase/migrations/202609260001_box_inventory.sql#L9) |
| `created_by` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L10](../../../supabase/migrations/202609260001_box_inventory.sql#L10) |
| `created_at` | `timestamptz` | [supabase/migrations/202609260001_box_inventory.sql:L11](../../../supabase/migrations/202609260001_box_inventory.sql#L11) |

### Tabla `flavor_sales`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L14](../../../supabase/migrations/202609260001_box_inventory.sql#L14) |
| `variant_id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L15](../../../supabase/migrations/202609260001_box_inventory.sql#L15) |
| `quantity` | `integer` | [supabase/migrations/202609260001_box_inventory.sql:L16](../../../supabase/migrations/202609260001_box_inventory.sql#L16) |
| `source_operation_id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L17](../../../supabase/migrations/202609260001_box_inventory.sql#L17) |
| `order_id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L18](../../../supabase/migrations/202609260001_box_inventory.sql#L18) |
| `created_at` | `timestamptz` | [supabase/migrations/202609260001_box_inventory.sql:L19](../../../supabase/migrations/202609260001_box_inventory.sql#L19) |
| `reversed_at` | `timestamptz` | [supabase/migrations/202609260001_box_inventory.sql:L20](../../../supabase/migrations/202609260001_box_inventory.sql#L20) |

### Tabla `inventory_opening_counts`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `variant_id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L26](../../../supabase/migrations/202609260001_box_inventory.sql#L26) |
| `quantity` | `integer` | [supabase/migrations/202609260001_box_inventory.sql:L27](../../../supabase/migrations/202609260001_box_inventory.sql#L27) |
| `counted_at` | `timestamptz` | [supabase/migrations/202609260001_box_inventory.sql:L28](../../../supabase/migrations/202609260001_box_inventory.sql#L28) |

### Tabla `inventory_sync_gaps`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `operation_id` | `uuid` | [supabase/migrations/202609260001_box_inventory.sql:L31](../../../supabase/migrations/202609260001_box_inventory.sql#L31) |
| `created_at` | `timestamptz` | [supabase/migrations/202609260001_box_inventory.sql:L32](../../../supabase/migrations/202609260001_box_inventory.sql#L32) |

### Tabla `inventory_control`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `boolean` | [supabase/migrations/202609260001_box_inventory.sql:L35](../../../supabase/migrations/202609260001_box_inventory.sql#L35) |
| `enforce_orders` | `boolean` | [supabase/migrations/202609260001_box_inventory.sql:L36](../../../supabase/migrations/202609260001_box_inventory.sql#L36) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609260001_box_inventory.sql:L37](../../../supabase/migrations/202609260001_box_inventory.sql#L37) |

- view `inventory_by_flavor` — [supabase/migrations/202609260001_box_inventory.sql:L51](../../../supabase/migrations/202609260001_box_inventory.sql#L51)
- trigger `orders_record_flavor_sales` — [supabase/migrations/202609260001_box_inventory.sql:L85](../../../supabase/migrations/202609260001_box_inventory.sql#L85)
- función `record_completed_order_flavors` — [supabase/migrations/202609260001_box_inventory.sql:L74](../../../supabase/migrations/202609260001_box_inventory.sql#L74)
- función `api_set_physical_inventory_count` — [supabase/migrations/202609260001_box_inventory.sql:L88](../../../supabase/migrations/202609260001_box_inventory.sql#L88)
- función `api_create_order_by_customer_id` — [supabase/migrations/202609260001_box_inventory.sql:L122](../../../supabase/migrations/202609260001_box_inventory.sql#L122)
- función `api_push_sync_operations` — [supabase/migrations/202609260001_box_inventory.sql:L153](../../../supabase/migrations/202609260001_box_inventory.sql#L153)
- cambio/permisos `alter table` (`box_purchases`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L40](../../../supabase/migrations/202609260001_box_inventory.sql#L40)
- cambio/permisos `alter table` (`flavor_sales`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L41](../../../supabase/migrations/202609260001_box_inventory.sql#L41)
- cambio/permisos `alter table` (`inventory_opening_counts`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L42](../../../supabase/migrations/202609260001_box_inventory.sql#L42)
- cambio/permisos `alter table` (`inventory_sync_gaps`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L43](../../../supabase/migrations/202609260001_box_inventory.sql#L43)
- cambio/permisos `alter table` (`inventory_control`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L44](../../../supabase/migrations/202609260001_box_inventory.sql#L44)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L45](../../../supabase/migrations/202609260001_box_inventory.sql#L45)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L49](../../../supabase/migrations/202609260001_box_inventory.sql#L49)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L71](../../../supabase/migrations/202609260001_box_inventory.sql#L71)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L72](../../../supabase/migrations/202609260001_box_inventory.sql#L72)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L114](../../../supabase/migrations/202609260001_box_inventory.sql#L114)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L115](../../../supabase/migrations/202609260001_box_inventory.sql#L115)
- cambio/permisos `alter function` (`api_create_order_by_customer_id`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L118](../../../supabase/migrations/202609260001_box_inventory.sql#L118)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L120](../../../supabase/migrations/202609260001_box_inventory.sql#L120)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L148](../../../supabase/migrations/202609260001_box_inventory.sql#L148)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L149](../../../supabase/migrations/202609260001_box_inventory.sql#L149)
- cambio/permisos `alter function` (`api_push_sync_operations`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L151](../../../supabase/migrations/202609260001_box_inventory.sql#L151)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L152](../../../supabase/migrations/202609260001_box_inventory.sql#L152)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L209](../../../supabase/migrations/202609260001_box_inventory.sql#L209)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L210](../../../supabase/migrations/202609260001_box_inventory.sql#L210)
- cambio/permisos `alter publication` (`supabase_realtime`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L256](../../../supabase/migrations/202609260001_box_inventory.sql#L256)
- cambio/permisos `alter publication` (`supabase_realtime`; abrir SQL para objeto completo) — [supabase/migrations/202609260001_box_inventory.sql:L260](../../../supabase/migrations/202609260001_box_inventory.sql#L260)

## 202609270001_manual_inventory_and_completion.sql

[supabase/migrations/202609270001_manual_inventory_and_completion.sql:L1](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L1)

### Tabla `inventory_manual_counts`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `variant_id` | `uuid` | [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L4](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L4) |
| `quantity` | `integer` | [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L5](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L5) |
| `counted_at` | `timestamptz` | [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L6](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L6) |
| `counted_by` | `uuid` | [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L7](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L7) |

- view `inventory_by_flavor` — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L18](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L18)
- función `api_set_manual_inventory` — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L37](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L37)
- función `api_create_order_by_customer_id` — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L63](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L63)
- función `api_transition_order` — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L93](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L93)
- función `record_completed_order_flavors` — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L104](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L104)
- función `api_complete_paid_order` — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L116](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L116)
- cambio/permisos `alter table` (`inventory_manual_counts`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L9](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L9)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L10](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L10)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L11](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L11)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L60](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L60)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L61](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L61)
- cambio/permisos `alter function` (`api_transition_order`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L91](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L91)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L92](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L92)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L100](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L100)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L101](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L101)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L140](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L140)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270001_manual_inventory_and_completion.sql:L141](../../../supabase/migrations/202609270001_manual_inventory_and_completion.sql#L141)

## 202609270002_admin_loyalty_adjustments.sql

[supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L1](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L1)

### Tabla `loyalty_admin_adjustments`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L5](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L5) |
| `idempotency_key` | `uuid` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L6](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L6) |
| `customer_id` | `uuid` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L7](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L7) |
| `admin_user_id` | `uuid` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L8](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L8) |
| `kind` | `text` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L9](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L9) |
| `amount` | `integer` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L10](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L10) |
| `qualified_on` | `date` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L11](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L11) |
| `reason` | `text` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L12](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L12) |
| `before_state` | `jsonb` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L13](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L13) |
| `after_state` | `jsonb` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L14](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L14) |
| `created_at` | `timestamptz` | [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L15](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L15) |

- index `loyalty_admin_adjustments_customer_created_idx` — [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L17](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L17)
- función `api_admin_adjust_loyalty` — [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L23](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L23)
- cambio/permisos `alter table` (`loyalty_admin_adjustments`; abrir SQL para objeto completo) — [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L19](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L19)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L20](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L20)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L172](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L172)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270002_admin_loyalty_adjustments.sql:L174](../../../supabase/migrations/202609270002_admin_loyalty_adjustments.sql#L174)

## 202609270003_customer_onboarding.sql

[supabase/migrations/202609270003_customer_onboarding.sql:L1](../../../supabase/migrations/202609270003_customer_onboarding.sql#L1)

### Tabla `customer_onboarding`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `customer_id` | `uuid` | [supabase/migrations/202609270003_customer_onboarding.sql:L4](../../../supabase/migrations/202609270003_customer_onboarding.sql#L4) |
| `tutorial_version` | `smallint` | [supabase/migrations/202609270003_customer_onboarding.sql:L5](../../../supabase/migrations/202609270003_customer_onboarding.sql#L5) |
| `status` | `text` | [supabase/migrations/202609270003_customer_onboarding.sql:L6](../../../supabase/migrations/202609270003_customer_onboarding.sql#L6) |
| `last_step` | `smallint` | [supabase/migrations/202609270003_customer_onboarding.sql:L7](../../../supabase/migrations/202609270003_customer_onboarding.sql#L7) |
| `started_at` | `timestamptz` | [supabase/migrations/202609270003_customer_onboarding.sql:L8](../../../supabase/migrations/202609270003_customer_onboarding.sql#L8) |
| `postponed_at` | `timestamptz` | [supabase/migrations/202609270003_customer_onboarding.sql:L9](../../../supabase/migrations/202609270003_customer_onboarding.sql#L9) |
| `completed_at` | `timestamptz` | [supabase/migrations/202609270003_customer_onboarding.sql:L10](../../../supabase/migrations/202609270003_customer_onboarding.sql#L10) |
| `updated_at` | `timestamptz` | [supabase/migrations/202609270003_customer_onboarding.sql:L11](../../../supabase/migrations/202609270003_customer_onboarding.sql#L11) |

- trigger `preserve_completed_onboarding` — [supabase/migrations/202609270003_customer_onboarding.sql:L25](../../../supabase/migrations/202609270003_customer_onboarding.sql#L25)
- función `preserve_completed_onboarding` — [supabase/migrations/202609270003_customer_onboarding.sql:L16](../../../supabase/migrations/202609270003_customer_onboarding.sql#L16)
- cambio/permisos `alter table` (`customer_onboarding`; abrir SQL para objeto completo) — [supabase/migrations/202609270003_customer_onboarding.sql:L28](../../../supabase/migrations/202609270003_customer_onboarding.sql#L28)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270003_customer_onboarding.sql:L29](../../../supabase/migrations/202609270003_customer_onboarding.sql#L29)

## 202609270004_three_daily_purchases.sql

[supabase/migrations/202609270004_three_daily_purchases.sql:L1](../../../supabase/migrations/202609270004_three_daily_purchases.sql#L1)

- función `api_credit_purchase` — [supabase/migrations/202609270004_three_daily_purchases.sql:L5](../../../supabase/migrations/202609270004_three_daily_purchases.sql#L5)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270004_three_daily_purchases.sql:L142](../../../supabase/migrations/202609270004_three_daily_purchases.sql#L142)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609270004_three_daily_purchases.sql:L143](../../../supabase/migrations/202609270004_three_daily_purchases.sql#L143)

## 202609280001_seller_role.sql

[supabase/migrations/202609280001_seller_role.sql:L1](../../../supabase/migrations/202609280001_seller_role.sql#L1)

- cambio/permisos `alter type` (`app_role`; abrir SQL para objeto completo) — [supabase/migrations/202609280001_seller_role.sql:L2](../../../supabase/migrations/202609280001_seller_role.sql#L2)

## 202609280002_seller_orders.sql

[supabase/migrations/202609280002_seller_orders.sql:L1](../../../supabase/migrations/202609280002_seller_orders.sql#L1)

- función `api_transition_order` — [supabase/migrations/202609280002_seller_orders.sql:L3](../../../supabase/migrations/202609280002_seller_orders.sql#L3)
- función `api_complete_paid_order` — [supabase/migrations/202609280002_seller_orders.sql:L54](../../../supabase/migrations/202609280002_seller_orders.sql#L54)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609280002_seller_orders.sql:L82](../../../supabase/migrations/202609280002_seller_orders.sql#L82)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609280002_seller_orders.sql:L84](../../../supabase/migrations/202609280002_seller_orders.sql#L84)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609280002_seller_orders.sql:L85](../../../supabase/migrations/202609280002_seller_orders.sql#L85)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609280002_seller_orders.sql:L87](../../../supabase/migrations/202609280002_seller_orders.sql#L87)

## 202609290001_redemption_management.sql

[supabase/migrations/202609290001_redemption_management.sql:L1](../../../supabase/migrations/202609290001_redemption_management.sql#L1)

- función `api_staff_resolve_redemption` — [supabase/migrations/202609290001_redemption_management.sql:L8](../../../supabase/migrations/202609290001_redemption_management.sql#L8)
- cambio/permisos `alter table` (`reward_redemptions`; abrir SQL para objeto completo) — [supabase/migrations/202609290001_redemption_management.sql:L3](../../../supabase/migrations/202609290001_redemption_management.sql#L3)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609290001_redemption_management.sql:L85](../../../supabase/migrations/202609290001_redemption_management.sql#L85)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609290001_redemption_management.sql:L87](../../../supabase/migrations/202609290001_redemption_management.sql#L87)

## 202609290002_customer_usernames.sql

[supabase/migrations/202609290002_customer_usernames.sql:L1](../../../supabase/migrations/202609290002_customer_usernames.sql#L1)

- trigger `customers_set_username` — [supabase/migrations/202609290002_customer_usernames.sql:L47](../../../supabase/migrations/202609290002_customer_usernames.sql#L47)
- función `allocate_customer_username` — [supabase/migrations/202609290002_customer_usernames.sql:L6](../../../supabase/migrations/202609290002_customer_usernames.sql#L6)
- función `set_customer_username` — [supabase/migrations/202609290002_customer_usernames.sql:L39](../../../supabase/migrations/202609290002_customer_usernames.sql#L39)
- cambio/permisos `alter table` (`customers`; abrir SQL para objeto completo) — [supabase/migrations/202609290002_customer_usernames.sql:L3](../../../supabase/migrations/202609290002_customer_usernames.sql#L3)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609290002_customer_usernames.sql:L35](../../../supabase/migrations/202609290002_customer_usernames.sql#L35)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609290002_customer_usernames.sql:L37](../../../supabase/migrations/202609290002_customer_usernames.sql#L37)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609290002_customer_usernames.sql:L46](../../../supabase/migrations/202609290002_customer_usernames.sql#L46)
- cambio/permisos `alter table` (`customers`; abrir SQL para objeto completo) — [supabase/migrations/202609290002_customer_usernames.sql:L63](../../../supabase/migrations/202609290002_customer_usernames.sql#L63)

## 202609290003_customer_phone_password.sql

[supabase/migrations/202609290003_customer_phone_password.sql:L1](../../../supabase/migrations/202609290003_customer_phone_password.sql#L1)

- función `api_set_customer_password_by_verified_phone` — [supabase/migrations/202609290003_customer_phone_password.sql:L3](../../../supabase/migrations/202609290003_customer_phone_password.sql#L3)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609290003_customer_phone_password.sql:L36](../../../supabase/migrations/202609290003_customer_phone_password.sql#L36)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609290003_customer_phone_password.sql:L38](../../../supabase/migrations/202609290003_customer_phone_password.sql#L38)

## 202609300001_direct_customer_password.sql

[supabase/migrations/202609300001_direct_customer_password.sql:L1](../../../supabase/migrations/202609300001_direct_customer_password.sql#L1)

- función `api_claim_customer_password` — [supabase/migrations/202609300001_direct_customer_password.sql:L5](../../../supabase/migrations/202609300001_direct_customer_password.sql#L5)
- función `api_change_customer_password` — [supabase/migrations/202609300001_direct_customer_password.sql:L38](../../../supabase/migrations/202609300001_direct_customer_password.sql#L38)
- cambio/permisos `drop function` (`if`; abrir SQL para objeto completo) — [supabase/migrations/202609300001_direct_customer_password.sql:L3](../../../supabase/migrations/202609300001_direct_customer_password.sql#L3)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609300001_direct_customer_password.sql:L33](../../../supabase/migrations/202609300001_direct_customer_password.sql#L33)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609300001_direct_customer_password.sql:L35](../../../supabase/migrations/202609300001_direct_customer_password.sql#L35)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609300001_direct_customer_password.sql:L60](../../../supabase/migrations/202609300001_direct_customer_password.sql#L60)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202609300001_direct_customer_password.sql:L62](../../../supabase/migrations/202609300001_direct_customer_password.sql#L62)

## 202610030001_shared_inventory.sql

[supabase/migrations/202610030001_shared_inventory.sql:L1](../../../supabase/migrations/202610030001_shared_inventory.sql#L1)

### Tabla `inventory_movements`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `bigint` | [supabase/migrations/202610030001_shared_inventory.sql:L4](../../../supabase/migrations/202610030001_shared_inventory.sql#L4) |
| `variant_id` | `uuid` | [supabase/migrations/202610030001_shared_inventory.sql:L5](../../../supabase/migrations/202610030001_shared_inventory.sql#L5) |
| `quantity_delta` | `bigint` | [supabase/migrations/202610030001_shared_inventory.sql:L6](../../../supabase/migrations/202610030001_shared_inventory.sql#L6) |
| `source_key` | `text` | [supabase/migrations/202610030001_shared_inventory.sql:L7](../../../supabase/migrations/202610030001_shared_inventory.sql#L7) |
| `created_at` | `timestamptz` | [supabase/migrations/202610030001_shared_inventory.sql:L8](../../../supabase/migrations/202610030001_shared_inventory.sql#L8) |

### Tabla `inventory_revision`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `boolean` | [supabase/migrations/202610030001_shared_inventory.sql:L11](../../../supabase/migrations/202610030001_shared_inventory.sql#L11) |
| `revision` | `bigint` | [supabase/migrations/202610030001_shared_inventory.sql:L12](../../../supabase/migrations/202610030001_shared_inventory.sql#L12) |
| `activated_at` | `timestamptz` | [supabase/migrations/202610030001_shared_inventory.sql:L13](../../../supabase/migrations/202610030001_shared_inventory.sql#L13) |

- trigger `inventory_movement_revision` — [supabase/migrations/202610030001_shared_inventory.sql:L33](../../../supabase/migrations/202610030001_shared_inventory.sql#L33)
- trigger `inventory_gap_revision` — [supabase/migrations/202610030001_shared_inventory.sql:L35](../../../supabase/migrations/202610030001_shared_inventory.sql#L35)
- trigger `flavor_shared_stock` — [supabase/migrations/202610030001_shared_inventory.sql:L60](../../../supabase/migrations/202610030001_shared_inventory.sql#L60)
- trigger `box_shared_stock` — [supabase/migrations/202610030001_shared_inventory.sql:L82](../../../supabase/migrations/202610030001_shared_inventory.sql#L82)
- view `inventory_by_flavor` — [supabase/migrations/202610030001_shared_inventory.sql:L85](../../../supabase/migrations/202610030001_shared_inventory.sql#L85)
- trigger `order_inventory_revision` — [supabase/migrations/202610030001_shared_inventory.sql:L141](../../../supabase/migrations/202610030001_shared_inventory.sql#L141)
- función `inventory_movement_changed` — [supabase/migrations/202610030001_shared_inventory.sql:L26](../../../supabase/migrations/202610030001_shared_inventory.sql#L26)
- función `inventory_flavor_movement` — [supabase/migrations/202610030001_shared_inventory.sql:L38](../../../supabase/migrations/202610030001_shared_inventory.sql#L38)
- función `inventory_box_movement` — [supabase/migrations/202610030001_shared_inventory.sql:L63](../../../supabase/migrations/202610030001_shared_inventory.sql#L63)
- función `api_set_shared_inventory` — [supabase/migrations/202610030001_shared_inventory.sql:L110](../../../supabase/migrations/202610030001_shared_inventory.sql#L110)
- función `api_set_manual_inventory` — [supabase/migrations/202610030001_shared_inventory.sql:L125](../../../supabase/migrations/202610030001_shared_inventory.sql#L125)
- función `inventory_order_revision` — [supabase/migrations/202610030001_shared_inventory.sql:L134](../../../supabase/migrations/202610030001_shared_inventory.sql#L134)
- función `api_inventory_snapshot` — [supabase/migrations/202610030001_shared_inventory.sql:L143](../../../supabase/migrations/202610030001_shared_inventory.sql#L143)
- función `api_pull_orders_for_device` — [supabase/migrations/202610030001_shared_inventory.sql:L157](../../../supabase/migrations/202610030001_shared_inventory.sql#L157)
- cambio/permisos `alter table` (`inventory_manual_counts`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L16](../../../supabase/migrations/202610030001_shared_inventory.sql#L16)
- cambio/permisos `alter table` (`inventory_movements`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L21](../../../supabase/migrations/202610030001_shared_inventory.sql#L21)
- cambio/permisos `alter table` (`inventory_revision`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L22](../../../supabase/migrations/202610030001_shared_inventory.sql#L22)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L23](../../../supabase/migrations/202610030001_shared_inventory.sql#L23)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L24](../../../supabase/migrations/202610030001_shared_inventory.sql#L24)
- cambio/permisos `alter function` (`api_set_manual_inventory`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L108](../../../supabase/migrations/202610030001_shared_inventory.sql#L108)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L109](../../../supabase/migrations/202610030001_shared_inventory.sql#L109)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L129](../../../supabase/migrations/202610030001_shared_inventory.sql#L129)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L131](../../../supabase/migrations/202610030001_shared_inventory.sql#L131)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L153](../../../supabase/migrations/202610030001_shared_inventory.sql#L153)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030001_shared_inventory.sql:L154](../../../supabase/migrations/202610030001_shared_inventory.sql#L154)

## 202610030002_order_push.sql

[supabase/migrations/202610030002_order_push.sql:L1](../../../supabase/migrations/202610030002_order_push.sql#L1)

### Tabla `push_devices`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `device_public_id` | `uuid` | [supabase/migrations/202610030002_order_push.sql:L3](../../../supabase/migrations/202610030002_order_push.sql#L3) |
| `auth_user_id` | `uuid` | [supabase/migrations/202610030002_order_push.sql:L4](../../../supabase/migrations/202610030002_order_push.sql#L4) |
| `platform` | `text` | [supabase/migrations/202610030002_order_push.sql:L5](../../../supabase/migrations/202610030002_order_push.sql#L5) |
| `token` | `text` | [supabase/migrations/202610030002_order_push.sql:L6](../../../supabase/migrations/202610030002_order_push.sql#L6) |
| `environment` | `text` | [supabase/migrations/202610030002_order_push.sql:L7](../../../supabase/migrations/202610030002_order_push.sql#L7) |
| `app_version` | `text` | [supabase/migrations/202610030002_order_push.sql:L8](../../../supabase/migrations/202610030002_order_push.sql#L8) |
| `active` | `boolean` | [supabase/migrations/202610030002_order_push.sql:L9](../../../supabase/migrations/202610030002_order_push.sql#L9) |
| `updated_at` | `timestamptz` | [supabase/migrations/202610030002_order_push.sql:L10](../../../supabase/migrations/202610030002_order_push.sql#L10) |

### Tabla `order_push_jobs`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202610030002_order_push.sql:L13](../../../supabase/migrations/202610030002_order_push.sql#L13) |
| `order_id` | `uuid` | [supabase/migrations/202610030002_order_push.sql:L14](../../../supabase/migrations/202610030002_order_push.sql#L14) |
| `device_public_id` | `uuid` | [supabase/migrations/202610030002_order_push.sql:L15](../../../supabase/migrations/202610030002_order_push.sql#L15) |
| `attempts` | `integer` | [supabase/migrations/202610030002_order_push.sql:L16](../../../supabase/migrations/202610030002_order_push.sql#L16) |
| `available_at` | `timestamptz` | [supabase/migrations/202610030002_order_push.sql:L17](../../../supabase/migrations/202610030002_order_push.sql#L17) |
| `delivered_at` | `timestamptz` | [supabase/migrations/202610030002_order_push.sql:L18](../../../supabase/migrations/202610030002_order_push.sql#L18) |
| `lease_id` | `uuid` | [supabase/migrations/202610030002_order_push.sql:L19](../../../supabase/migrations/202610030002_order_push.sql#L19) |
| `last_error` | `text` | [supabase/migrations/202610030002_order_push.sql:L20](../../../supabase/migrations/202610030002_order_push.sql#L20) |

- index `order_push_pending` — [supabase/migrations/202610030002_order_push.sql:L23](../../../supabase/migrations/202610030002_order_push.sql#L23)
- trigger `new_order_push` — [supabase/migrations/202610030002_order_push.sql:L66](../../../supabase/migrations/202610030002_order_push.sql#L66)
- función `api_register_push_device` — [supabase/migrations/202610030002_order_push.sql:L29](../../../supabase/migrations/202610030002_order_push.sql#L29)
- función `api_unregister_push_device` — [supabase/migrations/202610030002_order_push.sql:L48](../../../supabase/migrations/202610030002_order_push.sql#L48)
- función `queue_order_push` — [supabase/migrations/202610030002_order_push.sql:L55](../../../supabase/migrations/202610030002_order_push.sql#L55)
- función `api_claim_order_push` — [supabase/migrations/202610030002_order_push.sql:L68](../../../supabase/migrations/202610030002_order_push.sql#L68)
- función `api_finish_order_push` — [supabase/migrations/202610030002_order_push.sql:L88](../../../supabase/migrations/202610030002_order_push.sql#L88)
- cambio/permisos `alter table` (`push_devices`; abrir SQL para objeto completo) — [supabase/migrations/202610030002_order_push.sql:L24](../../../supabase/migrations/202610030002_order_push.sql#L24)
- cambio/permisos `alter table` (`order_push_jobs`; abrir SQL para objeto completo) — [supabase/migrations/202610030002_order_push.sql:L25](../../../supabase/migrations/202610030002_order_push.sql#L25)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030002_order_push.sql:L26](../../../supabase/migrations/202610030002_order_push.sql#L26)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030002_order_push.sql:L27](../../../supabase/migrations/202610030002_order_push.sql#L27)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030002_order_push.sql:L101](../../../supabase/migrations/202610030002_order_push.sql#L101)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610030002_order_push.sql:L103](../../../supabase/migrations/202610030002_order_push.sql#L103)

## 202610050001_inventory_lock_order.sql

[supabase/migrations/202610050001_inventory_lock_order.sql:L1](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L1)

- función `api_transition_order` — [supabase/migrations/202610050001_inventory_lock_order.sql:L8](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L8)
- función `api_record_order_payment` — [supabase/migrations/202610050001_inventory_lock_order.sql:L21](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L21)
- función `api_complete_paid_order` — [supabase/migrations/202610050001_inventory_lock_order.sql:L32](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L32)
- cambio/permisos `alter function` (`api_transition_order`; abrir SQL para objeto completo) — [supabase/migrations/202610050001_inventory_lock_order.sql:L4](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L4)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050001_inventory_lock_order.sql:L6](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L6)
- cambio/permisos `alter function` (`api_record_order_payment`; abrir SQL para objeto completo) — [supabase/migrations/202610050001_inventory_lock_order.sql:L17](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L17)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050001_inventory_lock_order.sql:L19](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L19)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050001_inventory_lock_order.sql:L58](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L58)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050001_inventory_lock_order.sql:L61](../../../supabase/migrations/202610050001_inventory_lock_order.sql#L61)

## 202610050002_mobile_restore_identity.sql

[supabase/migrations/202610050002_mobile_restore_identity.sql:L1](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L1)

- función `api_restore_device_identity` — [supabase/migrations/202610050002_mobile_restore_identity.sql:L4](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L4)
- función `api_push_sync_operations` — [supabase/migrations/202610050002_mobile_restore_identity.sql:L33](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L33)
- cambio/permisos `alter table` (`app_devices`; abrir SQL para objeto completo) — [supabase/migrations/202610050002_mobile_restore_identity.sql:L3](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L3)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050002_mobile_restore_identity.sql:L28](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L28)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050002_mobile_restore_identity.sql:L29](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L29)
- cambio/permisos `alter function` (`api_push_sync_operations`; abrir SQL para objeto completo) — [supabase/migrations/202610050002_mobile_restore_identity.sql:L31](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L31)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050002_mobile_restore_identity.sql:L32](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L32)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050002_mobile_restore_identity.sql:L45](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L45)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610050002_mobile_restore_identity.sql:L46](../../../supabase/migrations/202610050002_mobile_restore_identity.sql#L46)

## 202610070001_catalog_operations.sql

[supabase/migrations/202610070001_catalog_operations.sql:L1](../../../supabase/migrations/202610070001_catalog_operations.sql#L1)

### Tabla `catalog_change_receipts`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `operation_id` | `uuid` | [supabase/migrations/202610070001_catalog_operations.sql:L16](../../../supabase/migrations/202610070001_catalog_operations.sql#L16) |
| `auth_user_id` | `uuid` | [supabase/migrations/202610070001_catalog_operations.sql:L17](../../../supabase/migrations/202610070001_catalog_operations.sql#L17) |
| `request_hash` | `text` | [supabase/migrations/202610070001_catalog_operations.sql:L18](../../../supabase/migrations/202610070001_catalog_operations.sql#L18) |
| `result` | `jsonb` | [supabase/migrations/202610070001_catalog_operations.sql:L19](../../../supabase/migrations/202610070001_catalog_operations.sql#L19) |
| `created_at` | `timestamptz` | [supabase/migrations/202610070001_catalog_operations.sql:L20](../../../supabase/migrations/202610070001_catalog_operations.sql#L20) |

- trigger `zz_product_variants_catalog_version` — [supabase/migrations/202610070001_catalog_operations.sql:L13](../../../supabase/migrations/202610070001_catalog_operations.sql#L13)
- función `catalog_updated_at` — [supabase/migrations/202610070001_catalog_operations.sql:L6](../../../supabase/migrations/202610070001_catalog_operations.sql#L6)
- función `api_update_flavor` — [supabase/migrations/202610070001_catalog_operations.sql:L24](../../../supabase/migrations/202610070001_catalog_operations.sql#L24)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070001_catalog_operations.sql:L12](../../../supabase/migrations/202610070001_catalog_operations.sql#L12)
- cambio/permisos `alter table` (`catalog_change_receipts`; abrir SQL para objeto completo) — [supabase/migrations/202610070001_catalog_operations.sql:L22](../../../supabase/migrations/202610070001_catalog_operations.sql#L22)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070001_catalog_operations.sql:L23](../../../supabase/migrations/202610070001_catalog_operations.sql#L23)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070001_catalog_operations.sql:L51](../../../supabase/migrations/202610070001_catalog_operations.sql#L51)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070001_catalog_operations.sql:L52](../../../supabase/migrations/202610070001_catalog_operations.sql#L52)

## 202610070002_staff_device_provisioning.sql

[supabase/migrations/202610070002_staff_device_provisioning.sql:L1](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L1)

### Tabla `staff_device_invitations`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `token_hash` | `text` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L3](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L3) |
| `created_by` | `uuid` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L4](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L4) |
| `role` | `text` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L5](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L5) |
| `expires_at` | `timestamptz` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L6](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L6) |
| `consumed_at` | `timestamptz` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L7](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L7) |
| `created_at` | `timestamptz` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L8](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L8) |

### Tabla `staff_device_credentials`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `device_public_id` | `uuid` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L11](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L11) |
| `auth_user_id` | `uuid` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L12](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L12) |
| `role` | `text` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L13](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L13) |
| `token_hash` | `text` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L14](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L14) |
| `revoked` | `boolean` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L15](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L15) |
| `expires_at` | `timestamptz` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L16](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L16) |
| `created_at` | `timestamptz` | [supabase/migrations/202610070002_staff_device_provisioning.sql:L17](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L17) |

- función `api_issue_staff_invitation` — [supabase/migrations/202610070002_staff_device_provisioning.sql:L23](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L23)
- función `api_claim_staff_invitation` — [supabase/migrations/202610070002_staff_device_provisioning.sql:L32](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L32)
- función `api_revoke_staff_device` — [supabase/migrations/202610070002_staff_device_provisioning.sql:L50](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L50)
- cambio/permisos `alter table` (`staff_device_invitations`; abrir SQL para objeto completo) — [supabase/migrations/202610070002_staff_device_provisioning.sql:L19](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L19)
- cambio/permisos `alter table` (`staff_device_credentials`; abrir SQL para objeto completo) — [supabase/migrations/202610070002_staff_device_provisioning.sql:L20](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L20)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070002_staff_device_provisioning.sql:L21](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L21)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070002_staff_device_provisioning.sql:L22](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L22)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070002_staff_device_provisioning.sql:L60](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L60)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070002_staff_device_provisioning.sql:L62](../../../supabase/migrations/202610070002_staff_device_provisioning.sql#L62)

## 202610070003_push_device_revocation.sql

[supabase/migrations/202610070003_push_device_revocation.sql:L1](../../../supabase/migrations/202610070003_push_device_revocation.sql#L1)

- función `api_claim_order_push` — [supabase/migrations/202610070003_push_device_revocation.sql:L5](../../../supabase/migrations/202610070003_push_device_revocation.sql#L5)
- cambio/permisos `alter function` (`api_claim_order_push`; abrir SQL para objeto completo) — [supabase/migrations/202610070003_push_device_revocation.sql:L3](../../../supabase/migrations/202610070003_push_device_revocation.sql#L3)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070003_push_device_revocation.sql:L4](../../../supabase/migrations/202610070003_push_device_revocation.sql#L4)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070003_push_device_revocation.sql:L14](../../../supabase/migrations/202610070003_push_device_revocation.sql#L14)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610070003_push_device_revocation.sql:L15](../../../supabase/migrations/202610070003_push_device_revocation.sql#L15)

## 202610080001_firebase_staff_identity.sql

[supabase/migrations/202610080001_firebase_staff_identity.sql:L1](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L1)

### Tabla `staff_firebase_bindings`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `firebase_uid` | `text` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L4](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L4) |
| `device_public_id` | `uuid` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L5](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L5) |
| `auth_user_id` | `uuid` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L6](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L6) |
| `role` | `public.app_role` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L7](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L7) |
| `credential_hash` | `text` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L8](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L8) |
| `revoked` | `boolean` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L9](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L9) |
| `expires_at` | `timestamptz` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L10](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L10) |
| `created_at` | `timestamptz` | [supabase/migrations/202610080001_firebase_staff_identity.sql:L11](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L11) |

- función `api_bind_firebase_device` — [supabase/migrations/202610080001_firebase_staff_identity.sql:L18](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L18)
- función `api_resolve_firebase_device` — [supabase/migrations/202610080001_firebase_staff_identity.sql:L61](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L61)
- cambio/permisos `alter table` (`staff_firebase_bindings`; abrir SQL para objeto completo) — [supabase/migrations/202610080001_firebase_staff_identity.sql:L14](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L14)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610080001_firebase_staff_identity.sql:L15](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L15)
- cambio/permisos `grant all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610080001_firebase_staff_identity.sql:L16](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L16)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610080001_firebase_staff_identity.sql:L57](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L57)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610080001_firebase_staff_identity.sql:L58](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L58)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610080001_firebase_staff_identity.sql:L75](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L75)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610080001_firebase_staff_identity.sql:L76](../../../supabase/migrations/202610080001_firebase_staff_identity.sql#L76)

## 202610130001_daily_operations.sql

[supabase/migrations/202610130001_daily_operations.sql:L1](../../../supabase/migrations/202610130001_daily_operations.sql#L1)

### Tabla `daily_sessions`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L15](../../../supabase/migrations/202610130001_daily_operations.sql#L15) |
| `business_date` | `date` | [supabase/migrations/202610130001_daily_operations.sql:L16](../../../supabase/migrations/202610130001_daily_operations.sql#L16) |
| `opened_at` | `timestamptz` | [supabase/migrations/202610130001_daily_operations.sql:L17](../../../supabase/migrations/202610130001_daily_operations.sql#L17) |
| `closed_at` | `timestamptz` | [supabase/migrations/202610130001_daily_operations.sql:L18](../../../supabase/migrations/202610130001_daily_operations.sql#L18) |
| `closed_by` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L19](../../../supabase/migrations/202610130001_daily_operations.sql#L19) |
| `closing_operation_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L20](../../../supabase/migrations/202610130001_daily_operations.sql#L20) |
| `closing_summary` | `jsonb` | [supabase/migrations/202610130001_daily_operations.sql:L21](../../../supabase/migrations/202610130001_daily_operations.sql#L21) |

### Tabla `daily_operations`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L25](../../../supabase/migrations/202610130001_daily_operations.sql#L25) |
| `server_sequence` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L26](../../../supabase/migrations/202610130001_daily_operations.sql#L26) |
| `session_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L27](../../../supabase/migrations/202610130001_daily_operations.sql#L27) |
| `actor_user_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L28](../../../supabase/migrations/202610130001_daily_operations.sql#L28) |
| `kind` | `text` | [supabase/migrations/202610130001_daily_operations.sql:L29](../../../supabase/migrations/202610130001_daily_operations.sql#L29) |
| `request_hash` | `text` | [supabase/migrations/202610130001_daily_operations.sql:L30](../../../supabase/migrations/202610130001_daily_operations.sql#L30) |
| `payload` | `jsonb` | [supabase/migrations/202610130001_daily_operations.sql:L31](../../../supabase/migrations/202610130001_daily_operations.sql#L31) |
| `occurred_at` | `timestamptz` | [supabase/migrations/202610130001_daily_operations.sql:L32](../../../supabase/migrations/202610130001_daily_operations.sql#L32) |
| `created_at` | `timestamptz` | [supabase/migrations/202610130001_daily_operations.sql:L33](../../../supabase/migrations/202610130001_daily_operations.sql#L33) |
| `investment_cents` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L34](../../../supabase/migrations/202610130001_daily_operations.sql#L34) |
| `revenue_cents` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L35](../../../supabase/migrations/202610130001_daily_operations.sql#L35) |
| `cash_cents` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L36](../../../supabase/migrations/202610130001_daily_operations.sql#L36) |
| `yappy_cents` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L37](../../../supabase/migrations/202610130001_daily_operations.sql#L37) |
| `cost_cents` | `numeric` | [supabase/migrations/202610130001_daily_operations.sql:L38](../../../supabase/migrations/202610130001_daily_operations.sql#L38) |
| `unknown_cost_units` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L39](../../../supabase/migrations/202610130001_daily_operations.sql#L39) |
| `order_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L40](../../../supabase/migrations/202610130001_daily_operations.sql#L40) |

### Tabla `daily_operation_items`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `operation_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L44](../../../supabase/migrations/202610130001_daily_operations.sql#L44) |
| `variant_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L45](../../../supabase/migrations/202610130001_daily_operations.sql#L45) |
| `name_snapshot` | `text` | [supabase/migrations/202610130001_daily_operations.sql:L46](../../../supabase/migrations/202610130001_daily_operations.sql#L46) |
| `sku_snapshot` | `text` | [supabase/migrations/202610130001_daily_operations.sql:L47](../../../supabase/migrations/202610130001_daily_operations.sql#L47) |
| `quantity` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L48](../../../supabase/migrations/202610130001_daily_operations.sql#L48) |
| `per_box_quantity` | `integer` | [supabase/migrations/202610130001_daily_operations.sql:L49](../../../supabase/migrations/202610130001_daily_operations.sql#L49) |
| `unit_price_cents` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L50](../../../supabase/migrations/202610130001_daily_operations.sql#L50) |
| `cost_cents` | `numeric` | [supabase/migrations/202610130001_daily_operations.sql:L51](../../../supabase/migrations/202610130001_daily_operations.sql#L51) |
| `unknown_cost_units` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L52](../../../supabase/migrations/202610130001_daily_operations.sql#L52) |

### Tabla `daily_cost_lots`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L56](../../../supabase/migrations/202610130001_daily_operations.sql#L56) |
| `variant_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L57](../../../supabase/migrations/202610130001_daily_operations.sql#L57) |
| `source_operation_id` | `uuid` | [supabase/migrations/202610130001_daily_operations.sql:L58](../../../supabase/migrations/202610130001_daily_operations.sql#L58) |
| `remaining_quantity` | `bigint` | [supabase/migrations/202610130001_daily_operations.sql:L59](../../../supabase/migrations/202610130001_daily_operations.sql#L59) |
| `unit_cost_cents` | `numeric` | [supabase/migrations/202610130001_daily_operations.sql:L60](../../../supabase/migrations/202610130001_daily_operations.sql#L60) |
| `created_at` | `timestamptz` | [supabase/migrations/202610130001_daily_operations.sql:L61](../../../supabase/migrations/202610130001_daily_operations.sql#L61) |

- index `daily_operations_session_sequence` — [supabase/migrations/202610130001_daily_operations.sql:L42](../../../supabase/migrations/202610130001_daily_operations.sql#L42)
- index `daily_cost_lots_fifo` — [supabase/migrations/202610130001_daily_operations.sql:L63](../../../supabase/migrations/202610130001_daily_operations.sql#L63)
- trigger `zz_daily_web_sale` — [supabase/migrations/202610130001_daily_operations.sql:L279](../../../supabase/migrations/202610130001_daily_operations.sql#L279)
- función `daily_take_cost` — [supabase/migrations/202610130001_daily_operations.sql:L73](../../../supabase/migrations/202610130001_daily_operations.sql#L73)
- función `daily_session_summary` — [supabase/migrations/202610130001_daily_operations.sql:L103](../../../supabase/migrations/202610130001_daily_operations.sql#L103)
- función `api_daily_snapshot` — [supabase/migrations/202610130001_daily_operations.sql:L123](../../../supabase/migrations/202610130001_daily_operations.sql#L123)
- función `api_daily_apply` — [supabase/migrations/202610130001_daily_operations.sql:L149](../../../supabase/migrations/202610130001_daily_operations.sql#L149)
- función `daily_record_web_sale` — [supabase/migrations/202610130001_daily_operations.sql:L255](../../../supabase/migrations/202610130001_daily_operations.sql#L255)
- cambio/permisos `alter table` (`daily_sessions`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L64](../../../supabase/migrations/202610130001_daily_operations.sql#L64)
- cambio/permisos `alter table` (`daily_operations`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L65](../../../supabase/migrations/202610130001_daily_operations.sql#L65)
- cambio/permisos `alter table` (`daily_operation_items`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L66](../../../supabase/migrations/202610130001_daily_operations.sql#L66)
- cambio/permisos `alter table` (`daily_cost_lots`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L67](../../../supabase/migrations/202610130001_daily_operations.sql#L67)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L68](../../../supabase/migrations/202610130001_daily_operations.sql#L68)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L69](../../../supabase/migrations/202610130001_daily_operations.sql#L69)
- cambio/permisos `drop trigger` (`if`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L278](../../../supabase/migrations/202610130001_daily_operations.sql#L278)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L280](../../../supabase/migrations/202610130001_daily_operations.sql#L280)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L281](../../../supabase/migrations/202610130001_daily_operations.sql#L281)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610130001_daily_operations.sql:L282](../../../supabase/migrations/202610130001_daily_operations.sql#L282)

## 202610140001_staff_order_notifications.sql

[supabase/migrations/202610140001_staff_order_notifications.sql:L1](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L1)

### Tabla `push_devices`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `device_public_id` | `uuid` | [supabase/migrations/202610140001_staff_order_notifications.sql:L6](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L6) |
| `auth_user_id` | `uuid` | [supabase/migrations/202610140001_staff_order_notifications.sql:L6](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L6) |
| `platform` | `text` | [supabase/migrations/202610140001_staff_order_notifications.sql:L7](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L7) |
| `token` | `text` | [supabase/migrations/202610140001_staff_order_notifications.sql:L7](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L7) |
| `environment` | `text` | [supabase/migrations/202610140001_staff_order_notifications.sql:L8](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L8) |
| `app_version` | `text` | [supabase/migrations/202610140001_staff_order_notifications.sql:L9](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L9) |
| `active` | `boolean` | [supabase/migrations/202610140001_staff_order_notifications.sql:L9](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L9) |
| `updated_at` | `timestamptz` | [supabase/migrations/202610140001_staff_order_notifications.sql:L10](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L10) |

### Tabla `order_push_jobs`

| Columna inicial | Tipo inicial | Evidencia |
|---|---|---|
| `id` | `uuid` | [supabase/migrations/202610140001_staff_order_notifications.sql:L13](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L13) |
| `order_id` | `uuid` | [supabase/migrations/202610140001_staff_order_notifications.sql:L13](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L13) |
| `device_public_id` | `uuid` | [supabase/migrations/202610140001_staff_order_notifications.sql:L14](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L14) |
| `attempts` | `integer` | [supabase/migrations/202610140001_staff_order_notifications.sql:L15](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L15) |
| `available_at` | `timestamptz` | [supabase/migrations/202610140001_staff_order_notifications.sql:L15](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L15) |
| `delivered_at` | `timestamptz` | [supabase/migrations/202610140001_staff_order_notifications.sql:L16](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L16) |
| `lease_id` | `uuid` | [supabase/migrations/202610140001_staff_order_notifications.sql:L16](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L16) |
| `last_error` | `text` | [supabase/migrations/202610140001_staff_order_notifications.sql:L16](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L16) |

- index `order_push_pending` — [supabase/migrations/202610140001_staff_order_notifications.sql:L18](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L18)
- trigger `new_order_push` — [supabase/migrations/202610140001_staff_order_notifications.sql:L83](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L83)
- función `api_staff_register_order_notifications` — [supabase/migrations/202610140001_staff_order_notifications.sql:L27](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L27)
- función `api_staff_stop_order_notifications` — [supabase/migrations/202610140001_staff_order_notifications.sql:L56](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L56)
- función `queue_order_push` — [supabase/migrations/202610140001_staff_order_notifications.sql:L70](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L70)
- función `api_claim_staff_order_push` — [supabase/migrations/202610140001_staff_order_notifications.sql:L85](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L85)
- función `api_finish_staff_order_push` — [supabase/migrations/202610140001_staff_order_notifications.sql:L106](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L106)
- función `api_retry_staff_order_push` — [supabase/migrations/202610140001_staff_order_notifications.sql:L121](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L121)
- función `api_staff_order_notification_status` — [supabase/migrations/202610140001_staff_order_notifications.sql:L136](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L136)
- cambio/permisos `alter table` (`push_devices`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L19](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L19)
- cambio/permisos `alter table` (`push_devices`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L20](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L20)
- cambio/permisos `alter table` (`push_devices`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L21](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L21)
- cambio/permisos `alter table` (`push_devices`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L22](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L22)
- cambio/permisos `alter table` (`order_push_jobs`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L23](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L23)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L24](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L24)
- cambio/permisos `grant select` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L25](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L25)
- cambio/permisos `drop trigger` (`if`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L82](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L82)
- cambio/permisos `revoke execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L152](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L152)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610140001_staff_order_notifications.sql:L156](../../../supabase/migrations/202610140001_staff_order_notifications.sql#L156)

## 202610270001_weekly_ranking.sql

[supabase/migrations/202610270001_weekly_ranking.sql:L1](../../../supabase/migrations/202610270001_weekly_ranking.sql#L1)

- index `loyalty_transactions_weekly_purchases_idx` — [supabase/migrations/202610270001_weekly_ranking.sql:L7](../../../supabase/migrations/202610270001_weekly_ranking.sql#L7)
- función `api_staff_weekly_ranking` — [supabase/migrations/202610270001_weekly_ranking.sql:L11](../../../supabase/migrations/202610270001_weekly_ranking.sql#L11)
- cambio/permisos `revoke all` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610270001_weekly_ranking.sql:L55](../../../supabase/migrations/202610270001_weekly_ranking.sql#L55)
- cambio/permisos `grant execute` (`on`; abrir SQL para objeto completo) — [supabase/migrations/202610270001_weekly_ranking.sql:L56](../../../supabase/migrations/202610270001_weekly_ranking.sql#L56)
