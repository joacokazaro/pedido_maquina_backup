export async function loginRequest(username, password) {
  const res = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    throw new Error("Credenciales inválidas");
  }

  return res.json();
}
