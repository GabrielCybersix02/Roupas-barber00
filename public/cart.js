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
  if (count) count.textContent = items.length ? "(" + items.length + ")" : "";
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
  checkout.hidden = items.length === 0;
  if (!items.length) return;
  const preview = new URL("/pedido", location.origin);
  const lines = items.map((item, index) => {
    preview.searchParams.append("item", JSON.stringify([item.id, item.key, item.size]));
    return (index + 1) + ". " + [item.name, item.model, "Tamanho: " + item.size, formatPrice(item.price)].filter(Boolean).join(" · ");
  });
  const message = ["Olá! Gostaria de pedir:", "", ...lines, "", "Valor total: " + formatPrice(total), "", "Fotos dos modelos: " + preview.href].join("\n");
  checkout.href = "https://wa.me/" + cart.dataset.phone + "?text=" + encodeURIComponent(message);
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
