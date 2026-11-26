import { parseOffer } from "/offer-parser.mjs";

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
const importer = document.querySelector("#import-offer");
const photoInput = editor.elements.image;
const photoPreview = document.querySelector("#photo-preview");
const maxPhotos = 100;
const maxPhotoBytes = 50 * 1024 * 1024;
const photoTypes = ["image/jpeg", "image/png", "image/webp"];
let selectedPhotos = [];
let preparedPhotos = new WeakMap();
let previewUrls = [];

const { name, sizes, details, description, price, old_price: oldPriceField } = editor.elements;
const caption = document.querySelector("#caption-preview");
let descriptionEdited = false;

function catalogAmount(value) {
  const text = value.trim();
  if (!/^\d{1,6}(?:[,.]\d{1,2})?$/.test(text)) return "";
  const amount = Number(text.replace(",", "."));
  return amount > 0 ? currency.format(amount) : "";
}

function updateDescription() {
  const title = name.value.trim();
  if (!descriptionEdited) {
    const notes = details.value.trim();
    const sizeRange = sizes.value.trim();
    description.value = title
      ? notes || (sizeRange ? `${title}. Tamanhos disponíveis: ${sizeRange}.` : title + ".")
      : "";
  }
  const promotional = catalogAmount(price.value);
  const previous = catalogAmount(oldPriceField.value);
  const lines = [
    previous && promotional ? "⚫ PROMOÇÃO BLACK DAS BLACKS" : "",
    title ? "✔️ " + title.toLocaleUpperCase("pt-BR") : "",
    ...description.value.trim().split(/\n+/).map(line => line.trim())
      .filter(line => line && !line.startsWith(title + ".")).map(line => "➖ " + line),
    sizes.value.trim() ? "➖ Tam: " + sizes.value.trim() : "",
    previous && promotional ? "💰 ATACADO DA BLACK" : "",
    previous && promotional ? "De: " + previous : "",
    promotional ? (previous ? "Por: " : "Preço: ") + promotional : "",
  ];
  caption.textContent = lines.filter(Boolean).join("\n");
}

editor.addEventListener("input", event => {
  if (event.target === description) descriptionEdited = Boolean(description.value.trim());
  updateDescription();
});
document.querySelector("#regenerate-description").addEventListener("click", () => {
  descriptionEdited = false;
  updateDescription();
});

function clearPhotoPreview() {
  for (const img of photoPreview.querySelectorAll("img")) img.removeAttribute("src");
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
  photoPreview.replaceChildren();
}

function showPhotos() {
  clearPhotoPreview();
  for (const [index, file] of selectedPhotos.entries()) {
    const tile = document.createElement("div");
    if (index < 3) {
      const img = document.createElement("img");
      img.alt = index === 0 ? "Capa" : "Foto " + (index + 1);
      img.src = URL.createObjectURL(preparedPhotos.get(file) ?? file);
      previewUrls.push(img.src);
      tile.append(img);
    }
    const label = document.createElement("span");
    label.textContent = `${index + 1}. ${file.name} `;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remover";
    remove.setAttribute("aria-label", "Remover foto " + (index + 1) + ": " + file.name);
    remove.addEventListener("click", () => {
      selectedPhotos.splice(index, 1);
      showPhotos();
      status.textContent = `${selectedPhotos.length} de ${maxPhotos} fotos selecionadas.`;
    });
    tile.append(label, remove);
    photoPreview.append(tile);
  }
}
function addPhotos(files) {
  const incoming = [...files];
  if (incoming.some(file => !file.size || file.size > maxPhotoBytes || !photoTypes.includes(file.type))) {
    status.textContent = "Escolha fotos JPG, PNG ou WebP de até 50 MB cada.";
    return;
  }
  if (selectedPhotos.length + incoming.length > maxPhotos) {
    status.textContent = `Você já selecionou ${selectedPhotos.length} fotos. O limite é de ${maxPhotos} por peça.`;
    return;
  }
  selectedPhotos.push(...incoming);
  showPhotos();
  status.textContent = `${selectedPhotos.length} de ${maxPhotos} fotos selecionadas.`;
}

photoInput.addEventListener("change", () => {
  addPhotos(photoInput.files);
  photoInput.value = "";
});
photoInput.parentElement.addEventListener("dragover", event => event.preventDefault());
photoInput.parentElement.addEventListener("drop", event => {
  event.preventDefault();
  addPhotos(event.dataTransfer.files);
});
document.querySelector("#clear-photos").addEventListener("click", () => {
  selectedPhotos = [];
  preparedPhotos = new WeakMap();  showPhotos();
  status.textContent = "Seleção de fotos limpa.";
});

async function preparePhoto(file) {
  let source;
  let url;
  let fallbackImage;
  let canvas;
  function releaseSource() {
    source?.close?.();
    source = undefined;
    fallbackImage?.removeAttribute("src");
    fallbackImage = undefined;
    if (url) URL.revokeObjectURL(url);
    url = undefined;
  }
  try {
    try {
      source = await createImageBitmap(file);
    } catch {
      url = URL.createObjectURL(file);
      const img = fallbackImage = new Image();
      img.src = url;
      try {
        await img.decode();
      } catch {
        throw new Error("Não foi possível abrir esta imagem. Remova só esta foto ou adicione uma cópia salva como JPG ou PNG.");
      }
      source = img;
    }
    const width = source.naturalWidth ?? source.width;
    const height = source.naturalHeight ?? source.height;
    const scale = Math.min(1, 1600 / Math.max(width, height));
    if (scale === 1 && file.size <= 1024 * 1024) return file;
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    releaseSource();
    const optimized = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!optimized || optimized.size > maxPhotoBytes) throw new Error("Não foi possível otimizar a imagem.");
    return optimized;
  } finally {
    releaseSource();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

importer.addEventListener("submit", event => {
  event.preventDefault();
  if (editing) resetEditor();
  const draft = parseOffer(importer.elements.message.value);
  for (const [key, value] of Object.entries(draft)) editor.elements[key].value = value;
  details.value = draft.description;
  descriptionEdited = false;
  updateDescription();
  editor.querySelector("h2").textContent = "Prévia da oferta";
  status.textContent = "Confira os dados e adicione as fotos antes de publicar.";
  editor.scrollIntoView({ behavior: "smooth" });
});

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
  if (!response.ok) throw new Error(path.startsWith(bucket)
    ? `O armazenamento recusou o envio (HTTP ${response.status}).`
    : "Não foi possível concluir a operação.");
  return response.status === 204 ? null : response.json();
}

function resetEditor() {
  editing = null;
  editor.reset();
  selectedPhotos = [];
  preparedPhotos = new WeakMap();  descriptionEdited = false;
  updateDescription();
  showPhotos();
  editor.querySelector("h2").textContent = "Cadastrar peça";
  cancel.hidden = true;
}

function closePanel() {
  token = null;
  manager.hidden = true;
  document.querySelector("#new-password").hidden = true;
  login.hidden = false;
  login.reset();
  items.replaceChildren();
  importer.reset();
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
      editor.elements.old_price.value = product.old_price ? (product.old_price / 100).toFixed(2).replace(".", ",") : "";
      details.value = product.description;
      descriptionEdited = true;
      updateDescription();
      editor.querySelector("h2").textContent = "Editar peça";
      cancel.hidden = false;
      editor.scrollIntoView({ behavior: "smooth" });
    }), actionButton("Remover", () => {
      if (!confirm("Remover " + product.name + " do catálogo?")) return;
      void busy(manager, async () => {
        const removed = await request(table + "?id=eq." + product.id, { method: "DELETE", representation: true });
        if (!removed.length) throw new Error("Peça não encontrada.");
        await Promise.all([removed[0].image_key, ...(removed[0].gallery_keys ?? [])].map(discard));
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
  recovery.elements.email.value = login.elements.email?.value ?? "";
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
      let session;
      if (login.elements.username) {
        const response = await fetch("/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: fields.get("username"), password: fields.get("password") }),
        });
        if (!response.ok) throw new Error();
        session = await response.json();
      } else session = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email: fields.get("email").trim(), password: fields.get("password") },
      });
      token = session.access_token;
    } catch {
      throw new Error("Não foi possível entrar. Confira seus dados de acesso.");
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
    const oldPrice = String(fields.get("old_price")).trim();
    if (oldPrice && !/^\d{1,6}(?:[,.]\d{1,2})?$/.test(oldPrice)) throw new Error("Informe um preço anterior válido.");
    const oldCents = oldPrice ? Math.round(Number(oldPrice.replace(",", ".")) * 100) : null;
    if (oldCents !== null && oldCents <= cents) throw new Error("O preço anterior precisa ser maior que o preço atual.");

    const files = [...selectedPhotos];
    if (!files.length && !previous) throw new Error("Adicione pelo menos uma foto.");

    clearPhotoPreview();
    // Give the browser a frame to discard decoded thumbnails before reading the originals.
    await new Promise(resolve => setTimeout(resolve, 50));
    const invalid = [];
    for (const [index, file] of files.entries()) {
      if (preparedPhotos.has(file)) continue;
      status.textContent = `Verificando foto ${index + 1} de ${files.length}…`;
      try {
        preparedPhotos.set(file, await preparePhoto(file));
      } catch {
        invalid.push(`${index + 1} (${file.name})`);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (invalid.length) {
      throw new Error(`Não foi possível preparar: ${invalid.join(", ")}. Remova ou substitua essas fotos. As demais continuam selecionadas.`);
    }

    const uploaded = [];
    try {
      for (const [index, file] of files.entries()) {
        status.textContent = `Enviando foto ${index + 1} de ${files.length}…`;
        try {
          const photo = preparedPhotos.get(file);
          const key = crypto.randomUUID();
          uploaded.push(key);
          await request(bucket + key, { method: "POST", body: photo, type: photo.type });
        } catch (error) {
          throw new Error(`Foto ${index + 1} de ${files.length} (${file.name}): ${error.message}`);
        }
      }
      const changed = await request(table + (previous ? "?id=eq." + previous.id + "&image_key=eq." + previous.image_key : ""), {
        method: previous ? "PATCH" : "POST",
        body: {
          ...product, price: cents, old_price: oldCents,
          image_key: uploaded[0] ?? previous?.image_key,
          gallery_keys: uploaded.length ? uploaded.slice(1) : (previous?.gallery_keys ?? []),
        },
        representation: true,
      });
      if (!changed.length) throw new Error("A peça mudou. Atualize a página e tente novamente.");
    } catch (error) {
      // If the publish response was lost, retain any photos referenced by the saved row.
      if (uploaded.length && token) {
        const saved = await request(table + "?select=id&image_key=eq." + uploaded[0]).catch(() => null);
        if (saved?.length === 0) await Promise.all(uploaded.map(discard));
      }
      throw error;
    }
    if (uploaded.length && previous) await Promise.all([previous.image_key, ...(previous.gallery_keys ?? [])].map(discard));
    importer.reset();
    resetEditor();
    await list();
    status.textContent = "Peça publicada no catálogo.";
  }).finally(showPhotos);
});
