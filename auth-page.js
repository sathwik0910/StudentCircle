
const AUTH_API = "http://localhost:5000/api/auth";

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const authMessage = document.getElementById("authMessage");

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "crimson" : "green";
}

function saveLogin(data) {
  // Keep the token for the current browser tab.
  sessionStorage.setItem("studentCircleToken", data.token);
  sessionStorage.setItem("studentCircleUser", JSON.stringify(data.user));

  // Existing app.js uses this key to find the student's requests.
  localStorage.setItem("studentCircleUserName", data.user.name);

  showMessage("Success! Opening StudentCircle...");

  window.location.href = "find-groups.html";
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    showMessage("Creating your account...");

    try {
      const response = await fetch(`${AUTH_API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Registration failed.");
      }

      saveLogin(data);
    } catch (error) {
      showMessage(error.message || "Could not connect to the server.", true);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    showMessage("Logging in...");

    try {
      const response = await fetch(`${AUTH_API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      saveLogin(data);
    } catch (error) {
      showMessage(error.message || "Could not connect to the server.", true);
    }
  });
}
