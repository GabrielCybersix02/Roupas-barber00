const amount = '(?:R\\$\\s*)?(\\d{1,6}(?:[.,]\\d{1,2})?)';
const fromPrice = new RegExp('^de\\s*:?\\s*' + amount, 'i');
const toPrice = new RegExp('(?:^|\\s)(?:por|preço(?: promocional)?|valor)\\s*:?\\s*' + amount, 'i');
const categories = [
  [/regata/i, "Regatas"], [/polo/i, "Polos"], [/bermuda/i, "Bermudas"],
  [/short/i, "Shorts"], [/calça/i, "Calças"], [/camis/i, "Camisetas"],
];

export function parseOffer(message) {
  const clean = message.replace(/[*~_]/g, "").replace(/\s*([:：])\s*/g, "$1 ");
  const lines = clean.split(/\r?\n/).map(raw => ({
    marked: /^[✔✅☑]/u.test(raw.trim()),
    text: raw.replace(/^[\s\p{Extended_Pictographic}\uFE0F➖–—•-]+/u, "").trim(),
  })).filter(line => line.text && !/^(promoção\b|atacado\b|black das blacks\b)/i.test(line.text));
  const sizes = /^(?:tam(?:anhos?)?\.?|numeração)\s*:\s*(.*)$/i;
  const details = lines.filter(line => !sizes.test(line.text) && !fromPrice.test(line.text) && !toPrice.test(line.text));
  const title = details.find(line => line.marked) ?? details[0];
  const name = title?.text ?? "";
  return {
    name,
    category: categories.find(([pattern]) => pattern.test(name))?.[1] ?? "",
    description: details.filter(line => line !== title).map(line => line.text).join(" "),
    sizes: lines.map(line => line.text.match(sizes)?.[1]).find(Boolean) ?? "",
    old_price: lines.map(line => line.text.match(fromPrice)?.[1]).find(Boolean) ?? "",
    price: clean.match(toPrice)?.[1] ?? "",
  };
}
