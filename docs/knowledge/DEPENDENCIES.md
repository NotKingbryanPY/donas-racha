# Dependencias y herramientas

[Contexto](AI_CONTEXT.md) · [Build](RUNBOOK.md)

Web HTML/CSS/JS sin framework ni bundler; backend CommonJS Node 22, fetch/crypto; @vercel/functions3.10.1 mantiene tareas postrespuesta. SDK Supabase 2.117.3 vendorizado para catálogo Realtime; Nunito WOFF2 local. Emisor FCM HTTPv1 con fetch/crypto, sin Firebase Admin SDK.

Android2.1.1/código17: Gradle 8.11.1, AGP 8.9.2, Kotlin 2.1.20/KSP, JDK17, compile/target35/min23. Views/Material1.12.0, AppCompat1.7.0, Room2.7.1, WorkManager2.9.1, lifecycle2.8.7, core1.15.0. Conserva dependencias/config pública Firebase históricas necesarias para compilar fuentes preservadas; FCM se inicializa para el flujo2.1, sin nueva base comercial ni escritura Firestore. No se cambió facturación ni Firestore.

Pruebas: JUnit/Robolectric/MockWebServer, PGlite0.5.8, Playwright1.62.1, pg8.16.3 en CI, Python biblioteca estándar para conocimiento. Las herramientas de prueba no son dependencias de runtime web. Pines actuales se mantienen por compatibilidad API23; lint no certifica ausencia de bugs o políticas de tienda futuras.

SDK config pública Firebase y firma oficial se verificaron mediante metadatos existentes; las credenciales privadas de firma se leen solo en el build fuera de Git. El APK utiliza www.dracha.store y nunca una clave service_role. Variables Vercel existentes Supabase se conservan. iOS/Apps Script no se recompilan ni despliegan.

## Actualización2.1

Android2.1.1/código17/Room7: mismo SDK/material/workmanager; el seguimiento del registro usa LiveData/WorkInfo existentes, sin añadir dependencias. FCM existente se activa con proyecto/app/certificado ya verificados. No nueva base Firebase ni servicios permanentes. API añade solo @vercel/functions3.10.1 para mantener tareas postrespuesta; continúa Node22/CommonJS y12 rutas, no otra función serverless. Spark se mantiene. Cron/pg_net/Vault son configuración Supabase separada; no Cloud Functions de pago.

## Identidad y seguimiento Drachas

Sin dependencias nuevas del runtime. SVG trazado sin fuentes externas; Nunito local del producto se conserva. build-brand-assets.cjs usa @resvg/resvg-js2.6.2 de desarrollo mediante RESVG_MODULE o módulo instalado, para PNG/favicon/social. No se empaqueta con la API. AbortController propio evita depender de AbortSignal.timeout en el navegador; Web Locks es mejora progresiva para dedupe, con fallback. Sin Firebase/FCM web nuevo.


## Portada de recompensas — 18 octubre 2026

La portada nueva no añade paquetes, fuentes, servicios, Firebase o imágenes remotas. Conserva Nunito local. Solo HTML/CSS/JS y tres WebP locales de la ilustración autorizada (24/80/170KB, redondeados). image_gen creó el original; Pillow del runtime de desarrollo solo redimensionó/comprimió. Sin dependencia nueva de ejecución. Reutiliza la API getCliente y catálogo existentes.
