import {mkdir,copyFile,writeFile,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const destination=join(root,'outputs','DonasControl.swiftpm');
await mkdir(destination,{recursive:true});
const sources=['DonasControl.swift','Core/Models.swift','Core/Ledger.swift','Core/BackupValidation.swift','App/SessionClient.swift','App/LocalStore.swift','App/NetworkStatus.swift','App/AppModel.swift','App/Views.swift','App/OpeningStockView.swift'];
for(const source of sources) await copyFile(join(root,'ios',source),join(destination,source.split('/').at(-1)));
await cp(join(root,'ios','Assets.xcassets'),join(destination,'Assets.xcassets'),{recursive:true});
await writeFile(join(destination,'Package.swift'),`// swift-tools-version: 5.9
import PackageDescription
import AppleProductTypes
let package=Package(name:"Donas Control",platforms:[.iOS("17.0")],products:[
    .iOSApplication(name:"Donas Control",targets:["AppModule"],bundleIdentifier:"com.bryan.donas.control",
        displayVersion:"1.3.0",bundleVersion:"9",appIcon:.asset("AppIcon"),accentColor:.presetColor(.purple),
        supportedDeviceFamilies:[.pad,.phone],supportedInterfaceOrientations:[.portrait,.landscapeLeft,.landscapeRight])
],targets:[.executableTarget(name:"AppModule",path:".",resources:[.process("Assets.xcassets")],swiftSettings:[.define("DONAS_PLAYGROUNDS")])],swiftLanguageVersions:[.v5])
`);
console.log(destination);
