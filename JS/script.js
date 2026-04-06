const passwordInput = document.getElementById("password");
const unlockBtn = document.getElementById("unlock-btn");
const output = document.getElementById("vault-output");

async function unlockVault() {
  const password = passwordInput.value.trim();
  if (!password) return;

  const res = await fetch("/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  if(res.ok){
    sessionStorage.setItem("masterPassword", password);
    window.location.href = "vault.html";
  } else {
    output.innerText = "Wrong password or vault not found";
  }
}

const password = sessionStorage.getItem("masterPassword");

if (!password) {
    window.location.href = "login.html";
}

unlockBtn.addEventListener("click", unlockVault);
passwordInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter") unlockVault();
});