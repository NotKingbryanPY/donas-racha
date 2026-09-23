# Integración de la fase 9

Este directorio es código nuevo. Debe copiarse al proyecto Android reconstruido u original.

1. Agrega `android.permission.INTERNET` al manifiesto.
2. Agrega WorkManager Kotlin `androidx.work:work-runtime-ktx:2.9.1` y conserva Room/coroutines ya presentes.
3. Incluye `SyncOperationEntity` en la lista de entidades de `AppDatabase`, sube la versión de 1 a 2, expone `abstract fun syncDao(): SyncDao` y registra `DONAS_MIGRATION_1_2`.
4. Inicializa `SyncDependencies` al arrancar la aplicación. `baseUrl` debe ser `https://donas-racha.vercel.app`; `AuthTokenProvider` debe devolver la sesión administrativa, nunca una service-role key.
5. Dentro de cada transacción de `BusinessRepository`, llama a `SyncQueue.enqueue(...)` con el mismo UUID de la operación local. El evento y la entrada de cola deben confirmarse juntos.
6. Llama `SyncScheduler.schedule(context)` al iniciar la app y después de cada nueva operación.

La cola no aplica operaciones contables en Supabase todavía. El backend de fase 9 las recibe con idempotencia y las deja en estado `RECEIVED`; el procesador contable corresponde a la fase 10.

