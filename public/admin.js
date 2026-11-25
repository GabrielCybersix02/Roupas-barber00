const config = await fetch("/config.json").then(response => response.json());
const table = "/rest/v1/clothing_catalog_products";
const bucket = "/storage/v1/object/clothing-catalog-photos/";
const login = document.querySelector("#login");
const editor = document.querySelector("#editor");
const manager = document.querySelector("#manager");
const status = document.querySelector("#status");
const cancel = document.querySelector("#cancel");
const items = document.querySelector("#items");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let token;
let editing;

async function request(path, { method = "GET", body, type = "application/json", representation = false } = {}) {
  if (!config.url || !config.key) throw new Error("A conexão com o catálogo ainda não foi configurada.");
  const headers = { apikey: config.key };
  if (token) headers.Authorization = "Bearer " + token;
  if (body) headers["Content-Type"] = type;
  if (representation) headers.Prefer = "return=representation";
  const response = await fetch(config.url + path, {
    method, headers, body: body && type === "application/json" ? JSON.stringify(body) : body,
  });
  if (response.status === 401 && token) {
    closePanel();
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  if (!response.ok) throw new Error("Não foi possível concluir a operação.");
  return response.status === 204 ? null : response.json();
}

function resetEditor() {
  editing = null;
  editor.reset();
  editor.querySelector("h2").textContent = "Cadastrar peça";
  editor.elements.image.required = true;
  cancel.hidden = true;
}

function closePanel() {
  token = null;
  manager.hidden = true;
  document.querySelector("#new-password").hidden = true;
  login.hidden = false;
  login.reset();
  items.replaceChildren();
  resetEditor();
}

async function busy(form, action) {
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach(button => { button.disabled = true; });
  status.textContent = "";
  try { await action(); }
  catch (error) { status.textContent = error.message; }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}

function actionButton(text, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = text;
  button.addEventListener("click", action);
  return button;
}

async function list() {
  const products = await request(table + "?select=*&order=created_at.desc");
  items.replaceChildren();
  if (!products.length) items.textContent = "Nenhuma peça cadastrada.";
  for (const product of products) {
    const item = document.createElement("article");
    item.className = "admin-item";
    const label = document.createElement("span");
    label.textContent = product.name + " · " + currency.format(product.price / 100);
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(actionButton("Editar", () => {
      resetEditor();
      editing = product;
      for (const key of ["name", "category", "description", "sizes"]) editor.elements[key].value = product[key];
      editor.elements.price.value = (product.price / 100).toFixed(2).replace(".", ",");
      editor.elements.image.required = false;
      editor.querySelector("h2").textContent = "Editar peça";
      cancel.hidden = false;
      editor.scrollIntoView({ behavior: "smooth" });
    }), actionButton("Remover", () => {
      if (!confirm("Remover " + product.name + " do catálogo?")) return;
      void busy(manager, async () => {
        const removed = await request(table + "?id=eq." + product.id, { method: "DELETE", representation: true });
        if (!removed.length) throw new Error("Peça não encontrada.");
        await discard(removed[0].image_key);
        if (editing?.id === product.id) resetEditor();
        await list();
        status.textContent = "Peça removida.";
      });
    }));
    item.append(label, actions);
    items.append(item);
  }
}

async function discard(key) {
  try { await request(bucket + key, { method: "DELETE" }); }
  catch { /* The published product never points to an image removed here. */ }
}

const recovery = document.querySelector("#recovery");
const newPassword = document.querySelector("#new-password");
const callback = new URLSearchParams(location.hash.slice(1));
if (callback.get("type") === "recovery" && callback.get("access_token")) {
  token = callback.get("access_token");
  history.replaceState(null, "", location.pathname);
  login.hidden = true;
  newPassword.hidden = false;
} else if (callback.has("error_code")) {
  history.replaceState(null, "", location.pathname);
  status.textContent = "O link de recuperação é inválido ou expirou. Solicite outro.";
}

document.querySelector("#forgot").addEventListener("click", () => {
  recovery.elements.email.value = login.elements.email.value;
  login.hidden = true;
  recovery.hidden = false;
  recovery.elements.email.focus();
});

recovery.addEventListener("submit", event => {
  event.preventDefault();
  void busy(recovery, async () => {
    const redirect = encodeURIComponent(new URL("/admin", location.origin).href);
    await request("/auth/v1/recover?redirect_to=" + redirect, {
      method: "POST",
      body: { email: recovery.elements.email.value.trim() },
    });
    status.textContent = "Se o e-mail estiver cadastrado, você receberá um link. Confira também o spam.";
  });
});

newPassword.addEventListener("submit", event => {
  event.preventDefault();
  void busy(newPassword, async () => {
    const { password, confirmation } = newPassword.elements;
    if (password.value !== confirmation.value) throw new Error("As senhas precisam ser iguais.");
    await request("/auth/v1/user", { method: "PUT", body: { password: password.value } });
    try { await request("/auth/v1/logout?scope=local", { method: "POST" }); }
    catch { /* Discard the recovery token locally if logout is unavailable. */ }
    newPassword.reset();
    newPassword.hidden = true;
    closePanel();
    status.textContent = "Senha atualizada. Entre com a nova senha.";
  });
});

login.addEventListener("submit", event => {
  event.preventDefault();
  void busy(login, async () => {
    const fields = new FormData(login);
    try {
      const session = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email: fields.get("email").trim(), password: fields.get("password") },
      });
      token = session.access_token;
    } catch {
      throw new Error("Não foi possível entrar. Confira seu e-mail e sua senha do Supabase.");
    }
    const roles = await request("/rest/v1/clothing_catalog_admins?select=user_id");
    if (!roles.length) {
      closePanel();
      throw new Error("Esta conta não tem acesso ao painel.");
    }
    await list();
    login.reset();
    login.hidden = true;
    manager.hidden = false;
  });
});

document.querySelector("#logout").addEventListener("click", async () => {
  try { await request("/auth/v1/logout", { method: "POST" }); }
  catch { /* Close the local session even if the network is unavailable. */ }
  closePanel();
  status.textContent = "";
});
cancel.addEventListener("click", resetEditor);

editor.addEventListener("submit", event => {
  event.preventDefault();
  const fields = new FormData(editor);
  const previous = editing;
  void busy(manager, async () => {
    const price = String(fields.get("price")).trim();
    if (!/^\d{1,6}(?:[,.]\d{1,2})?$/.test(price)) throw new Error("Informe um preço válido, como 79,90.");
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    if (cents < 1) throw new Error("O preço deve ser maior que zero.");
    const product = Object.fromEntries(["name", "category", "description", "sizes"].map(key => [key, fields.get(key).trim()]));
    if (!product.name || !product.category || !product.description) throw new Error("Preencha nome, categoria e descrição.");
    const file = fields.get("image");
    let uploaded;
    if (file.size) {
      if (file.size > 5242880 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Escolha uma foto JPG, PNG ou WebP de até 5 MB.");
      }
      uploaded = crypto.randomUUID();
      await request(bucket + uploaded, { method: "POST", body: file, type: file.type });
    }
    if (!uploaded && !previous) throw new Error("Adicione uma foto.");
    try {
      const changed = await request(table + (previous ? "?id=eq." + previous.id + "&image_key=eq." + previous.image_key : ""), {
        method: previous ? "PATCH" : "POST",
        body: { ...product, price: cents, image_key: uploaded || previous.image_key },
        representation: true,
      });
      if (!changed.length) throw new Error("A peça mudou. Atualize a página e tente novamente.");
    } catch (error) {
      if (uploaded) await discard(uploaded);
      throw error;
    }
    if (uploaded && previous) await discard(previous.image_key);
    resetEditor();
    await list();
    status.textContent = "Peça publicada no catálogo.";
  });
});
