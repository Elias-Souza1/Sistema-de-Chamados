// register.js - create account as USUARIO by default
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const errorBox = document.getElementById('errorBox');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      const user = createUser({ name, email, pass: password, role: ROLES.USUARIO });
      alert("Conta criada com sucesso! Faça login.");
      window.location.href = "./login.html";
    } catch (err){
      errorBox.textContent = err.message || "Erro ao criar conta.";
      errorBox.style.display = 'block';
    }
  });
});