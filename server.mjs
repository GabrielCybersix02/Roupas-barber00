import http from "node:http";
import { readFile } from "node:fs/promises";

const offers = JSON.parse(await readFile(new URL("./black-ofertas.json", import.meta.url), "utf8"));

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, WHATSAPP_NUMBER, RENDER_EXTERNAL_URL } = process.env;
const shopName = process.env.SHOP_NAME || "RC7 Multimarcas";
const number = (WHATSAPP_NUMBER || "").replace(/\D/g, "");
const table = "/rest/v1/clothing_catalog_products";
const photos = "/storage/v1/object/public/clothing-catalog-photos/";
const uuid = /^[0-9a-f-]{36}$/;
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const price = product => currency.format(product.price / 100);
const image = product => product.images?.[0] ?? SUPABASE_URL + photos + product.image_key;
const prices = product => product.old_price
  ? `<div class="offer-price"><span>Atacado da Black</span><del>${currency.format(product.old_price / 100)}</del><strong>${price(product)}</strong></div>`
  : `<strong>${price(product)}</strong>`;
const productPath = product => "/peca/" + product.id;

async function products(query) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error("Supabase ausente");
  const response = await fetch(SUPABASE_URL + table + query, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Falha no catálogo: " + response.status);
  return response.json();
}

function layout(body, title = shopName, openGraph = "") {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="theme-color" content="#0a0908"><link rel="stylesheet" href="/style.css">${openGraph}</head><body><header class="top"><div class="wrap bar"><a class="brand" href="/" aria-label="${escape(shopName)}"><b>RC7</b><span>MULTIMARCAS</span></a><a class="nav" href="/#catalogo">Ver catálogo</a></div></header>${body}<footer class="wrap footer">${escape(shopName)}</footer></body></html>`;
}

function catalog(items) {
  const categories = [...new Set(items.map(item => item.category))];
  const cards = items.map(item => `<a class="card" data-category="${escape(item.category)}" href="${productPath(item)}"><img src="${escape(image(item))}" alt="${escape(item.name)}" loading="lazy"><div class="card-copy"><span class="eyebrow">${escape(item.category)}</span><h3>${escape(item.name)}</h3>${prices(item)}</div></a>`).join("");
  const filters = categories.map(category => `<button type="button" data-category="${escape(category)}" aria-pressed="false">${escape(category)}</button>`).join("");
  return layout(`<main><section class="hero wrap">
    <div class="hero-logo"><img src="/rc7-logo.webp" width="708" height="1536" alt="RC7 Multimarcas, com gorila e coroa dourada"></div>
    <div class="hero-copy"><h1>RC7 <em>Multimarcas</em></h1><p>Roupas, calçados e acessórios</p><a class="button" href="#catalogo">Explorar catálogo</a></div>
  </section><section id="catalogo" class="collection wrap"><h2>Explore as peças</h2><p class="eyebrow">Promoção Black das Blacks</p>${items.length ? `<div class="filters"><button type="button" aria-pressed="true">Todas</button>${filters}</div><div class="grid">${cards}</div><script src="/catalog.js" defer></script>` : '<p class="empty">Em breve, novas peças por aqui.</p>'}</section></main>`);
}

function detail(item, origin) {
  const link = origin + productPath(item);
  const metadata = { title: item.name + " · " + price(item), description: item.description, image: new URL(image(item), origin).href, url: link, type: "product" };
  const og = Object.entries(metadata).map(([key, value]) => `<meta property="og:${key}" content="${escape(value)}">`).join("");
  const message = `Olá! Tenho interesse nesta peça:\n${item.name}\nValor: ${price(item)}\n${link}`;
  const whatsapp = "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  const galleryImages = item.images?.slice(1) ?? (item.gallery_keys ?? []).map(key => SUPABASE_URL + photos + key);
  const gallery = galleryImages.length
    ? `<section class="offer-gallery" aria-label="Fotos e modelos"><h2>Fotos e modelos</h2><div>${galleryImages.map((src, i) =>
      `<a href="${escape(src)}"><img src="${escape(src)}" alt="${escape(item.name)} — foto ${i + 2}" loading="lazy"></a>`).join("")}</div></section>`
    : "";
  return layout(`<main class="wrap detail"><a class="nav" href="/#catalogo">Voltar ao catálogo</a><article><img src="${escape(image(item))}" alt="${escape(item.name)}"><div><p class="eyebrow">${escape(item.category)}</p><h1>${escape(item.name)}</h1>${prices(item)}<p>${escape(item.description)}</p>${item.sizes ? `<p>Tamanhos: ${escape(item.sizes)}</p>` : ""}${number ? `<a class="button whatsapp" href="${escape(whatsapp)}" target="_blank" rel="noopener noreferrer">Pedir pelo WhatsApp</a>` : ""}</div></article>${gallery}</main>`, item.name + " | " + shopName, og);
}

const admin = `<main class="wrap admin"><h1>Painel ADM</h1>
<form id="login" class="editor"><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><button class="button">Entrar</button><button type="button" class="secondary" id="forgot">Esqueci minha senha</button></form>
<form id="recovery" class="editor" hidden><h2>Recuperar senha</h2><label>E-mail<input name="email" type="email" autocomplete="email" required></label><button class="button">Enviar link de recuperação</button><a href="/admin">Voltar ao login</a></form>
<form id="new-password" class="editor" hidden><h2>Definir nova senha</h2><label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirme a nova senha<input name="confirmation" type="password" autocomplete="new-password" minlength="8" required></label><button class="button">Salvar senha</button></form>
<section id="manager" hidden><button type="button" class="secondary" id="logout">Sair</button>
<form class="editor" id="import-offer"><h2>Importar oferta</h2><label>Texto do WhatsApp<textarea name="message" required placeholder="Cole a mensagem com nome, detalhes e preços"></textarea></label><button class="button">Preencher prévia</button></form>
<form class="editor" id="editor"><h2>Cadastrar peça</h2><label>Nome<input name="name" maxlength="100" required></label><div class="fields"><label>Categoria<input name="category" maxlength="60" placeholder="Ex.: Camisetas" required></label><label>Preço (R$)<input name="price" inputmode="decimal" placeholder="79,90" required maxlength="10"></label></div><label>Preço anterior (R$)<input name="old_price" inputmode="decimal" placeholder="Opcional" maxlength="10"></label><label>Detalhes da peça (opcional)<textarea name="details" maxlength="1800" placeholder="Ex.: Sarja com elastano, três bolsos"></textarea></label><label>Descrição gerada<textarea name="description" maxlength="2000" required></textarea></label><button type="button" class="secondary" id="regenerate-description">Gerar descrição novamente</button><details><summary>Prévia da legenda</summary><pre id="caption-preview" class="caption-preview"></pre></details><label>Tamanhos disponíveis<input name="sizes" maxlength="100" placeholder="P, M, G, GG"></label><label>Fotos da peça<input name="image" type="file" multiple accept="image/jpeg,image/png,image/webp" required></label><span class="muted">Arraste as fotos aqui ou selecione até 50 arquivos JPG, PNG ou WebP de até 5 MB cada. A primeira é a capa. Ao editar, selecionar fotos substitui a galeria.</span><div id="photo-preview" class="photo-preview"></div><div class="actions"><button class="button">Publicar peça</button><button type="button" class="secondary" id="cancel" hidden>Cancelar edição</button></div></form>
<h2>Peças publicadas</h2><div id="items"></div></section><p id="status" class="notice" role="status"></p></main><script src="/admin.js?v=auto-description" type="module"></script>`;

const assets = { "/style.css": "text/css; charset=utf-8", "/admin.js": "text/javascript; charset=utf-8", "/offer-parser.mjs": "text/javascript; charset=utf-8", "/catalog.js": "text/javascript; charset=utf-8", "/rc7-logo.webp": "image/webp" };

http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  const origin = RENDER_EXTERNAL_URL || "http://localhost:" + (process.env.PORT || 3000);
  const path = new URL(req.url, origin).pathname;
  const send = (status, body, type = "text/html; charset=utf-8") => {
    res.writeHead(status, { "Content-Type": type });
    res.end(req.method === "HEAD" ? undefined : body);
  };
  if (!["GET", "HEAD"].includes(req.method)) return send(405, "Método não permitido.");
  try {
    if (Object.hasOwn(assets, path)) return send(200, await readFile(new URL("./public" + path, import.meta.url)), assets[path]);
    if (/^\/promo\/100005\d{4}\.webp$/.test(path)) {
      if (!offers.some(item => item.images.includes(path))) return send(404, "Foto não encontrada.");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return send(200, await readFile(new URL("./public" + path, import.meta.url)), "image/webp");
    }
    if (path === "/health") return send(200, "ok", "text/plain");
    if (path === "/config.json") return send(200, JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY }), "application/json");
    if (path === "/admin" || path === "/admin/") return send(200, layout(admin, "Painel ADM | " + shopName));
    if (path === "/") return send(200, catalog([...offers, ...await products("?select=*&order=created_at.desc")]));
    const id = path.slice("/peca/".length);
    if (path.startsWith("/peca/") && uuid.test(id)) {
      const item = offers.find(offer => offer.id === id) ?? (await products("?select=*&id=eq." + id))[0];
      if (item) return send(200, detail(item, origin));
    }
    return send(404, layout('<main class="wrap collection"><h2>Página não encontrada</h2><a class="nav" href="/">Voltar ao catálogo</a></main>'));
  } catch (error) {
    console.error(error.message);
    return send(503, layout('<main class="wrap collection"><h2>Catálogo temporariamente indisponível</h2><p>Tente novamente em instantes.</p></main>'));
  }
}).listen(Number(process.env.PORT || 3000), "0.0.0.0");
