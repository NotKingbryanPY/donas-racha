# Donas Racha V2 Core — Entrega masiva

## 1. Análisis breve de la arquitectura actual

La app actual ya tiene una arquitectura correcta para una PWA ligera universitaria:

- **Frontend móvil responsive** en un solo archivo HTML, con selección de rol, login de vendedor, escaneo de QR, perfil de cliente, registro de compras, ranking público y panel admin.
- **Backend en Google Apps Script**, con `doGet`, `doPost`, validación de contraseña, rutas tipo API, registro de clientes, registro de compras, ranking y stats.
- **Base de datos en Google Sheets**, con hojas principales `Clientes`, `Registros` y `Config`.
- **QR por cliente**, generado desde `QR_URL` y basado en el ID del cliente.

La mejora V2 no reemplaza la lógica base: la extiende. Por eso la hoja `Clientes` conserva sus primeras columnas originales:

`ID, Nombre, WhatsApp, FechaRegistro, RachaActual, TotalCompras, RecompensasGanadas, UltimaCompra, QR_URL`

La V2 agrega columnas nuevas a la derecha. Esto permite migrar sin borrar clientes, sin romper QR existentes y sin perder historial.

---

## 2. Nueva estructura de Google Sheets

La función `initSheets()` crea o actualiza estas hojas sin borrar datos existentes.

### Clientes

| Columna | Uso |
|---|---|
| ID | ID único del cliente. Se conserva. |
| Nombre | Nombre del cliente. |
| WhatsApp | Contacto opcional. |
| FechaRegistro | Fecha de creación. |
| RachaActual | Racha de la temporada actual. |
| TotalCompras | Compras acumuladas históricas. |
| RecompensasGanadas | Premios automáticos acumulados. |
| UltimaCompra | Última compra válida. |
| QR_URL | QR existente; se conserva. |
| PuntosTotales | Puntos acumulados permanentes. |
| PuntosDisponibles | Puntos disponibles para futuro canje. |
| PuntosPorCompras | Puntos obtenidos específicamente por compras. |
| NivelClave | BRONCE, PLATA, ORO, DIAMANTE, MAESTRO. |
| NivelNombre | Nombre visible del nivel. |
| NivelEmoji | Emoji del nivel. |
| ProgresoNivelPct | Porcentaje hacia siguiente nivel. |
| PuntosSiguienteNivel | Puntos restantes para subir. |
| HitosRacha | Hitos alcanzados: 3,7,14,21,30. |
| TemporadaActual | Número de temporada de racha. |
| TemporadasCompletadas | Cantidad de temporadas de 30 completadas. |
| FechaActualizacion | Última actualización gamificada. |
| MigradoV2 | Marca idempotente para no migrar dos veces. |

### Registros

| Columna | Uso |
|---|---|
| IDRegistro | ID único del registro. |
| IDCliente | Cliente asociado. |
| NombreCliente | Snapshot del nombre al momento de registrar. |
| FechaHora | Fecha y hora del evento. |
| Tipo | `purchase` o `reward`. |
| RachaResultante | Racha alcanzada en ese evento. |
| PuntosOtorgados | Puntos entregados. |
| NivelResultante | Nivel tras el evento. |
| PremioGenerado | TRUE/FALSE. |
| Fuente | app, migracion_v2, etc. |
| Notas | Información adicional. |

### Config

Incluye claves editables:

- `MODO_RACHA`
- `DIAS_TOLERANCIA`
- `COMPRAS_RECOMPENSA`
- `NOMBRE_NEGOCIO`
- `PRECIO_DONA`
- `ACTIVO`
- `ADMIN_PASSWORD`
- `PUNTOS_POR_COMPRA`
- `MIGRACION_V2_COMPLETA`
- `FECHA_MIGRACION_V2`
- `VERSION_SISTEMA`

### Insignias

Catálogo de logros automáticos:

| Insignia | Condición |
|---|---|
| 🥉 Primer Mordisco | 1 compra |
| 🥈 Cliente Frecuente | 5 compras |
| 🥇 Dona Lover | 20 compras |
| 👑 Rey de las Donas | 50 compras |
| 🔥 Maestro de Rachas | completar racha de 30 |
| 🎉 Cliente VIP | 100 compras |

### ClienteInsignias

Relación cliente-insignia para evitar duplicados.

### TemporadasRacha

Guarda temporadas completadas de 30 compras. Al completar 30, se registra la temporada y la racha vuelve a 0 para iniciar otra temporada.

### Migracion

Bitácora de la migración V2: clientes procesados, actualizados, insignias creadas y temporadas registradas.

---

## 3. Código completo de Google Apps Script

Archivo incluido: `Donas_Racha_v2_Code.gs`

Funciones principales incluidas:

- `doGet`
- `doPost`
- `doOptions`
- `corsResponse`
- `getCliente`
- `buscarCliente`
- `getTodosClientes`
- `getRanking`
- `getStats`
- `registrarCompra`
- `nuevoCliente`
- `eliminarCliente`
- `getConfig`
- `saveConfig`
- `initSheets`
- `migrarClientesExistentes`
- `recalcularNivelCliente`
- `asignarInsigniasAutomaticas`
- `calcularProgresoNivel`
- `calcularHitosRacha`

También incluye helpers internos para:

- Mapear columnas por nombre, no por posición fija.
- Mantener compatibilidad con las columnas actuales.
- Evitar doble compra el mismo día.
- Evitar insignias duplicadas.
- Evitar temporadas duplicadas.
- Ejecutar migración idempotente.

---

## 4. Código completo del frontend HTML

Archivo incluido: `Donas_Racha_v2_index.html`

Incluye:

- HTML, CSS y JavaScript en un solo archivo.
- Diseño mobile-first.
- Gradientes morados y tarjetas modernas.
- Selección de rol.
- Login vendedor/admin.
- Escaneo QR por cámara.
- Lectura QR desde imagen.
- Perfil de cliente mejorado.
- Puntos, nivel, barra de progreso, rachas, hitos e insignias.
- Ranking público por compras, puntos, racha, nivel y premios.
- Panel admin con ventas del día, semana, mes, clientes, puntos y premios.
- Migración desde el panel admin.
- Config rápida desde admin.
- Registro de compras con validación de compra diaria.
- Toasts visuales y confetti.

Antes de usarlo, cambia esta línea:

```js
const BACKEND_URL = 'PEGA_AQUI_TU_WEB_APP_URL';
```

Por la URL `/exec` de tu despliegue de Google Apps Script.

---

## 5. Guía de migración paso a paso

### Paso 0 — Copia de seguridad obligatoria

Antes de tocar producción:

1. Abre tu Google Sheet actual.
2. Ve a `Archivo > Crear una copia`.
3. Nombra la copia, por ejemplo: `Donas Racha Backup antes V2`.
4. No ejecutes la migración hasta tener esta copia.

### Paso 1 — Pegar backend nuevo

1. Abre Apps Script desde tu Sheet.
2. Crea o reemplaza el archivo `Code.gs` con el contenido de `Donas_Racha_v2_Code.gs`.
3. Si tu script no está vinculado directamente al Sheet, cambia:

```js
const SHEET_ID_FALLBACK = 'PEGA_AQUI_TU_SPREADSHEET_ID';
```

Por el ID real de tu Google Sheet.

### Paso 2 — Verificar contraseña admin

El backend conserva la contraseña actual como fallback inicial. Después de ejecutar `initSheets()`, puedes cambiarla desde la hoja `Config`, clave:

```txt
ADMIN_PASSWORD
```

### Paso 3 — Ejecutar initSheets

Desde Apps Script:

1. Selecciona la función `initSheets`.
2. Presiona `Run`.
3. Acepta permisos.
4. Verifica que se creen o actualicen estas hojas:
   - Clientes
   - Registros
   - Config
   - Insignias
   - ClienteInsignias
   - TemporadasRacha
   - Migracion

`initSheets()` no borra datos. Solo agrega hojas y columnas faltantes.

### Paso 4 — Ejecutar migración

Desde Apps Script o desde el panel admin:

```js
migrarClientesExistentes()
```

La regla aplicada es:

```txt
Puntos retroactivos = TotalCompras × 10
```

La migración:

- No borra clientes.
- No borra QR existentes.
- No borra historial.
- Calcula niveles por puntos.
- Asigna insignias iniciales.
- Marca `MigradoV2 = TRUE` por cliente.
- Marca `MIGRACION_V2_COMPLETA = TRUE` en Config.
- Registra una fila en `Migracion`.
- Si se ejecuta otra vez, no duplica datos.

---

## 6. Guía de despliegue

### Backend Apps Script

1. En Apps Script, pega `Donas_Racha_v2_Code.gs`.
2. Ejecuta `initSheets` manualmente.
3. Ejecuta `migrarClientesExistentes` una sola vez después de hacer backup.
4. Ve a `Deploy > New deployment`.
5. Tipo: `Web app`.
6. Ejecutar como: `Me`.
7. Quién tiene acceso: `Anyone` o `Anyone with the link`.
8. Copia la URL que termina en `/exec`.

### Frontend HTML

1. Abre `Donas_Racha_v2_index.html`.
2. Cambia `BACKEND_URL` por la URL `/exec`.
3. Sube el HTML donde estás alojando la app, o úsalo como archivo local de prueba.
4. En celular, abre la URL del frontend.
5. Inicia sesión como vendedor.

---

## 7. Cómo probar que todo funciona

### Prueba 1 — API activa

Abre en el navegador:

```txt
TU_URL_EXEC?action=getStats
```

Debe responder JSON con `ok:true`.

### Prueba 2 — Login vendedor

1. Abre el frontend.
2. Entra como vendedor.
3. Usa la contraseña configurada en `Config > ADMIN_PASSWORD`.
4. Debe abrir la vista de búsqueda y ranking.

### Prueba 3 — Perfil cliente existente

1. Busca un cliente existente.
2. Abre su perfil.
3. Verifica que aparezcan:
   - nivel
   - puntos totales
   - puntos disponibles
   - compras
   - racha
   - hitos
   - insignias
   - historial

### Prueba 4 — Registro de compra

1. Abre un cliente.
2. Presiona `Registrar compra`.
3. Debe aumentar:
   - `TotalCompras` +1
   - `PuntosTotales` +10
   - `PuntosDisponibles` +10
   - `PuntosPorCompras` +10
   - `RachaActual` según tolerancia
4. Debe aparecer una fila nueva en `Registros`.
5. Si intentas registrar de nuevo el mismo día, debe bloquearse.

### Prueba 5 — Niveles

Usa un cliente con diferentes compras acumuladas:

- 0 pts = Bronce
- 200 pts = Plata
- 500 pts = Oro
- 1000 pts = Diamante
- 2000 pts = Maestro Donero

### Prueba 6 — Insignias

Verifica que se asignen automáticamente:

- 1 compra: Primer Mordisco
- 5 compras: Cliente Frecuente
- 20 compras: Dona Lover
- 50 compras: Rey de las Donas
- 30 racha: Maestro de Rachas
- 100 compras: Cliente VIP

### Prueba 7 — Ranking

Prueba todos los rankings:

- Más compras
- Más puntos
- Mejor racha actual
- Más premios obtenidos
- Mejor nivel

---

## 8. Recomendaciones para V2 posterior

### Ruleta diaria

Agregar hoja futura `RuletaDiaria`:

- ID
- ClienteID
- Fecha
- Premio
- PuntosGanados
- Estado

Regla recomendada: 1 giro diario solo si el cliente compró o escaneó ese día.

### Misiones semanales

Agregar hoja futura `Misiones` y `ClienteMisiones`:

Ejemplos:

- Compra 2 veces esta semana.
- Compra con un amigo.
- Sube historia etiquetando Donas Racha.
- Compra antes de cierta hora.

### Referidos

Agregar campos:

- CodigoReferido
- ReferidoPor
- TotalReferidos

Regla sugerida:

- El referido recibe 10 puntos extra en su primera compra.
- El cliente que refiere recibe 20 puntos cuando el referido compra por primera vez.

---

## Archivos incluidos

- `Donas_Racha_v2_Code.gs`
- `Donas_Racha_v2_index.html`
- `Donas_Racha_v2_Estructura.xlsx`
- `Donas_Racha_v2_Guia.md`

