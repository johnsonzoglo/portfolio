const crypto = require('crypto');

const appUrl = request => (process.env.APP_URL || `${request.headers['x-forwarded-proto'] || 'http'}://${request.headers.host || 'localhost:8002'}`).replace(/\/$/, '');
const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

async function createStripeCheckout({ request, order, currency = 'USD', successPath = 'account.html#orders', cancelPath = '' }) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const root = appUrl(request);
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${root}/${successPath}${successPath.includes('?') ? '&' : '?'}payment=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${root}/${cancelPath || successPath}${(cancelPath || successPath).includes('?') ? '&' : '?'}payment=cancelled`);
  form.set('customer_email', order.customer.email);
  form.set('client_reference_id', order.id);
  form.set('metadata[orderId]', order.id);
  form.set('metadata[orderNumber]', order.number);
  form.set('payment_intent_data[metadata][orderId]', order.id);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', String(currency).toLowerCase());
  form.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(order.total) * 100)));
  form.set('line_items[0][price_data][product_data][name]', order.orderType === 'academy' ? order.items[0].name : `JZ Market order ${order.number}`);
  form.set('line_items[0][price_data][product_data][description]', order.items.map(item => `${item.quantity} × ${item.name}`).join(', ').slice(0, 500));
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Card checkout could not be started.');
  return { id: result.id, url: result.url };
}

function verifyStripeEvent(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;
  const values = Object.fromEntries(String(signatureHeader).split(',').map(part => part.split('=')));
  const timestamp = Number(values.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !values.v1) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const received = Buffer.from(values.v1, 'hex');
  const calculated = Buffer.from(expected, 'hex');
  if (received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) return null;
  return JSON.parse(rawBody);
}

async function sendEmail({ to, subject, html }) {
  if (!emailEnabled() || !to) return { skipped: true };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) throw new Error('Transactional email delivery failed.');
  return response.json();
}

const emailShell = (title, copy, action = '') => `<div style="background:#0b0e0c;padding:36px;font-family:Arial,sans-serif;color:#f4f1e9"><div style="max-width:620px;margin:auto;border:1px solid #343a35;padding:34px"><div style="color:#c8ff2e;font-weight:900;font-size:24px">JZ</div><h1 style="font-size:30px">${title}</h1><p style="line-height:1.7;color:#c9cec9">${copy}</p>${action}</div></div>`;
const actionLink = (url, label) => `<p style="margin-top:28px"><a href="${url}" style="background:#c8ff2e;color:#0b0e0c;padding:14px 18px;text-decoration:none;font-weight:700">${label}</a></p>`;

module.exports = {
  appUrl,
  stripeEnabled,
  emailEnabled,
  createStripeCheckout,
  verifyStripeEvent,
  sendEmail,
  emailShell,
  actionLink
};
