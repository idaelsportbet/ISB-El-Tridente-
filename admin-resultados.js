(() => {
 const boton=document.getElementById('tabResultados'),panel=document.createElement('section');
 panel.id='editorResultados';panel.hidden=true;panel.className='resultados-editor';
 panel.innerHTML='<h2 style="color:#efc766">PUBLICAR RESULTADOS</h2><div class="tabs"><button type="button" data-edicion="semanales" aria-pressed="true">SEMANAL</button><button type="button" data-edicion="mensuales" aria-pressed="false">MENSUAL</button></div><label for="referenciaResultados">Fecha de la semana o del mes</label><input id="referenciaResultados" type="date"><h3 class="resultados-periodo" id="tituloEditorResultados"></h3><div id="tablaEditorResultados"></div><p>Premium reúne el diario y semanal; Exclusiva reúne la diaria y semanal. Los resultados son comunes para todos los clientes.</p><button type="button" id="guardarResultados">PUBLICAR RESULTADOS</button><p id="estadoEditorResultados" role="status" aria-live="polite"></p>';
 document.querySelector('main').append(panel);
 const aviso=panel.querySelector('#estadoEditorResultados'),guardar=panel.querySelector('#guardarResultados'),referencia=panel.querySelector('#referenciaResultados');
 referencia.value=ResultadosCalendario.hoy().toISOString().slice(0,10);
 let tipo='semanales',secuencia=0,listo=false,filas=[],ocupado=false;
 async function api(method,body,q=''){
 const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('Inicia sesión con tu cuenta de administrador.');
 const r=await fetch('/api/resultados'+q,{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron guardar los resultados.');return data;
 }
 async function cargar(){
 if(ocupado)return;const version=++secuencia;listo=false;guardar.disabled=true;
 const fecha=new Date(referencia.value+'T12:00:00Z');if(!Number.isFinite(fecha.getTime()))return;
 const p=ResultadosCalendario.periodo(tipo,fecha);document.getElementById('tituloEditorResultados').textContent=p.titulo;
 const tabla=document.createElement('table');tabla.className='resultados-tabla';const head=document.createElement('thead'),tr=document.createElement('tr');
 for(const c of ['DÍA',...ResultadosCalendario.categorias]){const th=document.createElement('th');th.scope='col';th.textContent=c;tr.append(th);}head.append(tr);tabla.append(head);const tbody=document.createElement('tbody');filas=[];
 for(const d of p.filas){const row=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=(tipo==='mensuales'?d.numero+' · ':'')+d.dia;row.append(th);
 for(const c of ResultadosCalendario.categorias){const td=document.createElement('td'),texto=document.createElement('textarea'),estado=document.createElement('select');texto.maxLength=1000;texto.placeholder='Pick o comentario (opcional)';texto.setAttribute('aria-label',d.fecha+' '+c+' pick');estado.setAttribute('aria-label',d.fecha+' '+c+' resultado');
 for(const [v,t] of [['','Sin publicar'],['ganado','✓ GANADO'],['perdido','✕ PERDIDO'],['pendiente','• PENDIENTE'],['sin_pick','— SIN PICK']]){const option=document.createElement('option');option.value=v;option.textContent=t;estado.append(option);}
 const f={fecha:d.fecha,categoria:c,texto,estado,cambio:false};texto.oninput=()=>f.cambio=true;estado.onchange=()=>f.cambio=true;filas.push(f);td.append(texto,estado);row.append(td);}tbody.append(row);}
 tabla.append(tbody);const scroll=document.createElement('div');scroll.className='resultados-tabla-scroll';scroll.append(tabla);document.getElementById('tablaEditorResultados').replaceChildren(scroll);aviso.textContent='Cargando resultados guardados…';
 try{const data=await api('GET',undefined,'?desde='+p.inicio+'&hasta='+p.fin);if(version!==secuencia)return;const mapa=new Map(data.resultados.map(f=>[f.fecha+'|'+f.categoria,f]));for(const f of filas){const v=mapa.get(f.fecha+'|'+f.categoria);if(v){f.texto.value=v.texto;f.estado.value=v.estado;}}listo=true;guardar.disabled=false;aviso.textContent='Edita una casilla y publica. Semanal y mensual comparten los mismos resultados por fecha.';}
 catch(e){if(version===secuencia)aviso.textContent=e.message;}
 }
 boton.onclick=async()=>{
 try{await request('GET');}catch(e){estado.textContent=e.message;return;}
 form.hidden=true;document.getElementById('clientes').hidden=true;historial.hidden=true;document.getElementById('instrucciones').hidden=true;panel.hidden=false;document.querySelector('main').style.maxWidth='1200px';
 document.querySelectorAll('#secciones button').forEach(b=>b.setAttribute('aria-pressed',String(b===boton)));cargar();
 };
 for(const id of ['tabPick','tabClientes','tabPublicados'])document.getElementById(id).addEventListener('click',()=>{panel.hidden=true;boton.setAttribute('aria-pressed','false');document.querySelector('main').style.maxWidth='700px';});
 panel.querySelectorAll('[data-edicion]').forEach(b=>b.onclick=()=>{tipo=b.dataset.edicion;panel.querySelectorAll('[data-edicion]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));cargar();});referencia.onchange=cargar;
 guardar.onclick=async()=>{
 if(!listo||ocupado)return;const cambios=filas.filter(f=>f.cambio);
 if(!cambios.length){aviso.textContent='No hay cambios para publicar.';return;}
 if(cambios.some(f=>!f.estado.value)){aviso.textContent='Selecciona el estado de las casillas que editaste.';return;}
 ocupado=true;guardar.disabled=true;aviso.textContent='Publicando resultados…';
 try{const data=await api('POST',{resultados:cambios.map(f=>({fecha:f.fecha,categoria:f.categoria,texto:f.texto.value,estado:f.estado.value}))});cambios.forEach(f=>f.cambio=false);aviso.textContent='Resultados publicados: '+data.publicados+'. Ya aparecen en la tabla de clientes.';}
 catch(e){aviso.textContent=e.message;}finally{ocupado=false;guardar.disabled=false;}
 };
})();
