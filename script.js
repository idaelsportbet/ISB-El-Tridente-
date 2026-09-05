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

document.querySelectorAll('[data-form]').forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const type = form.dataset.form;
    alert(type === 'login' ? 'Demo lista. El próximo paso es conectar el inicio de sesión real con Supabase.' : 'Demo lista. El próximo paso es conectar el registro real con Supabase.');
  });
});
document.querySelectorAll('.modal .close').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('dialog');
    if (modal) modal.close();
  });
});
