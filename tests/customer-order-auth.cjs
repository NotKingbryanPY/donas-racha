'use strict';
const assert = require('node:assert/strict');
const createOrder = require('../api/orders/index');
const readOrder = require('../api/orders/[publicCode]');
const claimCustomer = require('../api/customer/claim');

function response(){
  return {
    headers:{},statusCode:200,
    setHeader(key,value){this.headers[key]=value;},
    end(value){this.body=JSON.parse(value);}
  };
}

(async()=>{
  const create=response();
  await createOrder({method:'POST',headers:{},url:'/api/orders',body:{}},create);
  assert.equal(create.statusCode,401);
  assert.equal(create.body.error.code,'AUTH_REQUIRED');

  const read=response();
  await readOrder({method:'GET',headers:{},url:'/api/orders/DR-1234567890',query:{publicCode:'DR-1234567890'}},read);
  assert.equal(read.statusCode,401);
  assert.equal(read.body.error.code,'AUTH_REQUIRED');

  const claim=response();
  await claimCustomer({method:'POST',headers:{},url:'/api/customer/claim',body:{claimToken:'a'.repeat(64)}},claim);
  assert.equal(claim.statusCode,401);
  assert.equal(claim.body.error.code,'AUTH_REQUIRED');
  console.log('PASS customer order and claim routes reject anonymous access');
})().catch(error=>{console.error(error);process.exitCode=1});
