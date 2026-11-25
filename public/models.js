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
    order.dataset.item = choice.dataset.item;
    order.hidden = false;
    status.textContent = choice.dataset.model + " escolhido.";
    size.focus();
  });
}

