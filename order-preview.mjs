import sharp from "sharp";

const width = 1200;
const height = 630;
const xml = value => String(value).replace(/[&<>"'\u0000-\u001f]/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? " ");
const shorten = (value, length) => {
  const chars = Array.from(value);
  return chars.length > length ? chars.slice(0, length - 1).join("") + "…" : value;
};

export async function renderOrderPreview(entries, total, readPhoto, price) {
  const columns = Math.ceil(Math.sqrt(entries.length));
  const rows = Math.ceil(entries.length / columns);
  const cellWidth = Math.floor(1150 / columns);
  const cellHeight = Math.floor(463 / rows);
  const font = Math.min(23, Math.floor(cellHeight / 5));
  const photoSize = Math.min(cellHeight - 14, Math.floor(cellWidth * .37));
  const textWidth = Math.floor((cellWidth - photoSize - 32) / (font * .6));
  const drawings = [];
  const photos = [];

  for (let i = 0; i < entries.length; i += 3) {
    await Promise.all(entries.slice(i, i + 3).map(async ({item, size, model, photo}, offset) => {
      const index = i + offset;
      const x = 25 + index % columns * cellWidth;
      const y = 85 + Math.floor(index / columns) * cellHeight;
      const textX = x + photoSize + 17;
      const firstLine = y + Math.floor(cellHeight / 2) - font;
      drawings.push(`<rect x="${x}" y="${y}" width="${cellWidth - 7}" height="${cellHeight - 7}" rx="10" fill="#28231e"/>
      <text x="${textX}" y="${firstLine}" font-weight="bold">${xml(shorten(item.name, textWidth))}</text>
      <text x="${textX}" y="${firstLine + font + 3}">${xml(shorten([model, "Tam. " + size].filter(Boolean).join(" · "), textWidth))}</text>
      <text x="${textX}" y="${firstLine + 2 * (font + 3)}" fill="#f7d7a2">${xml(price(item))}</text>`);
      try {
        const input = await sharp(await readPhoto(photo), { limitInputPixels: 45000000 })
          .rotate().resize(photoSize, photoSize, { fit: "contain", background: "#28231e" }).jpeg().toBuffer();
        photos.push({ input, left: x + 6, top: y + 4 });
      } catch {
        drawings.push(`<text x="${x + 6}" y="${firstLine}" font-size="12">Sem foto</text>`);
      }
    }));
  }

  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#121110"/>
    <g font-family="DejaVu Sans, sans-serif" font-size="${font}" fill="#fff">
      <text x="25" y="56" font-size="35" font-weight="bold" fill="#f7d7a2">RC7 Multimarcas · Pedido</text>
      ${drawings.join("")}
      <text x="25" y="597" font-size="32" font-weight="bold" fill="#f7d7a2">Total: ${xml(total)}</text>
    </g></svg>`);
  return sharp(svg).composite(photos).jpeg({ quality: 87 }).toBuffer();
}
