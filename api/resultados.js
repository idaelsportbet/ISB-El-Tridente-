const URL_SUPABASE='https://nfvkmxnprchvkufwvhpr.supabase.co';
const CATEGORIAS=['Premium','Exclusiva','Pack Mensual','Económica'],ESTADOS=['ganado','perdido','pendiente','sin_pick'];
const fechaValida=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!secret)return res.status(503).json({error:'Falta configurar la publicación de resultados.'});
 if(!/^Bearer \S+$/.test(req.headers.authorization||''))return res.status(401).json({error:'Inicia sesión para ver resultados.'});
 try{
 const auth=await fetch(URL_SUPABASE+'/auth/v1/user',{headers:{apikey:secret,Authorization:req.headers.authorization},signal:AbortSignal.timeout(8000)});
 if(!auth.ok)return res.status(401).json({error:'Tu sesión venció. Inicia sesión nuevamente.'});
 const user=await auth.json(),headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 if(req.method==='GET'){
 const {desde,hasta}=req.query||{};
 if(!fechaValida(desde)||!fechaValida(hasta)||desde>hasta||(Date.parse(hasta)-Date.parse(desde))/86400000>31)return res.status(400).json({error:'Periodo inválido.'});
 const q=new URLSearchParams({select:'fecha,categoria,texto,estado',and:'(fecha.gte.'+desde+',fecha.lte.'+hasta+')',order:'fecha.asc,categoria.asc',limit:'128'});
 const r=await fetch(URL_SUPABASE+'/rest/v1/resultados?'+q,{headers,signal:AbortSignal.timeout(8000)});
 if(!r.ok)return res.status(503).json({error:'Falta conectar la publicación de resultados.'});
 return res.status(200).json({resultados:await r.json()});
 }
 const adminId=(process.env.ADMIN_USER_ID||'').trim(),autorizado=adminId?user.id===adminId:user.email?.toLowerCase()==='idaelvargasbusiness@gmail.com'&&Boolean(user.email_confirmed_at);
 if(!autorizado)return res.status(403).json({error:'Solo el administrador puede publicar resultados.'});
 const filas=req.body?.resultados;
 if(!Array.isArray(filas)||!filas.length||filas.length>124)return res.status(400).json({error:'Selecciona resultados para publicar.'});
 const claves=new Set();
 for(const f of filas){const k=f.fecha+'|'+f.categoria;if(!fechaValida(f.fecha)||!CATEGORIAS.includes(f.categoria)||!ESTADOS.includes(f.estado)||typeof f.texto!=='string'||f.texto.length>1000||claves.has(k))return res.status(400).json({error:'Revisa fechas, categorías y estados.'});claves.add(k);}
 const r=await fetch(URL_SUPABASE+'/rest/v1/resultados?on_conflict=fecha,categoria',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(filas.map(f=>({fecha:f.fecha,categoria:f.categoria,texto:f.texto.trim(),estado:f.estado,updated_at:new Date().toISOString()}))),signal:AbortSignal.timeout(10000)});
 if(!r.ok)return res.status(503).json({error:'No se guardó: falta conectar la publicación de resultados.'});
 return res.status(200).json({publicados:filas.length});
 }catch{return res.status(502).json({error:'No se pudo conectar. Inténtalo nuevamente.'});}
}
