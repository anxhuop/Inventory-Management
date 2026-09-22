let products = [];
let dashboard = {};
let soldProducts = [];

const money = value => '₹' + Math.round(Number(value) || 0).toLocaleString('en-IN');
const status = product => product.stock <= product.threshold ? '<span class="pill low">Refill needed</span>' : '<span class="pill ok">In stock</span>';

async function api(path) {
  const response = await fetch('/api/' + path);
  if (!response.ok) throw new Error(`The ${path} report could not be loaded.`);
  return response.json();
}

function setText(id, value) {
  const element = document.querySelector('#' + id);
  if (element) element.textContent = value;
}

function render() {
  const { sales = 0, profit = 0, sold = 0, units = 0, investment = 0, remaining = 0 } = dashboard;
  const margin = sales ? Math.round(profit / sales * 100) : 0;
  setText('salesRevenue', money(sales));
  setText('grossProfit', money(profit));
  setText('margin', margin + '% profit margin');
  setText('inventorySummary', sold + ' / ' + units);
  setText('stockValueHome', money(investment));
  setText('remainingAmountHome', money(remaining));
  setText('salesRevenueReport', money(sales));
  setText('dailySales', money(sales / 30));
  setText('monthlySales', money(sales));
  setText('grossProfitReport', money(profit));
  setText('marginReport', margin + '% profit margin');
  setText('soldUnits', sold);
  setText('inventoryLeftReport', units);
  setText('stockValue', money(investment));
  setText('remainingAmount', money(remaining));

  document.querySelector('#profitBody').innerHTML = products.map(product => {
    const productMargin = product.price ? Math.round((product.price - product.cost) / product.price * 100) : 0;
    return `<tr><td class="product">${product.name}</td><td>${money(product.cost)}</td><td>${money(product.price)}</td><td><span class="pill ok">${productMargin}%</span></td></tr>`;
  }).join('');
  document.querySelector('#soldBody').innerHTML = soldProducts.map(product => `<tr><td class="product">${product.name}</td><td>${product.supplier}</td><td>${product.quantity} units</td><td>${money(product.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No sales recorded this month.</td></tr>';
  document.querySelector('#stockBody').innerHTML = products.map(product => `<tr><td class="product">${product.name}</td><td>${product.supplier}</td><td>${product.stock} units</td><td>${status(product)}</td></tr>`).join('');
  document.querySelector('#remainingBody').innerHTML = products.map(product => `<tr><td class="product">${product.name}</td><td>${product.stock} units</td><td>${money(product.price)}</td><td>${money(product.price * product.stock)}</td></tr>`).join('');
}

const pageMeta = { adminHome: ['Admin Dashboard', 'Business performance at a glance.'], salesPage: ['Sales Revenue', 'Monthly sales report and trend.'], profitPage: ['Gross Profit', 'Profitability by product.'], inventoryPage: ['Inventory', 'Products sold and current available stock.'], stockValuePage: ['Stock Value', 'Investment and remaining stock value.'] };
function showPage(id) {
  document.querySelectorAll('.admin-view').forEach(element => element.classList.toggle('active', element.id === id));
  document.querySelectorAll('.admin-nav').forEach(element => element.classList.toggle('active', element.dataset.adminView === id));
  if (id === 'inventoryPage') showInventoryReport('soldReport');
  if (id === 'stockValuePage') showStockReport('investmentReport');
  setText('adminTitle', pageMeta[id][0]);
  setText('adminSubtitle', pageMeta[id][1]);
}

async function unlock() {
  try {
    [products, dashboard, soldProducts] = await Promise.all([api('products'), api('dashboard'), api('sales/monthly')]);
    render();
    document.querySelector('#locked').classList.add('hidden');
    document.querySelector('#adminContent').classList.remove('hidden');
  } catch (error) {
    setText('loginError', 'Database connection error: ' + error.message);
  }
}

document.querySelector('#loginForm').onsubmit = event => {
  event.preventDefault();
  if (new FormData(event.target).get('pin') === '1234') unlock();
  else setText('loginError', 'Incorrect PIN. Please try again.');
};
document.querySelectorAll('.admin-nav').forEach(button => button.onclick = () => showPage(button.dataset.adminView));
document.querySelectorAll('[data-admin-go]').forEach(button => button.onclick = () => showPage(button.dataset.adminGo));
function showInventoryReport(id) {
  document.querySelectorAll('.inventory-report').forEach(element => element.classList.toggle('active', element.id === id));
  document.querySelectorAll('.inventory-tab').forEach(element => element.classList.toggle('active', element.dataset.inventoryTab === id));
}
document.querySelectorAll('.inventory-tab').forEach(button => button.onclick = () => showInventoryReport(button.dataset.inventoryTab));
function showStockReport(id) {
  document.querySelectorAll('.stock-report').forEach(element => element.classList.toggle('active', element.id === id));
  document.querySelectorAll('[data-stock-tab]').forEach(element => element.classList.toggle('active', element.dataset.stockTab === id));
}
document.querySelectorAll('[data-stock-tab]').forEach(button => button.onclick = () => showStockReport(button.dataset.stockTab));
