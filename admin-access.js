(()=> {
  const form=document.getElementById("accesoCortesiaForm");
  const status=document.getElementById("accesoCortesiaEstado");
  if(!form||!status)return;
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const correo=document.getElementById("accesoCortesiaCorreo").value.trim();
    const paquetes=[...form.querySelectorAll('input[name="paqueteCortesia"]:checked')].map(input=>input.value);
    if(!correo||!paquetes.length){status.textContent="Escribe el correo y selecciona al menos un paquete.";return;}
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;status.textContent="Activando los paquetes seleccionados…";
    try{
      const {data:{session}}=await client.auth.getSession();
      if(!session)throw new Error("La sesión venció. Inicia sesión otra vez.");
      const response=await fetch("/api/admin-picks",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({accion:"activar_prueba",correo_prueba:correo,paquetes_prueba:paquetes,permanente:true})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"No se pudieron activar los paquetes.");
      status.textContent=data.existente?"La cuenta ya tenía activos esos paquetes.":"Acceso gratis y sin vencimiento activado para: "+(data.paquetes||paquetes).join(", ")+".";
      document.getElementById("actualizarCompras")?.click();
    }catch(error){status.textContent=error.message||"No se pudieron activar los paquetes.";}
    finally{button.disabled=false;}
  });
})();