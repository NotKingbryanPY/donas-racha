# Donas Control Offline para iPhone

Versión iOS independiente de la app Android. Registra ventas de 1 a 99 donas por operación en **Efectivo** o **Yappy**, conserva stock local, precio configurable, historial, totales diarios y permite deshacer la última venta. El widget mediano/grande tiene botones **− / cantidad / +** y registra el cobro directamente sin abrir la app. Todo se guarda en SQLite dentro de un App Group compartido por la app y el widget. No hay API, inicio de sesión, pedidos, permisos de Internet ni sincronización con Supabase/Apps Script. Tampoco importa automáticamente la base Android.

## Abrir en una Mac

1. Instala Xcode con SDK iOS 17 o posterior y [XcodeGen](https://github.com/yonaskolb/XcodeGen).
2. En Terminal, entra en `ios/DonasControlOffline` y ejecuta `xcodegen generate`.
3. Abre `DonasControlOffline.xcodeproj` en Xcode. Selecciona tu equipo Apple en **Signing & Capabilities** para los targets **DonasControlOffline** y **DonasWidgetExtension**.
4. Registra y habilita el App Group `group.com.bryan.donascontrol.offline` para **ambos** identificadores de aplicación. Si ese nombre no está disponible para tu equipo, cambia el mismo identificador en `project.yml` y `Shared/Store.swift`, vuelve a generar el proyecto y registra el nuevo grupo. Sin esta capacidad, la app muestra un error claro y no crea dos bases independientes.
5. Compila y ejecuta el esquema **DonasControlOffline** en un iPhone con iOS 17 o superior. Ajusta el stock y precio en **Stock y precio** antes de vender. Agrega **Venta rápida de donas** a la pantalla de inicio desde el selector de widgets.

Para comprobar desde Xcode: registra varias donas por Efectivo y Yappy tanto en la app como en el widget; confirma que el stock y los totales diarios coincidan; intenta vender más de lo disponible; deshaz la última venta; cierra y vuelve a abrir la app; y repite con el iPhone sin conexión. Los registros permanecen únicamente en ese iPhone y se pierden al desinstalar la app. Haz una copia antes de borrar la instalación si contienen ventas reales.

Esta carpeta contiene la especificación de XcodeGen, fuentes SwiftUI/WidgetKit y almacenamiento SQLite. Se creó en Windows, donde Xcode no está disponible; **aún falta compilar y probar en una Mac y en un iPhone**. No es un IPA listo para instalar.
