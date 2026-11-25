const cartKey = "rc7-cart";
const cartUrl = "/carrinho";
const count = document.querySelector("#cart-count");
const cart = document.querySelector("#cart");
const money = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"});
const formatPrice = cents => money.format(cents / 100);

function readCart() {
  try {
    const items = JSON.parse(localStorage.getItem(cartKey) ?? "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function updateCart() {
  const items = readCart();
  if (count) {
    count.textContent = String(items.length);
    count.hidden = items.length === 0;
    count.parentElement.setAttribute("aria-label", "Carrinho, " + items.length + (items.length === 1 ? " peça" : " peças"));
  }
  if (!cart) return;
  const list = document.querySelector("#cart-items");
  const checkout = document.querySelector("#cart-whatsapp");
  const total = items.reduce((sum, item) => sum + item.price, 0);
  list.replaceChildren();
  for (const [index, item] of items.entries()) {
    const row = document.createElement("li");
    const photo = document.createElement("img");
    photo.src = item.photo;
    photo.alt = item.name + " " + item.model;
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const summary = document.createElement("p");
    summary.textContent = [item.model, "Tamanho: " + item.size, formatPrice(item.price)].filter(Boolean).join(" · ");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remover";
    remove.setAttribute("aria-label", "Remover " + item.name + " do carrinho");
    remove.addEventListener("click", () => {
      const current = readCart();
      current.splice(index, 1);
      try {
        localStorage.setItem(cartKey, JSON.stringify(current));
        updateCart();
      } catch {
        document.querySelector("#cart-total").textContent = "Não foi possível atualizar o carrinho.";
      }
    });
    details.append(name, summary, remove);
    row.append(photo, details);
    list.append(row);
  }
  document.querySelector("#cart-total").textContent = items.length ? "Valor total: " + formatPrice(total) : "Seu carrinho está vazio.";
  void prepareCheckout(checkout, items, total);
}

let revision = 0;
async function prepareCheckout(button, items, total) {
  const current = ++revision;
  const status = document.querySelector("#cart-image-status");
  button.hidden = status.hidden = !items.length;
  button.disabled = true;
  button.onclick = null;
  if (!items.length) return;
  status.textContent = "Preparando a imagem do pedido…";
  try {
    const { orderImage } = await import("/order-image.js");
    const file = await orderImage(items, total, formatPrice, () => current === revision);
    if (current !== revision) return;
    const payload = { files: [file] };
    const canShare = navigator.share && navigator.canShare?.(payload);
    status.textContent = canShare ? "Escolha o WhatsApp e a conversa da RC7."
      : "Neste navegador, o botão baixa a imagem para anexar no WhatsApp.";
    button.onclick = async () => {
      if (canShare) {
        try {
          await navigator.share(payload);
          return;
        } catch (error) {
          if (error.name === "AbortError" || current !== revision) return;
        }
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Anexe a imagem baixada na conversa da RC7.";
    };
  } catch {
    if (current !== revision) return;
    status.textContent = "Não foi possível montar a imagem. Toque para tentar novamente.";
    button.onclick = () => { void prepareCheckout(button, items, total); };
  }
  button.disabled = false;
}

document.querySelector("#model-order")?.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const size = document.querySelector("#order-size").value.trim();
  const feedback = document.querySelector("#cart-feedback");
  if (!size || form.hidden) return;
  const items = readCart();
  if (items.length >= 25) {
    feedback.textContent = "O carrinho aceita até 25 peças por pedido.";
    return;
  }
  items.push({...JSON.parse(form.dataset.item), size});
  try {
    localStorage.setItem(cartKey, JSON.stringify(items));
  } catch {
    feedback.textContent = "O navegador não conseguiu salvar o carrinho.";
    return;
  }
  updateCart();
  const link = document.createElement("a");
  link.href = cartUrl;
  link.textContent = "Ver carrinho";
  feedback.replaceChildren("Peça adicionada. ", link);
});

window.addEventListener("storage", event => {
  if (event.key === cartKey || event.key === null) updateCart();
});
window.addEventListener("pageshow", updateCart);
updateCart();

