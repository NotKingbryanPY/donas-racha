import Foundation

struct LocalStore {
    let url: URL
    init() throws {
        let directory=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true)
            .appendingPathComponent("DonasControl",isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        url=directory.appendingPathComponent("business-v1.json")
    }
    func load() throws -> BusinessState {
        guard FileManager.default.fileExists(atPath:url.path) else { return BusinessState() }
        let state=try JSONDecoder().decode(BusinessState.self,from:Data(contentsOf:url))
        guard state.schema==1 else { throw BusinessError.invalid("Esta copia requiere una versión más reciente de Donas Control.") }
        return state
    }
    func save(_ state: BusinessState) throws {
        let data=try JSONEncoder().encode(state)
        try data.write(to:url,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
    }
}
