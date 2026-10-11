const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";
const PAQUETES = ["Premium Diario", "Premium Semanal", "Exclusiva Diaria", "Exclusiva Semanal", "Pack Mensual", "Económica"];

async function notificarPicks(filas, secret) {
  const key=process.env.RESEND_API_KEY, remitente=process.env.PICK_EMAIL_FROM;
  if(!key || !remitente)return {estado:"sin_configurar",enviados:0};
  try {
    const paquetes=[...new Set(filas.map(f=>f.paquete))], destinatarios=new Map();
    for(let pagina=0;pagina<100;pagina++) {
      const query=new URLSearchParams({select:"correo,paquete,vencimiento",paquete:`in.(${paquetes.join(",")})`,vencimiento:`gt.${new Date().toISOString()}`,order:"id.asc",limit:"1000",offset:String(pagina*1000)});
      const respuesta=await fetch(`${SUPABASE_URL}/rest/v1/compras?${query}`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(8000)});
      if(!respuesta.ok)return {estado:"error",enviados:0};
      const compras=await respuesta.json();
      for(const compra of compras) {
        const correo=String(compra.correo || "").trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)||!paquetes.includes(compra.paquete)||!(Date.parse(compra.vencimiento)>Date.now()))continue;
        if(!destinatarios.has(correo))destinatarios.set(correo,new Set());
        destinatarios.get(correo).add(compra.paquete);
      }
      if(compras.length<1000)break;
      if(pagina===99)return {estado:"error",enviados:0};
    }
    const correos=[...destinatarios].map(([correo,paquetes])=>({from:remitente,to:[correo],reply_to:"idaelvargasbusiness@gmail.com",subject:"Tu pick de ISB EL TRIDENTE ya está publicado",text:`Hola,\n\nSe ha publicado un nuevo pick para tus paquetes: ${[...paquetes].join(", ")}.\nFecha del pick: ${filas[0].fecha_pick}.\n\nEntra con tu cuenta para verlo:\nhttps://www.idaelsportbet.me/mis-picks\n\nISB EL TRIDENTE`}));
    let enviados=0;
    for(let inicio=0;inicio<correos.length;inicio+=100) {
      const respuesta=await fetch("https://api.resend.com/emails/batch",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(correos.slice(inicio,inicio+100)),signal:AbortSignal.timeout(8000)});
      if(!respuesta.ok)return {estado:enviados?"parcial":"error",enviados,total:correos.length};
      enviados+=Math.min(100,correos.length-inicio);
      if(inicio+100<correos.length)await new Promise(resolve=>setTimeout(resolve,600));
    }
    return {estado:"enviados",enviados};
  } catch {return {estado:"error",enviados:0};}
}
function fechaActualCentral(){const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return `${p.find(x=>x.type==="year").value}-${p.find(x=>x.type==="month").value}-${p.find(x=>x.type==="day").value}`}export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PATCH"].includes(req.method)) return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  const adminId = (process.env.ADMIN_USER_ID || "").trim();
  const adminEmail = "idaelvargasbusiness@gmail.com";
  if (!secret) return res.status(503).json({ error: "Falta configurar la conexión del panel en Vercel." });
  if (!/^Bearer \S+$/.test(req.headers.authorization || "")) return res.status(401).json({ error: "Inicia sesión para continuar." });
  try {
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: secret, Authorization: req.headers.authorization }
    });
    if (!auth.ok) return res.status(401).json({ error: "Tu sesión venció. Inicia sesión nuevamente." });
    const user = await auth.json();
    const autorizado = adminId ? user.id === adminId :
      typeof user.email === "string" && user.email.toLowerCase() === adminEmail && Boolean(user.email_confirmed_at);
    if (!autorizado) return res.status(403).json({ error: "Esta cuenta no tiene permiso para publicar picks." }); if (req.method === "PATCH") return modificarPick(req,res,secret);
    if (req.method === "GET" && req.query?.vista === "compras") {
      const pagina = Number(req.query.pagina || 0);
      if (!Number.isInteger(pagina) || pagina < 0 || pagina > 10000) return res.status(400).json({error:"Página inválida."});
      const query = new URLSearchParams({select:"user_id,nombre,correo,paquete,cantidad_pagada_dolar,fecha_compra,vencimiento",order:"fecha_compra.desc",limit:"26",offset:String(pagina*25)});
      const headers = {apikey:secret,Authorization:`Bearer ${secret}`};
      const response = await fetch(`${SUPABASE_URL}/rest/v1/compras?${query}`,{headers});
      if (!response.ok) return res.status(502).json({error:"No se pudieron cargar las compras."});
      const filas = await response.json();
      const compras = filas.slice(0,25);
      const usuarios = new Map();
      const ids = [...new Set(compras.map(c=>c.user_id).filter(Boolean))];
      for(let i=0;i<ids.length;i+=5) {
        await Promise.all(ids.slice(i,i+5).map(async id=>{
          try {
            const info = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`,{headers,signal:AbortSignal.timeout(4000)});
            if(info.ok) {const cuenta=await info.json();usuarios.set(id,cuenta.user_metadata?.username || "");}
          } catch {}
        }));
      }
      return res.status(200).json({compras:compras.map(c=>({...c,usuario:usuarios.get(c.user_id)||null})),pagina,hayMas:filas.length>25});
    }
    if (req.method === "GET" && req.query?.vista === "picks") {
      const esHistorial=req.query.historial === "1", pagina=Number(req.query.pagina || 0);
      if(!Number.isInteger(pagina)||pagina<0||pagina>10000)return res.status(400).json({error:"Página inválida."});
      const query = new URLSearchParams({select:"id,paquete,titulo,descripcion,fecha_pick,imagen_url,activo",order:esHistorial?"fecha_pick.asc,created_at.asc":"fecha_pick.desc,created_at.desc",limit:esHistorial?"26":"1",offset:esHistorial?String(pagina*25):"0"});
      if(!esHistorial){if(!PAQUETES.includes(req.query.paquete))return res.status(400).json({error:"Selecciona un paquete."});query.set("paquete",`eq.${req.query.paquete}`);query.set("activo","eq.true");query.set("fecha_pick",`eq.${fechaActualCentral()}`);}
      const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/picks?${query}`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`}});
      if(!respuesta.ok)return res.status(502).json({error:"No se pudieron cargar los picks publicados."});
      return res.status(200).json(await respuesta.json().then(filas=>({picks:esHistorial?filas.slice(0,25):filas,hayMas:esHistorial&&filas.length>25})));
    }
    if (req.method === "GET") return res.status(200).json({ autorizado: true });
    if (req.body?.accion === "activar_prueba") {
      // Only the authenticated owner can grant a temporary, free access to an existing account.
      const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
      let destinatario = user;
      const correoPrueba = req.body.correo_prueba;
      if (correoPrueba !== undefined && (typeof correoPrueba !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoPrueba.trim()) || correoPrueba.length > 254)) return res.status(400).json({ error: "Revisa el correo de la cuenta de prueba." });
      if (correoPrueba && correoPrueba.trim().toLowerCase() !== user.email?.toLowerCase()) {
        const correo = correoPrueba.trim().toLowerCase();
        const busqueda = new URLSearchParams({ select: "user_id", correo: `eq.${correo}`, order: "fecha_compra.desc", limit: "1" });
        const compras = await fetch(`${SUPABASE_URL}/rest/v1/compras?${busqueda}`, { headers });
        if (!compras.ok) return res.status(502).json({ error: "No se pudo encontrar la cuenta de prueba." });
        const cuentas = await compras.json();
        if (!cuentas[0]?.user_id) {
          let encontrada;
          for(let pagina=1;pagina<=10;pagina++) {
            const lista = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${pagina}&per_page=1000`,{headers});
            if(!lista.ok)return res.status(502).json({error:"No se pudo comprobar la cuenta de cliente."});
            const datos=await lista.json();encontrada=datos.users?.find(u=>u.email?.toLowerCase()===correo);
            if(encontrada || !datos.users?.length || datos.users.length<1000)break;
          }
          if(!encontrada)return res.status(404).json({error:"Ese correo todavía no tiene una cuenta registrada."});
          cuentas.push({user_id:encontrada.id});
        }
        const cuenta = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(cuentas[0].user_id)}`, { headers });
        if (!cuenta.ok) return res.status(404).json({ error: "No se encontró esa cuenta de cliente." });
        destinatario = await cuenta.json();
        if (destinatario.email?.toLowerCase() !== correo || !destinatario.id) return res.status(400).json({ error: "El correo de compra no coincide con la cuenta. Revisa el correo con el que inicias sesión." });
      }
      const accesoFijo = req.body.permanente === true && ["floresidael2000@gmail.com","machadofelixb@gmail.com"].includes(destinatario.email?.toLowerCase());
      const paquetesPrueba = req.body.todos === true ? (destinatario.email?.toLowerCase() === "machadofelixb@gmail.com" ? ["Premium Diario","Exclusiva Diaria","Pack Mensual","Económica"] : PAQUETES) : ["Premium Diario"];
      if(accesoFijo && destinatario.email?.toLowerCase() === "machadofelixb@gmail.com") {
        const filtro = new URLSearchParams({user_id:`eq.${destinatario.id}`,paquete:"in.(Premium Semanal,Exclusiva Semanal)",nombre:"like.*(ACCESO DE CORTESÍA)",cantidad_pagada_dolar:"eq.0"});
        const ajuste = await fetch(`${SUPABASE_URL}/rest/v1/compras?${filtro}`,{method:"PATCH",headers:{...headers,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({vencimiento:new Date().toISOString()})});
        if(!ajuste.ok)return res.status(502).json({error:"No se pudo ajustar el acceso semanal."});
      }
      const consulta = new URLSearchParams({ select: "paquete,vencimiento", user_id: `eq.${destinatario.id}`, vencimiento: `gt.${new Date().toISOString()}`, limit: "100" });
      const anterior = await fetch(`${SUPABASE_URL}/rest/v1/compras?${consulta}`, { headers });
      if (!anterior.ok) return res.status(502).json({ error: "No se pudo comprobar tu acceso." });
      const filas = await anterior.json();
      const faltantes = paquetesPrueba.filter(paquete => !filas.some(f => f.paquete === paquete && (!accesoFijo || Date.parse(f.vencimiento) > Date.parse("2098-01-01"))));
      if (!faltantes.length) return res.status(200).json({ paquete: "Premium Diario", existente: true });
      const ahora = new Date();
      const resultado = await fetch(`${SUPABASE_URL}/rest/v1/compras`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(faltantes.map(paquete => ({ user_id: destinatario.id, nombre: `${destinatario.user_metadata?.full_name || "Cliente"} (${accesoFijo ? "ACCESO DE CORTESÍA" : "PRUEBA SIN COBRO"})`, correo: destinatario.email, paquete, cantidad_pagada_dolar: 0, fecha_compra: ahora.toISOString(), vencimiento: accesoFijo ? "2099-12-31T23:59:59.000Z" : new Date(ahora.getTime() + 60 * 60 * 1000).toISOString() })))
      });
      if (!resultado.ok) return res.status(502).json({ error: "No se pudo activar el paquete de prueba." });
      return res.status(201).json({ paquete: "Premium Diario", prueba: true, duracion: "1 hora" });
    }
    const { titulo, descripcion, partidos, jugadas, cuota, instagram = "", analisis = "", fecha_pick, imagen_url = "", juego_url = "", paquetes } = req.body || {};
    const estructurado = Array.isArray(partidos) || Array.isArray(jugadas) || cuota !== undefined;
    const deportes = { "Fútbol":"⚽", MLB:"⚾", NBA:"🏀", NHL:"🏒", NFL:"🏈", UFC:"🥊" };
    const partidosValidos = Array.isArray(partidos) && partidos.length > 0 && partidos.length <= 12 && partidos.every(p => p && typeof p.deporte === "string" && Object.hasOwn(deportes, p.deporte) && typeof p.enfrentamiento === "string" && p.enfrentamiento.trim().length > 2 && p.enfrentamiento.trim().length <= 240);
    const jugadasValidas = Array.isArray(jugadas) && jugadas.length > 0 && jugadas.length <= 20 && jugadas.every(j => typeof j === "string" && j.trim().length > 0 && j.trim().length <= 500);
    const cuotaValida = typeof cuota === "string" && /^[+-]?\d{1,8}(?:[.,]\d{1,4})?$/.test(cuota.trim());
    const instagramValido = typeof instagram === "string" && instagram.length <= 60 && (!instagram.trim() || /^@?[a-zA-Z0-9._]{1,30}$/.test(instagram.trim()));
    const analisisValido = typeof analisis === "string" && analisis.length <= 5000;
    if (typeof titulo !== "string" || !titulo.trim() || titulo.length > 160 ||
        (estructurado ? !(partidosValidos && jugadasValidas && cuotaValida && instagramValido && analisisValido) : (typeof descripcion !== "string" || !descripcion.trim() || descripcion.length > 10000)) ||
        typeof fecha_pick !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_pick) ||
        !Number.isFinite(Date.parse(`${fecha_pick}T00:00:00Z`)) ||
        new Date(`${fecha_pick}T00:00:00Z`).toISOString().slice(0,10) !== fecha_pick ||
        !Array.isArray(paquetes) || !paquetes.length || paquetes.some(p => !PAQUETES.includes(p))) {
      return res.status(400).json({ error: "Revisa el título, contenido, fecha y paquetes." });
    }
    let imagenValida = typeof imagen_url === "string" && imagen_url.length <= 2048;
    if (imagenValida && imagen_url) {
      try { const url = new URL(imagen_url); imagenValida = url.protocol === "https:" && !url.username && !url.password; }
      catch { imagenValida = false; }
    }
    if (!imagenValida) {
      return res.status(400).json({ error: "La imagen debe tener un enlace HTTPS válido." });
    }
    let juegoValido = typeof juego_url === "string" && juego_url.length <= 2048;
    if (juegoValido && juego_url) {
      try { const url = new URL(juego_url); juegoValido = url.protocol === "https:" && !url.username && !url.password; }
      catch { juegoValido = false; }
    }
    if (!juegoValido) return res.status(400).json({error:"El juego debe tener un enlace HTTPS válido."});
    const tituloPick = titulo.trim().startsWith("📍") ? titulo.trim() : `📍 ${titulo.trim()}`;
    const descripcionPick = estructurado ? [
      ...partidos.map(p => `🏟️ ${deportes[p.deporte]} ${p.deporte} · ${p.enfrentamiento.trim()}`),
      "",
      ...jugadas.map(j => `🟢 → ${j.trim()}`),
      `🔥 ${cuota.trim()}`,
      instagram.trim() ? `📸 ${instagram.trim().startsWith("@") ? instagram.trim() : `@${instagram.trim()}`}` : "",
      analisis.trim() ? `\nAnálisis:\n${analisis.trim()}` : ""
    ].filter(Boolean).join("\n") : descripcion.trim();
    // Keep the structured pick in the existing text column; no database migration is required.
    const contenido = descripcionPick + (juego_url ? `\n\nVer juego: ${new URL(juego_url).href}` : "");
    if (contenido.length > 10000) return res.status(400).json({error:"Acorta el análisis para incluir el enlace del juego."});
    const filas = [...new Set(paquetes)].map(paquete => ({
      titulo: tituloPick, descripcion: contenido, fecha_pick,
      imagen_url: imagen_url || null, paquete, activo: true
    }));
    const result = await fetch(`${SUPABASE_URL}/rest/v1/picks`, {
      method: "POST",
      headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(filas)
    });
    if (!result.ok) {
      console.error("No se pudo publicar el pick", result.status);
      return res.status(502).json({ error: "No se pudo confirmar la publicación. Revisa la tabla picks antes de volver a intentarlo." });
    }
    const notificaciones=await notificarPicks(filas,secret);
    return res.status(201).json({ publicados: filas.length, picks: filas, notificaciones });
  } catch {
    return res.status(500).json({ error: "No se pudo confirmar la publicación. Revisa los picks antes de volver a intentarlo." });
  }
}
