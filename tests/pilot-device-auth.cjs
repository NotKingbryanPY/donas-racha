const assert=require('node:assert/strict');const {createHash}=require('node:crypto');
const modulePath=require.resolve('../api/_lib/supabase');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',device='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let valid=true,role='SELLER',queries=[];
require.cache[modulePath]={id:modulePath,filename:modulePath,loaded:true,exports:{serviceRequest:async(table,{query})=>{
 queries.push({table,query});return table==='staff_device_credentials'?(valid?[{auth_user_id:id,role,device_public_id:device}]:[]):[{role:'ADMIN'}];
}}};
const {requireStaff,requireAdmin}=require('../api/_lib/auth');
const credential='drd.'+device+'.'+'x'.repeat(43),req={headers:{authorization:'Bearer '+credential}};
(async()=>{
 const staff=await requireStaff(req);assert.equal(staff.role,'SELLER');assert.equal(staff.deviceId,device);
 const q=new URLSearchParams(queries[0].query);assert.equal(q.get('token_hash'),'eq.'+createHash('sha256').update(credential).digest('hex'));
 assert.equal(q.get('revoked'),'eq.false');assert.ok(q.get('expires_at').startsWith('gt.'));
 await assert.rejects(requireAdmin(req),e=>e.status===403);
 role='ADMIN';assert.equal((await requireAdmin(req)).role,'ADMIN');
 valid=false;await assert.rejects(requireStaff(req),e=>e.status===401&&e.code==='DEVICE_REVOKED');
 await assert.rejects(requireStaff({headers:{}}),e=>e.status===401);
 await assert.rejects(requireStaff({headers:{authorization:'Bearer drd.invalid'}}),e=>e.status===401);
 const sync=require('../api/sync/index')._test;
 const timestamp='2026-10-07T12:00:00.123456Z';
 assert.equal(sync.parseCursor(Buffer.from(JSON.stringify({updatedAt:timestamp,id})).toString('base64url')).updatedAt,timestamp);
 console.log('PASS device middleware: hashed credentials, expiry/revocation, SELLER isolation, missing auth and microsecond cursor');
})().catch(e=>{console.error(e);process.exitCode=1;});
