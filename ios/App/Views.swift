import SwiftUI
import UniformTypeIdentifiers

struct MainView: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        TabView(selection:$model.tab) {
            HomeView().tabItem { Label("Inicio",systemImage:"house.fill") }.tag(0)
            OrdersView().tabItem { Label("Pedidos",systemImage:"bag.fill") }.tag(1).badge(model.state.activeOrders.count)
            SalesView().tabItem { Label("Ventas",systemImage:"dollarsign.circle.fill") }.tag(2)
            InventoryView().tabItem { Label("Inventario",systemImage:"shippingbox.fill") }.tag(3)
            SettingsView().tabItem { Label("Ajustes",systemImage:"gearshape.fill") }.tag(4)
        }.safeAreaInset(edge:.bottom) {
            Text(model.message).font(.caption).padding(8).frame(maxWidth:.infinity).background(.ultraThinMaterial)
        }
    }
}
enum OperationKind: String, Identifiable {
    case open="Abrir jornada",close="Cerrar jornada",purchase="Comprar cajas",expense="Gasto de negocio"
    case personal="Gasto personal",transfer="Transferencia",loan="Préstamo recibido",repay="Pagar préstamo",partner="Pagar socio"
    var id: String { rawValue }
}
struct HomeView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var network: NetworkStatus
    @State private var operation: OperationKind?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:18) {
                    VStack(alignment:.leading,spacing:8) {
                        Text("Tu negocio, al día").font(.largeTitle.bold())
                        Label(network.stableWifi ? "Wi‑Fi estable" : network.online ? "Conectado · esperando Wi‑Fi estable" : "Trabajando sin conexión",systemImage:network.online ? "wifi" : "wifi.slash")
                        Text("\(model.state.pending.count) pendientes · \(model.state.dayOpen ? "Jornada abierta" : "Jornada cerrada")").font(.subheadline)
                    }.frame(maxWidth:.infinity,alignment:.leading).padding(22).background(Color.brown.opacity(0.12),in:RoundedRectangle(cornerRadius:24))
                    LazyVGrid(columns:[GridItem(.adaptive(minimum:155))],spacing:12) {
                        Metric(title:"Pedidos activos",value:String(model.state.activeOrders.count),symbol:"bag")
                        Metric(title:"Stock local",value:"\(model.state.stock) donas",symbol:"shippingbox")
                        Metric(title:"Efectivo local",value:money(model.state.balance("CASH")),symbol:"banknote")
                        Metric(title:"Yappy local",value:money(model.state.balance("YAPPY")),symbol:"creditcard")
                    }
                    Button("Registrar venta",systemImage:"plus.circle.fill") { model.tab=2 }.buttonStyle(.borderedProminent).controlSize(.large)
                    HStack {
                        Button(model.state.dayOpen ? "Cerrar jornada" : "Abrir jornada") { operation=model.state.dayOpen ? .close : .open }
                        Button("Comprar cajas") { operation = .purchase }
                    }.buttonStyle(.bordered)
                    GroupBox("Ganancia y socios · libro local acumulado") {
                        VStack(alignment:.leading,spacing:8) {
                            Text(money(model.state.profit)).font(.title.bold())
                            ForEach(Array(Ledger.shares(model.state).enumerated()),id:\.offset) { entry in
                                HStack { Text(entry.element.0);Spacer();Text(money(entry.element.1)) }
                            }
                            Text("Reparto estimado antes de pagos. Pagos realizados: \(money(model.state.balance("PARTNER")))").font(.caption).foregroundStyle(.secondary)
                        }.frame(maxWidth:.infinity,alignment:.leading)
                    }
                    GroupBox("Últimos movimientos") {
                        VStack { ForEach(Array(model.state.events.suffix(5).reversed())) { event in EventRow(event:event) } }
                    }
                    if let synced=model.state.lastSync { Text("Última sincronización: \(synced.formatted(date:.abbreviated,time:.shortened))").font(.caption).foregroundStyle(.secondary) }
                }.padding().frame(maxWidth:900)
            }.navigationTitle("Donas Control").navigationBarTitleDisplayMode(.inline)
                .toolbar { Button { Task { await model.synchronize() } } label: { Image(systemName:"arrow.clockwise") }.disabled(model.busy) }
                .sheet(item:$operation) { OperationForm(kind:$0) }
        }
    }
}
struct Metric: View {
    let title: String;let value: String;let symbol: String
    var body: some View {
        VStack(alignment:.leading,spacing:10) {
            Label(title,systemImage:symbol).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title2.bold()).minimumScaleFactor(0.7).lineLimit(1)
        }.frame(maxWidth:.infinity,alignment:.leading).padding(18).background(.background,in:RoundedRectangle(cornerRadius:18))
            .overlay(RoundedRectangle(cornerRadius:18).stroke(.quaternary))
    }
}
struct OrdersView: View {
    @EnvironmentObject var model: AppModel
    @State private var filter="ACTIVE"
    @State private var selected: RemoteOrder?
    @State private var payment="CASH"
    @State private var cancelOrder: RemoteOrder?
    var visible: [RemoteOrder] { model.state.orders.filter { filter=="ALL" || !["COMPLETED","CANCELLED"].contains($0.status) } }
    var body: some View {
        NavigationStack {
            List {
                if !model.signedIn {
                    Section { Text("Conecta tu cuenta una vez desde Ajustes para recibir pedidos.");Button("Abrir Ajustes") { model.tab=4 } }
                }
                Picker("Mostrar",selection:$filter) { Text("Activos").tag("ACTIVE");Text("Historial").tag("ALL") }.pickerStyle(.segmented)
                if visible.isEmpty { ContentUnavailableView("Todo al día",systemImage:"bag",description:Text("Los pedidos aparecerán aquí al sincronizar.")) }
                ForEach(visible) { order in
                    Section {
                        HStack { Text(order.customerName ?? "Cliente").font(.headline);Spacer();Text(money(order.totalCents)).bold() }
                        Text(order.deliveryLocation ?? "").foregroundStyle(.secondary)
                        if let phone=order.customerPhone { Text(phone).font(.caption) }
                        ForEach(Array(order.items.enumerated()),id:\.offset) { entry in Text("\(entry.element.quantity) × \(entry.element.variantName ?? "Dona")") }
                        Text(order.paymentStatus=="CONFIRMED" ? "Cobrado" : order.paymentMethod=="YAPPY" ? "Yappy al recibir" : "Efectivo al recibir").font(.caption)
                        if order.status=="PENDING" {
                            Button("Aceptar pedido") { Task { await model.transition(order,to:"ACCEPTED") } }
                            Button("Cancelar",role:.destructive) { cancelOrder=order }
                        }
                        if order.status=="ACCEPTED" {
                            Button("En camino") { Task { await model.transition(order,to:"OUT_FOR_DELIVERY") } }
                            Button("Cancelar",role:.destructive) { cancelOrder=order }
                        }
                        if order.status=="OUT_FOR_DELIVERY" { Button("Cobrado y entregado") { payment=order.paymentMethod;selected=order } }
                    } header: { Text("\(order.statusName) · \(order.publicCode)") }
                    .disabled(model.busy)
                }
            }.navigationTitle("Pedidos").refreshable { await model.synchronize() }
                .toolbar { Button("Actualizar") { Task { await model.synchronize() } }.disabled(model.busy) }
                .confirmationDialog("Cancelar el pedido libera sus donas reservadas.",isPresented:Binding(get:{ cancelOrder != nil },set:{ if !$0 { cancelOrder=nil } })) {
                    Button("Cancelar pedido",role:.destructive) { if let order=cancelOrder { Task { await model.transition(order,to:"CANCELLED") } };cancelOrder=nil }
                }
                .sheet(item:$selected) { order in
                    NavigationStack {
                        Form {
                            Text("Confirma que recibiste \(money(order.totalCents)) y entregaste las donas.")
                            Picker("Cobrado por",selection:$payment) { Text("Efectivo").tag("CASH");Text("Yappy").tag("YAPPY") }.disabled(order.paymentStatus=="CONFIRMED")
                            Button("Confirmar cobro y entrega") { selected=nil;Task { await model.transition(order,to:"COMPLETED",payment:payment) } }.buttonStyle(.borderedProminent)
                        }.navigationTitle(order.publicCode).toolbar { Button("Volver") { selected=nil } }
                    }.presentationDetents([.medium])
                }
        }
    }
}
struct SalesView: View {
    @EnvironmentObject var model: AppModel
    @State private var quantities: [String:Int] = [:]
    @State private var payment="CASH"
    @State private var operation: OperationKind?
    @State private var undo=false
    @State private var period=0
    private var selected: [String:Int] { quantities.filter { $0.value>0 } }
    private var count: Int { selected.values.reduce(0,+) }
    private var history: [LocalEvent] {
        let calendar=Calendar.current
        let start=period==0 ? calendar.startOfDay(for:Date()) : calendar.dateInterval(of:period==1 ? .weekOfYear : .month,for:Date())!.start
        return model.state.events.filter { $0.date>=start }.reversed()
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Nueva venta por sabor") {
                    ForEach(Flavor.allCases,id:\.rawValue) { flavor in
                        Stepper(value:Binding(get:{ quantities[flavor.rawValue] ?? 0 },set:{ quantities[flavor.rawValue]=$0 }),in:0...min(99,model.state.stock(flavor))) {
                            VStack(alignment:.leading) { Text("\(flavor.name): \(quantities[flavor.rawValue] ?? 0)");Text("\(model.state.stock(flavor)) disponibles en este libro").font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                    Picker("Cobro",selection:$payment) { Text("Efectivo").tag("CASH");Text("Yappy").tag("YAPPY") }.pickerStyle(.segmented)
                    Text("\(count) donas · \(money(Int64(count)*model.state.config.unitPriceCents))").font(.title2.bold())
                    Button("Guardar venta") {
                        if model.commit({ try Ledger.sale(&$0,items:selected,account:payment) }) {
                            quantities=[:];model.message="Venta guardada en el dispositivo.";Task { await model.synchronize() }
                        }
                    }.disabled(count==0 || count>99 || !model.state.dayOpen || model.storageProblem).buttonStyle(.borderedProminent)
                    if !model.state.dayOpen { Text("Abre una jornada desde Inicio.").foregroundStyle(.secondary) }
                    Button("Deshacer última venta",role:.destructive) { undo=true }
                }
                Section("Más operaciones") { ForEach([OperationKind.purchase,.expense,.personal,.transfer,.loan,.repay,.partner]) { kind in Button(kind.rawValue) { operation=kind } } }
                Section("Historial y estadísticas locales") {
                    Picker("Período",selection:$period) { Text("Hoy").tag(0);Text("Semana").tag(1);Text("Mes").tag(2) }.pickerStyle(.segmented)
                    Text("Ventas netas: \(money(history.filter { ["SALE","REVERSAL"].contains($0.type) }.reduce(0) { $0+$1.amountCents }))")
                    ForEach(history) { EventRow(event:$0) }
                }
            }.navigationTitle("Ventas").sheet(item:$operation) { OperationForm(kind:$0) }
                .confirmationDialog("¿Deshacer la última venta presencial?",isPresented:$undo) { Button("Deshacer venta",role:.destructive) { model.record { try Ledger.reverseLastSale(&$0) } } }
        }
    }
}
struct EventRow: View {
    let event: LocalEvent
    var body: some View {
        HStack {
            VStack(alignment:.leading,spacing:4) { Text(event.title);Text(event.date.formatted(date:.abbreviated,time:.shortened)).font(.caption).foregroundStyle(.secondary) }
            Spacer();Text(money(event.amountCents)).monospacedDigit().strikethrough(event.reversed)
        }.padding(.vertical,4)
    }
}
struct InventoryView: View {
    @EnvironmentObject var model: AppModel
    @State private var physical=false
    var body: some View {
        NavigationStack {
            List {
                Section("Este dispositivo · disponible sin conexión") {
                    ForEach(Flavor.allCases,id:\.rawValue) { flavor in LabeledContent(flavor.name,value:String(model.state.stock(flavor))) }
                    Text("Cada caja contiene 12 donas: 4 chocolate, 4 vainilla y 2 de cada sabor con chispas.").font(.caption)
                }
                Section("Inventario publicado · todo el negocio") {
                    if let snapshot=model.state.inventory {
                        ForEach(snapshot.flavors) { flavor in
                            VStack(alignment:.leading) {
                                Text(flavor.name).font(.headline)
                                Text("\(flavor.availableQuantity) disponibles · \(flavor.reservedQuantity) reservadas")
                                if !flavor.counted { Text("Requiere conteo o conciliación").foregroundStyle(.orange) }
                            }
                        }
                        Text("Última consulta: \(snapshot.serverTime)").font(.caption).foregroundStyle(.secondary)
                        Button("Registrar conteo físico compartido") { physical=true }
                    } else { Text("Conecta tu cuenta y actualiza para consultar las existencias de la página.") }
                }
                Section { Text("Las ventas de todos los socios llegan al inventario compartido después de sincronizar por Wi‑Fi. Las reservas ya están descontadas de las unidades disponibles en la página.") }.font(.caption).foregroundStyle(.secondary)
            }.navigationTitle("Inventario").refreshable { await model.synchronize() }
                .toolbar { Button("Actualizar") { Task { await model.synchronize() } } }.sheet(isPresented:$physical) { PhysicalCountView() }
        }
    }
}
struct PhysicalCountView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) var dismiss
    @State private var counts: [String:String] = [:]
    @State private var revision: Int64?
    var body: some View {
        NavigationStack {
            Form {
                Text("Cuenta las existencias de todo el negocio, incluidas las donas reservadas. Sincroniza primero los dispositivos de todos los socios.")
                ForEach(Flavor.allCases,id:\.rawValue) { flavor in TextField(flavor.name,text:Binding(get:{ counts[flavor.rawValue] ?? "" },set:{ counts[flavor.rawValue]=$0 })).keyboardType(.numberPad) }
                Button("Guardar conteo") {
                    var normalized: [String:Int] = [:]
                    for flavor in Flavor.allCases {
                        guard let value=Int(counts[flavor.rawValue] ?? ""),(0...100000).contains(value) else { model.message="Completa los cuatro sabores con cantidades entre 0 y 100000.";return }
                        normalized[flavor.rawValue]=value
                    }
                    guard let revision else { return }
                    Task { await model.savePhysicalInventory(counts:normalized,revision:revision);dismiss() }
                }.disabled(model.busy || !model.state.pending.isEmpty || revision==nil)
            }.navigationTitle("Conteo físico").toolbar { Button("Volver") { dismiss() } }.onAppear { revision=model.state.inventory?.revision }
        }
    }
}
struct OperationForm: View {
    let kind: OperationKind
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) var dismiss
    @State private var amount=""
    @State private var second="0"
    @State private var description=""
    @State private var account="CASH"
    @State private var boxes=1
    var body: some View {
        NavigationStack {
            Form {
                if kind == .purchase {
                    Stepper("\(boxes) caja(s) · \(boxes*12) donas",value:$boxes,in:1...10000)
                    Text("Por caja: 4 chocolate, 4 vainilla, 2 chocolate con chispas y 2 vainilla con chispas.")
                    Text("Costo total: \(money(model.state.config.boxCostCents*Int64(boxes)))")
                } else if kind == .close { Text("Stock al cierre: \(model.state.stock) donas. Revisa el conteo físico antes de cerrar.") }
                else {
                    TextField(kind == .open ? "Efectivo que agregas como capital" : "Importe",text:$amount).keyboardType(.decimalPad)
                    if kind == .open || kind == .transfer { TextField(kind == .open ? "Yappy que agregas como capital" : "Comisión",text:$second).keyboardType(.decimalPad) }
                }
                if kind != .open && kind != .close {
                    Picker("Cuenta",selection:$account) { Text("Efectivo").tag("CASH");Text("Yappy").tag("YAPPY");if kind == .purchase { Text("Compra a crédito").tag("LOAN") } }
                }
                if [.expense,.personal,.partner].contains(kind) { TextField(kind == .partner ? "Nombre del socio" : "Motivo",text:$description) }
                Button("Guardar") { save() }.buttonStyle(.borderedProminent).disabled(model.storageProblem)
            }.navigationTitle(kind.rawValue).navigationBarTitleDisplayMode(.inline).toolbar { Button("Volver") { dismiss() } }
        }
    }
    private func save() {
        let cents=parseCents(amount),other=parseCents(second)
        if kind != .purchase && kind != .close && cents==nil { model.message="Escribe el importe con hasta dos decimales.";return }
        let saved=model.commit { next in
            switch kind {
            case .open: guard let other else { throw BusinessError.invalid("Saldo Yappy inválido.") };try Ledger.openDay(&next,cash:cents ?? 0,yappy:other)
            case .close: try Ledger.closeDay(&next)
            case .purchase: try Ledger.purchase(&next,boxes:boxes,account:account)
            case .expense,.personal: try Ledger.expense(&next,cents:cents ?? 0,account:account,title:description.isEmpty ? kind.rawValue : description,personal:kind == .personal)
            case .transfer: guard let other else { throw BusinessError.invalid("Comisión inválida.") };try Ledger.transfer(&next,cents:cents ?? 0,fee:other,from:account)
            case .loan,.repay: try Ledger.loan(&next,cents:cents ?? 0,account:account,repay:kind == .repay)
            case .partner: try Ledger.partnerPayment(&next,cents:cents ?? 0,account:account,name:description)
            }
        }
        if saved { model.message="Registro guardado.";dismiss();Task { await model.synchronize() } }
    }
}
struct SettingsView: View {
    @EnvironmentObject var model: AppModel
    @State private var email=""
    @State private var password=""
    @State private var cost="6.00"
    @State private var price="1.00"
    @State private var exportURL: URL?
    @State private var importing=false
    @State private var logout=false
    var body: some View {
        NavigationStack {
            Form {
                Section("Cuenta y sesión") {
                    if model.signedIn {
                        Label("Sesión guardada",systemImage:"lock.shield")
                        Text("Se renueva automáticamente. Una pérdida de Wi‑Fi no cierra tu sesión.").font(.caption)
                        Button("Cerrar sesión",role:.destructive) { logout=true }.disabled(model.busy)
                    } else {
                        TextField("Correo administrador",text:$email).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.emailAddress)
                        SecureField("Contraseña",text:$password)
                        Button("Conectar una vez") { Task { await model.login(email:email,password:password);if model.signedIn { password="" } } }.disabled(model.busy || email.isEmpty || password.isEmpty)
                    }
                }
                Section("Notificaciones y conexión") {
                    Text(model.pushRegistered ? "Push registrado en el servidor" : "Avisos locales al consultar. Push pendiente de configuración o registro.")
                    Button("Activar notificaciones") { Task { await model.requestNotifications() } }
                    Button("Sincronizar ahora") { Task { await model.synchronize() } }.disabled(model.busy)
                    Text("Las escrituras esperan 10 segundos de Wi‑Fi estable. iOS decide cuándo permite las tareas en segundo plano; al abrir la app vuelve a intentar los pendientes.").font(.caption)
                }
                Section("Configuración del libro local") {
                    TextField("Costo por caja",text:$cost).keyboardType(.decimalPad)
                    TextField("Precio por dona",text:$price).keyboardType(.decimalPad)
                    Button("Guardar precios") {
                        guard let c=parseCents(cost),let p=parseCents(price),c>0,p>0,c<=1_000_000,p<=1_000_000 else { model.message="Precios inválidos.";return }
                        model.record { $0.config.boxCostCents=c;$0.config.unitPriceCents=p }
                    }
                    Text("Los nuevos precios se aplican a las ventas siguientes. Los pedidos conservan el precio confirmado en la página.").font(.caption)
                    NavigationLink("Socios y reparto estimado") { PartnersView() }
                }
                Section("Copias del libro local") {
                    Button("Preparar copia") { do { exportURL=try model.export() } catch { model.message=error.localizedDescription } }
                    if let exportURL { ShareLink("Guardar o compartir copia",item:exportURL) }
                    Button("Restaurar copia iOS") { importing=true }
                    Text("Las copias contienen movimientos y datos de pedidos, sin contraseñas ni tokens. Restaura solo en una instalación vacía y retira el dispositivo anterior antes de continuar.").font(.caption)
                }
                Section { Text("Donas Control 1.3.0 · iPhone y iPad\n12 donas por caja · 4/4/2/2").font(.caption).foregroundStyle(.secondary) }
            }.navigationTitle("Ajustes")
                .onAppear { cost=String(format:"%.2f",Double(model.state.config.boxCostCents)/100);price=String(format:"%.2f",Double(model.state.config.unitPriceCents)/100) }
                .confirmationDialog("¿Cerrar sesión? El libro local se conserva.",isPresented:$logout) { Button("Cerrar sesión",role:.destructive) { Task { await model.logout() } } }
                .fileImporter(isPresented:$importing,allowedContentTypes:[.json]) { result in
                    do { try model.restore(result.get());model.message="Copia restaurada." } catch { model.message=error.localizedDescription }
                }
        }
    }
}
struct PartnersView: View {
    @EnvironmentObject var model: AppModel
    @State private var partners: [Partner] = []
    var body: some View {
        Form {
            ForEach($partners) { $partner in TextField("Nombre",text:$partner.name);Stepper("\(partner.percentage)%",value:$partner.percentage,in:0...100) }.onDelete { partners.remove(atOffsets:$0) }
            Button("Agregar socio") { if partners.count<8 { partners.append(Partner(name:"Socio",percentage:0)) } }
            Text("Total: \(partners.reduce(0) { $0+$1.percentage })%")
            Button("Guardar reparto") {
                guard !partners.isEmpty,partners.reduce(0,{ $0+$1.percentage })==100,partners.allSatisfy({ !$0.name.trimmingCharacters(in:.whitespaces).isEmpty }) else { model.message="Completa los nombres y reparte exactamente el 100%.";return }
                model.record { $0.partners=partners }
            }
            Text("Estimación acumulada por porcentajes, con centavos repartidos por mayor residuo. Los pagos se registran por separado en Ventas.").font(.caption)
        }.navigationTitle("Socios").onAppear { partners=model.state.partners }
    }
}
