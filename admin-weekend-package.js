(()=>{
 const status=document.getElementById("weekendPackageStatus"),button=document.getElementById("toggleWeekendPackage");
 if(!status||!button||!window.supabase)return;
 const client=window.supabase.createClient("https://nfvkmxnprchvkufwvhpr.supabase.co","sb_publishable_LkV-utNMHKyRw5GH30SF-Q_znC4MRA1");
 async function request(method,active){
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw new Error("Inicia sesión con la cuenta de administrador.");
  const response=await fetch("/api/package-discount?feature=weekend&vista=admin",{method,headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify({active})}:{})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo actualizar el paquete.");return data;
 }
 function pintar(active){button.textContent=active?"DESACTIVAR PAQUETE DE FIN DE SEMANA":"ACTIVAR PAQUETE DE FIN DE SEMANA";button.setAttribute("aria-pressed",String(active));button.classList.toggle("is-active",active);status.textContent=active?"Activo: se muestran Fin de Semana, Champions, Reto 10 días, Económica y Pack Mensual.":"Inactivo: se muestran los paquetes normales.";}
 async function cargar(){button.disabled=true;status.textContent="Consultando estado…";try{const data=await request("GET");pintar(data.active);}catch(e){status.textContent=e.message||"No se pudo consultar el estado.";button.textContent="REINTENTAR";}finally{button.disabled=false;}}
 button.addEventListener("click",async()=>{const active=button.getAttribute("aria-pressed")!=="true";button.disabled=true;status.textContent=active?"Activando paquete…":"Desactivando paquete…";try{pintar((await request("POST",active)).active);}catch(e){status.textContent=e.message||"No se pudo guardar el cambio.";}finally{button.disabled=false;}});
 const weekend=document.querySelector('input[name="paquete"][value="Paquete Fin de Semana"]'),tiers=document.getElementById("weekendTierFields");
 function actualizarTiers(){if(!weekend||!tiers)return;tiers.hidden=!weekend.checked;if(!weekend.checked)tiers.querySelectorAll('input[name="weekendTier"]').forEach(input=>input.checked=false);}
 weekend?.addEventListener("change",actualizarTiers);
 actualizarTiers();cargar();
})();