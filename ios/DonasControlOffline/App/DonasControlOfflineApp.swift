import SwiftUI
import WidgetKit

@main
struct DonasControlOfflineApp: App {
    var body: some Scene {
        WindowGroup { HomeView() }
    }
}

struct HomeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var dashboard: Dashboard?
    @State private var quantity = 1
    @State private var message: String?
    @State private var editingSettings = false
    @State private var undoConfirmation = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let dashboard {
                        HStack {
                            summary("Disponibles", "\(dashboard.stock)", "donas")
                            summary("Vendidas hoy", "\(dashboard.todayQuantity)", "donas")
                        }
                        .frame(maxWidth: .infinity)

                        VStack(alignment: .leading, spacing: 16) {
                            Text("Nueva venta").font(.title2.bold())
                            Text("\(money(dashboard.priceCents)) por dona")
                                .foregroundStyle(.secondary)
                            HStack(spacing: 20) {
                                quantityButton("−", enabled: quantity > 1) { quantity -= 1 }
                                Text("\(quantity)").font(.system(size: 38, weight: .bold, design: .rounded))
                                    .monospacedDigit().frame(minWidth: 55)
                                quantityButton("+", enabled: quantity < min(99, dashboard.stock)) { quantity += 1 }
                            }
                            .frame(maxWidth: .infinity)
                            Text("Total: \(money(dashboard.priceCents * Int64(quantity)))")
                                .font(.title3.bold())
                            HStack {
                                saleButton("Efectivo", payment: .cash, enabled: dashboard.stock >= quantity)
                                saleButton("Yappy", payment: .yappy, enabled: dashboard.stock >= quantity)
                            }
                        }
                        .padding(20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Cobros de hoy").font(.headline)
                            HStack {
                                Text("Efectivo")
                                Spacer()
                                Text(money(dashboard.cashCents)).bold()
                            }
                            HStack {
                                Text("Yappy")
                                Spacer()
                                Text(money(dashboard.yappyCents)).bold()
                            }
                            Divider()
                            HStack {
                                Text("Total").bold()
                                Spacer()
                                Text(money(dashboard.cashCents + dashboard.yappyCents)).bold()
                            }
                        }
                        .padding(20)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))

                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Últimas ventas").font(.headline)
                                Spacer()
                                if !dashboard.sales.isEmpty {
                                    Button("Deshacer última") { undoConfirmation = true }.font(.subheadline)
                                }
                            }
                            if dashboard.sales.isEmpty {
                                Text("Aún no hay ventas registradas.").foregroundStyle(.secondary)
                            } else {
                                ForEach(dashboard.sales) { sale in
                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text("\(sale.quantity) dona\(sale.quantity == 1 ? "" : "s") · \(sale.payment.rawValue)")
                                            Text(sale.date, style: .date).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Text(money(sale.totalCents)).bold()
                                    }
                                    if sale.id != dashboard.sales.last?.id { Divider() }
                                }
                            }
                        }
                        .padding(20)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
                    } else {
                        ContentUnavailableView("No se pudieron abrir los datos locales", systemImage: "externaldrive.badge.exclamationmark", description: Text(message ?? "Revisa App Groups en Xcode."))
                    }
                }
                .padding()
            }
            .navigationTitle("Donas Control")
            .toolbar { Button("Stock y precio") { editingSettings = true } }
            .sheet(isPresented: $editingSettings) { SettingsView(onSaved: refresh) }
            .alert("Aviso", isPresented: Binding(get: { message != nil && dashboard != nil }, set: { if !$0 { message = nil } })) {
                Button("Aceptar") { message = nil }
            } message: { Text(message ?? "") }
            .confirmationDialog("¿Deshacer la última venta?", isPresented: $undoConfirmation) {
                Button("Deshacer venta", role: .destructive) { perform { try Store.undoLastSale() } }
            } message: { Text("La cantidad vendida volverá al stock y se descontará del resumen.") }
            .onAppear(perform: refresh)
            .onChange(of: scenePhase) { _, phase in if phase == .active { refresh() } }
        }
        .tint(.brown)
    }

    private func summary(_ label: String, _ value: String, _ unit: String) -> some View {
        VStack(alignment: .leading) {
            Text(label).font(.subheadline).foregroundStyle(.secondary)
            Text(value).font(.system(size: 34, weight: .bold, design: .rounded)).monospacedDigit()
            Text(unit).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
    }

    private func quantityButton(_ label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(label).font(.title.bold()).frame(width: 56, height: 56) }
            .buttonStyle(.bordered)
            .disabled(!enabled)
            .accessibilityLabel(label == "+" ? "Aumentar cantidad" : "Reducir cantidad")
    }

    private func saleButton(_ label: String, payment: Payment, enabled: Bool) -> some View {
        Button(label) { perform { try Store.recordSale(quantity: quantity, payment: payment); quantity = 1 } }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity)
            .disabled(!enabled)
    }

    private func perform(_ action: () throws -> Void) {
        do { try action(); refresh(); WidgetCenter.shared.reloadAllTimelines() }
        catch { message = error.localizedDescription }
    }

    private func refresh() {
        do {
            dashboard = try Store.snapshot()
            quantity = min(max(1, quantity), max(1, min(99, dashboard?.stock ?? 1)))
        } catch { dashboard = nil; message = error.localizedDescription }
    }
}

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    let onSaved: () -> Void
    @State private var stock = ""
    @State private var price = ""
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Inventario") {
                    TextField("Donas disponibles", text: $stock).keyboardType(.numberPad)
                    Text("Escribe la cantidad física actual. No se borran las ventas.").font(.footnote)
                }
                Section("Precio") {
                    TextField("Precio por dona en balboas", text: $price).keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Stock y precio")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Guardar", action: save) }
            }
            .onAppear {
                if let data = try? Store.snapshot() {
                    stock = String(data.stock)
                    price = String(format: "%.2f", Double(data.priceCents) / 100)
                }
            }
            .alert("No se pudo guardar", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("Aceptar") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        do {
            guard let units = Int(stock), let decimal = Decimal(string: price.replacingOccurrences(of: ",", with: "."), locale: Locale(identifier: "en_US_POSIX")) else {
                throw StoreError.invalid("Escribe un stock y precio válidos.")
            }
            var amount = decimal * 100
            var rounded = Decimal()
            NSDecimalRound(&rounded, &amount, 0, .plain)
            guard amount == rounded, let cents = Int64(NSDecimalNumber(decimal: rounded).stringValue) else {
                throw StoreError.invalid("El precio admite hasta dos decimales.")
            }
            try Store.saveSettings(stock: units, priceCents: cents)
            WidgetCenter.shared.reloadAllTimelines()
            onSaved()
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}
