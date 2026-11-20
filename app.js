const STORAGE_KEYS = {
  TAILOR_ORDERS: "mbh_orders_v1",
  STORE_PRODUCTS: "mbh_store_products_v2",
  STORE_ORDERS: "mbh_store_orders_v2",
  CART: "mbh_cart_v2",
  SETTINGS: "mbh_settings_v2"
};

const DEFAULT_SETTINGS = {
  boutiqueName: "Mahroli Boutique & Desi Market",
  boutiqueLocation: "Mahroli & Reengus, Sikar, Rajasthan",
  sellerWhatsapp: "",
  allowedPincodes: "332404, 332402, 332406",
  deliveryCharge: 30,
  freeDeliveryAbove: 499,
  upiId: "",
  upiPayeeName: "Mahroli Boutique House"
};

// Pre-loaded starter catalog tailored to WoolenWonders4 & Mahroli Boutique House
const STARTER_PRODUCTS = [
  {
    id: "PRD-101",
    title: "Handmade Crochet Sunflower Keychain",
    category: "Crochet & Handmade",
    price: 129,
    mrp: 199,
    stock: 25,
    sizes: ["Free Size"],
    description: "100% hand-knitted soft woolen sunflower keychain by WoolenWonders4. Lightweight, washable & durable metal ring.",
    photoDataUrl: ""
  },
  {
    id: "PRD-102",
    title: "Cute Crochet Butterfly & Bumblebee Combo Keychain",
    category: "Crochet & Handmade",
    price: 219,
    mrp: 349,
    stock: 18,
    sizes: ["Combo (2 Pcs)"],
    description: "Pair of handmade butterfly and bumblebee woolen keychains — ideal for bags, scooty keys & gifting.",
    photoDataUrl: ""
  },
  {
    id: "PRD-103",
    title: "Rajasthani Cotton Printed Straight Kurti",
    category: "Ladies Suits & Kurtis",
    price: 449,
    mrp: 699,
    stock: 15,
    sizes: ["S", "M", "L", "XL", "XXL"],
    description: "Pure breathable Jaipuri cotton kurti stitched at Mahroli Boutique House with neat piping finish.",
    photoDataUrl: ""
  },
  {
    id: "PRD-104",
    title: "Handmade Crochet Flower Hair Clip (Set of 2)",
    category: "Crochet & Handmade",
    price: 99,
    mrp: 159,
    stock: 30,
    sizes: ["Free Size"],
    description: "Soft pastel woolen flower hair clips for girls & women. Gentle grip alligator clip.",
    photoDataUrl: ""
  }
];

let currentTailorPhoto = "";
let currentProdPhoto = "";
let deferredPrompt = null;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(STORAGE_KEYS.SETTINGS, {}) };
}

function loadProducts() {
  const existing = readJson(STORAGE_KEYS.STORE_PRODUCTS, null);
  if (!existing) {
    writeJson(STORAGE_KEYS.STORE_PRODUCTS, STARTER_PRODUCTS);
    return [...STARTER_PRODUCTS];
  }
  return existing;
}

function saveProducts(list) {
  writeJson(STORAGE_KEYS.STORE_PRODUCTS, list);
  renderStoreCatalog();
  renderAdminProducts();
}

function loadStoreOrders() {
  return readJson(STORAGE_KEYS.STORE_ORDERS, []);
}

function saveStoreOrders(list) {
  writeJson(STORAGE_KEYS.STORE_ORDERS, list);
  updateBadges();
}

function loadTailorOrders() {
  return readJson(STORAGE_KEYS.TAILOR_ORDERS, []);
}

function saveTailorOrders(list) {
  writeJson(STORAGE_KEYS.TAILOR_ORDERS, list);
  updateBadges();
}

function loadCart() {
  return readJson(STORAGE_KEYS.CART, []);
}

function saveCart(cart) {
  writeJson(STORAGE_KEYS.CART, cart);
  updateBadges();
}

function updateBadges() {
  const cartQty = loadCart().reduce((sum, item) => sum + item.qty, 0);
  document.getElementById("cartCount").textContent = String(cartQty);
  document.getElementById("storeOrderCount").textContent = String(loadStoreOrders().length);
  document.getElementById("tailorOrderCount").textContent = String(loadTailorOrders().length);
  document.getElementById("adminProdCount").textContent = String(loadProducts().length);
}

function formatINR(num) {
  return "₹" + (Number(num) || 0).toLocaleString("en-IN");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makePlaceholderSvg(title, category) {
  const label = escapeHtml((category || "Item").slice(0, 22));
  const shortTitle = escapeHtml((title || "Product").slice(0, 24));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#f3e6ee"/>
    <circle cx="200" cy="125" r="54" fill="#5c2d4b" opacity="0.14"/>
    <text x="200" y="132" font-family="sans-serif" font-size="18" font-weight="bold" fill="#5c2d4b" text-anchor="middle">${label}</text>
    <text x="200" y="185" font-family="sans-serif" font-size="15" fill="#411d34" text-anchor="middle">${shortTitle}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function compressImageFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 640;
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width > height) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function buildUpiUri(amount, note) {
  const settings = loadSettings();
  const vpa = (settings.upiId || "").trim();
  const pn = encodeURIComponent((settings.upiPayeeName || settings.boutiqueName || "Store").trim());
  const tn = encodeURIComponent((note || "Order Payment").slice(0, 60));
  const amt = Number(amount) > 0 ? `&am=${Number(amount).toFixed(2)}` : "";
  if (!vpa) return "";
  return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${pn}${amt}&cu=INR&tn=${tn}`;
}

/* ==================== STOREFRONT & CART ==================== */
function renderStoreCatalog() {
  const grid = document.getElementById("storeCatalogGrid");
  const query = (document.getElementById("storeSearch").value || "").toLowerCase().trim();
  const cat = document.getElementById("storeCategoryFilter").value;

  const list = loadProducts().filter((p) => {
    const matchCat = cat === "ALL" || p.category === cat;
    const matchQ =
      !query ||
      p.title.toLowerCase().includes(query) ||
      (p.description || "").toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query);
    return matchCat && matchQ;
  });

  if (!list.length) {
    grid.innerHTML = `<div class="card"><p class="muted">No products found in this category.</p></div>`;
    return;
  }

  grid.innerHTML = list
    .map((p) => {
      const hasDiscount = p.mrp && Number(p.mrp) > Number(p.price);
      const offPct = hasDiscount ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
      const imgSrc = p.photoDataUrl || makePlaceholderSvg(p.title, p.category);
      const sizes = p.sizes && p.sizes.length ? p.sizes : ["Free Size"];
      const outOfStock = Number(p.stock) <= 0;

      return `
        <article class="product-card">
          <div class="prod-img-wrap">
            <img src="${imgSrc}" alt="${escapeHtml(p.title)}" />
            ${hasDiscount ? `<span class="discount-tag">${offPct}% OFF</span>` : ""}
            <span class="cat-tag">${escapeHtml(p.category)}</span>
          </div>
          <div class="prod-body">
            <div class="prod-title">${escapeHtml(p.title)}</div>
            <div class="prod-price-row">
              <span class="prod-price">${formatINR(p.price)}</span>
              ${hasDiscount ? `<span class="prod-mrp">${formatINR(p.mrp)}</span>` : ""}
              ${hasDiscount ? `<span class="prod-off">${offPct}% off</span>` : ""}
            </div>
            <div class="small-text muted">${escapeHtml((p.description || "").slice(0, 75))}${(p.description || "").length > 75 ? "..." : ""}</div>
            <div>
              <select class="size-select" id="size-${p.id}">
                ${sizes.map((s) => `<option value="${escapeHtml(s)}">Size/Var: ${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>
            <div class="prod-card-actions">
              <button type="button" class="btn btn-small btn-secondary add-cart-btn" data-id="${p.id}" ${outOfStock ? "disabled" : ""} style="flex:1;">
                ${outOfStock ? "Out of Stock" : "+ Cart"}
              </button>
              <button type="button" class="btn btn-small btn-primary buy-now-btn" data-id="${p.id}" ${outOfStock ? "disabled" : ""} style="flex:1;">
                Buy Now
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll(".add-cart-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      addToCart(btn.dataset.id, false);
    });
  });

  grid.querySelectorAll(".buy-now-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      addToCart(btn.dataset.id, true);
    });
  });
}

function addToCart(productId, openCheckoutImmediately) {
  const product = loadProducts().find((p) => p.id === productId);
  if (!product) return;
  const sizeEl = document.getElementById(`size-${productId}`);
  const selectedSize = sizeEl ? sizeEl.value : (product.sizes && product.sizes[0]) || "Free Size";

  const cart = loadCart();
  const existing = cart.find((c) => c.productId === productId && c.size === selectedSize);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: product.id,
      title: product.title,
      price: Number(product.price),
      size: selectedSize,
      qty: 1
    });
  }
  saveCart(cart);

  if (openCheckoutImmediately) {
    openCartModal();
  } else {
    renderCartModal();
    openCartModal();
  }
}

function computeCartTotals() {
  const cart = loadCart();
  const settings = loadSettings();
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const freeThreshold = Number(settings.freeDeliveryAbove) || 0;
  const baseFee = Number(settings.deliveryCharge) || 0;
  const shipping = subtotal === 0 || (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : baseFee;
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}

function renderCartModal() {
  const listEl = document.getElementById("cartItemsList");
  const formEl = document.getElementById("checkoutForm");
  const summaryEl = document.getElementById("cartBillSummary");
  const cart = loadCart();

  if (!cart.length) {
    listEl.innerHTML = `<p class="muted">Your shopping cart is empty. Browse products in "Shop Store" and add items!</p>`;
    formEl.classList.add("hidden");
    return;
  }

  formEl.classList.remove("hidden");
  listEl.innerHTML = cart
    .map(
      (item, idx) => `
      <div class="cart-row">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <div class="small-text muted">Option: ${escapeHtml(item.size)} • ${formatINR(item.price)} each</div>
        </div>
        <div class="qty-controls">
          <button type="button" class="btn btn-small btn-secondary cart-dec" data-idx="${idx}">-</button>
          <strong>${item.qty}</strong>
          <button type="button" class="btn btn-small btn-secondary cart-inc" data-idx="${idx}">+</button>
        </div>
      </div>
    `
    )
    .join("");

  const { subtotal, shipping, total } = computeCartTotals();
  summaryEl.innerHTML = `
    <div><span>Items Subtotal:</span> <strong>${formatINR(subtotal)}</strong></div>
    <div><span>Delivery Charge:</span> <strong>${shipping === 0 ? "FREE" : formatINR(shipping)}</strong></div>
    <div class="balance-row"><span>Total Payable:</span> <strong>${formatINR(total)}</strong></div>
  `;

  listEl.querySelectorAll(".cart-dec").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = loadCart();
      const idx = Number(btn.dataset.idx);
      if (c[idx].qty > 1) c[idx].qty -= 1;
      else c.splice(idx, 1);
      saveCart(c);
      renderCartModal();
    });
  });

  listEl.querySelectorAll(".cart-inc").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = loadCart();
      const idx = Number(btn.dataset.idx);
      c[idx].qty += 1;
      saveCart(c);
      renderCartModal();
    });
  });
}

function openCartModal() {
  renderCartModal();
  document.getElementById("cartModal").classList.remove("hidden");
}

function validatePincode(pin) {
  const settings = loadSettings();
  const allowedRaw = (settings.allowedPincodes || "").trim();
  if (!allowedRaw) return true;
  const allowedList = allowedRaw.split(",").map((x) => x.trim()).filter(Boolean);
  return allowedList.includes(pin.trim());
}

function initCheckout() {
  const pinInput = document.getElementById("chkPincode");
  const pinMsg = document.getElementById("pincodeStatusMsg");

  pinInput.addEventListener("input", () => {
    const val = pinInput.value.trim();
    if (val.length === 6) {
      if (validatePincode(val)) {
        pinMsg.textContent = "Delivery available at this pincode!";
        pinMsg.style.color = "var(--success)";
      } else {
        pinMsg.textContent = `Delivery currently restricted to: ${loadSettings().allowedPincodes}`;
        pinMsg.style.color = "var(--danger)";
      }
    } else {
      pinMsg.textContent = "";
    }
  });

  document.getElementById("checkoutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const cart = loadCart();
    if (!cart.length) return;

    const pin = pinInput.value.trim();
    if (!validatePincode(pin)) {
      alert(`Sorry! Delivery is only available for pincodes: ${loadSettings().allowedPincodes}`);
      return;
    }

    const totals = computeCartTotals();
    const orderId = "ORD-" + String(Date.now()).slice(-6);
    const storeOrder = {
      id: orderId,
      type: "STORE",
      createdAt: new Date().toISOString(),
      customerName: document.getElementById("chkName").value.trim(),
      customerPhone: document.getElementById("chkPhone").value.trim(),
      pincode: pin,
      address: document.getElementById("chkAddress").value.trim(),
      paymentMode: document.getElementById("chkPaymentMode").value,
      status: "New Order",
      items: cart,
      billing: totals
    };

    // Reduce stock
    const products = loadProducts();
    cart.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) prod.stock = Math.max(0, Number(prod.stock) - item.qty);
    });
    saveProducts(products);

    const orders = loadStoreOrders();
    orders.unshift(storeOrder);
    saveStoreOrders(orders);

    saveCart([]);
    e.target.reset();
    pinMsg.textContent = "";
    document.getElementById("cartModal").classList.add("hidden");

    openStoreOrderInvoice(storeOrder);
  });
}

/* ==================== SELLER PRODUCT MANAGEMENT ==================== */
function initProductManager() {
  const photoInput = document.getElementById("prodPhoto");
  const previewWrap = document.getElementById("prodPhotoPreviewWrap");
  const previewImg = document.getElementById("prodPhotoPreview");

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    compressImageFile(file, (dataUrl) => {
      currentProdPhoto = dataUrl;
      previewImg.src = dataUrl;
      previewWrap.classList.remove("hidden");
    });
  });

  document.getElementById("clearProdPhotoBtn").addEventListener("click", () => {
    currentProdPhoto = "";
    photoInput.value = "";
    previewWrap.classList.add("hidden");
  });

  document.getElementById("productForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const sizesRaw = document.getElementById("prodSizes").value.trim();
    const sizes = sizesRaw ? sizesRaw.split(",").map((s) => s.trim()).filter(Boolean) : ["Free Size"];

    const newProd = {
      id: "PRD-" + String(Date.now()).slice(-5),
      title: document.getElementById("prodTitle").value.trim(),
      category: document.getElementById("prodCategory").value,
      stock: Number(document.getElementById("prodStock").value) || 0,
      price: Number(document.getElementById("prodPrice").value) || 0,
      mrp: Number(document.getElementById("prodMrp").value) || 0,
      sizes,
      description: document.getElementById("prodDesc").value.trim(),
      photoDataUrl: currentProdPhoto
    };

    const list = loadProducts();
    list.unshift(newProd);
    saveProducts(list);
    updateBadges();

    e.target.reset();
    document.getElementById("prodSizes").value = "Free Size";
    document.getElementById("prodStock").value = "10";
    currentProdPhoto = "";
    previewWrap.classList.add("hidden");
    alert("Product published to your online store!");
  });
}

function renderAdminProducts() {
  const container = document.getElementById("adminProductsList");
  const list = loadProducts();
  if (!list.length) {
    container.innerHTML = `<p class="muted">No products listed yet.</p>`;
    return;
  }

  container.innerHTML = list
    .map(
      (p) => `
      <div class="order-card">
        <div>
          <div class="order-top">
            <strong>${escapeHtml(p.title)}</strong>
            <span class="badge">Stock: ${p.stock}</span>
          </div>
          <div class="small-text muted">${escapeHtml(p.category)} • Price: <strong>${formatINR(p.price)}</strong></div>
        </div>
        <div class="order-actions">
          <button type="button" class="btn btn-small btn-secondary restock-btn" data-id="${p.id}">+5 Stock</button>
          <button type="button" class="btn btn-small btn-danger del-prod-btn" data-id="${p.id}">Remove</button>
        </div>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".restock-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = loadProducts();
      const target = list.find((x) => x.id === btn.dataset.id);
      if (target) {
        target.stock = Number(target.stock) + 5;
        saveProducts(list);
      }
    });
  });

  container.querySelectorAll(".del-prod-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("Delete this product from store?")) return;
      saveProducts(loadProducts().filter((x) => x.id !== btn.dataset.id));
      updateBadges();
    });
  });
}

/* ==================== STORE ORDERS MANAGEMENT ==================== */
function renderStoreOrders() {
  const container = document.getElementById("storeOrdersContainer");
  const q = (document.getElementById("searchStoreOrders").value || "").toLowerCase().trim();
  const st = document.getElementById("filterStoreOrderStatus").value;

  const filtered = loadStoreOrders().filter((o) => {
    const matchSt = st === "ALL" || o.status === st;
    const matchQ =
      !q ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      o.id.toLowerCase().includes(q);
    return matchSt && matchQ;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="card"><p class="muted">No online store orders yet.</p></div>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (o) => `
      <article class="order-card">
        <div>
          <div class="order-top">
            <div>
              <strong>${escapeHtml(o.customerName)}</strong>
              <div class="small-text muted">${escapeHtml(o.id)} • ${escapeHtml(o.paymentMode)}</div>
            </div>
            <span class="badge ${o.status === "Delivered" ? "delivered" : ""}">${escapeHtml(o.status)}</span>
          </div>
          <div class="order-meta" style="margin-top:0.5rem;">
            <div>Phone: <strong>${escapeHtml(o.customerPhone)}</strong> | Pin: <strong>${escapeHtml(o.pincode)}</strong></div>
            <div>Address: ${escapeHtml(o.address)}</div>
            <div style="margin-top:0.3rem;">Items: <strong>${o.items.map((i) => `${i.title} (${i.size}) x${i.qty}`).join(", ")}</strong></div>
            <div>Total: <strong>${formatINR(o.billing.total)}</strong></div>
          </div>
        </div>
        <div class="order-actions">
          <select class="store-st-sel" data-id="${o.id}" style="width:auto;padding:0.35rem 0.5rem;font-size:0.82rem;">
            ${["New Order", "Packed", "Shipped / Out for Delivery", "Delivered"]
              .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
          <button type="button" class="btn btn-small btn-primary view-store-bill" data-id="${o.id}">Invoice &amp; QR</button>
          <a class="btn btn-small btn-whatsapp" target="_blank" rel="noopener noreferrer" href="${buildStoreWhatsAppLink(o)}">WhatsApp</a>
        </div>
      </article>
    `
    )
    .join("");

  container.querySelectorAll(".store-st-sel").forEach((sel) => {
    sel.addEventListener("change", () => {
      const list = loadStoreOrders();
      const target = list.find((x) => x.id === sel.dataset.id);
      if (target) {
        target.status = sel.value;
        saveStoreOrders(list);
        renderStoreOrders();
      }
    });
  });

  container.querySelectorAll(".view-store-bill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = loadStoreOrders().find((x) => x.id === btn.dataset.id);
      if (order) openStoreOrderInvoice(order);
    });
  });
}

function buildStoreWhatsAppLink(order) {
  const settings = loadSettings();
  const upiLink = buildUpiUri(order.billing.total, `${settings.boutiqueName} ${order.id}`);
  const itemLines = order.items.map((i) => `• ${i.title} (${i.size}) x${i.qty} = ${formatINR(i.price * i.qty)}`).join("\n");
  const msg = [
    `Namaste ${order.customerName},`,
    `Order Confirmation from *${settings.boutiqueName}*`,
    `*Order ID:* ${order.id}`,
    `*Status:* ${order.status}`,
    ``,
    itemLines,
    `Delivery: ${order.billing.shipping === 0 ? "FREE" : formatINR(order.billing.shipping)}`,
    `*Total Payable:* ${formatINR(order.billing.total)} (${order.paymentMode})`,
    `*Address:* ${order.address} - ${order.pincode}`,
    upiLink && order.paymentMode.includes("UPI") ? `\n*Pay via UPI:* ${upiLink}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const sellerPhone = (settings.sellerWhatsapp || "").replace(/\D/g, "");
  const custDigits = (order.customerPhone || "").replace(/\D/g, "");
  const targetPhone = sellerPhone || (custDigits.length === 10 ? "91" + custDigits : custDigits);
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
}

function openStoreOrderInvoice(order) {
  const settings = loadSettings();
  const modal = document.getElementById("billModal");
  const paper = document.getElementById("billPrintableArea");
  const waBtn = document.getElementById("whatsappShareBtn");
  const upiUri = buildUpiUri(order.billing.total, `${order.id} - ${order.customerName}`);

  paper.innerHTML = `
    <div class="bill-header">
      <h3 style="margin:0;">${escapeHtml(settings.boutiqueName)}</h3>
      <div class="small-text muted">${escapeHtml(settings.boutiqueLocation || "")}</div>
      <div class="small-text" style="margin-top:0.25rem;">Store Invoice: <strong>${escapeHtml(order.id)}</strong> | Mode: <strong>${escapeHtml(order.paymentMode)}</strong></div>
    </div>
    <div class="small-text">
      <div><strong>Customer:</strong> ${escapeHtml(order.customerName)} (${escapeHtml(order.customerPhone)})</div>
      <div><strong>Address:</strong> ${escapeHtml(order.address)} — Pincode: <strong>${escapeHtml(order.pincode)}</strong></div>
    </div>
    <table class="bill-table">
      <thead>
        <tr><th>Product</th><th>Qty</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${order.items
          .map(
            (i) => `
          <tr>
            <td>${escapeHtml(i.title)} (${escapeHtml(i.size)})</td>
            <td>${i.qty}</td>
            <td>${formatINR(i.price * i.qty)}</td>
          </tr>`
          )
          .join("")}
        <tr>
          <td colspan="2">Delivery Charge</td>
          <td>${order.billing.shipping === 0 ? "FREE" : formatINR(order.billing.shipping)}</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Grand Total</strong></td>
          <td><strong>${formatINR(order.billing.total)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div class="bill-qr-block">
      ${
        upiUri
          ? `<div class="small-text" style="margin-bottom:0.4rem;">Scan to Pay <strong>${formatINR(order.billing.total)}</strong> (${escapeHtml(settings.upiId)})</div><div id="modalQrTarget"></div>`
          : `<div class="small-text muted">Set your UPI ID in "UPI &amp; Delivery" tab to show Payment QR.</div>`
      }
    </div>
  `;

  if (upiUri) {
    new QRCode(document.getElementById("modalQrTarget"), { text: upiUri, width: 156 });
  }
  waBtn.href = buildStoreWhatsAppLink(order);
  modal.classList.remove("hidden");
}

/* ==================== TAILORING MODULE ==================== */
function computeTailorTotals() {
  const stitch = Number(document.getElementById("stitchingCharge").value) || 0;
  const extra = Number(document.getElementById("extraCharge").value) || 0;
  const advance = Number(document.getElementById("advancePaid").value) || 0;
  const total = stitch + extra;
  const balance = Math.max(0, total - advance);

  document.getElementById("calcTotal").textContent = formatINR(total);
  document.getElementById("calcAdvance").textContent = formatINR(advance);
  document.getElementById("calcBalance").textContent = formatINR(balance);
  return { stitch, extra, advance, total, balance };
}

function initTailoringModule() {
  const photoInput = document.getElementById("fabricPhoto");
  const previewWrap = document.getElementById("photoPreviewWrap");
  const previewImg = document.getElementById("photoPreview");

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    compressImageFile(file, (dataUrl) => {
      currentTailorPhoto = dataUrl;
      previewImg.src = dataUrl;
      previewWrap.classList.remove("hidden");
    });
  });

  document.getElementById("clearPhotoBtn").addEventListener("click", () => {
    currentTailorPhoto = "";
    photoInput.value = "";
    previewWrap.classList.add("hidden");
  });

  const form = document.getElementById("orderForm");
  const dateInput = document.getElementById("deliveryDate");
  const dt = new Date();
  dt.setDate(dt.getDate() + 5);
  dateInput.value = dt.toISOString().split("T")[0];

  ["stitchingCharge", "extraCharge", "advancePaid"].forEach((id) => {
    document.getElementById(id).addEventListener("input", computeTailorTotals);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const totals = computeTailorTotals();
    const order = {
      id: "MBH-" + String(Date.now()).slice(-6),
      createdAt: new Date().toISOString(),
      customerName: document.getElementById("customerName").value.trim(),
      customerPhone: document.getElementById("customerPhone").value.trim(),
      garmentType: document.getElementById("garmentType").value,
      deliveryDate: document.getElementById("deliveryDate").value,
      status: document.getElementById("orderStatus").value,
      measurements: {
        length: document.getElementById("mLength").value,
        chest: document.getElementById("mChest").value,
        waist: document.getElementById("mWaist").value,
        hip: document.getElementById("mHip").value,
        shoulder: document.getElementById("mShoulder").value,
        sleeve: document.getElementById("mSleeve").value,
        frontNeck: document.getElementById("mFrontNeck").value,
        backNeck: document.getElementById("mBackNeck").value
      },
      notes: document.getElementById("stitchNotes").value.trim(),
      photoDataUrl: currentTailorPhoto,
      billing: totals
    };

    const list = loadTailorOrders();
    list.unshift(order);
    saveTailorOrders(list);

    form.reset();
    dateInput.value = dt.toISOString().split("T")[0];
    currentTailorPhoto = "";
    previewWrap.classList.add("hidden");
    computeTailorTotals();

    openTailorBillModal(order);
  });
}

function formatMeasurementsText(m) {
  const pairs = [
    ["Length", m.length],
    ["Chest", m.chest],
    ["Waist", m.waist],
    ["Hip", m.hip],
    ["Shoulder", m.shoulder],
    ["Sleeve", m.sleeve],
    ["Front Neck", m.frontNeck],
    ["Back Neck", m.backNeck]
  ].filter(([, val]) => val !== "" && val !== undefined);
  return pairs.length ? pairs.map(([k, v]) => `${k}: ${v}"`).join(" | ") : "No measurements entered";
}

function renderTailorOrders() {
  const container = document.getElementById("ordersContainer");
  const q = (document.getElementById("searchOrders").value || "").toLowerCase().trim();
  const st = document.getElementById("filterStatus").value;

  const filtered = loadTailorOrders().filter((o) => {
    const matchSt = st === "ALL" || o.status === st;
    const matchQ =
      !q ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      o.id.toLowerCase().includes(q);
    return matchSt && matchQ;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="card"><p class="muted">No tailoring orders recorded yet.</p></div>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (o) => `
      <article class="order-card">
        <div>
          <div class="order-top">
            <div>
              <strong>${escapeHtml(o.customerName)}</strong>
              <div class="muted small-text">${escapeHtml(o.id)} • ${escapeHtml(o.garmentType)}</div>
            </div>
            <span class="badge ${o.status === "Delivered" ? "delivered" : o.status === "Ready for Delivery" ? "ready" : ""}">${escapeHtml(o.status)}</span>
          </div>
          ${o.photoDataUrl ? `<img class="order-thumb" src="${o.photoDataUrl}" alt="Fabric photo" />` : ""}
          <div class="order-meta" style="margin-top:0.55rem;">
            <div>Phone: <strong>${escapeHtml(o.customerPhone)}</strong> | Delivery: <strong>${escapeHtml(o.deliveryDate)}</strong></div>
            <div>Total: <strong>${formatINR(o.billing.total)}</strong> | Balance: <strong>${formatINR(o.billing.balance)}</strong></div>
            <div class="small-text" style="margin-top:0.25rem;">${escapeHtml(formatMeasurementsText(o.measurements))}</div>
          </div>
        </div>
        <div class="order-actions">
          <select class="tailor-st-sel" data-id="${o.id}" style="width:auto;padding:0.35rem 0.5rem;font-size:0.82rem;">
            ${["Measurement Taken", "Cutting", "Stitching", "Ready for Delivery", "Delivered"]
              .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
          <button type="button" class="btn btn-small btn-primary open-tailor-bill" data-id="${o.id}">Bill &amp; QR</button>
          <a class="btn btn-small btn-whatsapp" target="_blank" rel="noopener noreferrer" href="${buildTailorWhatsAppLink(o)}">WhatsApp</a>
        </div>
      </article>
    `
    )
    .join("");

  container.querySelectorAll(".tailor-st-sel").forEach((sel) => {
    sel.addEventListener("change", () => {
      const list = loadTailorOrders();
      const target = list.find((x) => x.id === sel.dataset.id);
      if (target) {
        target.status = sel.value;
        saveTailorOrders(list);
        renderTailorOrders();
      }
    });
  });

  container.querySelectorAll(".open-tailor-bill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = loadTailorOrders().find((x) => x.id === btn.dataset.id);
      if (order) openTailorBillModal(order);
    });
  });
}

function buildTailorWhatsAppLink(order) {
  const settings = loadSettings();
  const payAmount = order.billing.balance > 0 ? order.billing.balance : order.billing.total;
  const upiLink = buildUpiUri(payAmount, `${settings.boutiqueName} ${order.id}`);
  const msg = [
    `Namaste ${order.customerName},`,
    `Tailoring Update from *${settings.boutiqueName}*`,
    `*Order ID:* ${order.id} (${order.garmentType})`,
    `*Status:* ${order.status}`,
    `*Delivery Date:* ${order.deliveryDate}`,
    `*Total:* ${formatINR(order.billing.total)} | *Advance:* ${formatINR(order.billing.advance)} | *Balance:* ${formatINR(order.billing.balance)}`,
    upiLink ? `\n*Pay Balance via UPI:* ${upiLink}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const digits = (order.customerPhone || "").replace(/\D/g, "");
  const phone = digits.length === 10 ? "91" + digits : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

function openTailorBillModal(order) {
  const settings = loadSettings();
  const modal = document.getElementById("billModal");
  const paper = document.getElementById("billPrintableArea");
  const waBtn = document.getElementById("whatsappShareBtn");
  const payAmount = order.billing.balance > 0 ? order.billing.balance : order.billing.total;
  const upiUri = buildUpiUri(payAmount, `${order.id} - ${order.customerName}`);

  paper.innerHTML = `
    <div class="bill-header">
      <h3 style="margin:0;">${escapeHtml(settings.boutiqueName)}</h3>
      <div class="small-text muted">${escapeHtml(settings.boutiqueLocation || "")}</div>
      <div class="small-text" style="margin-top:0.25rem;">Tailoring Order: <strong>${escapeHtml(order.id)}</strong> | Delivery: <strong>${escapeHtml(order.deliveryDate)}</strong></div>
    </div>
    <div class="small-text">
      <div><strong>Customer:</strong> ${escapeHtml(order.customerName)} (${escapeHtml(order.customerPhone)})</div>
      <div><strong>Garment:</strong> ${escapeHtml(order.garmentType)} | <strong>Status:</strong> ${escapeHtml(order.status)}</div>
      <div style="margin-top:0.25rem;"><strong>Measurements:</strong> ${escapeHtml(formatMeasurementsText(order.measurements))}</div>
    </div>
    <table class="bill-table">
      <thead><tr><th>Particulars</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Stitching Charge</td><td>${formatINR(order.billing.stitch)}</td></tr>
        <tr><td>Extra / Design / Material</td><td>${formatINR(order.billing.extra)}</td></tr>
        <tr><td><strong>Total Bill</strong></td><td><strong>${formatINR(order.billing.total)}</strong></td></tr>
        <tr><td>Advance Paid</td><td>-${formatINR(order.billing.advance)}</td></tr>
        <tr><td><strong>Balance Due</strong></td><td><strong>${formatINR(order.billing.balance)}</strong></td></tr>
      </tbody>
    </table>
    <div class="bill-qr-block">
      ${
        upiUri
          ? `<div class="small-text" style="margin-bottom:0.4rem;">Scan to Pay <strong>${formatINR(payAmount)}</strong> (${escapeHtml(settings.upiId)})</div><div id="modalQrTarget"></div>`
          : `<div class="small-text muted">Set your UPI ID in "UPI &amp; Delivery" tab to show Payment QR.</div>`
      }
    </div>
  `;

  if (upiUri) {
    new QRCode(document.getElementById("modalQrTarget"), { text: upiUri, width: 156 });
  }
  waBtn.href = buildTailorWhatsAppLink(order);
  modal.classList.remove("hidden");
}

/* ==================== SETTINGS & NAVIGATION ==================== */
function renderSettingsQr() {
  const vpa = document.getElementById("upiIdInput").value.trim();
  const pn = encodeURIComponent((document.getElementById("upiPayeeName").value || "Store").trim());
  const qrBox = document.getElementById("qrContainer");
  const uriText = document.getElementById("upiUriPreview");

  if (!vpa) {
    qrBox.innerHTML = `<span class="muted small-text">Enter UPI ID to preview QR</span>`;
    uriText.textContent = "";
    return;
  }
  const uri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${pn}&cu=INR`;
  new QRCode(qrBox, { text: uri, width: 176 });
  uriText.textContent = uri;
}

function initSettings() {
  const s = loadSettings();
  document.getElementById("boutiqueName").value = s.boutiqueName;
  document.getElementById("boutiqueLocation").value = s.boutiqueLocation;
  document.getElementById("sellerWhatsapp").value = s.sellerWhatsapp || "";
  document.getElementById("allowedPincodes").value = s.allowedPincodes || "";
  document.getElementById("deliveryCharge").value = s.deliveryCharge;
  document.getElementById("freeDeliveryAbove").value = s.freeDeliveryAbove;
  document.getElementById("upiIdInput").value = s.upiId;
  document.getElementById("upiPayeeName").value = s.upiPayeeName;
  document.getElementById("headerBrandTitle").textContent = s.boutiqueName;

  ["upiIdInput", "upiPayeeName"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderSettingsQr);
  });

  document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    const next = {
      boutiqueName: document.getElementById("boutiqueName").value.trim() || DEFAULT_SETTINGS.boutiqueName,
      boutiqueLocation: document.getElementById("boutiqueLocation").value.trim(),
      sellerWhatsapp: document.getElementById("sellerWhatsapp").value.trim(),
      allowedPincodes: document.getElementById("allowedPincodes").value.trim(),
      deliveryCharge: Number(document.getElementById("deliveryCharge").value) || 0,
      freeDeliveryAbove: Number(document.getElementById("freeDeliveryAbove").value) || 0,
      upiId: document.getElementById("upiIdInput").value.trim(),
      upiPayeeName: document.getElementById("upiPayeeName").value.trim() || DEFAULT_SETTINGS.upiPayeeName
    };
    writeJson(STORAGE_KEYS.SETTINGS, next);
    document.getElementById("headerBrandTitle").textContent = next.boutiqueName;
    renderSettingsQr();
    const msg = document.getElementById("settingsSavedMsg");
    msg.textContent = "Saved!";
    setTimeout(() => (msg.textContent = ""), 2500);
  });
}

function initNavigationAndModals() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      buttons.forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      panels.forEach((p) => p.classList.toggle("active", p.id === targetId));
      if (targetId === "store-front") renderStoreCatalog();
      if (targetId === "manage-products") renderAdminProducts();
      if (targetId === "store-orders") renderStoreOrders();
      if (targetId === "tailoring-list") renderTailorOrders();
      if (targetId === "upi-setup") renderSettingsQr();
    });
  });

  document.getElementById("cartToggleBtn").addEventListener("click", openCartModal);
  document.getElementById("closeCartBtn").addEventListener("click", () => {
    document.getElementById("cartModal").classList.add("hidden");
  });

  const billModal = document.getElementById("billModal");
  document.getElementById("closeModalBtn").addEventListener("click", () => billModal.classList.add("hidden"));
  billModal.addEventListener("click", (e) => {
    if (e.target === billModal) billModal.classList.add("hidden");
  });
  document.getElementById("printBillBtn").addEventListener("click", () => window.print());

  document.getElementById("storeSearch").addEventListener("input", renderStoreCatalog);
  document.getElementById("storeCategoryFilter").addEventListener("change", renderStoreCatalog);
  document.getElementById("searchStoreOrders").addEventListener("input", renderStoreOrders);
  document.getElementById("filterStoreOrderStatus").addEventListener("change", renderStoreOrders);
  document.getElementById("searchOrders").addEventListener("input", renderTailorOrders);
  document.getElementById("filterStatus").addEventListener("change", renderTailorOrders);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById("installBtn");
    installBtn.classList.remove("hidden");
    installBtn.addEventListener("click", async () => {
      installBtn.classList.add("hidden");
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initSettings();
  initNavigationAndModals();
  initProductManager();
  initCheckout();
  initTailoringModule();

  loadProducts();
  updateBadges();
  renderStoreCatalog();
  renderAdminProducts();
  renderStoreOrders();
  renderTailorOrders();
  renderSettingsQr();
});
