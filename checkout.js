const readCart=()=>{try{const value=JSON.parse(localStorage.getItem('jz-market-cart')||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
const cart=readCart();
const form=document.querySelector('#checkoutForm');
const message=document.querySelector('#checkoutMessage');
const submitButton=form.querySelector('[type="submit"]');
const accountToken=localStorage.getItem('jz-account-token');
let products=[];
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const esc=value=>{const element=document.createElement('span');element.textContent=value;return element.innerHTML};
const price=product=>product.salePrice||product.price;

function render(){
  const rows=cart.map(item=>({...item,product:products.find(product=>product.id===item.id)})).filter(row=>row.product);
  document.querySelector('#summaryItems').innerHTML=rows.length?rows.map(row=>{const image=(row.product.images||[])[0]||row.product.image;return `<div class="summary-item"><div class="summary-item-media">${image?`<img src="${esc(image)}" alt="">`:`<span>${esc(row.product.name.charAt(0))}</span>`}</div><div><h3>${esc(row.product.name)}</h3><p>${row.variant?`${esc(row.variant)} · `:''}Quantity ${row.quantity}</p></div><strong>${money(price(row.product)*row.quantity)}</strong></div>`}).join(''):'<div class="summary-empty"><div>Your bag is empty.<a href="shop.html">Return to the market →</a></div></div>';
  const itemCount=rows.reduce((sum,row)=>sum+row.quantity,0);
  document.querySelector('#summaryCount').textContent=`${itemCount} item${itemCount===1?'':'s'}`;
  document.querySelector('#summaryTotal').textContent=money(rows.reduce((sum,row)=>sum+price(row.product)*row.quantity,0));
  if(!rows.length){message.textContent='Your bag is empty. Add a product before continuing.';submitButton.disabled=true}
}

form.addEventListener('submit',async event=>{
  event.preventDefault();message.textContent='';message.classList.remove('success');submitButton.disabled=true;submitButton.classList.add('is-loading');form.setAttribute('aria-busy','true');const data=new FormData(form);
  try{
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json',...(accountToken?{Authorization:`Bearer ${accountToken}`}:{})},body:JSON.stringify({customer:{name:data.get('name'),email:data.get('email'),phone:data.get('phone'),address:data.get('address'),note:data.get('note')},paymentMethod:data.get('paymentMethod'),deliveryZone:data.get('deliveryZone'),discountCode:data.get('discountCode'),items:cart.map(item=>({id:item.id,quantity:item.quantity,variant:item.variant||''}))})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    localStorage.removeItem('jz-market-cart');if(result.checkoutUrl){location.href=result.checkoutUrl;return}form.style.display='none';document.querySelector('#orderNumber').textContent=result.orderNumber;document.querySelector('#orderSuccess').classList.add('visible');document.querySelector('#orderSuccess').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(error){message.textContent=error.message||'We could not place your order. Please try again.';submitButton.disabled=false}
  finally{submitButton.classList.remove('is-loading');form.removeAttribute('aria-busy')}
});

fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'checkout_start',path:location.pathname})}).catch(()=>{});
Promise.all([fetch('/api/products').then(response=>response.ok?response.json():Promise.reject()),fetch('/api/store-settings').then(response=>response.ok?response.json():Promise.reject())]).then(([productData,settings])=>{
  products=productData;
  if(!settings.payments?.stripe){document.querySelector('#stripePayment')?.remove();form.elements.paymentMethod.value='cash'}
  document.querySelector('#deliveryZone').innerHTML=settings.deliveryZones.map(zone=>`<option value="${esc(zone.id)}">${esc(zone.name)} — ${money(zone.fee)}</option>`).join('');
  render();if(accountToken)fetch('/api/account/me',{headers:{Authorization:`Bearer ${accountToken}`}}).then(response=>response.ok?response.json():null).then(account=>{if(!account)return;form.elements.name.value=account.customer.name||'';form.elements.email.value=account.customer.email||'';form.elements.phone.value=account.customer.phone||'';form.elements.address.value=account.customer.addresses?.[0]?.address||''}).catch(()=>{});
}).catch(()=>{document.querySelector('#summaryItems').innerHTML='<div class="summary-empty"><div>We could not load this order.<a href="shop.html">Return to the market →</a></div></div>';message.textContent='Could not load your order. Please return to the shop.';submitButton.disabled=true});

// Keep visitor support available during checkout without coupling it to checkout state.
import('./support-chat.js').catch(() => {});
