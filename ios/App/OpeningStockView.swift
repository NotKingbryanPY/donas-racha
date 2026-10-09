import SwiftUI

struct OpeningStockView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) var dismiss
    @State private var quantities: [String:String] = [:]
    @State private var cost=""
    var body: some View {
        NavigationStack {
            Form {
                Text("Registra las donas que ya tienes al empezar este libro. Este saldo inicial conserva el inventario publicado; las compras nuevas se registran en Ventas.")
                ForEach(Flavor.allCases,id:\.rawValue) { flavor in
                    TextField(flavor.name,text:Binding(get:{ quantities[flavor.rawValue] ?? "" },set:{ quantities[flavor.rawValue]=$0 })).keyboardType(.numberPad)
                }
                TextField("Costo total de estas existencias",text:$cost).keyboardType(.decimalPad)
                Button("Guardar existencias iniciales") {
                    var counts: [String:Int] = [:]
                    for flavor in Flavor.allCases {
                        guard let value=Int(quantities[flavor.rawValue] ?? ""),(0...100000).contains(value) else { model.message="Completa los cuatro sabores.";return }
                        counts[flavor.rawValue]=value
                    }
                    guard let cents=parseCents(cost) else { model.message="Escribe el costo de las existencias.";return }
                    if model.commit({ try Ledger.seedInventory(&$0,items:counts,costCents:cents) }) {
                        dismiss();model.message="Existencias locales registradas sin duplicar compras en la página.";Task { await model.synchronize() }
                    }
                }.disabled(model.storageProblem)
            }.navigationTitle("Stock inicial").toolbar { Button("Volver") { dismiss() } }
        }
    }
}
