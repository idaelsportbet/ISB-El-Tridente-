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
  const equipoClave=v=>{let s=String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();if(s.startsWith("paris")||s==="psg")s="paris saint germain";return s;};const clave=m=>[equipoClave(m.local),equipoClave(m.visitante)].sort().join("|");
  function addMatch(match={}) {
    const card=document.createElement("fieldset");
    card.className="champions-admin-match";
    const resultado=estados.includes(match.resultado)?match.resultado:"Pendiente";
    card.innerHTML='<legend>PARTIDO</legend><div class="champions-admin-match-grid"><label>Equipo local<input data-local maxlength="100" required placeholder="Equipo local" value="'+escapeHtml(match.local||"")+'"></label><label>Escudo local (enlace HTTPS)<input data-local-logo type="url" maxlength="2048" placeholder="https://…" value="'+escapeHtml(match.escudo_local||"")+'"></label><label>Equipo visitante<input data-visitante maxlength="100" required placeholder="Equipo visitante" value="'+escapeHtml(match.visitante||"")+'"></label><label>Escudo visitante (enlace HTTPS)<input data-visitante-logo type="url" maxlength="2048" placeholder="https://…" value="'+escapeHtml(match.escudo_visitante||"")+'"></label><label>Cuota (opcional)<input data-cuota inputmode="text" maxlength="20" placeholder="+110" value="'+escapeHtml(match.cuota||"")+'"></label><label>Resultado<select data-resultado>'+estados.map(x=>'<option'+(x===resultado?' selected':'')+'>'+x+'</option>').join("")+'</select></label><button type="button" class="remove-entry" data-quitar>QUITAR PARTIDO</button></div>';
    card.querySelector("[data-quitar]").addEventListener("click",()=>{card.remove();});
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
    status.textContent="Selecciona una fecha para editar los partidos, añadir escudos y guardar resultados.";
    loadDay();
  }
  tab.addEventListener("click",openPanel);
  document.querySelectorAll("#secciones button").forEach(b=>b.addEventListener("click",()=>{if(b!==tab)panel.hidden=true;}));
  document.getElementById("championsAdminAddMatch").addEventListener("click",()=>addMatch());
  date.addEventListener("change",loadDay);
  document.getElementById("championsAdminDeleteDate").addEventListener("click",async()=>{
    if(!date.value||!confirm("¿Quitar todos los partidos de Champions de "+date.value+"?"))return;
    status.textContent="Quitando fecha…";
    try{await call("POST",{accion:"borrar_champions_fecha",fecha:date.value});rows.replaceChildren();status.textContent="Se quitaron los partidos guardados de esa fecha.";}
    catch(e){status.textContent=e.message;}
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const partidos=[...rows.children].map(row=>({local:row.querySelector("[data-local]").value.trim(),escudo_local:row.querySelector("[data-local-logo]").value.trim(),visitante:row.querySelector("[data-visitante]").value.trim(),escudo_visitante:row.querySelector("[data-visitante-logo]").value.trim(),cuota:row.querySelector("[data-cuota]").value.trim(),resultado:row.querySelector("[data-resultado]").value}));
    const save=form.querySelector('[type="submit"]');
    save.disabled=true;status.textContent="Guardando partidos, escudos y resultados…";
    try{const d=await call("POST",{accion:"guardar_champions",fecha:date.value,partidos});status.textContent="Se guardaron "+d.partidos+" partido(s) para "+d.fecha+".";}
    catch(e){status.textContent=e.message;}
    finally{save.disabled=false;}
  });
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  date.value=v.year+"-"+v.month+"-"+v.day;
  loadDay();
})();