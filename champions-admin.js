(()=> {
  const panel=document.getElementById("championsAdminPanel");
  const tab=document.getElementById("tabChampions");
  const form=document.getElementById("championsAdminForm");
  const date=document.getElementById("championsAdminDate");
  const rows=document.getElementById("championsAdminMatches");
  const status=document.getElementById("championsAdminStatus");
  if(!panel||!tab)return;
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const estados=["Pendiente","Ganado","Perdido","No enviado"];
  const calendarRoot=document.getElementById("championsAdminCalendar");
  let diasGuardados=[], mesActivo=null;
  function obtenerPartidos(fecha){return (diasGuardados.find(d=>d.fecha===fecha)?.partidos||[]).filter(p=>p&&p.manual===true);}
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
  function previewEscudo(root,url) {
    const valor=String(url||"").trim();
    if(!valor){root.innerHTML='<span class="champions-crest-preview-empty">Vista previa del escudo</span>';return;}
    root.innerHTML='<img src="'+escapeHtml(valor)+'" alt="Vista previa del escudo">';
    const img=root.querySelector("img");
    img.addEventListener("error",()=>{root.innerHTML='<span class="champions-crest-preview-error">Este enlace no abre una imagen. Sube el archivo del escudo.</span>';},{once:true});
  }
  async function convertirImagen(file) {
    if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error("Selecciona un escudo PNG, JPG o WebP.");
    if(!("createImageBitmap" in window)) {
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("No se pudo leer el archivo."));reader.readAsDataURL(file);});
      if(String(data).length>90000)throw new Error("La imagen es muy grande. Usa una imagen más pequeña.");
      return data;
    }
    const bitmap=await createImageBitmap(file),scale=Math.min(1,240/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    let data=canvas.toDataURL("image/webp",.72);
    if(data.length>90000){canvas.width=Math.round(canvas.width*.75);canvas.height=Math.round(canvas.height*.75);data=canvas.toDataURL("image/webp",.62);}
    if(data.length>90000){canvas.width=Math.round(canvas.width*.7);canvas.height=Math.round(canvas.height*.7);data=canvas.toDataURL("image/webp",.5);}
    if(data.length>90000)throw new Error("No se pudo reducir el escudo. Elige una imagen más pequeña.");
    return data;
  }
  function addMatch(match={}) {
    const card=document.createElement("fieldset");
    card.className="champions-admin-match";
    const resultado=estados.includes(match.resultado)?match.resultado:"Pendiente",numero=rows.children.length+1;
    card.innerHTML='<legend>PARTIDO '+numero+'</legend><div class="champions-admin-match-grid"><label>Equipo local<input data-local required maxlength="100" placeholder="Nombre del equipo local" value="'+escapeHtml(match.local||"")+'"></label><label>Equipo visitante<input data-visitante required maxlength="100" placeholder="Nombre del equipo visitante" value="'+escapeHtml(match.visitante||"")+'"></label><label>Enlace directo del escudo local (opcional)<input data-local-logo type="url" maxlength="2048" placeholder="https://…/escudo.png" value="'+escapeHtml(match.escudo_local||"")+'"></label><label>Enlace directo del escudo visitante (opcional)<input data-visitante-logo type="url" maxlength="2048" placeholder="https://…/escudo.png" value="'+escapeHtml(match.escudo_visitante||"")+'"></label><label>Subir escudo local desde el dispositivo<input data-local-file type="file" accept="image/png,image/jpeg,image/webp"></label><label>Subir escudo visitante desde el dispositivo<input data-visitante-file type="file" accept="image/png,image/jpeg,image/webp"></label><div class="champions-crest-preview" data-local-preview></div><div class="champions-crest-preview" data-visitante-preview></div><label>Resultado<select data-resultado>'+estados.map(x=>'<option'+(x===resultado?' selected':'')+'>'+x+'</option>').join("")+'</select></label></div><button class="add-entry champions-remove-match" type="button" data-remove-match>QUITAR PARTIDO</button>';
    const previewLocal=card.querySelector("[data-local-preview]"),previewVisitante=card.querySelector("[data-visitante-preview]");
    previewEscudo(previewLocal,match.escudo_local);previewEscudo(previewVisitante,match.escudo_visitante);
    for(const [lado,selector,preview] of [["local","[data-local-file]",previewLocal],["visitante","[data-visitante-file]",previewVisitante]]) {
      const fileInput=card.querySelector(selector),urlInput=card.querySelector(lado==="local"?"[data-local-logo]":"[data-visitante-logo]");
      urlInput.addEventListener("input",()=>previewEscudo(preview,urlInput.value));
      fileInput.addEventListener("change",async()=>{
        const file=fileInput.files?.[0];if(!file)return;
        fileInput.disabled=true;status.textContent="Preparando el escudo…";
        try {
          const archivo=await convertirImagen(file);
          const out=await call("POST",{accion:"subir_champions_escudo",fecha:date.value,partido:numero,lado,archivo});
          urlInput.value=out.url;previewEscudo(preview,out.url);
          status.textContent="Escudo subido. Pulsa GUARDAR PARTIDOS DE ESTA FECHA para mostrarlo a los clientes.";
        } catch(error){status.textContent=error.message||"No se pudo subir el escudo.";}
        finally{fileInput.disabled=false;fileInput.value="";}
      });
    }
    card.querySelector("[data-remove-match]").addEventListener("click",()=>{card.remove();[...rows.children].forEach((item,i)=>item.querySelector("legend").textContent="PARTIDO "+(i+1));});
    rows.append(card);
  }
  document.getElementById("championsAdminAddMatch").addEventListener("click",()=>addMatch());
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
    status.textContent="Cargando los partidos que agregaste…";
    try {
      const d=await call("GET",null,"?vista=champions&fecha="+encodeURIComponent(date.value));
      const partidos=(d.dias?.find(x=>x.fecha===date.value)?.partidos||[]).filter(p=>p&&p.manual===true);
      guardarEnCache(date.value,partidos);
      rows.replaceChildren();
      partidos.forEach(addMatch);
      status.textContent=partidos.length
        ? partidos.length+" partido(s) agregados para "+date.value+"."
        : "No hay partidos agregados para esta fecha. Pulsa AÑADIR PARTIDO para empezar.";
    } catch(e) {status.textContent=e.message;}
  }
  function openPanel() {
    document.getElementById("publicar").hidden=true;
    for(const id of ["refundAdmin","editorLayout","clientes","supportAdmin","editorResultados","pickPublicado","historial","descuentoPanel","challengeCycleAdmin"]) {
      const el=document.getElementById(id);if(el)el.hidden=true;
    }
    panel.hidden=false;
    document.querySelectorAll("#secciones button").forEach(b=>b.setAttribute("aria-pressed",String(b===tab)));
    status.textContent="Elige una fecha y agrega manualmente los partidos que quieras publicar a tus clientes.";
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
    const partidos=[...rows.children].map(row=>({manual:true,local:row.querySelector("[data-local]").value.trim(),escudo_local:row.querySelector("[data-local-logo]").value.trim(),visitante:row.querySelector("[data-visitante]").value.trim(),escudo_visitante:row.querySelector("[data-visitante-logo]").value.trim(),resultado:row.querySelector("[data-resultado]").value}));
    if(!partidos.length){status.textContent="Agrega al menos un partido o usa QUITAR ESTA FECHA.";return;}
    if(partidos.some(p=>!p.local||!p.visitante)){status.textContent="Escribe los dos equipos de cada partido.";return;}
    if(partidos.some(p=>[p.escudo_local,p.escudo_visitante].some(u=>{try{return ["share.google","photos.app.goo.gl"].includes(new URL(u).hostname);}catch{return false;}}))){status.textContent="Los enlaces de Google compartido no son archivos de imagen. Sube esos escudos desde tu dispositivo y vuelve a guardar.";return;}
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