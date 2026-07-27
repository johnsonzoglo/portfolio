const cart=JSON.parse(localStorage.getItem('jz-market-cart')||'[]');
const form=document.querySelector('#checkoutForm');
const message=document.querySelector('#checkoutMessage');
const accountToken=localStorage.getItem('jz-account-token');
let products=[];
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const esc=value=>{const element=document.createElement('span');element.textContent=value;return element.innerHTML};
const price=product=>product.salePrice||product.price;

function render(){
  const rows=cart.map(item=>({...item,product:products.find(product=>product.id===item.id)})).filter(row=>row.product);
  document.querySelector('#summaryItems').innerHTML=rows.map(row=>`<div class="summary-item"><div><h3>${esc(row.product.name)}</h3><p>${row.variant?`${esc(row.variant)} · `:''}Quantity ${row.quantity}</p></div><strong>${money(price(row.product)*row.quantity)}</strong></div>`).join('');
  document.querySelector('#summaryCount').textContent=`${rows.reduce((sum,row)=>sum+row.quantity,0)} items`;
  document.querySelector('#summaryTotal').textContent=money(rows.reduce((sum,row)=>sum+price(row.product)*row.quantity,0));
  if(!rows.length){message.textContent='Your cart is empty.';form.querySelector('button').disabled=true}
}

form.addEventListener('submit',async event=>{
  event.preventDefault();message.textContent='';const button=form.querySelector('button');button.disabled=true;const data=new FormData(form);
  try{
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json',...(accountToken?{Authorization:`Bearer ${accountToken}`}:{})},body:JSON.stringify({customer:{name:data.get('name'),email:data.get('email'),phone:data.get('phone'),address:data.get('address'),note:data.get('note')},paymentMethod:data.get('paymentMethod'),deliveryZone:data.get('deliveryZone'),discountCode:data.get('discountCode'),items:cart.map(item=>({id:item.id,quantity:item.quantity,variant:item.variant||''}))})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    localStorage.removeItem('jz-market-cart');if(result.checkoutUrl){location.href=result.checkoutUrl;return}form.style.display='none';document.querySelector('#orderNumber').textContent=result.orderNumber;document.querySelector('#orderSuccess').classList.add('visible');
  }catch(error){message.textContent=error.message;button.disabled=false}
});

fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'checkout_start',path:location.pathname})}).catch(()=>{});
Promise.all([fetch('/api/products').then(response=>response.json()),fetch('/api/store-settings').then(response=>response.json())]).then(([productData,settings])=>{
  products=productData;
  if(!settings.payments?.stripe){document.querySelector('#stripePayment')?.remove();form.elements.paymentMethod.value='cash'}
  document.querySelector('#deliveryZone').innerHTML=settings.deliveryZones.map(zone=>`<option value="${esc(zone.id)}">${esc(zone.name)} — ${money(zone.fee)}</option>`).join('');
  render();if(accountToken)fetch('/api/account/me',{headers:{Authorization:`Bearer ${accountToken}`}}).then(response=>response.ok?response.json():null).then(account=>{if(!account)return;form.elements.name.value=account.customer.name||'';form.elements.email.value=account.customer.email||'';form.elements.phone.value=account.customer.phone||'';form.elements.address.value=account.customer.addresses?.[0]?.address||''}).catch(()=>{});
}).catch(()=>message.textContent='Could not load your order. Please return to the shop.');
