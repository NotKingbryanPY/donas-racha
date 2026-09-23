# Dona Control — arquitectura de sincronización

## Arquitectura recuperada

El APK 1.1.1 es una aplicación Kotlin con una sola `MainActivity`, View Binding y un widget de venta rápida. La actividad crea directamente `donas.db` y `BusinessRepository`; no usa ViewModel ni inyección de dependencias. Room 2.6.1 conserva 19 tablas contables y operativas en versión 1. Las operaciones del repositorio ya usan transacciones, FIFO, centavos enteros e idempotencia local para ventas.

La aplicación no tenía permiso de Internet, cliente HTTP, WorkManager ni Supabase. DataStore se usa solamente para ajustes visuales.

## Diseño de fase 9

```mermaid
flowchart LR
  UI[MainActivity y widget] --> BR[BusinessRepository]
  BR --> DB[(Room donas.db)]
  DB --> OQ[Cola local de sincronización]
  OQ --> WM[WorkManager con red disponible]
  WM --> API[/api/sync]
  API --> SO[(sync_operations)]
  API --> ORD[(orders)]
```

Room sigue siendo la fuente inmediata del teléfono. Registrar una venta no espera la red. El sincronizador envía lotes de hasta 50 operaciones cuando exista conexión y conserva los pendientes si Vercel o Supabase fallan.

`POST /api/sync` exige una sesión Supabase con rol `ADMIN`, registra el dispositivo sin guardar secretos propios y acepta eventos con UUID e idempotencia. Repetir el mismo evento devuelve el mismo acuse; reutilizar su UUID con contenido distinto falla.

`GET /api/sync` entrega pedidos por un cursor estable compuesto por `updated_at` e `id`. El teléfono deduplica por UUID. El cursor solo avanza después de guardar todo el lote en Room.

## Límites de esta fase

Las operaciones recibidas quedan en estado `RECEIVED`. Convertir un pedido completado en venta, descontar inventario, registrar pago y otorgar puntos pertenece a la transacción de fase 10. Esta separación evita modificar los libros contables recuperados antes de poder compilar y probar la aplicación completa.

El APK descompilado es una referencia verificable, pero no reproduce automáticamente los archivos Kotlin y Gradle originales. La integración Android se mantiene como una capa nueva hasta reconstruir y compilar el proyecto recuperado.
