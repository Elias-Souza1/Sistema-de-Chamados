// js/login.js
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Login falhou");
      return;
    }

    // guarda sessão para o guard e páginas
    sessionStorage.setItem("user", JSON.stringify(data.user));
    sessionStorage.setItem("roles", JSON.stringify(data.roles || []));
    sessionStorage.setItem("permissions", JSON.stringify(data.permissions || []));
    sessionStorage.setItem("auth", "true");

    window.location.replace("./inicial.html");
  } catch (err) {
    console.error("Erro:", err);
    alert("Erro no servidor");
  }
});
