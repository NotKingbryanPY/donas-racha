# Dependencias y herramientas

[Contexto](AI_CONTEXT.md) · [Build](RUNBOOK.md)

Web HTML/CSS/JS sin framework ni bundler; backend CommonJS Node 22, fetch/crypto; package.json sin dependencias servidor. SDK Supabase 2.117.3 vendorizado para catálogo Realtime; Nunito WOFF2 local. No Firebase Admin ni emisor FCM restaurados.

Android 2.0.0/código 15: Gradle 8.11.1, AGP 8.9.2, Kotlin 2.1.20/KSP, JDK17, compile/target35/min23. Views/Material1.12.0, AppCompat1.7.0, Room2.7.1, WorkManager2.9.1, lifecycle2.8.7, core1.15.0. Conserva dependencias/config pública Firebase históricas necesarias para compilar fuentes preservadas; no introduce un nuevo SDK comercial ni inicializa Firestore/FCM para el flujo nuevo. No se cambió facturación ni Firestore.

Pruebas: JUnit/Robolectric/MockWebServer, PGlite0.5.8, Playwright1.62.1, pg8.16.3 en CI, Python biblioteca estándar para conocimiento. Las herramientas de prueba no son dependencias de runtime web. Pines actuales se mantienen por compatibilidad API23; lint no certifica ausencia de bugs o políticas de tienda futuras.

SDK config pública Firebase y firma oficial se verificaron mediante metadatos existentes; las credenciales privadas de firma se leen solo en el build fuera de Git. El APK utiliza www.dracha.store y nunca una clave service_role. Variables Vercel existentes Supabase se conservan. iOS/Apps Script no se recompilan ni despliegan.
