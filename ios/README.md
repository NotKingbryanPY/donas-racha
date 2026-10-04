# Donas Control 1.3.0 — iPhone y iPad

Aplicación SwiftUI para iOS/iPadOS 17 o posterior. Incluye Inicio, Pedidos, Ventas, Inventario y Ajustes; libro offline, FIFO, efectivo/Yappy, compras 4/4/2/2, gastos, transferencias, préstamos, reparto porcentual estimado y copias JSON. SELLER atiende pedidos; ADMIN registra movimientos y conteos.

## Usarla teniendo únicamente un iPad

Ejecutar `node scripts/package-ios.mjs` desde la raíz del repositorio. Se genera `outputs/DonasControl.swiftpm`. Comprimir **la carpeta completa**, pasar el ZIP al iPad, descomprimir en Archivos y abrir el proyecto `.swiftpm` con Swift Playgrounds. Ejecutar, entrar a Ajustes y conectar la cuenta del negocio. No copiar únicamente `DonasControl.swift`: ahora hay varios archivos y recursos.

El paquete conserva el libro offline y sincroniza con la app abierta; desactiva BGTaskScheduler, que requiere configurar el proyecto Xcode. La apertura de este paquete en el iPad físico sigue pendiente de verificar. No es un IPA firmado ni una descarga de App Store.

Antes de trabajar, configurar precios, abrir jornada con saldos reales y registrar existencias iniciales si ya se compraron en otro equipo. No volver a registrarlas como compra: aumentaría otra vez el inventario compartido. Las nuevas compras incorporan 4 chocolate, 4 vainilla y 2 de cada sabor con chispas por caja.

## Compilar con Xcode y verificar en la nube

```sh
cd ios
swift test
xcodegen generate
xcodebuild -project DonasControl.xcodeproj -scheme DonasControl -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

El workflow `.github/workflows/ios-build.yml` prueba, compila y abre la app en un simulador iPad; publica la app y una captura. Esta compilación sí se ha verificado. Para dispositivos/TestFlight/App Store, seleccionar el equipo Apple del propietario y firmar `com.bryan.donas.control`, habilitando Push Notifications y Background Modes. No están disponibles esas credenciales en este workspace.

## Sesión, avisos y datos

El llavero conserva la sesión renovable, sin contraseña. Una pérdida de red, límite temporal o caída del servidor no la elimina. Supabase puede revocarla o limitarla mediante sus políticas. Las escrituras esperan diez segundos continuos de Wi‑Fi sin modo de datos limitados; los pedidos se consultan con cualquier conexión. iOS decide cuándo permite tareas en segundo plano; abrir la app vuelve a intentar los pendientes.

APNs está implementado en app/API con entitlements de desarrollo/producción. Sin las claves y firma autorizada solo hay avisos locales al detectar pedidos durante consultas. No se ha validado push real con la app cerrada.

La página y las apps comparten el inventario del servidor tras activar las migraciones. Cada instalación conserva su propio libro; no se fusionan automáticamente saldos, préstamos ni lotes históricos de Android con iOS. Android exporta SQLite e iOS JSON: una migración histórica necesita conversión y una copia real de los datos.

Usar un libro administrador principal y cuentas SELLER para los socios que atienden pedidos. Las entregas cobradas por socios, posteriores a la apertura del libro iOS, se incorporan una vez cuando la jornada está abierta y hay existencias locales. Las discrepancias solicitan conciliación sin repetir el cobro.

Las copias conservan identificadores para reconocer reintentos; restaurar solo en instalación vacía y retirar el dispositivo anterior antes de continuar. Se validan antes de reemplazar el libro. No contienen tokens, pero pueden incluir datos de pedidos.

Consultar [análisis y activación](../docs/DONAS_CONTROL_1.3.0_ANALISIS_Y_ACTIVACION.md) para despliegue, notificaciones, transición del inventario y límites comprobados.
