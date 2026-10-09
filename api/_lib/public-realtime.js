// Only a public Supabase key may reach the browser. Fail closed on misconfiguration.
function publicRealtimeConfig({url,anonKey}) {
  let project;
  try { project=new URL(url); } catch (_) { return {enabled:false}; }
  if (project.protocol!=='https:' || !project.hostname.endsWith('.supabase.co') ||
      project.username || project.password || project.port || project.search || project.hash ||
      (project.pathname!=='/' && project.pathname!=='')) return {enabled:false};
  const key=String(anonKey || '');
  let publicKey=/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key);
  if (!publicKey) {
    const parts=key.split('.');
    if (parts.length===3 && parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part))) {
      try { publicKey=JSON.parse(Buffer.from(parts[1],'base64url').toString()).role==='anon'; }
      catch (_) { /* A malformed or privileged key never leaves the server. */ }
    }
  }
  return publicKey ? {enabled:true,url:project.origin,anonKey:key} : {enabled:false};
}
module.exports={publicRealtimeConfig};
