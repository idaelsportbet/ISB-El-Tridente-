const resultadosClient=window.supabase.createClient('https://nfvkmxnprchvkufwvhpr.supabase.co','sb_publishable_LkV-utNMHKyRw5GH30SF-Q_znC4MRA1');
let tipoResultados='semanales';
let resultadosSesion='',resultadosSolicitud=0;
function mostrarResultados(){
 const p=ResultadosCalendario.periodo(tipoResultados);
 document.getElementById('resultadosTitulo').textContent=p.titulo;
 const tabla=document.createElement('table');tabla.className='resultados-tabla';
 const cabecera=document.createElement('thead'),filaCabecera=document.createElement('tr');
 for(const nombre of ['DÍA',...ResultadosCalendario.categorias]){const th=document.createElement('th');th.scope='col';th.textContent=nombre.toUpperCase();filaCabecera.append(th);}cabecera.append(filaCabecera);tabla.append(cabecera);
 const cuerpo=document.createElement('tbody');
 for(const d of p.filas){const fila=document.createElement('tr'),dia=document.createElement('th');dia.scope='row';dia.textContent=(tipoResultados==='mensuales'?d.numero+' · ':'')+d.dia;fila.append(dia);
 for(const c of ResultadosCalendario.categorias){const td=document.createElement('td');td.className='resultado-estado';td.dataset.clave=d.fecha+'|'+c;td.textContent='— SIN PUBLICAR';fila.append(td);}cuerpo.append(fila);}
 tabla.append(cuerpo);const scroll=document.createElement('div');scroll.className='resultados-tabla-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Tabla de resultados '+tipoResultados);scroll.append(tabla);document.getElementById('resultadosTabla').replaceChildren(scroll);
 cargarResultados(p,++resultadosSolicitud);
}
async function cargarResultados(p,solicitud){
 const aviso=document.querySelector('#resultadosPanel .message');aviso.textContent='Cargando resultados…';
 try{const r=await fetch('/api/resultados?desde='+p.inicio+'&hasta='+p.fin,{headers:{Authorization:'Bearer '+resultadosSesion},signal:AbortSignal.timeout(10000)});const data=await r.json();if(solicitud!==resultadosSolicitud)return;if(!r.ok)throw new Error(data.error);
 const mapa=new Map(data.resultados.map(x=>[x.fecha+'|'+x.categoria,x]));const etiquetas={ganado:'✓ GANADO',perdido:'✕ PERDIDO',sin_pick:'— NO SE ENVIÓ',pendiente:'• PENDIENTE'};
 document.querySelectorAll('[data-clave]').forEach(td=>{const v=mapa.get(td.dataset.clave);if(!v||!etiquetas[v.estado])return;td.replaceChildren();if(v.texto){const texto=document.createElement('div');texto.className='resultado-texto';texto.textContent=v.texto;td.append(texto);}const e=document.createElement('span');e.className='resultado-estado resultado-'+v.estado;e.textContent=etiquetas[v.estado];td.append(e);});aviso.textContent=data.resultados.length?'':'Todavía no hay resultados publicados para este periodo.';
 }catch(e){if(solicitud===resultadosSolicitud)aviso.textContent=e.message||'No se pudieron cargar los resultados.';}
}
async function comprobarResultados(){
 const estado=document.getElementById('resultadosAcceso');
 try{const {data:{user},error}=await resultadosClient.auth.getUser();const {data:{session}}=await resultadosClient.auth.getSession();if(error||!user||!session){estado.textContent='Inicia sesión para acceder a los resultados.';const a=document.createElement('a');a.href='/';a.className='button';a.textContent='INICIAR SESIÓN';estado.append(a);return;}resultadosSesion=session.access_token;estado.hidden=true;document.getElementById('resultadosPanel').hidden=false;mostrarResultados();}
 catch{estado.textContent='No se pudo comprobar tu acceso. Actualiza la página para intentarlo de nuevo.';}
}
document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click',()=>{tipoResultados=b.dataset.periodo;document.querySelectorAll('[data-periodo]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));mostrarResultados();}));
comprobarResultados();

