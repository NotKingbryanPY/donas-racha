'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

global.fetch = async url => {
  const path = new URL(url).pathname;
  const value = path.endsWith('/consume_api_rate_limit')
    ? { allowed: true }
    : path.endsWith('/api_public_ranking')
      ? [{ public_id:'CABC123', display_name:'Cliente', level_key:'BRONCE',
        level_name:'Bronce', level_emoji:'🥉', lifetime_points:10,
        available_points:10, purchase_count:1, redemption_count:0, current_streak:1 }]
      : null;
  if (!value) throw new Error(`Unexpected URL: ${url}`);
  return { ok:true, status:200, text:async()=>JSON.stringify(value) };
};

const ranking = require('../api/ranking');
const res = { statusCode:200, setHeader(){}, end(body){ this.body=JSON.parse(body); } };
(async()=>{
  await ranking({ method:'GET', url:'/api/ranking', query:{type:'racha'}, headers:{} }, res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.data.ranking[0].name,'Cliente');
  assert.equal('id' in res.body.data.ranking[0],false);
  assert.equal(JSON.stringify(res.body).includes('CABC123'),false);
  console.log('PASS public ranking does not expose customer login IDs');
})().catch(error=>{console.error(error);process.exitCode=1;});
