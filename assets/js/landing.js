/* Presentation only. Reward selection comes from the existing profile renderer. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id),stamps=[...document.querySelectorAll('.landing-stamp')];
  let snapshot=null,generation=0,controller=null,flight=null,flightIdentity=null;
  const owns=(owner,token)=>!!owner && !!token && sessionStorage.getItem('donasCustomerId')===owner && sessionStorage.getItem('donasCustomerToken')===token;
  function reset(){
    generation++;controller?.abort();controller=null;flight=null;flightIdentity=null;
    snapshot=null;stamps.forEach(stamp=>stamp.classList.remove('is-earned'));
    document.querySelector('.landing-reward-card').setAttribute('aria-busy','false');
    const meter=el('landingRewardMeter');['role','aria-label','aria-valuemin','aria-valuemax','aria-valuenow','aria-valuetext'].forEach(attr=>meter.removeAttribute(attr));
    el('landingRewardStatus').textContent='Tu progreso, en tu perfil';
    el('landingRewardTarget').textContent='Acumula puntos y canjéalos por premios.';
    el('landingRewardHint').textContent='Tu próxima recompensa está cerca.';
  }
  function draw(){
    if(!snapshot || !owns(snapshot.owner,snapshot.token))return reset();
    const {reward,available}=snapshot,cost=Number(reward?.cost);
    if(!Number.isFinite(cost) || cost<=0){
      stamps.forEach(stamp=>stamp.classList.remove('is-earned'));
      el('landingRewardStatus').textContent=`${available} puntos disponibles`;
      el('landingRewardTarget').textContent='Aún no hay premios disponibles.';
      el('landingRewardHint').textContent='Tus puntos siguen guardados en tu perfil.';return;
    }
    const earned=Math.floor(Math.min(1,available/cost)*stamps.length),remaining=Math.max(0,cost-available);
    stamps.forEach((stamp,index)=>stamp.classList.toggle('is-earned',index<earned));
    const meter=el('landingRewardMeter');meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',`Puntos para ${reward.name || 'tu próxima recompensa'}`);
    meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(cost));meter.setAttribute('aria-valuenow',String(Math.min(available,cost)));
    meter.setAttribute('aria-valuetext',`${available} puntos disponibles; ${remaining ? `faltan ${remaining} puntos` : 'ya puedes canjear'}`);
    el('landingRewardStatus').textContent=available<cost?`${available} de ${cost} puntos`:`${available} puntos disponibles`;
    el('landingRewardTarget').textContent=`${reward.name || 'Recompensa'} · ${cost} puntos`;
    el('landingRewardHint').textContent=remaining?'Tu próxima recompensa está cerca.':'Tu recompensa te espera en la tienda.';
  }
  function record(customer,owner,token){
    if(!owns(owner,token) || customer?.id!==owner || !Number.isSafeInteger(customer?.pointsAvailable) || customer.pointsAvailable<0 || !Array.isArray(customer.shopItems))return;
    const {reward,available}=nextRewardState(customer);
    snapshot={owner,token,reward,available};draw();
  }
  function renderRewards(customer){
    const owner=customer?.id,token=sessionStorage.getItem('donasCustomerToken');
    reset();if(openedAsUser && currentClient?.id===owner)record(customer,owner,token);
  }
  async function sync(){
    if(snapshot && owns(snapshot.owner,snapshot.token)){draw();return;}
    if(flight && owns(flightIdentity?.owner,flightIdentity?.token))return flight;
    reset();const owner=sessionStorage.getItem('donasCustomerId'),token=sessionStorage.getItem('donasCustomerToken');
    if(!owns(owner,token) || !navigator.onLine || el('roleOverlay').classList.contains('hidden'))return;
    const request=generation,aborter=new AbortController();controller=aborter;const signal=aborter.signal;flightIdentity={owner,token};
    const timeout=setTimeout(()=>aborter.abort(),15000);document.querySelector('.landing-reward-card').setAttribute('aria-busy','true');
    flight=(async()=>{
      try{
        const query=new URLSearchParams({action:'getCliente',id:owner});
        const response=await fetch('/api/backend?'+query,{signal,cache:'no-store',headers:{accept:'application/json',authorization:`Bearer ${token}`}});
        const payload=await response.json();
        if(request!==generation || !owns(owner,token) || signal.aborted || el('roleOverlay').classList.contains('hidden'))return;
        if(!response.ok || !payload?.ok)throw new Error('PROFILE_UNAVAILABLE');
        record(payload.data?.client,owner,token);
      }catch(_){
        if(request===generation && owns(owner,token))el('landingRewardStatus').textContent='Consulta tus puntos en el perfil';
      }finally{
        clearTimeout(timeout);if(request===generation){controller=null;flight=null;flightIdentity=null;document.querySelector('.landing-reward-card').setAttribute('aria-busy','false');}
      }
    })();return flight;
  }
  window.addEventListener('pagehide',reset);
  window.addEventListener('pageshow',event=>{if(event.persisted && !el('roleOverlay').classList.contains('hidden'))sync();});
  window.DonasLanding={renderRewards,reset,sync};reset();
})();
