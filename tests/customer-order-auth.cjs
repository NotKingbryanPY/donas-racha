'use strict';
const assert = require('node:assert/strict');
const createOrder = require('../api/orders/index');
const readOrder = require('../api/orders/[publicCode]');
const customerRoute = require('../api/customer/[route]');

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

  const profile=response();
  await customerRoute({method:'GET',headers:{},query:{route:'profile'},url:'/api/customer/profile'},profile);
  assert.equal(profile.statusCode,401);
  assert.equal(profile.body.error.code,'AUTH_REQUIRED');

  const registration=response();
  await customerRoute({method:'POST',headers:{},query:{route:'register'},url:'/api/customer/register',body:{}},registration);
  assert.equal(registration.statusCode,404);
  console.log('PASS ID profile routes reject missing sessions and customer email registration is closed');
})().catch(error=>{console.error(error);process.exitCode=1});
