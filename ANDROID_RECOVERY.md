# Recuperación de DonasControl 1.1.1

El APK debug entregado se analizó para diseñar la fase 9 con la arquitectura real de la aplicación.

- Paquete `com.bryan.donas`, versión `1.1.1` (`versionCode 5`).
- Kotlin, Room 2.6.1, coroutines 1.7.3, DataStore 1.1.4 y una sola actividad.
- Base `donas.db` versión 1 con contabilidad, inventario FIFO, ventas, compras, gastos, préstamos, socios y sesiones.
- Sin permiso de Internet, cliente HTTP, WorkManager ni integración previa con Supabase.
- SHA-256 del APK: `E3FCB89D20F7176695F9C3EFAA11B97714F6E2C384921AC953929FD4A9705B0D`.

Se recuperaron 89 archivos Java propios de la aplicación, sus recursos y el Smali de respaldo. Cuatro métodos coroutine complejos de `BusinessRepository` quedaron incompletos en la representación Java, pero su bytecode está preservado.

El material recuperado no es el proyecto Kotlin original: un APK no conserva comentarios, historial, configuración completa de Gradle ni todos los nombres originales. Por eso no se mezcló la descompilación con la web. La capa Android nueva se entrega como un paquete local independiente e incluye entidad y DAO de cola, migración Room 1→2, cliente HTTP, reintentos y WorkManager.
