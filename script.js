const menuBtn = document.querySelector('.menu-btn');
const nav = document.querySelector('.nav');
menuBtn?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

const login = document.getElementById('loginModal');
const register = document.getElementById('registerModal');

document.querySelectorAll('[data-open="login"]').forEach(b => b.addEventListener('click', () => login.showModal()));
document.querySelectorAll('[data-open="register"]').forEach(b => b.addEventListener('click', () => register.showModal())); if (new URLSearchParams(window.location.search).get('login') === 'admin') login?.showModal();

document.querySelectorAll('.modal').forEach(dialog => {
  dialog.addEventListener('click', e => {
    if (e.target === dialog) dialog.close();
  });
});

const SUPABASE_URL = 'https://nfvkmxnprchvkufwvhpr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LkV-utNMHKyRw5GH30SF-Q_znC4MRA1';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const registerForm = document.querySelector('[data-form="register"]');
const loginForm = document.querySelector('[data-form="login"]');
const recovery = document.getElementById('recoveryModal');
const passwordModal = document.getElementById('passwordModal');
const recoveryForm = document.querySelector('[data-form="recovery"]');
const passwordForm = document.querySelector('[data-form="password"]');
let recoveryAuthorized = false;

document.querySelectorAll('[data-open="recovery"]').forEach(button => button.addEventListener('click', () => {
  recoveryForm.elements.email.value = loginForm.elements.email.value;
  login.close();
  recovery.showModal();
}));

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    recoveryAuthorized = true;
    login?.close();
    register?.close();
    recovery?.close();
    if (!passwordModal.open) passwordModal.showModal();
  }
});

if (new URLSearchParams(window.location.hash.slice(1)).has('error_description')) {
  recovery.showModal();
  recoveryForm.querySelector('[data-recovery-message]').textContent = 'El enlace venció o no es válido. Solicita uno nuevo.';
  history.replaceState(null, '', window.location.pathname);
}

recoveryForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = recoveryForm.querySelector('button[type="submit"]');
  const message = recoveryForm.querySelector('[data-recovery-message]');
  button.disabled = true;
  message.textContent = 'Solicitando enlace…';
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(recoveryForm.elements.email.value.trim(), {
      redirectTo: window.location.origin + '/'
    });
    message.textContent = error ? 'No se pudo enviar el enlace. Espera un momento e inténtalo de nuevo.' : 'Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso. Revisa también spam.';
  } catch {
    message.textContent = 'No hay conexión. Inténtalo nuevamente.';
  } finally {
    button.disabled = false;
  }
});

passwordForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const message = passwordForm.querySelector('[data-password-message]');
  const password = passwordForm.elements.password.value;
  if (!recoveryAuthorized) {
    message.textContent = 'Abre el enlace de recuperación recibido en tu correo.';
    return;
  }
  if (password !== passwordForm.elements.confirm_password.value) {
    message.textContent = 'Las contraseñas no coinciden.';
    return;
  }
  const button = passwordForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      message.textContent = 'No se pudo guardar. Comprueba la contraseña o solicita un enlace nuevo.';
      return;
    }
    recoveryAuthorized = false;
    passwordForm.reset();
    message.textContent = 'Contraseña guardada. Ya puedes iniciar sesión con ella.';
    await supabaseClient.auth.signOut();
    passwordModal.close();
    login.showModal();
    alert('Contraseña guardada. Inicia sesión con tu nueva contraseña.');
  } catch {
    message.textContent = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
  } finally {
    button.disabled = false;
  }
});

registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = registerForm.elements['full_name'].value.trim();
  const phone = registerForm.elements['phone'].value.trim();
  const email = registerForm.elements['email'].value.trim();
  const username = registerForm.elements['username'].value.trim();
  const password = registerForm.elements['password'].value;
  const confirmPassword =
    registerForm.elements['confirm_password'].value;

  if (password !== confirmPassword) {
    alert('Las contraseñas no coinciden.');
    return;
  }

  const submitButton =
    registerForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = 'Creando cuenta...';

  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
        username: username
      }
    }
  });

  submitButton.disabled = false;
  submitButton.textContent = 'Crear mi cuenta';

  if (error) {
    alert('No se pudo crear la cuenta: ' + error.message);
    return;
  }

  alert(
    'Cuenta creada correctamente. Revisa tu correo electrónico para confirmar tu cuenta.'
  );

  registerForm.reset();
  register?.close();

  login?.showModal();
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = loginForm.elements['email'].value.trim();
  const password = loginForm.elements['password'].value;

  const submitButton =
    loginForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = 'Entrando...';
  const loginMessage = loginForm.querySelector('[data-login-message]');
  loginMessage.textContent = '';

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

  if (error) {
    submitButton.disabled = false;
    submitButton.textContent = 'Entrar';
    loginMessage.textContent = 'Correo o contraseña incorrectos. Puedes recuperar tu cuenta abajo.';
    return;
  }

  let destino = '/paquetes.html';
  try {
    const acceso = await fetch('/api/admin-picks', {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      signal: AbortSignal.timeout(8000)
    });
    if (acceso.ok) destino = '/admin';
  } catch {
    // Mi cuenta también permite abrir el panel si la comprobación falla temporalmente.
  }
  login?.close();
  window.location.href = destino;
});

document.querySelectorAll('.modal .close').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('dialog');
    if (modal) modal.close();
  });
});
