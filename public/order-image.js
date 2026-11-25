function fitText(ctx, value, width) {
  let text = value;
  if (ctx.measureText(text).width <= width) return text;
  while (text.length && ctx.measureText(text + "…").width > width) text = text.slice(0, -1);
  return text + "…";
}

async function loadPhoto(src) {
  const photo = new Image();
  photo.crossOrigin = "anonymous";
  photo.src = src;
  try {
    await photo.decode();
    return photo;
  } catch (error) {
    photo.removeAttribute("src");
    throw error;
  }
}

export async function orderImage(items, total, money, current) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 180 + items.length * 144;
  const ctx = canvas.getContext("2d");
  try {
    ctx.fillStyle = "#121110";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f7d7a2";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("RC7 Multimarcas", 28, 49);
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px sans-serif";
    ctx.fillText("Resumo do pedido", 28, 80);
    for (const [index, item] of items.entries()) {
      if (!current()) throw new Error("Pedido atualizado");
      const top = 104 + index * 144;
      ctx.fillStyle = "#25211d";
      ctx.fillRect(24, top, 672, 132);
      const photo = await loadPhoto(item.photo);
      try {
        const scale = Math.min(112 / photo.naturalWidth, 112 / photo.naturalHeight);
        const width = photo.naturalWidth * scale;
        const height = photo.naturalHeight * scale;
        ctx.drawImage(photo, 34 + (112 - width) / 2, top + 10 + (112 - height) / 2, width, height);
      } finally {
        photo.removeAttribute("src");
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(fitText(ctx, item.name, 510), 166, top + 34);
      ctx.font = "21px sans-serif";
      ctx.fillText(fitText(ctx, [item.model, "Tamanho: " + item.size].filter(Boolean).join(" · "), 510), 166, top + 68);
      ctx.fillStyle = "#f7d7a2";
      ctx.fillText(money(item.price), 166, top + 104);
    }
    ctx.fillStyle = "#f7d7a2";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText("Total: " + money(total), 28, canvas.height - 28);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Imagem indisponível");
    return new File([blob], "pedido-rc7.jpg", { type: blob.type });
  } finally {
    canvas.width = canvas.height = 0;
  }
}
