/* Reuses staff session transport. Tokens are shown only after explicit invitation creation. */
async function issueStaffDevice() {
  const button=document.getElementById('staffDeviceIssue'),message=document.getElementById('staffDevicesMessage');
  if(button.disabled||staffRole!=='ADMIN') return;
  button.disabled=true;document.getElementById('staffDeviceInvitation').value='';
  try {
    const result=await adminRequest('/api/admin/customers/provisioning','POST',{action:'issue',role:document.getElementById('staffDeviceRole').value});
    document.getElementById('staffDeviceInvitation').value=result.invitation;
    message.textContent='Pega esta invitación en el dispositivo de confianza. Válida por 15 minutos y un solo uso.';
  }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
}
async function loadStaffDevices() {
  if(staffRole!=='ADMIN')return;
  const list=document.getElementById('staffDevicesList');list.replaceChildren();
  try {
    const result=await adminRequest('/api/admin/customers/provisioning');
    for(const device of result.devices||[]) {
      const row=document.createElement('div');row.className='history-item';
      const copy=document.createElement('span');copy.className='grow';
      copy.textContent=device.device_public_id+' · '+(device.role||'Cuenta administrativa')+' · '+
        (device.revoked?'Revocado':device.expires_at?'Expira '+new Date(device.expires_at).toLocaleDateString('es-PA'):'Activo');
      row.append(copy);
      if(!device.revoked){const button=document.createElement('button');button.className='btn btn-outline';button.textContent='Revocar';
        button.onclick=async()=>{button.disabled=true;try{await adminRequest('/api/admin/customers/provisioning','POST',{action:'revoke',deviceId:device.device_public_id});await loadStaffDevices();}catch(error){document.getElementById('staffDevicesMessage').textContent=error.message;button.disabled=false;}};
        row.append(button);
      }
      list.append(row);
    }
  }catch(error){document.getElementById('staffDevicesMessage').textContent='Dispositivos: '+error.message;}
}
