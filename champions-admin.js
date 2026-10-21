(()=> {
  const panel=document.getElementById("championsAdminPanel");
  const tab=document.getElementById("tabChampions");
  const form=document.getElementById("championsAdminForm");
  const date=document.getElementById("championsAdminDate");
  const result=document.getElementById("championsAdminResult");
  const cuota=document.getElementById("championsAdminOdds");
  const selectedDate=document.getElementById("championsAdminSelectedDate");
  const status=document.getElementById("championsAdminStatus");
  const calendarRoot=document.getElementById("championsAdminCalendar");
  if(!panel||!tab||!form||!date||!result||!cuota||!calendarRoot)return;
  const escapeHtml=v=>String(v??"").replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\'":"&#39;"}[c]));
  const allowed=["Ganado","Perdido","No enviado"];
  let diasGuardados=[],mesActivo=null;
  function registro(fecha){return diasGuardados.find(d=>d.fecha===fecha)||{};}
  function guardarEnCache(fecha,resultado,odds){diasGuardados=diasGuardados.filter(d=>d.fecha!==fecha);if(resultado||odds)diasGuardados.push({fecha,resultado,cuota:odds});dibujarCalendario();}
  function syncSelected(){const actual=registro(date.value),r=actual.resultado||"";result.value=allowed.includes(r)?r:"";cuota.value=actual.cuota||"";selectedDate.textContent=new Date(date.value+"T12:00:00").toLocaleDateString("es-US",{timeZone:"America/Chicago",weekday:"long",year:"numeric",month:"long",day:"numeric"});}
  function dibujarCalendario(){
    if(!calendarRoot||!mesActivo)return;
    const year=mesActivo.getFullYear(),month=mesActivo.getMonth(),nombre=new Intl.DateTimeFormat("es-US",{month:"long",year:"numeric"}).format(mesActivo).toUpperCase();
    const primer=(new Date(year,month,1).getDay()+6)%7,total=new Date(year,month+1,0).getDate(),celdas=Array(primer).fill('<span class="champions-admin-empty"></span>');
    for(let d=1;d<=total;d++){
      const key=year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0"),item=registro(key),r=item.resultado||"",slug=r.toLowerCase().replace(/[^a-z]/g,""),label=(item.cuota?'<em>🔥 '+escapeHtml(item.cuota)+'</em>':"")+(r?'<em>'+r.toUpperCase()+'</em>':"");
      celdas.push('<button type="button" class="champions-admin-day champions-calendar-control'+(item.cuota?" has-odds":"")+(r?" admin-resultado-"+slug:"")+(date.value===key?" selected":"")+'" data-admin-date="'+key+'"><span>'+d+'</span>'+label+'</button>');
    }
    calendarRoot.innerHTML='<div class="champions-admin-monthbar"><button type="button" class="champions-calendar-control" data-admin-month="-1" aria-label="Mes anterior">‹</button><strong>'+nombre+'</strong><button type="button" class="champions-calendar-control" data-admin-month="1" aria-label="Mes siguiente">›</button></div><div class="champions-admin-weekdays"><span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span></div><div class="champions-admin-grid">'+celdas.join("")+'</div>';
    calendarRoot.querySelectorAll("[data-admin-month]").forEach(b=>b.addEventListener("click",()=>{const next=new Date(year,month+Number(b.dataset.adminMonth),1);if(next>=new Date(2026,6,1)&&next<=new Date(2027,11,1)){mesActivo=next;dibujarCalendario();}}));
    calendarRoot.querySelectorAll("[data-admin-date]").forEach(b=>b.addEventListener("click",()=>{date.value=b.dataset.adminDate;syncSelected();dibujarCalendario();}));
  }
  async function call(method,body,query=""){
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw new Error("La sesión venció. Inicia sesión otra vez.");
    const r=await fetch("/api/admin-picks"+query,{method,headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||"No se pudo guardar el resultado.");return data;
  }
  async function cargar(){try{const d=await call("GET",null,"?vista=champions");diasGuardados=(d.dias||[]).filter(x=>allowed.includes(x.resultado)||String(x.cuota||"").trim());dibujarCalendario();syncSelected();}catch(e){status.textContent=e.message;}}
  async function openPanel(){
    document.getElementById("publicar").hidden=true;
    for(const id of ["refundAdmin","editorLayout","clientes","supportAdmin","editorResultados","pickPublicado","historial","descuentoPanel","challengeCycleAdmin"]){const el=document.getElementById(id);if(document.getElementById(id))document.getElementById(id).hidden=true;}
    panel.hidden=false;document.querySelectorAll("#secciones button").forEach(b=>b.setAttribute("aria-pressed",String(b===tab)));
    await cargar();
  }
  tab.addEventListener("click",openPanel);
  document.querySelectorAll("#secciones button").forEach(b=>b.addEventListener("click",()=>{if(b!==tab)panel.hidden=true;}));
  form.addEventListener("submit",async e=>{
    e.preventDefault();if(!date.value)return;
    const save=form.querySelector('[type="submit"]');save.disabled=true;status.textContent="Guardando resultado del día…";
    try{const d=await call("POST",{accion:"guardar_champions",fecha:date.value,resultado:result.value,cuota:cuota.value.trim()});guardarEnCache(d.fecha,d.resultado||"",d.cuota||"");syncSelected();status.textContent=d.resultado||d.cuota?"Cuota y resultado guardados para "+d.fecha+".":"Se quitaron los datos de "+d.fecha+".";}
    catch(err){status.textContent=err.message;}
    finally{save.disabled=false;}
  });
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  date.value=v.year+"-"+v.month+"-"+v.day;mesActivo=new Date(Number(v.year),Number(v.month)-1,1);syncSelected();dibujarCalendario();
})();