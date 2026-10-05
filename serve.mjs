// Servidor de desenvolvimento local, sem dependências. Execute: node serve.mjs
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    const pages={'/':'index.html','/index':'index.html','/imovel':'imovel.html','/checkout':'checkout.html','/login':'login.html','/cadastro':'cadastro.html','/admin':'admin.html','/admin-login':'admin-login.html','/reservas':'reservas.html','/anuncie':'anuncie.html'};
    if(pathname==='/index'){res.writeHead(301,{Location:'/'+url.search,'Cache-Control':'no-store'});res.end();return;}
    const legacy=Object.entries(pages).find(([route,file])=>file!=='index.html'&&pathname===`/${file}` || file==='index.html'&&pathname==='/index.html');
    if(legacy){const destination=legacy[0]==='/index'?'/':legacy[0];res.writeHead(301,{Location:destination+url.search,'Cache-Control':'no-store'});res.end();return;}
    const route=pathname.replace(/\/+$/, '')||'/';
    const relative=(pages[route]||pathname.replace(/^\/+/, '')||'index.html');
    const file=path.resolve(root,relative);
    if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(8765,'127.0.0.1',()=>console.log('ebenLiving: http://127.0.0.1:8765'));
