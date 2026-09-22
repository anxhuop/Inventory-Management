const seed = [
  {
    name: "Basmati Rice 5 kg",
    category: "Groceries",
    supplier: "Local Wholesale Market",
    cost: 420,
    price: 520,
    stock: 28,
    threshold: 8,
  },
  {
    name: "Sunflower Oil 1 L",
    category: "Cooking essentials",
    supplier: "Fresh Foods Distributors",
    cost: 118,
    price: 145,
    stock: 6,
    threshold: 10,
  },
  {
    name: "Bath Soap Pack",
    category: "Personal care",
    supplier: "Local Wholesale Market",
    cost: 92,
    price: 125,
    stock: 42,
    threshold: 10,
  },
  {
    name: "Green Tea 100 g",
    category: "Beverages",
    supplier: "Fresh Foods Distributors",
    cost: 145,
    price: 199,
    stock: 4,
    threshold: 6,
  },
];
let products =
    JSON.parse(
      localStorage.getItem("inventory-management-products") || "null",
    ) || seed,
  adminUnlocked = false;
const money = (n) => "₹" + Math.round(n).toLocaleString("en-IN"),
  status = (p) =>
    p.stock <= p.threshold
      ? '<span class="pill low">Refill needed</span>'
      : '<span class="pill ok">In stock</span>';
function render() {
  const low = products.filter((p) => p.stock <= p.threshold),
    value = products.reduce((s, p) => s + p.cost * p.stock, 0),
    units = products.reduce((s, p) => s + p.stock, 0),
    sales = products.reduce((s, p) => s + p.price * p.stock * 0.22, 0),
    profit = products.reduce((s, p) => (p.price - p.cost) * p.stock * 0.22, 0),
    sold = Math.round(products.reduce((s, p) => s + p.stock * 0.22, 0));
  document.querySelector("#totalProducts").textContent = products.length;
  document.querySelector("#inventoryValue").textContent = money(value);
  document.querySelector("#totalUnits").textContent = units;
  document.querySelector("#lowStock").textContent = low.length;
  document.querySelector("#lowBadge").textContent = low.length;
  document.querySelector("#orderBadge").textContent = low.length;
  document.querySelector("#stockHealth").textContent = low.length;
  document.querySelector("#salesRevenue").textContent = money(sales);
  document.querySelector("#grossProfit").textContent = money(profit);
  document.querySelector("#margin").textContent =
    (sales ? Math.round((profit / sales) * 100) : 0) + "% profit margin";
  document.querySelector("#soldUnits").textContent = sold;
  document.querySelector("#inventoryBody").innerHTML =
    products
      .map(
        (p, i) =>
          `<tr><td><span class="product">${p.name}</span></td><td class="category">${p.category}</td><td class="category">${p.supplier}</td><td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock} units ${status(p)}</td><td><button class="link" onclick="removeProduct(${i})">Remove</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="7" class="empty">No products found.</td></tr>';
  document.querySelector("#recentBody").innerHTML = products
    .slice(0, 4)
    .map(
      (p) =>
        `<tr><td><span class="product">${p.name}</span><br><span class="category">${p.category}</span></td><td>${p.stock} units</td><td>${money(p.price)}</td><td>${status(p)}</td></tr>`,
    )
    .join("");
  document.querySelector("#reorderBody").innerHTML =
    low
      .map(
        (p) =>
          `<tr><td class="product">${p.name}</td><td>${p.supplier}</td><td><b>${p.stock} units</b></td><td>${p.threshold} units</td><td>${Math.max(p.threshold * 3 - p.stock, p.threshold)} units</td><td><button class="link" onclick="alert('Add ${p.name} to your purchase order with ${p.supplier}.')">Order</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="6" class="empty">Excellent — no products need refilling right now.</td></tr>';
}
function save() {
  localStorage.setItem(
    "inventory-management-products",
    JSON.stringify(products),
  );
  render();
}
function removeProduct(i) {
  if (confirm("Remove this product from inventory?")) {
    products.splice(i, 1);
    save();
  }
}
const modal = document.querySelector("#modal"),
  loginModal = document.querySelector("#loginModal");
function openModal() {
  modal.classList.add("show");
}
function closeLogin() {
  loginModal.classList.remove("show");
  document.querySelector("#loginError").textContent = "";
}
document.querySelector("#addBtn").onclick = openModal;
document.querySelector("#addBtn2").onclick = openModal;
document.querySelector("#cancel").onclick = () =>
  modal.classList.remove("show");
modal.onclick = (e) => {
  if (e.target === modal) modal.classList.remove("show");
};
document.querySelector("#productForm").onsubmit = (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  ["stock", "cost", "price", "threshold"].forEach((k) => (d[k] = Number(d[k])));
  products.unshift(d);
  save();
  e.target.reset();
  modal.classList.remove("show");
};
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
document
  .querySelectorAll(".nav")
  .forEach((b) => (b.onclick = () => show(b.dataset.view)));
document
  .querySelectorAll("[data-go]")
  .forEach((b) => (b.onclick = () => show(b.dataset.go)));
document.querySelector("#supplierBtn").onclick = () =>
  alert("Supplier management can be connected to your customer database next.");
document.querySelector("#printOrder").onclick = () => window.print();
document.querySelector("#ownerLogin").onclick = () =>
  loginModal.classList.add("show");
document.querySelector("#loginCancel").onclick = closeLogin;
loginModal.onclick = (e) => {
  if (e.target === loginModal) closeLogin();
};
document.querySelector("#loginForm").onsubmit = (e) => {
  e.preventDefault();
  if (new FormData(e.target).get("pin") === "1234") {
    adminUnlocked = true;
    closeLogin();
    document.querySelector("#loginForm").reset();
    show("admin");
  } else
    document.querySelector("#loginError").textContent =
      "Incorrect PIN. Please try again.";
};
document.querySelector("#ownerLogout").onclick = () => {
  adminUnlocked = false;
  show("dashboard");
};
function show(id) {
  if (id === "admin" && !adminUnlocked) {
    document
      .querySelectorAll(".view")
      .forEach((x) => x.classList.toggle("active", x.id === "admin"));
    document.querySelector("#adminLock").classList.remove("hidden");
    document.querySelector("#adminContent").classList.add("hidden");
  } else {
    document
      .querySelectorAll(".view")
      .forEach((x) => x.classList.toggle("active", x.id === id));
    if (id === "admin") {
      document.querySelector("#adminLock").classList.add("hidden");
      document.querySelector("#adminContent").classList.remove("hidden");
    }
  }
  document
    .querySelectorAll(".nav")
    .forEach((x) => x.classList.toggle("active", x.dataset.view === id));
  document.querySelector("#title").textContent = {
    dashboard: "Good morning, Shop Owner",
    inventory: "Inventory",
    reorder: "Refill & Orders",
    admin: "Owner Admin",
    suppliers: "Suppliers",
    settings: "Settings",
  }[id];
  document.querySelector("#subtitle").textContent =
    id === "admin"
      ? "Private sales and profit information."
      : id === "reorder"
        ? "Prepare supplier orders before stock runs out."
        : id === "dashboard"
          ? "Your stock is organised and up to date."
          : "Manage your shop with confidence.";
  document.querySelector("#addBtn").style.visibility = [
    "inventory",
    "suppliers",
    "settings",
    "reorder",
    "admin",
  ].includes(id)
    ? "hidden"
    : "visible";
}
render();
