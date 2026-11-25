const choices = [...document.querySelectorAll("button[data-model]")];
const order = document.querySelector("#model-order");
const status = document.querySelector("#model-status");

for (const choice of choices) {
  choice.addEventListener("click", () => {
    for (const button of choices) {
      button.setAttribute("aria-pressed", String(button === choice));
      button.textContent = button === choice ? "Peça escolhida" : "Escolher peça";
    }
    order.href = choice.dataset.order;
    order.hidden = false;
    status.textContent = choice.dataset.model + " escolhido.";
  });
}
