import AppIntents
import SwiftUI
import WidgetKit

private let widgetKind = "DonasVentaRapida"

enum WidgetPayment: String, AppEnum {
    case cash
    case yappy

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Forma de pago"
    static var caseDisplayRepresentations: [WidgetPayment: DisplayRepresentation] = [
        .cash: "Efectivo", .yappy: "Yappy"
    ]

    var payment: Payment { self == .cash ? .cash : .yappy }
}

struct AdjustQuantityIntent: AppIntent {
    static var title: LocalizedStringResource = "Cambiar cantidad de donas"
    static var openAppWhenRun = false
    @Parameter(title: "Cambio") var delta: Int

    init() {}
    init(delta: Int) { self.delta = delta }

    func perform() async throws -> some IntentResult {
        do { try Store.adjustWidgetQuantity(delta) }
        catch { try? Store.setWidgetNotice(error.localizedDescription) }
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        return .result()
    }
}

struct RecordSaleIntent: AppIntent {
    static var title: LocalizedStringResource = "Registrar venta de donas"
    static var openAppWhenRun = false
    @Parameter(title: "Pago") var payment: WidgetPayment
    @Parameter(title: "Identificador") var requestID: String

    init() {}
    init(payment: WidgetPayment) {
        self.payment = payment
        self.requestID = UUID().uuidString
    }

    func perform() async throws -> some IntentResult {
        do { try Store.recordSale(quantity: 0, payment: payment.payment, fromWidget: true, requestID: requestID) }
        catch { try? Store.setWidgetNotice(error.localizedDescription) }
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        return .result()
    }
}

struct DonasEntry: TimelineEntry {
    let date: Date
    let dashboard: Dashboard?
}

struct DonasProvider: TimelineProvider {
    func placeholder(in context: Context) -> DonasEntry { DonasEntry(date: .now, dashboard: nil) }
    func getSnapshot(in context: Context, completion: @escaping (DonasEntry) -> Void) {
        completion(DonasEntry(date: .now, dashboard: try? Store.snapshot()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DonasEntry>) -> Void) {
        let entry = DonasEntry(date: .now, dashboard: try? Store.snapshot())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

struct DonasWidgetView: View {
    let entry: DonasEntry

    var body: some View {
        if let data = entry.dashboard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("🍩 Venta rápida").font(.headline)
                    Spacer()
                    Text("Quedan \(data.stock)").font(.caption).foregroundStyle(.secondary)
                }
                HStack(spacing: 14) {
                    Button(intent: AdjustQuantityIntent(delta: -1)) { Text("−").frame(width: 34, height: 30) }
                        .disabled(data.widgetQuantity <= 1)
                        .accessibilityLabel("Reducir cantidad")
                    Text("\(data.widgetQuantity)").font(.title.bold()).monospacedDigit()
                    Button(intent: AdjustQuantityIntent(delta: 1)) { Text("+").frame(width: 34, height: 30) }
                        .disabled(data.widgetQuantity >= min(99, data.stock))
                        .accessibilityLabel("Aumentar cantidad")
                    Spacer()
                    Text(money(data.priceCents * Int64(data.widgetQuantity))).font(.subheadline.bold())
                }
                HStack {
                    Button(intent: RecordSaleIntent(payment: .cash)) { Label("Efectivo", systemImage: "banknote") }
                        .disabled(data.stock < data.widgetQuantity)
                    Button(intent: RecordSaleIntent(payment: .yappy)) { Label("Yappy", systemImage: "iphone.gen3") }
                        .disabled(data.stock < data.widgetQuantity)
                }
                .buttonStyle(.borderedProminent)
                .font(.caption)
                if !data.widgetNotice.isEmpty {
                    Text(data.widgetNotice).font(.caption2).lineLimit(1)
                }
            }
            .containerBackground(.brown.opacity(0.12), for: .widget)
        } else {
            VStack(alignment: .leading) {
                Text("🍩 Donas Control").font(.headline)
                Text("Abre la app y configura el stock.").font(.caption)
            }
            .containerBackground(.brown.opacity(0.12), for: .widget)
        }
    }
}

struct DonasWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: widgetKind, provider: DonasProvider()) { entry in
            DonasWidgetView(entry: entry)
        }
        .configurationDisplayName("Venta rápida de donas")
        .description("Ajusta la cantidad y cobra en efectivo o Yappy sin abrir la app.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct DonasWidgetBundle: WidgetBundle {
    var body: some Widget { DonasWidget() }
}
