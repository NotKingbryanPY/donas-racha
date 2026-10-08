const fs=require('node:fs');
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,deleteField,serverTimestamp,Timestamp}=require('firebase/firestore');
let passed=0;
(async()=>{
  const [host,port]=String(process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8080').split(':');
  const env=await initializeTestEnvironment({projectId:'demo-donas-rules',firestore:{host,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8').replace(/^\uFEFF/,'')}});
  try {
    const alice=env.authenticatedContext('alice',{email_verified:true}).firestore();
    const bob=env.authenticatedContext('bob',{email_verified:true}).firestore();
    const publicDb=env.unauthenticatedContext().firestore();
    const unverified=env.authenticatedContext('alice',{email_verified:false}).firestore();
    const own=doc(alice,'userPreferences/alice');
    const valid=()=>({uid:'alice',schemaVersion:1,theme:-1,updatedAt:serverTimestamp()});
    async function denied(task) {await assertFails(task);passed++;}
    async function allowed(task) {await assertSucceeds(task);passed++;}
    await denied(getDocs(collection(publicDb,'userPreferences')));
    await denied(setDoc(doc(publicDb,'userPreferences/alice'),valid()));
    await denied(setDoc(doc(unverified,'userPreferences/alice'),valid()));
    await allowed(setDoc(own,valid()));
    await allowed(getDoc(own));
    await denied(getDoc(doc(bob,'userPreferences/alice')));
    await denied(setDoc(doc(bob,'userPreferences/alice'),valid()));
    await denied(deleteDoc(doc(bob,'userPreferences/alice')));
    await denied(getDocs(collection(alice,'userPreferences')));
    await denied(setDoc(doc(alice,'userPreferences/bob'),valid()));
    await denied(setDoc(own,{...valid(),uid:'bob'}));
    for(const change of [{uid:'bob'},{schemaVersion:2},{theme:0},{theme:'1'},{theme:1.5},
      {isAdmin:true},{extraData:'x'.repeat(100_000)},{updatedAt:Timestamp.fromMillis(0)},
      {theme:deleteField()},{uid:deleteField()},{updatedAt:deleteField()},{uid:'x'.repeat(129)}]) {
      await denied(updateDoc(own,{updatedAt:serverTimestamp(),...change}));
    }
    await denied(setDoc(doc(alice,'userPreferences/alice/settings/theme'),valid()));
    for(const path of ['orders/test','inventory/test','staffRoles/alice','userPreferences/bob'])
      await denied(setDoc(doc(alice,path),{role:'ADMIN'}));
    for(const mode of [-1,1,2]) await allowed(updateDoc(own,{theme:mode,updatedAt:serverTimestamp()}));
    assert.equal((await getDoc(own)).data().theme,2);
    await allowed(deleteDoc(own));
    for(const missing of ['uid','schemaVersion','theme','updatedAt']) {
      const data=valid();delete data[missing];await denied(setDoc(own,data));
    }
    console.log(`PASS Firestore emulator: ${passed} permission/schema checks, owner isolation, verification, create/update, no role escalation or business writes`);
  } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
