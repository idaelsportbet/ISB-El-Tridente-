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
document.querySelectorAll('[data-open="register"]').forEach(b => b.addEventListener('click', () => register.showModal()));

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

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

  submitButton.disabled = false;
  submitButton.textContent = 'Entrar';

  if (error) {
    alert('Correo o contraseña incorrectos.');
    return;
  }

  login?.close();

  alert('Inicio de sesión correcto.');
});
document.querySelectorAll('.modal .close').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('dialog');
    if (modal) modal.close();
  });
});
