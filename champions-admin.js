(()=> {
  const panel=document.getElementById("championsAdminPanel");
  const tab=document.getElementById("tabChampions");
  const form=document.getElementById("championsAdminForm");
  const date=document.getElementById("championsAdminDate");
  const rows=document.getElementById("championsAdminMatches");
  const status=document.getElementById("championsAdminStatus");
  const calendario=window.ISB_CHAMPIONS_FIXTURES||{};
  if(!panel||!tab)return;
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const estados=["Pendiente","Ganado","Perdido","No enviado"];
  const calendarRoot=document.getElementById("championsAdminCalendar");
  let diasGuardados=[], mesActivo=null;
  function obtenerPartidos(fecha){const guardado=diasGuardados.find(d=>d.fecha===fecha);return guardado?.partidos||((calendario[fecha]||[]).map(([local,visitante])=>({local,visitante})));}
  function estadoFecha(partidos){const estadosDia=(partidos||[]).map(p=>estados.includes(p.resultado)?p.resultado:"Pendiente");if(!estadosDia.length||estadosDia.includes("Pendiente"))return "";const distintos=[...new Set(estadosDia)];return distintos.length===1?distintos[0]:"Mixto";}
  function guardarEnCache(fecha,partidos){diasGuardados=diasGuardados.filter(d=>d.fecha!==fecha);if(partidos?.length)diasGuardados.push({fecha,partidos});dibujarCalendario();}
  function dibujarCalendario(){
    if(!calendarRoot||!mesActivo)return;
    const year=mesActivo.getFullYear(),month=mesActivo.getMonth(),nombre=new Intl.DateTimeFormat("es-US",{month:"long",year:"numeric"}).format(mesActivo).toUpperCase();
    const primer=(new Date(year,month,1).getDay()+6)%7,total=new Date(year,month+1,0).getDate(),celdas=Array(primer).fill('<span class="champions-admin-empty"></span>');
    for(let d=1;d<=total;d++){const key=year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0"),partidos=obtenerPartidos(key),n=partidos.length,ganados=partidos.filter(p=>p.resultado==="Ganado").length,perdidos=partidos.filter(p=>p.resultado==="Perdido").length,noEnviados=partidos.filter(p=>p.resultado==="No enviado").length,clase=ganados&&perdidos?" admin-resultado-mixto":ganados?" admin-resultado-ganado":perdidos?" admin-resultado-perdido":noEnviados&&!partidos.some(p=>p.resultado==="Pendiente")?" admin-resultado-noenviado":"",resumen=[ganados?'<span>✓ '+ganados+' G</span>':"",perdidos?'<span>✕ '+perdidos+' P</span>':""].filter(Boolean).join(" · ")||(noEnviados&&!partidos.some(p=>p.resultado==="Pendiente")?'<span>NO ENVIADO</span>':"");celdas.push('<button type="button" class="champions-admin-day champions-calendar-control'+(n?" has-games":"")+clase+(date.value===key?" selected":"")+'" data-admin-date="'+key+'"><span>'+d+'</span>'+(n?'<small>⚽ '+n+'</small>':"")+(resumen?'<em>'+resumen+'</em>':"")+'</button>');}
    calendarRoot.innerHTML='<div class="champions-admin-monthbar"><button type="button" class="champions-calendar-control" data-admin-month="-1" aria-label="Mes anterior">‹</button><strong>'+nombre+'</strong><button type="button" class="champions-calendar-control" data-admin-month="1" aria-label="Mes siguiente">›</button></div><div class="champions-admin-weekdays"><span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span></div><div class="champions-admin-grid">'+celdas.join("")+'</div>';
    calendarRoot.querySelectorAll("[data-admin-month]").forEach(b=>b.addEventListener("click",()=>{const next=new Date(year,month+Number(b.dataset.adminMonth),1);if(next>=new Date(2026,6,1)&&next<=new Date(2027,11,1)){mesActivo=next;dibujarCalendario();}}));
    calendarRoot.querySelectorAll("[data-admin-date]").forEach(b=>b.addEventListener("click",()=>{date.value=b.dataset.adminDate;mesActivo=new Date(Number(date.value.slice(0,4)),Number(date.value.slice(5,7))-1,1);dibujarCalendario();loadDay();}));
  }
  async function cargarCalendarioGuardado(){try{const d=await call("GET",null,"?vista=champions");diasGuardados=d.dias||[];dibujarCalendario();}catch(e){status.textContent=e.message;}}
  const equipoClave=v=>{let s=String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();if(s.startsWith("paris")||s==="psg")s="paris saint germain";return s;};const clave=m=>[equipoClave(m.local),equipoClave(m.visitante)].sort().join("|");
  function addMatch(match={}) {
    const card=document.createElement("fieldset");
    card.className="champions-admin-match";
    const resultado=estados.includes(match.resultado)?match.resultado:"Pendiente",numero=rows.children.length+1;
    card.innerHTML='<legend>PARTIDO '+numero+'</legend><input type="hidden" data-local value="'+escapeHtml(match.local||"")+'"><input type="hidden" data-visitante value="'+escapeHtml(match.visitante||"")+'"><div class="champions-admin-match-grid"><label>Escudo local · pega el enlace HTTPS<input data-local-logo type="url" maxlength="2048" placeholder="https://…/escudo.png" value="'+escapeHtml(match.escudo_local||"")+'"></label><label>Escudo visitante · pega el enlace HTTPS<input data-visitante-logo type="url" maxlength="2048" placeholder="https://…/escudo.png" value="'+escapeHtml(match.escudo_visitante||"")+'"></label><label>Cuota (opcional)<input data-cuota inputmode="text" maxlength="20" placeholder="+110" value="'+escapeHtml(match.cuota||"")+'"></label><label>Resultado<select data-resultado>'+estados.map(x=>'<option'+(x===resultado?' selected':'')+'>'+x+'</option>').join("")+'</select></label></div>';
    rows.append(card);
  }
  async function call(method,body,query="") {
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw new Error("La sesión venció. Inicia sesión otra vez.");
    const r=await fetch("/api/admin-picks"+query,{method,headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||"No se pudo guardar el calendario.");
    return data;
  }
  async function loadDay() {
    if(!date.value)return;
    status.textContent="Cargando calendario oficial y partidos guardados…";
    try {
      const d=await call("GET",null,"?vista=champions&fecha="+encodeURIComponent(date.value));
      const guardado=d.dias?.find(x=>x.fecha===date.value)?.partidos||[];
      const pendientes=[...guardado];
      const oficiales=(calendario[date.value]||[]).map(([local,visitante])=>{
        const i=pendientes.findIndex(p=>clave(p)===clave({local,visitante}));
        const anterior=i>=0?pendientes.splice(i,1)[0]:{};
        return {...anterior,local,visitante,escudo_local:anterior.escudo_local||"",escudo_visitante:anterior.escudo_visitante||"",cuota:anterior.cuota||"",resultado:anterior.resultado||"Pendiente"};
      });
      const partidos=[...oficiales,...pendientes];
      if(guardado.length)guardarEnCache(date.value,guardado);else dibujarCalendario();
      rows.replaceChildren();
      partidos.forEach(addMatch);
      status.textContent=partidos.length
        ? partidos.length+" partido(s) para "+date.value+(guardado.length?" · se conservaron los escudos, cuotas y resultados guardados.":" · calendario oficial cargado; agrega escudos y guarda.")
        : "No hay partidos oficiales confirmados para esta fecha. Puedes agregarlos manualmente.";
    } catch(e) {status.textContent=e.message;}
  }
  function openPanel() {
    document.getElementById("publicar").hidden=true;
    for(const id of ["refundAdmin","editorLayout","clientes","supportAdmin","editorResultados","pickPublicado","historial","descuentoPanel","challengeCycleAdmin"]) {
      const el=document.getElementById(id);if(el)el.hidden=true;
    }
    panel.hidden=false;
    document.querySelectorAll("#secciones button").forEach(b=>b.setAttribute("aria-pressed",String(b===tab)));
    status.textContent="Elige un día en el almanaque. Al abrirlo puedes añadir los enlaces HTTPS de los escudos, marcar el resultado y guardar.";
    cargarCalendarioGuardado();
    loadDay();
  }
  tab.addEventListener("click",openPanel);
  document.querySelectorAll("#secciones button").forEach(b=>b.addEventListener("click",()=>{if(b!==tab)panel.hidden=true;}));
  date.addEventListener("change",()=>{mesActivo=new Date(Number(date.value.slice(0,4)),Number(date.value.slice(5,7))-1,1);dibujarCalendario();loadDay();});
  document.getElementById("championsAdminDeleteDate").addEventListener("click",async()=>{
    if(!date.value||!confirm("¿Quitar todos los partidos de Champions de "+date.value+"?"))return;
    status.textContent="Quitando fecha…";
    try{await call("POST",{accion:"borrar_champions_fecha",fecha:date.value});rows.replaceChildren();guardarEnCache(date.value,[]);status.textContent="Se quitaron los partidos guardados de esa fecha.";}
    catch(e){status.textContent=e.message;}
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const partidos=[...rows.children].map(row=>({local:row.querySelector("[data-local]").value.trim(),escudo_local:row.querySelector("[data-local-logo]").value.trim(),visitante:row.querySelector("[data-visitante]").value.trim(),escudo_visitante:row.querySelector("[data-visitante-logo]").value.trim(),cuota:row.querySelector("[data-cuota]").value.trim(),resultado:row.querySelector("[data-resultado]").value}));
    const save=form.querySelector('[type="submit"]');
    save.disabled=true;status.textContent="Guardando partidos, escudos y resultados…";
    try{const d=await call("POST",{accion:"guardar_champions",fecha:date.value,partidos});guardarEnCache(d.fecha,partidos);status.textContent="Se guardaron "+d.partidos+" partido(s) para "+d.fecha+".";}
    catch(e){status.textContent=e.message;}
    finally{save.disabled=false;}
  });
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  date.value=v.year+"-"+v.month+"-"+v.day;
  mesActivo=new Date(Number(v.year),Number(v.month)-1,1);
  dibujarCalendario();
})();