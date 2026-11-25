import http from "node:http";
import { renderOrderPreview } from "./order-preview.mjs";
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

function layout(body, title = shopName, openGraph = "", showCart = true) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="theme-color" content="#0a0908"><link rel="stylesheet" href="/style.css">${openGraph}<link rel="stylesheet" href="/cart.css?v=4"></head><body><header class="top"><div class="wrap bar"><a class="brand" href="/" aria-label="${escape(shopName)}"><b>RC7</b><span>MULTIMARCAS</span></a><nav class="cart-nav"><a class="nav" href="/#catalogo">Ver catálogo</a>${number && showCart ? '<a class="cart-trigger" href="/carrinho" aria-label="Carrinho"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h3l3.1 12h11.2l2.2-8H6.1"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span id="cart-count" hidden></span></a><script src="/cart.js?v=4" defer></script>' : ""}</nav></div></header>${body}<footer class="wrap footer">${escape(shopName)}</footer></body></html>`;
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

function orderSizes(raw) {
  const text = (raw ?? "").toUpperCase().replace(/\bTAMANHO ÚNICO\b|ÚNICO/gu, "U");
  const alpha = ["PP", "P", "M", "G", "GG", "XG", "XGG", "G1", "G2", "G3", "G4", "G5"];
  const size = "(?:\\d{1,3}|[A-Z][A-Z0-9]*)";
  const ranges = new RegExp("\\b(" + size + ")\\s*(?:AO|A|ATÉ|[-–])\\s*(" + size + ")\\b", "gu");
  const expanded = text.replace(ranges, (match, from, to) => {
    if (/^\d+$/u.test(from) && /^\d+$/u.test(to)) {
      const first = Number(from), last = Number(to);
      if (last >= first && last - first < 50) return Array.from({ length: last - first + 1 }, (_, i) => first + i).join(" ");
    }
    const first = alpha.indexOf(from), last = alpha.indexOf(to);
    return first >= 0 && last >= first ? alpha.slice(first, last + 1).join(" ") : match;
  });
  return [...new Set((expanded.match(/\b[A-Z0-9]+\b/g) ?? [])
    .filter(value => alpha.includes(value) || /^(?:[1-9]\d{0,2}|U)$/u.test(value)))].map(value => value === "U" ? "Único" : value);
}

const modelImages = item => item.images ?? [image(item), ...(item.gallery_keys ?? []).map(key => SUPABASE_URL + photos + key)];
const modelKey = (src, origin) => new URL(src, origin).pathname.split("/").pop();

function detail(item, origin, requestedModel) {
  const link = origin + productPath(item);
  const models = modelImages(item);
  const galleryImages = models.slice(1);
  const modelLink = src => link + "?modelo=" + encodeURIComponent(modelKey(src, origin));
  const cartItem = (src, index) => escape(JSON.stringify({
    id: item.id, name: item.name, price: item.price, photo: src,
    key: modelKey(src, origin), model: galleryImages.length ? "Modelo " + (index + 1) : "",
  }));
  const selected = requestedModel === null ? -1 : models.findIndex(src => modelKey(src, origin) === requestedModel);
  if (requestedModel !== null && selected < 0) return null;
  const previewImage = models[selected] ?? models[0];
  const modelLabel = selected < 0 ? "" : "Modelo " + (selected + 1);
  const metadata = {
    title: [item.name, modelLabel, price(item)].filter(Boolean).join(" · "),
    description: item.description,
    image: new URL(previewImage, origin).href,
    "image:alt": [item.name, modelLabel].filter(Boolean).join(" — "),
    url: selected < 0 ? link : modelLink(previewImage),
    type: "product",
  };
  const og = Object.entries(metadata).map(([key, value]) => `<meta property="og:${key}" content="${escape(value)}">`).join("");
  const sizes = orderSizes(item.sizes);
  const orderForm = `<form id="model-order" data-item="${cartItem(previewImage, Math.max(0, selected))}" ${galleryImages.length && selected < 0 ? "hidden" : ""}>
    <label for="order-size">Escolha o tamanho</label>
    ${sizes.length
      ? `<select id="order-size" required><option value="">Selecione</option>${sizes.map(size => `<option>${escape(size)}</option>`).join("")}</select>`
      : '<input id="order-size" type="text" placeholder="Informe o tamanho desejado" maxlength="30" required>'}
    <button class="button" type="submit">Adicionar ao carrinho</button><p id="cart-feedback" role="status"></p>
  </form>`;
  const gallery = galleryImages.length
    ? `<section class="offer-gallery" id="modelos" aria-label="Fotos e modelos"><h2>Fotos e modelos</h2><div>${models.map((src, i) => {
      const label = "Modelo " + (i + 1);
      return `<div class="model-option"><a href="${escape(src)}"><img src="${escape(src)}" alt="${escape(item.name)} — ${label}" loading="lazy"></a><span>${label}</span>${number ? `<button type="button" class="secondary" aria-pressed="false" data-item="${cartItem(src, i)}" data-model="${label}" aria-label="Escolher peça: ${label}">Escolher peça</button>` : ""}</div>`;
    }).join("")}</div>${number ? `<p id="model-status" aria-live="polite">${modelLabel ? escape(modelLabel) + " escolhido." : "Escolha um modelo para continuar."}</p>${orderForm}` : ""}</section>`
    : "";
  const orderAction = number
    ? galleryImages.length ? '<a class="button" href="#modelos">Escolher modelo</a>' : orderForm
    : "";
  return layout(`<main class="wrap detail"><a class="nav" href="/#catalogo">Voltar ao catálogo</a><article><img src="${escape(previewImage)}" alt="${escape(metadata["image:alt"])}"><div><p class="eyebrow">${escape(item.category)}</p><h1>${escape(item.name)}</h1>${modelLabel ? `<p class="eyebrow">${modelLabel}</p>` : ""}${prices(item)}<p>${escape(item.description)}</p>${item.sizes ? `<p>Tamanhos: ${escape(item.sizes)}</p>` : ""}${orderAction}</div></article>${gallery}${number ? '<script src="/models.js?v=cart" defer></script>' : ""}</main>`, item.name + " | " + shopName, og);
}

async function guestPhoto(src) {
  if (/^\/promo\/100005\d{4}\.webp$/.test(src)) {
    return readFile(new URL("./public" + src, import.meta.url));
  }
  const prefix = SUPABASE_URL + photos;
  if (!src.startsWith(prefix) || !uuid.test(src.slice(prefix.length))) throw new Error("Foto inválida");
  const response = await fetch(src, { redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Foto indisponível");
  return Buffer.from(await response.arrayBuffer());
}

async function sharedOrder(url, origin, asImage = false) {
  const entries = url.searchParams.getAll("item");
  if (!entries.length || entries.length > 25) return null;
  const lines = entries.map(value => {
    try { return JSON.parse(value); } catch { return null; }
  });
  if (lines.some(line => !Array.isArray(line) || line.length !== 3 ||
    typeof line[0] !== "string" || !uuid.test(line[0]) ||
    typeof line[1] !== "string" || line[1].length > 100 ||
    typeof line[2] !== "string" || !line[2].trim() || line[2].length > 30)) return null;

  const ids = [...new Set(lines.map(([id]) => id))];
  const missing = ids.filter(id => !offers.some(item => item.id === id));
  const items = [...offers, ...(missing.length ? await products("?select=*&id=in.(" + missing.join(",") + ")") : [])];
  const order = lines.map(([id, key, size]) => {
    const item = items.find(product => product.id === id);
    if (!item) return null;
    const models = modelImages(item);
    const index = models.findIndex(src => modelKey(src, origin) === key);
    if (index < 0) return null;
    return { item, size, photo: models[index], model: models.length > 1 ? "Modelo " + (index + 1) : "" };
  });
  const available = order.filter(Boolean);
  if (!available.length) return null;
  const total = available.reduce((sum, entry) => sum + entry.item.price, 0);
  if (asImage) return renderOrderPreview(available, currency.format(total / 100), guestPhoto, price);
  const previewUrl = new URL("/pedido/previa.jpg", origin);
  previewUrl.search = url.search;
  const cards = available.map(({item, size, photo, model}) =>
    `<li><a href="${escape(photo)}"><img src="${escape(photo)}" alt="${escape(item.name + " " + model)}" loading="lazy"></a><div><strong>${escape(item.name)}</strong><p>${escape([model, "Tamanho: " + size, price(item)].filter(Boolean).join(" · "))}</p></div></li>`).join("");
  const preview = `<meta property="og:title" content="${escape(shopName)} · Pedido com ${lines.length} peça(s)"><meta property="og:image" content="${escape(previewUrl.href)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`;
  const summary = available.length === lines.length
    ? `<p><strong>Total: ${currency.format(total / 100)}</strong></p>`
    : '<p>Algumas peças ou fotos deste pedido não estão mais disponíveis.</p>';
  return layout(`<main class="wrap collection"><h1>Fotos do pedido</h1><ul class="cart-items">${cards}</ul>${summary}</main>`, "Pedido | " + shopName, preview, false);
}

const admin = `<main class="wrap admin"><h1>Painel ADM</h1>
<form id="login" class="editor"><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><button class="button">Entrar</button><button type="button" class="secondary" id="forgot">Esqueci minha senha</button></form>
<form id="recovery" class="editor" hidden><h2>Recuperar senha</h2><label>E-mail<input name="email" type="email" autocomplete="email" required></label><button class="button">Enviar link de recuperação</button><a href="/admin">Voltar ao login</a></form>
<form id="new-password" class="editor" hidden><h2>Definir nova senha</h2><label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirme a nova senha<input name="confirmation" type="password" autocomplete="new-password" minlength="8" required></label><button class="button">Salvar senha</button></form>
<section id="manager" hidden><button type="button" class="secondary" id="logout">Sair</button>
<form class="editor" id="import-offer"><h2>Importar oferta</h2><label>Texto do WhatsApp<textarea name="message" required placeholder="Cole a mensagem com nome, detalhes e preços"></textarea></label><button class="button">Preencher prévia</button></form>
<form class="editor" id="editor"><h2>Cadastrar peça</h2><label>Nome<input name="name" maxlength="100" required></label><div class="fields"><label>Categoria<input name="category" maxlength="60" placeholder="Ex.: Camisetas" required></label><label>Preço (R$)<input name="price" inputmode="decimal" placeholder="79,90" required maxlength="10"></label></div><label>Preço anterior (R$)<input name="old_price" inputmode="decimal" placeholder="Opcional" maxlength="10"></label><label>Detalhes da peça (opcional)<textarea name="details" maxlength="1800" placeholder="Ex.: Sarja com elastano, três bolsos"></textarea></label><label>Descrição gerada<textarea name="description" maxlength="2000" required></textarea></label><button type="button" class="secondary" id="regenerate-description">Gerar descrição novamente</button><details><summary>Prévia da legenda</summary><pre id="caption-preview" class="caption-preview"></pre></details><label>Tamanhos disponíveis<input name="sizes" maxlength="100" placeholder="P, M, G, GG"></label><label>Fotos da peça<input name="image" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><span class="muted">Arraste as fotos aqui ou selecione até 100 arquivos JPG, PNG ou WebP de até 50 MB cada. A primeira é a capa. A lista mostra miniaturas das três primeiras fotos. Ao editar, selecionar fotos substitui a galeria.</span><button id="clear-photos" type="button" class="secondary">Limpar seleção de fotos</button><div id="photo-preview" class="photo-preview"></div><div class="actions"><button class="button">Publicar peça</button><button type="button" class="secondary" id="cancel" hidden>Cancelar edição</button></div></form>
<h2>Peças publicadas</h2><div id="items"></div></section><p id="status" class="notice" role="status"></p></main><script src="/admin.js?v=photo-memory" type="module"></script>`;

const assets = { "/style.css": "text/css; charset=utf-8", "/admin.js": "text/javascript; charset=utf-8", "/offer-parser.mjs": "text/javascript; charset=utf-8", "/cart.css": "text/css; charset=utf-8", "/cart.js": "text/javascript; charset=utf-8", "/models.js": "text/javascript; charset=utf-8", "/catalog.js": "text/javascript; charset=utf-8", "/rc7-logo.webp": "image/webp" };

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
    if (path === "/admin" || path === "/admin/") return send(200, layout(admin, "Painel ADM | " + shopName, "", false));
    if (path === "/carrinho" && number) return send(200, layout(`<main class="wrap collection" id="cart" data-phone="${escape(number)}"><h1 class="cart-title"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h3l3.1 12h11.2l2.2-8H6.1"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg> Meu carrinho</h1><div class="cart-layout"><ul class="cart-items" id="cart-items"></ul><aside class="cart-summary"><h2>Resumo do pedido</h2><p id="cart-total" aria-live="polite"></p><a id="cart-whatsapp" class="button" hidden>Enviar pedido para loja</a><a class="nav" href="/#catalogo">Continuar escolhendo</a></aside></div></main>`));
    if (path === "/pedido" || path === "/pedido/previa.jpg") {
      const asImage = path.endsWith(".jpg");
      const page = await sharedOrder(new URL(req.url, origin), origin, asImage);
      if (page) {
        if (asImage) res.setHeader("Cache-Control", "public, max-age=300");
        return send(200, page, asImage ? "image/jpeg" : undefined);
      }
    }
    if (path === "/") return send(200, catalog([...offers, ...await products("?select=*&order=created_at.desc")]));
    const id = path.slice("/peca/".length);
    if (path.startsWith("/peca/") && uuid.test(id)) {
      const item = offers.find(offer => offer.id === id) ?? (await products("?select=*&id=eq." + id))[0];
      if (item) {
        const model = new URL(req.url, origin).searchParams.get("modelo");
        const page = detail(item, origin, model);
        if (page) return send(200, page);
      }
    }
    return send(404, layout('<main class="wrap collection"><h2>Página não encontrada</h2><a class="nav" href="/">Voltar ao catálogo</a></main>'));
  } catch (error) {
    console.error(error.message);
    return send(503, layout('<main class="wrap collection"><h2>Catálogo temporariamente indisponível</h2><p>Tente novamente em instantes.</p></main>'));
  }
}).listen(Number(process.env.PORT || 3000), "0.0.0.0");

