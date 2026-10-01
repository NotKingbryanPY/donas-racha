# Donas Control para iPad — código SwiftUI

`DonasControl.swift` es el código fuente de un visor de pedidos. En un iPad con Swift Playgrounds, crea un proyecto **App**, sustituye el archivo principal por este y elimina el `@main` que trae el proyecto. Alternativamente, crea una app iPadOS 17+ en Xcode y agrega el archivo. Para instalarla hay que compilarla y firmarla con una cuenta Apple.

La cuenta de administrador se introduce una vez; el token de renovación queda en el llavero del iPad. La app consulta pedidos al abrirse y cada 30 segundos mientras está visible, con avisos locales para pedidos nuevos detectados. Se debe autorizar el permiso de notificaciones. Con la app cerrada o suspendida, iPadOS no mantiene esta consulta; para avisos inmediatos en segundo plano se necesita integrar APNs y registrar cada dispositivo en el servidor.

Este archivo no se pudo compilar ni instalar desde Windows. No contiene credenciales ni sustituye el despliegue del backend.
