const token = sessionStorage.getItem('jz-admin-token');
const id = new URLSearchParams(location.search).get('id');
const invoice = document.querySelector('#invoice');
if (!token) location.href = 'admin.html';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
const esc = (value) => {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
};

fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } })
  .then(async (response) => {
    const orders = await response.json();
    if (response.status === 401) {
      sessionStorage.removeItem('jz-admin-token');
      location.href = 'admin.html';
      return [];
    }
    if (!response.ok) throw new Error(orders.error || 'Could not load this invoice.');
    return orders;
  })
  .then((orders) => {
    const order = orders.find((item) => item.id === id);
    if (!order) throw new Error('Invoice not found.');
    document.title = `Invoice ${order.number} — JZ Market`;
    const customer = order.customer || {};
    invoice.innerHTML = `
      <header class="top">
        <div><div class="brand">JZ <span>MARKET</span></div><p>Invoice / order confirmation</p></div>
        <div class="meta"><b>${esc(order.number)}</b><p>${new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p><p>Status: ${esc(order.status)} · Payment: ${esc(order.paymentStatus)}</p></div>
      </header>
      <section class="customer"><b>Billed to</b>${esc(customer.name)}<br>${esc(customer.email)}${customer.phone ? ` · ${esc(customer.phone)}` : ''}${customer.address ? `<br>${esc(customer.address)}` : ''}</section>
      <section class="items">${order.items.map((item) => `<div class="row"><span>${Number(item.quantity) || 1} × ${esc(item.name)}${item.variant ? ` · ${esc(item.variant)}` : ''}</span><b>${money(item.subtotal)}</b></div>`).join('')}</section>
      <section class="totals">
        <div class="total"><span>Subtotal</span><b>${money(order.subtotal ?? order.total)}</b></div>
        ${order.discountAmount ? `<div class="total"><span>Discount${order.discountCode ? ` (${esc(order.discountCode)})` : ''}</span><b>−${money(order.discountAmount)}</b></div>` : ''}
        <div class="total"><span>Delivery</span><b>${money(order.deliveryFee || 0)}</b></div>
        ${order.tax ? `<div class="total"><span>Tax</span><b>${money(order.tax)}</b></div>` : ''}
        <div class="total grand"><span>Total</span><b>${money(order.total)}</b></div>
      </section>
      <footer class="invoice-footer"><span>Thank you for choosing JZ Market.</span><span>Personally supported · Quality checked</span></footer>`;
  })
  .catch((error) => {
    invoice.innerHTML = `<div class="invoice-loading"><div><strong>${esc(error.message)}</strong><p>Return to the admin dashboard and try again.</p></div></div>`;
  });
