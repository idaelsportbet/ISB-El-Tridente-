const resultadosClient = window.supabase.createClient('https://nfvkmxnprchvkufwvhpr.supabase.co', 'sb_publishable_LkV-utNMHKyRw5GH30SF-Q_znC4MRA1');
async function comprobarResultados() {
  const estado = document.getElementById('resultadosAcceso');
  try {
    const { data: { user }, error } = await resultadosClient.auth.getUser();
    if (error || !user) {
      estado.textContent = 'Inicia sesión para acceder a los resultados.';
      const enlace = document.createElement('a');
      enlace.href = '/'; enlace.className = 'button'; enlace.textContent = 'INICIAR SESIÓN';
      estado.appendChild(enlace);
      return;
    }
    estado.hidden = true;
    document.getElementById('resultadosPanel').hidden = false;
  } catch {
    estado.textContent = 'No se pudo comprobar tu acceso. Actualiza la página para intentarlo de nuevo.';
  }
}
document.querySelectorAll('[data-periodo]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-periodo]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  document.getElementById('resultadosTitulo').textContent = 'Resultados ' + button.dataset.periodo;
}));
comprobarResultados();
