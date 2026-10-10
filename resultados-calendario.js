(() => {
 const categorias=['Premium','Exclusiva','Pack Mensual','Económica'], dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 const mover=(fecha,n)=>new Date(fecha.getTime()+n*86400000);
 function hoy(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return new Date(p.year+'-'+p.month+'-'+p.day+'T12:00:00Z');}
 function periodo(tipo,referencia=hoy()){
 let inicio,fin;
 if(tipo==='mensuales'){inicio=new Date(Date.UTC(referencia.getUTCFullYear(),referencia.getUTCMonth(),1,12));fin=new Date(Date.UTC(referencia.getUTCFullYear(),referencia.getUTCMonth()+1,0,12));}
 else{inicio=mover(referencia,-((referencia.getUTCDay()+6)%7));fin=mover(inicio,6);}
 const formato=new Intl.DateTimeFormat('es',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
 const filas=[];for(let d=inicio;d<=fin;d=mover(d,1))filas.push({fecha:d.toISOString().slice(0,10),dia:dias[d.getUTCDay()],numero:d.getUTCDate()});
 return {inicio:inicio.toISOString().slice(0,10),fin:fin.toISOString().slice(0,10),titulo:(tipo==='mensuales'?'Mes':'Semana')+' del '+formato.format(inicio)+' al '+formato.format(fin),filas};
 }
 window.ResultadosCalendario={categorias,hoy,periodo,mover};
})();
