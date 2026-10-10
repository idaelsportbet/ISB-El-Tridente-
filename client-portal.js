const supabaseClient = window.supabase.createClient("https://nfvkmxnprchvkufwvhpr.supabase.co", "sb_publishable_LkV-utNMHKyRw5GH30SF-Q_znC4MRA1");
const vistaPicks = document.body.dataset.vista === "picks";
const contenido = document.getElementById("contenido");
let comprasVisibles = [], filtroActual = "Todos", cargando = false, comprobandoPago = false;
const escapar = valor => String(valor ?? "—").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function fechaBonita(valor) { const fecha = new Date(valor); return Number.isFinite(fecha.getTime()) ? fecha.toLocaleString("es-US",{timeZone:"America/Chicago",dateStyle:"medium",timeStyle:"short"}) : "—"; }
function fila(label,valor) { return `<div class="row"><div class="label">${label}</div><div class="value">${escapar(valor)}</div></div>`; }
function paquetesActivos(compras) {
  const paquetes = new Map();
  for (const compra of compras) {
    if (!compra.paquete || !(new Date(compra.vencimiento) > new Date())) continue;
    const anterior = paquetes.get(compra.paquete);
    if (!anterior || new Date(compra.vencimiento) > new Date(anterior.vencimiento)) paquetes.set(compra.paquete,compra);
  }
  return [...paquetes.values()];
}
function sinPaquetes() { return `<div class="empty message">No tienes paquetes activos.<a class="button" href="paquetes.html">VER PAQUETES</a></div>`; }
function renderCuenta(user, compras) {
  contenido.innerHTML = `<section class="panel" aria-labelledby="personalTitulo"><h2 id="personalTitulo" class="section-title">MI INFORMACIÓN</h2><div class="personal">${fila("NOMBRE",user.user_metadata?.full_name || compras[0]?.nombre || "—")}${fila("CORREO",user.email || "—")}</div></section><section class="panel" aria-labelledby="paquetesTitulo"><h2 id="paquetesTitulo" class="section-title">MIS PAQUETES</h2>${compras.length ? compras.map(compra => `<article class="package"><div class="package-head"><h3 class="package-title">${escapar(compra.paquete)}</h3><span class="status">ACTIVO</span></div>${fila("TOTAL PAGADO",`$${Number(compra.cantidad_pagada_dolar || 0).toFixed(2)} USD`)}${fila("FECHA DE COMPRA",fechaBonita(compra.fecha_compra))}${fila("VENCIMIENTO",fechaBonita(compra.vencimiento))}</article>`).join("") + `<a class="button" href="mis-picks.html">VER MIS PICKS →</a>` : sinPaquetes()}</section>`;
}
function contenidoPick(pick) {
  let descripcion = pick.descripcion || "", juego = "", imagen = "";
  const enlace = descripcion.match(/\n\nVer juego: (https:\/\/[^\s]+)\s*$/);
  const urlSegura = valor => { try { const url = new URL(valor); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; } };
  if (enlace && (juego = urlSegura(enlace[1]))) descripcion = descripcion.slice(0,enlace.index);
  imagen = urlSegura(pick.imagen_url);
  return `<div class="pick-date">${escapar(pick.fecha_pick)}</div><h3 class="pick-title">${escapar(pick.titulo || "Pick de hoy")}</h3>${imagen ? `<img class="pick-image" src="${escapar(imagen)}" alt="Imagen del pick" loading="lazy">` : ""}<p class="pick-description" style="white-space:pre-wrap">${escapar(descripcion)}</p>${juego ? `<a class="button" href="${escapar(juego)}" target="_blank" rel="noopener noreferrer">VER JUEGO</a>` : ""}`;
}
function marcaPick(paquete) {
  const texto = escapar(`ISB EL TRIDENTE · ${paquete}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="64"><text x="24" y="38" fill="#efc766" font-family="Arial" font-size="12" font-weight="700" transform="rotate(-8 150 32)">${texto}</text></svg>`;
  return escapar(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}
function renderPicks(compras) {
  if (!compras.length) { contenido.innerHTML = `<section class="panel">${sinPaquetes()}</section>`; return; }
  if (filtroActual !== "Todos" && !compras.some(c=>c.paquete === filtroActual)) filtroActual = "Todos";
  const filtros = ["Todos",...compras.map(c=>c.paquete)];
  contenido.innerHTML = `<div class="filters" aria-label="Filtrar por paquete">${filtros.map((f,i)=>`<button class="filter" type="button" data-filtro="${i}" aria-pressed="${f===filtroActual}">${escapar(f)}</button>`).join("")}</div>${compras.filter(c=>filtroActual === "Todos" || c.paquete===filtroActual).map(compra=>`<article class="panel"><div class="package-head"><h2 class="package-title">${escapar(compra.paquete)}</h2><span class="status">ACTIVO</span></div><div class="pick-preview" style="--marca-pick:${marcaPick(compra.paquete)}">${compra.errorPick ? `<p class="message">No se pudo cargar el pick. Actualiza la página para intentarlo de nuevo.</p>` : compra.pick ? contenidoPick(compra.pick) : `<p class="message">Todavía no se ha publicado el pick de hoy para este paquete.</p>`}</div></article>`).join("")}`;
  document.querySelectorAll("[data-filtro]").forEach(boton=>boton.addEventListener("click",()=>{filtroActual=filtros[Number(boton.dataset.filtro)];renderPicks(comprasVisibles);}));
}
async function cargarPortal() {
  if (cargando) return;
  cargando = true;
  try {
    const {data:{session}} = await supabaseClient.auth.getSession();
    if (!session?.user) { contenido.innerHTML = `<section class="panel message">Debes iniciar sesión para ver tu cuenta y tus picks.<a class="button" href="index.html">INICIAR SESIÓN</a></section>`; return; }
    if (!vistaPicks) comprobarPago(session);
    const {data,error} = await supabaseClient.from("compras").select("nombre,paquete,cantidad_pagada_dolar,fecha_compra,vencimiento").eq("user_id",session.user.id).gt("vencimiento",new Date().toISOString()).order("fecha_compra",{ascending:false}).limit(100);
    if (error) throw new Error("No se pudieron cargar tus paquetes. Actualiza la página para intentarlo de nuevo.");
    comprasVisibles = paquetesActivos(data || []);
    if (vistaPicks) {
      const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));
      const hoy = `${partes.year}-${partes.month}-${partes.day}`;
      await Promise.all(comprasVisibles.map(async compra=>{
        const {data:picks,error} = await supabaseClient.from("picks").select("titulo,descripcion,fecha_pick,imagen_url").eq("paquete",compra.paquete).eq("fecha_pick",hoy).eq("activo",true).order("created_at",{ascending:false}).limit(1);
        compra.pick = picks?.[0]; compra.errorPick = Boolean(error);
      }));
      comprasVisibles = comprasVisibles.filter(c=>new Date(c.vencimiento)>new Date());
      renderPicks(comprasVisibles);
    } else {
      renderCuenta(session.user,comprasVisibles);
      try {
        const respuesta = await fetch("/api/admin-picks",{headers:{Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(8000)});
        document.getElementById("adminLink").hidden = !respuesta.ok;
        const prueba = document.getElementById("pruebaAcceso");
        prueba.hidden = !respuesta.ok;
        const correoPrueba = document.getElementById("correoPrueba");
        if (correoPrueba) { correoPrueba.hidden = !respuesta.ok; if (!correoPrueba.value) correoPrueba.value = session.user.email; }
        prueba.onclick = async () => {
          prueba.disabled = true;
          const estado = document.getElementById("estadoPrueba");
          estado.hidden = false;estado.textContent = "Activando tu paquete de prueba...";
          try {
            const respuesta = await fetch("/api/admin-picks",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({accion:"activar_prueba",correo_prueba:correoPrueba?.value || session.user.email}),signal:AbortSignal.timeout(15000)});
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.error);
            estado.textContent = resultado.existente ? "Ya tienes Premium Diario activo. Puedes publicar tu jugada para ese paquete." : "Premium Diario activo durante 1 hora para probar. Total pagado: $0.00; no se hizo ningún cobro.";
            await cargarPortal();
          } catch(error) { estado.textContent = error.message || "No se pudo activar la prueba."; }
          finally { prueba.disabled = false; }
        };
      } catch {}
    }
  } catch (error) { contenido.innerHTML = `<section class="panel message">${escapar(error.message || "No se pudo cargar tu información. Actualiza la página.")}</section>`; }
  finally { cargando = false; }
}
async function comprobarPago(session) {
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get("payment") !== "success" || comprobandoPago) return;
  const mensaje=document.getElementById("estadoPago"), boton=document.getElementById("revisarPago");
  mensaje.hidden=false;boton.hidden=true;comprobandoPago=true;
  mensaje.textContent="Comprobando tu pago y la activación de tu paquete...";
  try {
    const respuesta=await fetch(`/api/payment-status?session_id=${encodeURIComponent(parametros.get("session_id")||"")}`,{headers:{Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(25000)});
    const pago=await respuesta.json();if(!respuesta.ok)throw new Error(pago.error);
    if(pago.estado==="activo") {
      mensaje.textContent=`Pago confirmado. Tu paquete ${pago.paquete} ya está activo.`;
      history.replaceState(null,"",window.location.pathname);
      setTimeout(cargarPortal,1000);
    } else {
      mensaje.textContent=pago.estado==="activando"?"Stripe confirmó tu pago. Estamos activando tu paquete; vuelve a comprobarlo en unos segundos.":"El pago aún no está confirmado. No necesitas realizar otra compra para comprobarlo.";
      boton.hidden=false;
    }
  } catch(error){mensaje.textContent=error.message||"No se pudo comprobar tu pago. Inténtalo de nuevo.";boton.hidden=false;}
  finally{comprobandoPago=false;}
  boton.onclick=()=>comprobarPago(session);
}
cargarPortal();
// Remove access from the displayed views when it expires, including in an open tab.
setInterval(()=>{if(comprasVisibles.some(c=>new Date(c.vencimiento)<=new Date()))cargarPortal();},30000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")cargarPortal();});
