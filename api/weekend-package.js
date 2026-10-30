const SUPABASE_URL="https://nfvkmxnprchvkufwvhpr.supabase.co";
const SETTINGS_URL=`${SUPABASE_URL}/rest/v1/isb_site_settings`;
const SETTING_KEY="paquete_fin_de_semana";
const ADMIN_EMAILS=new Set(["idaelvargasbusiness@gmail.com","felixyaiden@icloud.com"]);

async function isAdmin(authorization,secret){
  if(!/^Bearer \S+$/.test(authorization||""))return false;
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:secret,Authorization:authorization},signal:AbortSignal.timeout(5000)});
  if(!response.ok)return false;
  const user=await response.json(),adminId=(process.env.ADMIN_USER_ID||"").trim(),email=typeof user.email==="string"?user.email.toLowerCase():"";
  return Boolean(adminId&&user.id===adminId)||(Boolean(user.email_confirmed_at)&&ADMIN_EMAILS.has(email));
}
async function readActive(secret){
  const query=new URLSearchParams({select:"value",key:"eq."+SETTING_KEY,limit:"1"});
  const response=await fetch(`${SETTINGS_URL}?${query}`,{headers:{apikey:secret,Authorization:"Bearer "+secret},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error("No se pudo consultar el paquete de fin de semana.");
  const rows=await response.json();return rows[0]?.value?.active===true;
}
async function saveActive(secret,active){
  const query=new URLSearchParams({key:"eq."+SETTING_KEY});
  const headers={apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json",Prefer:"return=representation"};
  const payload={value:{active},updated_at:new Date().toISOString()};
  const update=await fetch(`${SETTINGS_URL}?${query}`,{method:"PATCH",headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
  if(!update.ok)throw new Error("No se pudo guardar la activación del paquete.");
  if((await update.json()).length)return;
  const create=await fetch(SETTINGS_URL,{method:"POST",headers,body:JSON.stringify({key:SETTING_KEY,...payload}),signal:AbortSignal.timeout(8000)});
  if(!create.ok)throw new Error("No se pudo crear la configuración del paquete.");
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"Método no permitido."});
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret)return res.status(503).json({error:"Falta configurar la conexión segura del paquete."});
  try{
    if(req.method==="GET"){
      if(req.query?.vista==="admin"&&!(await isAdmin(req.headers.authorization,secret)))return res.status(403).json({error:"Solo el administrador puede gestionar el paquete."});
      return res.status(200).json({active:await readActive(secret)});
    }
    if(!(await isAdmin(req.headers.authorization,secret)))return res.status(403).json({error:"Solo el administrador puede cambiar el paquete."});
    if(typeof req.body?.active!=="boolean")return res.status(400).json({error:"Indica si el paquete estará activo."});
    await saveActive(secret,req.body.active);
    return res.status(200).json({active:req.body.active});
  }catch(error){return res.status(503).json({error:error.message||"No se pudo actualizar el paquete."});}
}
