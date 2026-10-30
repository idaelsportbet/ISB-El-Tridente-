const SUPABASE_URL="https://nfvkmxnprchvkufwvhpr.supabase.co";
const PAQUETES=["Premium","Exclusiva","Económica","Champions League Completa"];
const ESTADOS=["ganado","perdido","pendiente","no_enviado"];
const fechaValida=v=>typeof v==="string"&&/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function calcular(f){
  const estado=f.estado;
  if(estado==="no_enviado")return {cuota:"",monto_apostado:0,ganancia_neta:0,retorno_total:0};
  const monto=Number(f.monto_apostado);
  if(!Number.isFinite(monto)||monto<0||monto>1000000)throw new Error("Revisa el monto apostado.");
  const raw=String(f.cuota||"").trim().replace(/[−–]/g,"-");
  let cuota=0;
  if(estado==="ganado"||estado==="perdido"||estado==="pendiente"){
    if(!/^[+-]?\\d{2,5}$/.test(raw))throw new Error("Escribe una cuota americana, por ejemplo +110 o -110.");
    cuota=Number(raw);
    if(!cuota||Math.abs(cuota)<100)throw new Error("La cuota debe ser +100 o superior, o -100 o inferior.");
  }
  let neto=0,retorno=0;
  if(estado==="ganado"){neto=cuota>0?monto*cuota/100:monto*100/Math.abs(cuota);neto=Math.round(neto*100)/100;retorno=Math.round((monto+neto)*100)/100;}
  else if(estado==="perdido"){neto=-monto;retorno=0;}
  return {cuota:raw,monto_apostado:monto,ganancia_neta:neto,retorno_total:retorno};
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"Método no permitido."});
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret)return res.status(503).json({error:"Falta configurar la conexión de resultados."});
  if(!/^Bearer \\S+$/.test(req.headers.authorization||""))return res.status(401).json({error:"Inicia sesión para ver el resumen."});
  try{
    const auth=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:secret,Authorization:req.headers.authorization},signal:AbortSignal.timeout(8000)});
    if(!auth.ok)return res.status(401).json({error:"Tu sesión venció. Inicia sesión de nuevo."});
    const user=await auth.json(),headers={apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json"};
    if(req.method==="GET"){
      const fecha=req.query?.fecha;
      if(!fechaValida(fecha))return res.status(400).json({error:"Fecha inválida."});
      const query=new URLSearchParams({select:"fecha,paquete,cuota,monto_apostado,estado,ganancia_neta,retorno_total",fecha:"eq."+fecha,order:"paquete.asc"});
      const r=await fetch(SUPABASE_URL+"/rest/v1/resumen_apuestas_diarias?"+query,{headers,signal:AbortSignal.timeout(8000)});
      if(!r.ok)return res.status(503).json({error:"El panel necesita que se active su tabla de resumen diario en Supabase."});
      return res.status(200).json({fecha,resultados:await r.json()});
    }
    const adminId=(process.env.ADMIN_USER_ID||"").trim();
    const adminEmails=["idaelvargasbusiness@gmail.com","felixyaiden@icloud.com"];
    const autorizado=(adminId&&user.id===adminId)||(Boolean(user.email_confirmed_at)&&adminEmails.includes((user.email||"").toLowerCase()));
    if(!autorizado)return res.status(403).json({error:"Solo el administrador puede guardar este resumen."});
    if(!fechaValida(req.body?.fecha)||!Array.isArray(req.body?.resultados)||req.body.resultados.length!==PAQUETES.length)return res.status(400).json({error:"Completa las cuatro filas del resumen."});
    const vistos=new Set(),filas=[];
    for(const f of req.body.resultados){
      if(!PAQUETES.includes(f.paquete)||vistos.has(f.paquete)||!ESTADOS.includes(f.estado))return res.status(400).json({error:"Revisa los paquetes y resultados seleccionados."});
      vistos.add(f.paquete);
      const calculo=calcular(f);
      filas.push({fecha:req.body.fecha,paquete:f.paquete,...calculo,estado:f.estado,updated_at:new Date().toISOString()});
    }
    const r=await fetch(SUPABASE_URL+"/rest/v1/resumen_apuestas_diarias?on_conflict=fecha,paquete",{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(filas),signal:AbortSignal.timeout(10000)});
    if(!r.ok)return res.status(503).json({error:"No se guardó el resumen. Activa primero la tabla de resumen diario en Supabase."});
    return res.status(200).json({guardados:filas.length,fecha:req.body.fecha});
  }catch(e){return res.status(502).json({error:e.message||"No se pudo conectar con el resumen diario."});}
}
