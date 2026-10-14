# Historial de decisiones y documentación

## 2026-10-14 — verificación continuada

El conjunto final local pasó113 pruebas, lint estricto debug/official y build/R8. APK oficial2.0.0/código15,5,398,339bytes, misma firma anterior; SHA256 y análisis de secretos en DONAS_CONTROL_2_RESULTADOS. La copia de distribución/sha se añade a downloads para acceso desde teléfono. Fuente Androidef54035; web/conocimiento CI verdes, emuladores pendientes en ese momento. Producción SQL sigue sin ejecución real por fallo del kernel Browser/Computer.

109 de111 pruebas Android pasaron en el primer conjunto completo. Se corrigieron dos fixtures: orden de qualifiers para captura y WorkManager inicializado dos veces en la prueba histórica. Las pruebas de negocio/Room/reintentos ya habían pasado. CI de documentación detectó diferencia CRLF en README/licencia vendor; se corrigió normalización preservando bytes del bundle JS. Validación final/build firmado continúan; no confundir estos resultados parciales con APK entregado o SQL real activado.

## 2026-10-13 — Donas Control 2

Base web70164c4. Se leyó la guía anterior y se preservó copia local en outputs/knowledge-before-donas-control-2. Se consolidan guías/modelo/diagramas para nueva app diaria: Supabase compartido, Room6 preservado, UUID/outbox, compras configurables, ventas/pago dividido, consumo, costo central y cierre seguro. Cambia explícitamente el alcance retirado el12octubre; no se rehabilitan flujos móviles antiguos.

SQL aditivo probado con el archivo móvil presente; backend reutiliza router sin nueva función Vercel; Dashboard añade lectura de datos confirmados. Ejemplo visual generado antes de UI. Evidencia/activación pendientes en VALIDATION y OPEN_ISSUES. Cada cambio posterior debe registrar pruebas, riesgo/limitación y actualización documental en la misma entrega.

## Historia recuperada

8octubre: guía de conocimiento inicial sobre web, Room5, contabilidad por instalación, Firebase/preferencias/FCM; fuente93643ed. 1.4.2 d304e46 mejoró recuperación push, pero faltaban credenciales de emisión. 12octubre fe8bcbb retiró integración móvil/cron; web1.5.0 Supabase independiente. 13octubre PR40/main70164c4 publicó web1.5.1, conservando cero/borradores y cancelación en camino. Los informes fechados se mantienen en docs y Git. Esta historia no certifica costo/datos de cada teléfono ni esquema privado actual.
