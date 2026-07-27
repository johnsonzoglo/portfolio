const grid=document.querySelector('#productGrid');
const filters=[...document.querySelectorAll('.filter')];
const drawer=document.querySelector('#cartDrawer');
const overlay=document.querySelector('#cartOverlay');
const cartItems=document.querySelector('#cartItems');
const cartEmpty=document.querySelector('#cartEmpty');
const cartCount=document.querySelector('#cartCount');
const cartTotal=document.querySelector('#cartTotal');
const checkoutLink=document.querySelector('#checkoutLink');
const searchInput=document.querySelector('#productSearch');
const sortInput=document.querySelector('#productSort');

let products=[];
let cart=JSON.parse(localStorage.getItem('jz-market-cart')||'[]').map(item=>({id:item.id,quantity:item.quantity||1}));
let currentFilter='all';

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const esc=value=>{const element=document.createElement('span');element.textContent=value;return element.innerHTML};

function art(product){
  if(product.image)return `<div class="product-art product-image"><img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy"></div>`;
  const type=product.art;
  if(type==='phone-apple'||type==='phone-galaxy')return `<div class="product-art phone-art ${type==='phone-galaxy'?'phone-galaxy':''}"><div class="market-device ${type==='phone-galaxy'?'square':''}"><i></i><b>${type==='phone-apple'?'PRO':'AI'}</b></div><span>${esc(product.condition)} / ready</span></div>`;
  if(type==='laptop'||type==='thinkpad')return `<div class="product-art market-laptop-art ${type==='thinkpad'?'dark-laptop':''}"><div class="product-laptop"><b>${type==='thinkpad'?'WORK / PLAY':'CREATE.'}</b></div><span>${esc(product.condition)} / ready</span></div>`;
  if(type==='game-fc'||type==='game-forza')return `<div class="product-art game-art ${type}"><div class="game-box"><small>JZ SELECT</small><b>${type==='game-fc'?'FC<br><i>26</i>':'FORZA<br><i>HORIZON 5</i>'}</b><span>READY TO PLAY</span></div></div>`;
  if(type==='car-sky'||type==='car-night')return `<div class="product-art market-car-art ${type}"><div class="product-car ${type==='car-night'?'luxury':''}"><i></i><b></b><b></b></div><span>${esc(product.condition)} / verified</span></div>`;
  if(type==='camera')return `<div class="product-art camera-art"><div class="camera-shape"><i></i><b>4K</b></div><span>create anywhere</span></div>`;
  if(type==='mic')return `<div class="product-art mic-art"><div class="mic-shape"><i></i></div><span>sound like a pro</span></div>`;
  return `<div class="product-art generic-art"><b>${esc(product.category)}</b><span>JZ Market</span></div>`;
}

function visibleProducts(){
  const query=searchInput.value.trim().toLowerCase();
  const visible=products.filter(product=>(currentFilter==='all'||product.category===currentFilter)&&(!query||[product.name,product.category,product.condition,product.description].some(value=>String(value||'').toLowerCase().includes(query))));
  if(sortInput.value==='price-low')visible.sort((a,b)=>a.price-b.price);
  if(sortInput.value==='price-high')visible.sort((a,b)=>b.price-a.price);
  if(sortInput.value==='name')visible.sort((a,b)=>a.name.localeCompare(b.name));
  return visible;
}

function renderProducts(){
  const visible=visibleProducts();
  document.querySelector('#resultCount').textContent=visible.length;
  if(!visible.length){
    grid.innerHTML=`<div class="catalog-empty"><div><strong>No finds match that search.</strong><p>Try another word or browse a different category.</p></div></div>`;
    return;
  }
  grid.innerHTML=visible.map(product=>`<article class="product" data-id="${esc(product.id)}">${art(product)}<div class="product-info"><div><p>${esc(product.category)} / ${esc(product.condition)}</p><h3>${esc(product.name)}</h3><small>${esc(product.description)}</small></div><strong>${money(product.price)}</strong></div><button class="add-cart" ${product.stock<1?'disabled':''}>${product.stock<1?'Sold out':product.category==='cars'?'Add to inquiry':'Add to bag'} <span>＋</span></button><p class="stock-note">${product.stock<1?'Unavailable':product.stock<3?`Only ${product.stock} left`:`${product.stock} available`}</p></article>`).join('');
}

function renderCart(){
  cart=cart.filter(item=>products.some(product=>product.id===item.id));
  const rows=cart.map(item=>({...item,product:products.find(product=>product.id===item.id)}));
  cartItems.innerHTML=rows.map(({product,quantity})=>`<div class="cart-item"><div><h3>${esc(product.name)}</h3><p>${money(product.price)} · ${product.stock} available</p><div class="qty"><button data-qty="-1" data-id="${esc(product.id)}" aria-label="Decrease quantity">−</button><span>${quantity}</span><button data-qty="1" data-id="${esc(product.id)}" aria-label="Increase quantity">＋</button></div></div><button data-remove="${esc(product.id)}">Remove</button></div>`).join('');
  cartCount.textContent=cart.reduce((sum,item)=>sum+item.quantity,0);
  cartTotal.textContent=money(rows.reduce((sum,row)=>sum+row.product.price*row.quantity,0));
  cartEmpty.classList.toggle('hidden',Boolean(cart.length));
  checkoutLink.href=cart.length?'checkout.html':'#';
  checkoutLink.classList.toggle('disabled',!cart.length);
  localStorage.setItem('jz-market-cart',JSON.stringify(cart));
}

function openCart(){drawer.classList.add('open');overlay.classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeCart(){drawer.classList.remove('open');overlay.classList.remove('open');drawer.setAttribute('aria-hidden','true');document.body.style.overflow=''}

filters.forEach(button=>button.addEventListener('click',()=>{
  currentFilter=button.dataset.filter;
  filters.forEach(item=>item.classList.toggle('active',item===button));
  renderProducts();
}));
searchInput.addEventListener('input',renderProducts);
sortInput.addEventListener('change',renderProducts);
grid.addEventListener('click',event=>{
  const button=event.target.closest('.add-cart');
  if(!button||button.disabled)return;
  const id=button.closest('.product').dataset.id;
  const product=products.find(item=>item.id===id);
  const item=cart.find(entry=>entry.id===id);
  if(item){if(item.quantity<product.stock)item.quantity++}else cart.push({id,quantity:1});
  renderCart();
  openCart();
});
cartItems.addEventListener('click',event=>{
  if(event.target.dataset.remove)cart=cart.filter(item=>item.id!==event.target.dataset.remove);
  const id=event.target.dataset.id;
  if(id){
    const item=cart.find(entry=>entry.id===id);
    const product=products.find(entry=>entry.id===id);
    item.quantity=Math.max(0,Math.min(product.stock,item.quantity+Number(event.target.dataset.qty)));
    if(!item.quantity)cart=cart.filter(entry=>entry.id!==id);
  }
  renderCart();
});
document.querySelector('#cartTrigger').addEventListener('click',openCart);
document.querySelector('#cartClose').addEventListener('click',closeCart);
document.querySelector('#cartContinue').addEventListener('click',closeCart);
overlay.addEventListener('click',closeCart);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCart()});
document.querySelector('#year').textContent=new Date().getFullYear();

const requested=new URLSearchParams(location.search).get('category');
if(filters.some(button=>button.dataset.filter===requested)){
  currentFilter=requested;
  filters.forEach(button=>button.classList.toggle('active',button.dataset.filter===requested));
}

fetch('/api/products')
  .then(response=>response.ok?response.json():Promise.reject())
  .then(data=>{products=data;renderProducts();renderCart()})
  .catch(()=>{grid.innerHTML='<p class="load-error">The collection could not load. Please refresh the page.</p>'});
