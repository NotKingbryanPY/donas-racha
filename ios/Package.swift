// swift-tools-version: 5.9
import PackageDescription
let package=Package(name:"DonasControlCore",platforms:[.macOS(.v13),.iOS(.v17)],products:[
    .library(name:"DonasControlCore",targets:["DonasControlCore"])
],targets:[.target(name:"DonasControlCore",path:"Core"),.testTarget(name:"DonasControlCoreTests",dependencies:["DonasControlCore"],path:"Tests")])
