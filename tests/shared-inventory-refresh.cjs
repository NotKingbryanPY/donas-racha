const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
let calls=0,renders=0;let intervals=[];
const notice={textContent:''},delivery={style:{display:''}};
const quantities=new Map([['flavor-1',2]]);
const context={Map,Array,Date,Promise,openedAsUser:true,clientOrderVariants:[{id:'flavor-1',name:'Chocolate',unit_price_cents:100}],
  customerOrderQuantities:quantities,navigator:{onLine:true},document:{hidden:false,activeElement:null,
    getElementById:id=>id==='clientDeliverySection'?delivery:notice,addEventListener(){},querySelectorAll:()=>[]},
  setInterval:(_,ms)=>intervals.push(ms),renderClientFlavors:()=>{renders++},
  vercelApi:async()=>{calls++;return {enforced:true,flavors:[{variant_id:'flavor-1',available_quantity:1,counted:true}]}}};
vm.createContext(context);vm.runInContext(fs.readFileSync('assets/js/shared-inventory-refresh.js','utf8'),context);
(async()=>{
  await context.refreshSharedStock();assert.equal(calls,1);assert.equal(renders,1);
  assert.equal(quantities.get('flavor-1'),2,'background stock update must preserve the customer cart');
  assert.equal(context.clientOrderVariants[0].inventory.available_quantity,1);
  context.document.hidden=true;await context.refreshSharedStock();assert.equal(calls,1);
  context.document.hidden=false;context.navigator.onLine=false;await context.refreshSharedStock();assert.equal(calls,1);
  assert.deepEqual(intervals,[20000]);console.log('PASS visible stock refresh, offline suspension and cart preservation');
})().catch(error=>{console.error(error);process.exitCode=1});
