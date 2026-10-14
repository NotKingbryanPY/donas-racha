# Historial de decisiones y documentación

## 2026-10-13 — Donas Control 2

Base web70164c4. Se leyó la guía anterior y se preservó copia local en outputs/knowledge-before-donas-control-2. Se consolidan guías/modelo/diagramas para nueva app diaria: Supabase compartido, Room6 preservado, UUID/outbox, compras configurables, ventas/pago dividido, consumo, costo central y cierre seguro. Cambia explícitamente el alcance retirado el12octubre; no se rehabilitan flujos móviles antiguos.

SQL aditivo probado con el archivo móvil presente; backend reutiliza router sin nueva función Vercel; Dashboard añade lectura de datos confirmados. Ejemplo visual generado antes de UI. Evidencia/activación pendientes en VALIDATION y OPEN_ISSUES. Cada cambio posterior debe registrar pruebas, riesgo/limitación y actualización documental en la misma entrega.

## Historia recuperada

8octubre: guía de conocimiento inicial sobre web, Room5, contabilidad por instalación, Firebase/preferencias/FCM; fuente93643ed. 1.4.2 d304e46 mejoró recuperación push, pero faltaban credenciales de emisión. 12octubre fe8bcbb retiró integración móvil/cron; web1.5.0 Supabase independiente. 13octubre PR40/main70164c4 publicó web1.5.1, conservando cero/borradores y cancelación en camino. Los informes fechados se mantienen en docs y Git. Esta historia no certifica costo/datos de cada teléfono ni esquema privado actual.
