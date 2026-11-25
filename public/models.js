const choices = [...document.querySelectorAll("button[data-model]")];
const order = document.querySelector("#model-order");
const status = document.querySelector("#model-status");
const size = document.querySelector("#order-size");

for (const choice of choices) {
  choice.addEventListener("click", () => {
    for (const button of choices) {
      button.setAttribute("aria-pressed", String(button === choice));
      button.textContent = button === choice ? "Peça escolhida" : "Escolher peça";
    }
    order.dataset.order = choice.dataset.order;
    order.hidden = false;
    status.textContent = choice.dataset.model + " escolhido.";
    size.focus();
  });
}

order.addEventListener("submit", event => {
  event.preventDefault();
  const value = size.value.trim();
  if (!value || order.hidden) {
    size.focus();
    return;
  }
  const url = new URL(order.dataset.order);
  const lines = url.searchParams.get("text").split("\n");
  lines.splice(-1, 0, "Tamanho: " + value);
  url.searchParams.set("text", lines.join("\n"));
  window.location.assign(url.href);
});
