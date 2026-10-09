const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const name=pathname==='/'?'index.html':pathname.slice(1);
  if(!(name==='index.html'||name==='customer.html'||name.startsWith('assets/'))||name.includes('..')) {res.writeHead(404);res.end();return;}
  const file=path.resolve(root,name); if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try {const data=fs.readFileSync(file);res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(data);} catch(_){res.writeHead(404);res.end();}
}).listen(8765,'127.0.0.1',()=>console.log('Fixture http://127.0.0.1:8765'));
