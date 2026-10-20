const supabaseClient = window.supabase.createClient("https://nfvkmxnprchvkufwvhpr.supabase.co", "sb_publishable_LkV-utNMHKyRw5GH30SF-Q_znC4MRA1");
const vistaPicks = document.body.dataset.vista === "picks";
const contenido = document.getElementById("contenido");
let comprasVisibles = [], filtroActual = new URLSearchParams(window.location.search).get("paquete") || "Todos", cargando = false, comprobandoPago = false;
const escapar = valor => String(valor ?? "—").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function fechaCentral(){const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return `${p.find(x=>x.type==="year").value}-${p.find(x=>x.type==="month").value}-${p.find(x=>x.type==="day").value}`}if(vistaPicks){const fechaInicial=fechaCentral();const revisarDia=setInterval(()=>{if(fechaCentral()!==fechaInicial){clearInterval(revisarDia);window.location.reload()}},5000)}function fechaBonita(valor) { const fecha = new Date(valor); return Number.isFinite(fecha.getTime()) ? fecha.toLocaleString("es-US",{timeZone:"America/Chicago",dateStyle:"medium",timeStyle:"short"}) : "—"; }
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
  const nombre = user.user_metadata?.full_name || compras.find(compra => compra.nombre)?.nombre || "—";
  const telefono = user.user_metadata?.phone || user.phone || "No registrado";
  const usuario = user.user_metadata?.username || "No registrado";
  contenido.innerHTML = `<section class="panel" aria-labelledby="personalTitulo"><h2 id="personalTitulo" class="section-title">MI INFORMACIÓN</h2><div class="personal">${fila("NOMBRE COMPLETO",nombre)}${fila("CORREO",user.email || "—")}${fila("TELÉFONO",telefono)}${fila("NOMBRE DE USUARIO",usuario)}${fila("ID DE USUARIO",user.id || "—")}</div></section><section class="panel" aria-labelledby="paquetesTitulo"><h2 id="paquetesTitulo" class="section-title">MIS PAQUETES</h2>${compras.length ? compras.map(compra => `<article class="package"><div class="package-head"><h3 class="package-title">${escapar(compra.paquete)}</h3><span class="status">ACTIVO</span></div>${fila("TOTAL PAGADO",`$${Number(compra.cantidad_pagada_dolar || 0).toFixed(2)} USD`)}${fila("FECHA DE COMPRA",fechaBonita(compra.fecha_compra))}${fila("VENCIMIENTO",fechaBonita(compra.vencimiento))}</article>`).join("") + `<a class="button" href="mis-picks.html">VER MIS PICKS →</a>` : sinPaquetes()}</section>`;
}
function contenidoPick(pick) {
  let descripcion = pick.descripcion || "", juego = "", imagen = "";
  const enlace = descripcion.match(/\n\nVer juego: (https:\/\/[^\s]+)\s*$/);
  const urlSegura = valor => { try { const url = new URL(valor); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; } };
  if (enlace && (juego = urlSegura(enlace[1]))) descripcion = descripcion.slice(0,enlace.index);
  imagen = urlSegura(pick.imagen_url);
  return `<div class="pick-date">${escapar(pick.fecha_pick)}</div><h3 class="pick-title">${escapar(pick.titulo || "Pick de hoy")}</h3>${imagen ? `<img class="pick-image" src="${escapar(imagen)}" alt="Imagen del pick" loading="lazy">` : ""}${window.renderPickDescription(descripcion)}${juego ? `<a class="button" href="${escapar(juego)}" target="_blank" rel="noopener noreferrer">VER JUEGO</a>` : ""}`;
}
function marcaPick(paquete) {
  const texto = escapar(`ISB EL TRIDENTE · ${paquete}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="64"><text x="24" y="38" fill="#efc766" font-family="Arial" font-size="12" font-weight="700">${texto}</text></svg>`;
  return escapar(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}

function renderChampionsCalendar(root,dias,error=false){
  const parsed=(dias||[]).map(d=>({...d,fecha:String(d.fecha||"").slice(0,10)})).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.fecha));
  const porFecha=new Map(parsed.map(d=>[d.fecha,Array.isArray(d.partidos)?d.partidos:[]]));
  const hoy=fechaCentral(),inicio=new Date(2026,6,1),fin=new Date(2027,11,1);let mes=new Date(Number(hoy.slice(0,4)),Number(hoy.slice(5,7))-1,1);
  if(mes<inicio)mes=new Date(inicio);if(mes>fin)mes=new Date(fin);
  let seleccionado=(parsed.find(d=>d.fecha>=hoy)||parsed[0]||{}).fecha||hoy;
  function llave(y,m,d){return y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");}
  function dibujar(){
    const year=mes.getFullYear(),month=mes.getMonth(),nombreMes=new Intl.DateTimeFormat("es-US",{month:"long",year:"numeric"}).format(mes).toUpperCase();
    const primer=(new Date(year,month,1).getDay()+6)%7,diasMes=new Date(year,month+1,0).getDate();let celdas=Array(primer).fill('<span class="champions-empty-day"></span>');
    for(let d=1;d<=diasMes;d++){const key=llave(year,month,d),partidos=porFecha.get(key)||[],n=partidos.length,ganados=partidos.filter(p=>p.resultado==="Ganado").length,perdidos=partidos.filter(p=>p.resultado==="Perdido").length,noEnviados=partidos.filter(p=>p.resultado==="No enviado").length,claseEstado=ganados&&perdidos?" resultado-mixto":ganados?" resultado-ganado":perdidos?" resultado-perdido":noEnviados&&!partidos.some(p=>p.resultado==="Pendiente")?" resultado-noenviado":"",resumen=[ganados?'<span>✓ '+ganados+' G</span>':"",perdidos?'<span>✕ '+perdidos+' P</span>':""].filter(Boolean).join(" · ")||(noEnviados&&!partidos.some(p=>p.resultado==="Pendiente")?'<span>NO ENVIADO</span>':"");celdas.push('<button type="button" class="champions-day '+(n?"has-games ":"")+claseEstado+(key===seleccionado?" selected":"")+'" data-champions-date="'+key+'"><span>'+d+'</span>'+(n?'<small>⚽ '+n+'</small>':"")+(resumen?'<em>'+resumen+'</em>':"")+'</button>');}const lista=porFecha.get(seleccionado)||[],fechaTexto=new Date(seleccionado+"T12:00:00").toLocaleDateString("es-US",{timeZone:"America/Chicago",weekday:"long",year:"numeric",month:"long",day:"numeric"});
    const img=v=>{const raw=String(v||"");if(raw.length<=650000&&new RegExp("^data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$").test(raw))return escapar(raw);try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password?escapar(u.href):"";}catch{return "";}};
    const fixtures=lista.length?lista.map(p=>{const a=img(p.escudo_local),b=img(p.escudo_visitante),r=["Pendiente","Ganado","Perdido","No enviado"].includes(p.resultado)?p.resultado:"Pendiente",icono=r==="Ganado"?"✓ ":r==="Perdido"?"✕ ":r==="No enviado"?"— ":"";return '<article class="champions-fixture"><div class="champions-team">'+(a?'<img src="'+a+'" alt="" loading="lazy">':'<span class="champions-crest-placeholder">⚽</span>')+'<span>'+escapar(p.local||"")+"</span></div><span class=\"champions-vs\">VS</span><div class=\"champions-team\">"+(b?'<img src="'+b+'" alt="" loading="lazy">':'<span class="champions-crest-placeholder">⚽</span>')+'<span>'+escapar(p.visitante||"")+"</span></div>"+'<strong class="champions-result resultado-'+r.toLowerCase().replace(/[^a-z]/g,"")+'">'+icono+escapar(r)+'</strong></article>';}).join(""):'<p class="champions-no-games">No hay partidos publicados para esta fecha.</p>';
    root.innerHTML='<h2 class="champions-calendar-title">CALENDARIO DE PARTIDOS</h2><div class="champions-monthbar"><button type="button" data-month="-1" aria-label="Mes anterior">‹</button><strong>'+nombreMes+'</strong><button type="button" data-month="1" aria-label="Mes siguiente">›</button></div><div class="champions-weekdays"><span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span></div><div class="champions-calendar-grid">'+celdas.join("")+'</div><section class="champions-fixtures"><h3>PARTIDOS DEL DÍA</h3><p class="champions-selected-date">'+escapar(fechaTexto)+'</p>'+fixtures+'</section>'+(error?'<p class="champions-no-games">No se pudo cargar el calendario. Actualiza la página para volver a intentarlo.</p>':'')+'';
    root.querySelectorAll("[data-month]").forEach(button=>button.addEventListener("click",()=>{const next=new Date(year,month+Number(button.dataset.month),1);if(next>=inicio&&next<=fin){mes=next;dibujar();}}));
    root.querySelectorAll("[data-champions-date]").forEach(button=>button.addEventListener("click",()=>{seleccionado=button.dataset.championsDate;dibujar();}));
  }dibujar();
}

function renderPicks(compras) {
  if (!compras.length) { contenido.innerHTML = `<section class="panel">${sinPaquetes()}</section>`; return; }
  if (filtroActual !== "Todos" && !compras.some(c=>c.paquete === filtroActual)) filtroActual = "Todos";
  const filtros = ["Todos",...compras.map(c=>c.paquete)];
  if(filtroActual === "Todos") {
    contenido.innerHTML = `<section class="panel"><h2 class="section-title">ELIGE TU PAQUETE</h2><div class="package-options">${compras.map((c,i)=>`<button class="filter package-option" type="button" data-paquete="${i}">${escapar(c.paquete)}</button>`).join("")}</div></section>`;
    document.querySelectorAll("[data-paquete]").forEach(b=>b.addEventListener("click",()=>{filtroActual=compras[Number(b.dataset.paquete)].paquete;renderPicks(comprasVisibles);}));
    return;
  }
  contenido.innerHTML = `<div class="filters"><button class="filter" type="button" data-filtro="0">← VOLVER A MIS PAQUETES</button></div>${compras.filter(c=>filtroActual === "Todos" || c.paquete===filtroActual).map(compra=>`<article class="panel"><div class="package-head"><h2 class="package-title">${escapar(compra.paquete)}</h2><span class="status">ACTIVO</span></div><div class="pick-preview" style="--marca-pick:${marcaPick(compra.paquete)}">${compra.errorPick ? `<p class="message">No se pudo cargar el pick. Actualiza la página para intentarlo de nuevo.</p>` : compra.picks?.length ? compra.picks.map((pick,i)=>`<div${i?` style="border-top:1px solid #ad8736;padding-top:16px;margin-top:16px"`:""}>${contenidoPick(pick)}</div>`).join("") : `<p class="message">Todavía no se han publicado picks de hoy para este paquete.</p>`}</div>${compra.paquete==="Champions League Completa"?'<section class="champions-calendar-wrap" data-champions-calendar></section>':""}</article>`).join("")}`;
  contenido.querySelectorAll("[data-champions-calendar]").forEach(root=>{const compra=compras.find(c=>c.paquete==="Champions League Completa");renderChampionsCalendar(root,compra?.championsDays||[],compra?.championsCalendarError);})
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
      comprasVisibles = comprasVisibles.filter(c=>new Date(c.vencimiento)>new Date());
      const paquetesCliente = [...new Map(comprasVisibles.map(compra=>[compra.paquete,compra])).values()];
      await Promise.all(paquetesCliente.map(async compra=>{
        const {data:picks,error} = await supabaseClient.from("picks").select("titulo,descripcion,fecha_pick,imagen_url").eq("paquete",compra.paquete).eq("fecha_pick",hoy).eq("activo",true).order("created_at",{ascending:false}).limit(3);
        compra.picks = (picks || []).filter(p=>p.titulo!=="CHAMPIONS_CALENDAR_V1"); compra.errorPick = Boolean(error);
        if(compra.paquete==="Champions League Completa"){const {data:rows,error:calendarError}=await supabaseClient.from("picks").select("fecha_pick,descripcion").eq("paquete","Champions League Completa").eq("titulo","CHAMPIONS_CALENDAR_V1").eq("activo",true).order("fecha_pick",{ascending:true}).limit(1000);compra.championsCalendarError=Boolean(calendarError);compra.championsDays=(rows||[]).map(row=>{try{const parsed=JSON.parse(row.descripcion);return {fecha:row.fecha_pick,partidos:(parsed.partidos||[]).filter(p=>p&&p.manual===true)};}catch{return null;}}).filter(Boolean);}
      }));
      comprasVisibles = paquetesCliente;
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
            const respuesta = await fetch("/api/admin-picks",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({accion:"activar_prueba",todos:true,permanente:true,correo_prueba:correoPrueba?.value || session.user.email}),signal:AbortSignal.timeout(15000)});
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.error);
            estado.textContent = resultado.existente ? "Ya tienes Premium Diario activo. Puedes publicar tu jugada para ese paquete." : "Acceso a todos los paquetes activado. Total pagado: $0.00; no se hizo ningún cobro.";
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
