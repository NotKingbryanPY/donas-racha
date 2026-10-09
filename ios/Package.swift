// swift-tools-version: 5.9
import PackageDescription
let package=Package(name:"DonasControlCore",platforms:[.macOS(.v13),.iOS(.v17)],products:[
    .library(name:"DonasControlCore",targets:["DonasControlCore"])
],targets:[
    .target(name:"DonasControlCore",path:"Core"),
    .target(name:"DonasControlSession",dependencies:["DonasControlCore"],path:"App",exclude:["AppModel.swift","LocalStore.swift","NetworkStatus.swift","Views.swift","OpeningStockView.swift"],sources:["SessionClient.swift"]),
    .testTarget(name:"DonasControlCoreTests",dependencies:["DonasControlCore"],path:"Tests"),
    .testTarget(name:"DonasControlSessionTests",dependencies:["DonasControlSession","DonasControlCore"],path:"SessionTests")
])
