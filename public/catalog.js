const filters = [...document.querySelectorAll(".filters button")];
for (const button of filters) {
  button.addEventListener("click", () => {
    for (const filter of filters) filter.setAttribute("aria-pressed", String(filter === button));
    for (const card of document.querySelectorAll(".card[data-category]")) {
      card.hidden = button.dataset.category !== undefined && card.dataset.category !== button.dataset.category;
    }
  });
}
