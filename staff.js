let products = [],
  salesHistory = [],
  cart = [],
  restockId = null;
const money = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"),
  set = (id, v) => {
    const e = document.querySelector("#" + id);
    if (e) e.textContent = v;
  },
  status = (p) =>
    p.stock <= p.threshold
      ? '<span class="pill low">Refill needed</span>'
      : '<span class="pill ok">In stock</span>';
async function api(path, options = {}) {
  const r = await fetch("/api/" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error || "Could not save data.");
  }
  return r.status === 204 ? null : r.json();
}
async function load() {
  [products, salesHistory] = await Promise.all([
    api("products"),
    api("sales/recent"),
  ]);
  render();
}
const product = () =>
    products.find(
      (p) => String(p.id) === document.querySelector("#saleProduct").value,
    ),
  cartQty = (id) => cart.find((i) => i.id === id)?.quantity || 0;
function render() {
  const low = products.filter((p) => p.stock <= p.threshold),
    select = document.querySelector("#saleProduct"),
    old = select.value;
  set("lowBadge", low.length);
  set("orderBadge", low.length);
  select.innerHTML =
    '<option value="">Select a product</option>' +
    products
      .filter((p) => p.stock > 0)
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
  if ([...select.options].some((o) => o.value === old)) select.value = old;
  document.querySelector("#inventoryBody").innerHTML = products
    .map(
      (p) =>
        `<tr><td class="product">${p.name}</td><td>${p.category}</td><td>${p.supplier}</td><td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock} units ${status(p)}</td><td><button class="link" onclick="openRestock(${p.id})">Restock</button><button class="link remove-link" onclick="removeProduct(${p.id})">Remove</button></td></tr>`,
    )
    .join("");
  document.querySelector("#reorderBody").innerHTML =
    low
      .map(
        (p) =>
          `<tr><td class="product">${p.name}</td><td>${p.supplier}</td><td>${p.stock} units</td><td>${p.threshold} units</td><td>${Math.max(p.threshold * 3 - p.stock, p.threshold)} units</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="empty">No products need refilling right now.</td></tr>';
  document.querySelector("#salesHistoryBody").innerHTML =
    salesHistory
      .map(
        (s) =>
          `<tr><td class="product">Sale #${s.id}</td><td>${s.item_count} product${s.item_count === 1 ? "" : "s"}</td><td>${s.quantity} units</td><td>${money(s.amount)}</td><td>${new Date(s.sold_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="empty">No sales have been recorded yet.</td></tr>';
  renderCart();
  productInfo();
}
function productInfo() {
  const p = product();
  set("salePrice", p ? money(p.price) : "₹0");
  set("saleAvailable", p ? `${p.stock - cartQty(p.id)} units` : "—");
}
function renderCart() {
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0),
    qty = cart.reduce((s, i) => s + i.quantity, 0);
  document.querySelector("#cartBody").innerHTML =
    cart
      .map(
        (i) =>
          `<tr><td class="product">${i.name}<br><span class="category">${money(i.price)} each</span></td><td>${i.quantity}</td><td>${money(i.price * i.quantity)}</td><td><button class="link" onclick="removeCartItem(${i.id})">Remove</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="4" class="empty">Add products to start this bill.</td></tr>';
  set(
    "cartCount",
    qty ? `${qty} item${qty === 1 ? "" : "s"} in bill` : "No products added",
  );
  set("saleTotal", money(total));
}
function message(text = "") {
  set("saleError", text);
}
function addToCart() {
  const p = product(),
    q = Number(document.querySelector("#saleQuantity").value);
  message();
  if (!p) return message("Please choose a product.");
  if (!Number.isInteger(q) || q < 1) return message("Enter a valid quantity.");
  if (q + cartQty(p.id) > p.stock)
    return message(`Only ${p.stock - cartQty(p.id)} more units are available.`);
  const item = cart.find((i) => i.id === p.id);
  item
    ? (item.quantity += q)
    : cart.push({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        quantity: q,
      });
  document.querySelector("#saleQuantity").value = 1;
  renderCart();
  productInfo();
}
function removeCartItem(id) {
  cart = cart.filter((i) => i.id !== id);
  renderCart();
  productInfo();
}
async function removeProduct(id) {
  if (confirm("Remove this product?"))
    try {
      await api("products/" + id, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e.message);
    }
}
async function recordSale(print) {
  message();
  if (!cart.length) return message("Add at least one product to the bill.");
  const bill = [...cart];
  try {
    const r = await api("sales/batch", {
      method: "POST",
      body: JSON.stringify({
        items: bill.map((i) => ({ productId: i.id, quantity: i.quantity })),
      }),
    });
    cart = [];
    await load();
    print
      ? showBill(bill, r.orderId)
      : message(`Sale #${r.orderId} recorded successfully.`);
  } catch (e) {
    message(e.message);
  }
}
function showBill(items, id) {
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  set("billNumber", "Sale #" + id);
  set("billDate", new Date().toLocaleString("en-IN"));
  document.querySelector("#billBody").innerHTML = items
    .map(
      (i) =>
        `<tr><td class="product">${i.name}</td><td>${i.quantity}</td><td>${money(i.price)}</td><td>${money(i.price * i.quantity)}</td></tr>`,
    )
    .join("");
  set("billTotal", money(total));
  document.querySelector("#billModal").classList.add("show");
}
const restockModal = document.createElement("div");
restockModal.className = "modal";
restockModal.id = "restockModal";
restockModal.innerHTML =
  '<div class="modalbox"><h2>Restock product</h2><p id="restockProduct" class="category"></p><form id="restockForm" class="form"><label>Quantity to add<input required name="quantity" type="number" min="1" value="1"></label><label>New cost price (optional)<input name="cost" type="number" min="0" step="0.01"></label><label class="full">New selling price (optional)<input name="price" type="number" min="0" step="0.01"></label><p class="category full">Leave a price blank to keep the existing price. Enter a higher cost if your supplier price increased.</p><div class="modalfoot full"><button type="button" class="cancel" id="cancelRestock">Cancel</button><button class="primary">Update stock</button></div></form></div>';
document.body.append(restockModal);
function openRestock(id) {
  const p = products.find((x) => x.id === id);
  restockId = id;
  set(
    "restockProduct",
    `${p.name} · Current stock: ${p.stock} · Current cost: ${money(p.cost)}`,
  );
  restockModal.classList.add("show");
}
document.querySelector("#cancelRestock").onclick = () =>
  restockModal.classList.remove("show");
document.querySelector("#restockForm").onsubmit = async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  try {
    await api(`products/${restockId}/restock`, {
      method: "PUT",
      body: JSON.stringify(d),
    });
    e.target.reset();
    restockModal.classList.remove("show");
    await load();
  } catch (err) {
    alert(err.message);
  }
};
const modal = document.querySelector("#modal"),
  record = document.createElement("button");
record.type = "button";
record.className = "primary record-sale-button";
record.textContent = "Record sale";
document.querySelector("#generateBill").after(record);
document.querySelector("#generateBill").textContent =
  "Generate bill & record sale";
record.onclick = () => recordSale(false);
document.querySelector("#generateBill").onclick = () => recordSale(true);
document.querySelector("#addToBill").onclick = addToCart;
document.querySelector("#clearCart").onclick = () => {
  cart = [];
  renderCart();
  productInfo();
};
document.querySelector("#saleProduct").onchange = productInfo;
document.querySelector("#addBtn").style.display = "none";
document.querySelector("#addBtn2").onclick = () => modal.classList.add("show");
document.querySelector("#cancel").onclick = () =>
  modal.classList.remove("show");
document.querySelector("#productForm").onsubmit = async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  ["stock", "cost", "price", "threshold"].forEach((k) => (d[k] = Number(d[k])));
  try {
    await api("products", { method: "POST", body: JSON.stringify(d) });
    await load();
    e.target.reset();
    modal.classList.remove("show");
  } catch (err) {
    alert(err.message);
  }
};
document.querySelector("#closeBill").onclick = () =>
  document.querySelector("#billModal").classList.remove("show");
document.querySelector("#printBill").onclick = () => window.print();
document.querySelector("#refreshSales").onclick = () =>
  load().catch((e) => alert(e.message));
document.querySelector("#search").oninput = (e) => {
  const q = e.target.value.toLowerCase();
  document
    .querySelectorAll("#inventoryBody tr")
    .forEach(
      (r) =>
        (r.style.display = r.textContent.toLowerCase().includes(q)
          ? ""
          : "none"),
    );
};
document.querySelector("#printOrder").onclick = () => window.print();
document
  .querySelectorAll(".nav")
  .forEach((b) => (b.onclick = () => show(b.dataset.view)));
function show(id) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === id));
  document
    .querySelectorAll(".nav")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === id));
  set(
    "title",
    {
      dashboard: "Sales & Billing",
      inventory: "Inventory",
      reorder: "Refill & Orders",
      suppliers: "Suppliers",
      settings: "Settings",
    }[id],
  );
  set(
    "subtitle",
    id === "dashboard"
      ? "Add multiple products and generate one customer bill."
      : "Track products and refill stock on time.",
  );
}
load().catch((e) =>
  alert(
    "Cannot connect to the database. Start the Node.js server first.\n\n" +
      e.message,
  ),
);
