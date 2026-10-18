// Development only: derive Drachas variants from the outlined SVG master.
// RESVG_MODULE may point to an installed @resvg/resvg-js; not a runtime dependency.
const fs=require('node:fs');const path=require('node:path');
const {Resvg}=require(process.env.RESVG_MODULE || '@resvg/resvg-js');
const dir=path.resolve(__dirname,'../assets/images');
const logo=fs.readFileSync(path.join(dir,'drachas-logo.svg'),'utf8');
const defs=logo.match(/<defs>[\s\S]*?<\/defs>/)[0];
const symbol=logo.replace('0 0 510 112','0 0 155 112').replace(/<g fill="#FAF6FF">[\s\S]*?<\/g>/,'');
const word=logo.replace('0 0 510 112','150 0 360 112').replace('<g fill="#C5A3EE"><use href="#dr"/></g>','');
const icon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><title>Drachas</title>${defs}<rect width="160" height="160" rx="34" fill="#100D17"/><g transform="translate(8 27) scale(.93)" fill="#C5A3EE"><use href="#dr"/></g></svg>`;
const social=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><title>Drachas</title><rect width="1200" height="630" fill="#100D17"/><svg x="150" y="215" width="900" height="200" viewBox="0 0 510 112">${logo.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'')}</svg></svg>`;
for(const [name,source] of Object.entries({
  'drachas-symbol.svg':symbol,'drachas-word.svg':word,'drachas-icon.svg':icon,
  'drachas-logo-dark.svg':logo.replaceAll('#FAF6FF','#24162E'),
  'drachas-logo-mono.svg':logo.replaceAll('#FAF6FF','#24162E').replaceAll('#C5A3EE','#24162E')
}))fs.writeFileSync(path.join(dir,name),source.replace(/[\t ]+$/gm,''));
for(const [name,source,width] of [
  ['drachas-logo.png',logo,1020],['drachas-symbol.png',symbol,310],
  ['drachas-icon-180.png',icon,180],['drachas-icon-32.png',icon,32],['drachas-social.png',social,1200]
]){const bytes=new Resvg(source,{fitTo:{mode:'width',value:width}}).render().asPng();fs.writeFileSync(path.join(dir,name),bytes);console.log(`${name}: ${bytes.length} bytes`);}
