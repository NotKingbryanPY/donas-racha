// Reproducible local browser SDK; no third-party CDN at runtime.
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const version='2.117.3';
const integrity='K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==';
const response=await fetch(`https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-${version}.tgz`,
  {signal:AbortSignal.timeout(30000)});
if (!response.ok) throw new Error('SDK download failed: '+response.status);
const archive=Buffer.from(await response.arrayBuffer());
if (createHash('sha512').update(archive).digest('base64')!==integrity) throw new Error('SDK integrity mismatch');
const tar=gunzipSync(archive), entries=new Map();
for (let offset=0;offset+512<=tar.length;) {
  const name=tar.subarray(offset,offset+100).toString().replace(/\0.*$/s,'');
  if (!name) break;
  const size=parseInt(tar.subarray(offset+124,offset+136).toString().replace(/\0.*$/s,''),8);
  if (!Number.isFinite(size) || size<0 || offset+512+size>tar.length) throw new Error('Invalid SDK archive');
  if (name==='package/dist/umd/supabase.js' || name==='package/LICENSE')
    entries.set(name,tar.subarray(offset+512,offset+512+size));
  offset+=512+Math.ceil(size/512)*512;
}
if (entries.size!==2) throw new Error('Expected UMD SDK and license');
const output=resolve(import.meta.dirname,'../assets/vendor');
await mkdir(output,{recursive:true});
await writeFile(resolve(output,`supabase-${version}.js`),entries.get('package/dist/umd/supabase.js'));
await writeFile(resolve(output,'SUPABASE-LICENSE.txt'),entries.get('package/LICENSE'));
const sha=createHash('sha256').update(entries.get('package/dist/umd/supabase.js')).digest('hex');
await writeFile(resolve(output,'README.md'),`# Supabase browser SDK\n\nSupabase JS ${version}, official npm UMD bundle, loaded only when public catalog Realtime is enabled. Authentication persistence and refresh are disabled for this anonymous catalog client.\n\nSource: https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-${version}.tgz\n\nArchive SHA-512: ${integrity}\n\nBundle SHA-256: ${sha}\n\nRebuild with Node 22+: node scripts/build-catalog-sdk.mjs. The script checks archive integrity and extracts only the bundle and MIT license.\n`);
console.log(`Supabase JS ${version}: ${entries.get('package/dist/umd/supabase.js').length} bytes; SHA256 ${sha}`);
