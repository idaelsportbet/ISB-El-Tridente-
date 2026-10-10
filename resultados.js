const resultadosClient=window.supabase.createClient('https://nfvkmxnprchvkufwvhpr.supabase.co','sb_publishable_LkV-utNMHKyRw5GH30SF-Q_znC4MRA1');
let tipoResultados='semanales';
function mostrarResultados(){
 const p=ResultadosCalendario.periodo(tipoResultados);
 document.getElementById('resultadosTitulo').textContent=p.titulo;
 const tabla=document.createElement('table');tabla.className='resultados-tabla';
 const cabecera=document.createElement('thead'),filaCabecera=document.createElement('tr');
 for(const nombre of ['DÍA',...ResultadosCalendario.categorias]){const th=document.createElement('th');th.scope='col';th.textContent=nombre.toUpperCase();filaCabecera.append(th);}cabecera.append(filaCabecera);tabla.append(cabecera);
 const cuerpo=document.createElement('tbody');
 for(const d of p.filas){const fila=document.createElement('tr'),dia=document.createElement('th');dia.scope='row';dia.textContent=(tipoResultados==='mensuales'?d.numero+' · ':'')+d.dia;fila.append(dia);
 for(const c of ResultadosCalendario.categorias){const td=document.createElement('td');td.className='resultado-estado';td.textContent='— SIN PUBLICAR';fila.append(td);}cuerpo.append(fila);}
 tabla.append(cuerpo);const scroll=document.createElement('div');scroll.className='resultados-tabla-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Tabla de resultados '+tipoResultados);scroll.append(tabla);document.getElementById('resultadosTabla').replaceChildren(scroll);
}
async function comprobarResultados(){
 const estado=document.getElementById('resultadosAcceso');
 try{const {data:{user},error}=await resultadosClient.auth.getUser();if(error||!user){estado.textContent='Inicia sesión para acceder a los resultados.';const a=document.createElement('a');a.href='/';a.className='button';a.textContent='INICIAR SESIÓN';estado.append(a);return;}estado.hidden=true;document.getElementById('resultadosPanel').hidden=false;mostrarResultados();}
 catch{estado.textContent='No se pudo comprobar tu acceso. Actualiza la página para intentarlo de nuevo.';}
}
document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click',()=>{tipoResultados=b.dataset.periodo;document.querySelectorAll('[data-periodo]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));mostrarResultados();}));
comprobarResultados();
