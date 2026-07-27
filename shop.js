const grid=document.querySelector('#productGrid');
const drawer=document.querySelector('#cartDrawer');
const overlay=document.querySelector('#cartOverlay');
const cartItems=document.querySelector('#cartItems');
const cartEmpty=document.querySelector('#cartEmpty');
const cartCount=document.querySelector('#cartCount');
const cartTotal=document.querySelector('#cartTotal');
const checkoutLink=document.querySelector('#checkoutLink');
const searchInput=document.querySelector('#productSearch');
const sortInput=document.querySelector('#productSort');
const productModal=document.querySelector('#productModal');
const productModalContent=document.querySelector('#productModalContent');
const marketToast=document.querySelector('#marketToast');
const accountToken=localStorage.getItem('jz-account-token');

let products=[];
let reviews=[];
let filters=[];
let cart=JSON.parse(localStorage.getItem('jz-market-cart')||'[]').map(item=>({id:item.id,quantity:item.quantity||1,variant:item.variant||''}));
let savedProducts=JSON.parse(localStorage.getItem('jz-market-saved')||'[]');
let currentFilter='all';
let showSavedProducts=false;

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const esc=value=>{const element=document.createElement('span');element.textContent=String(value??'');return element.innerHTML};
const productRating=id=>{const items=reviews.filter(review=>review.targetType==='product'&&review.targetId===id);return items.length?{count:items.length,average:items.reduce((sum,item)=>sum+item.rating,0)/items.length}:null};

function productGallery(product){
  const gallery=(product.images||[]).filter(Boolean);
  if(product.image&&!gallery.includes(product.image))gallery.unshift(product.image);
  return gallery;
}

function art(product){
  const gallery=productGallery(product);
  if(gallery.length)return `<div class="product-art product-image">${gallery.slice(0,2).map((source,index)=>`<img class="${index?'secondary-product-image':''}" src="${esc(source)}" alt="${esc(product.name)}${index?' alternate view':''}" loading="lazy">`).join('')}${gallery.length>1?`<b class="gallery-count">${gallery.length} photos</b>`:''}</div>`;
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
  const visible=products.filter(product=>(currentFilter==='all'||product.category===currentFilter)&&(!showSavedProducts||savedProducts.includes(product.id))&&(!query||[product.name,product.category,product.collection,product.condition,product.description].some(value=>String(value||'').toLowerCase().includes(query))));
  if(sortInput.value==='featured')visible.sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
  if(sortInput.value==='price-low')visible.sort((a,b)=>(a.salePrice||a.price)-(b.salePrice||b.price));
  if(sortInput.value==='price-high')visible.sort((a,b)=>(b.salePrice||b.price)-(a.salePrice||a.price));
  if(sortInput.value==='name')visible.sort((a,b)=>a.name.localeCompare(b.name));
  return visible;
}

function renderProducts(){
  const visible=visibleProducts();
  const query=searchInput.value.trim();
  document.querySelector('#resultCount').textContent=visible.length;
  document.querySelector('#catalogSummary').textContent=showSavedProducts?`Showing ${visible.length} saved find${visible.length===1?'':'s'}`:query?`${visible.length} result${visible.length===1?'':'s'} for “${query}”`:currentFilter==='all'?'Showing the full collection':`Showing ${currentFilter}`;
  document.querySelector('#savedProductCount').textContent=savedProducts.length;
  document.querySelector('#savedProductsFilter').classList.toggle('active',showSavedProducts);
  if(!visible.length){
    grid.innerHTML=`<div class="catalog-empty"><div><strong>${showSavedProducts?'No saved items yet.':'No finds match that search.'}</strong><p>${showSavedProducts?'Tap the heart on a product to keep it here.':'Try another word or browse a different category.'}</p></div></div>`;
    return;
  }
  grid.innerHTML=visible.map(product=>{const rating=productRating(product.id);return `<article class="product" data-id="${esc(product.id)}"><div class="product-card-actions"><button class="save-product ${savedProducts.includes(product.id)?'saved':''}" type="button" aria-label="${savedProducts.includes(product.id)?'Remove from':'Save to'} favorites">${savedProducts.includes(product.id)?'♥':'♡'}</button><button class="quick-view" type="button">Quick view</button></div>${product.featured?'<span class="product-featured">JZ PICK</span>':''}${art(product)}<div class="product-info"><div><p>${esc(product.collection||product.category)} / ${esc(product.condition)}</p><h3>${esc(product.name)}</h3>${rating?`<span class="product-rating">★ ${rating.average.toFixed(1)} · ${rating.count} review${rating.count===1?'':'s'}</span>`:''}<small>${esc(product.description)}</small>${(product.variants||[]).length?`<label class="variant-select-label">Choose option<select class="variant-select">${product.variants.map(variant=>`<option value="${esc(variant)}">${esc(variant)}</option>`).join('')}</select></label>`:''}</div><strong>${product.salePrice?`<del>${money(product.price)}</del>${money(product.salePrice)}`:money(product.price)}</strong></div><button class="add-cart" ${product.stock<1?'disabled':''}>${product.stock<1?'Sold out':product.category==='cars'?'Add to inquiry':'Add to bag'} <span>＋</span></button><p class="stock-note">${product.stock<1?'Unavailable':product.stock<3?`Only ${product.stock} left`:`${product.stock} available`}</p></article>`}).join('');
}

function showToast(message){
  marketToast.textContent=message;marketToast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>marketToast.classList.remove('show'),2200);
}
function toggleSavedProduct(id){
  savedProducts=savedProducts.includes(id)?savedProducts.filter(item=>item!==id):[...savedProducts,id];
  localStorage.setItem('jz-market-saved',JSON.stringify(savedProducts));if(accountToken)fetch('/api/account/saved',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accountToken}`},body:JSON.stringify({products:savedProducts})}).catch(()=>{});renderProducts();showToast(savedProducts.includes(id)?'Saved to your collection':'Removed from saved');
}
function addProductToCart(product,variant=''){
  const item=cart.find(entry=>entry.id===product.id&&entry.variant===variant);
  if(item){if(item.quantity<product.stock)item.quantity++}else cart.push({id:product.id,quantity:1,variant});
  fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'add_to_cart',path:location.pathname,itemId:product.id,label:product.name})}).catch(()=>{});
  renderCart();showToast(`${product.name} added to your bag`);
}
function openProduct(product){
  if(!product)return;
  const gallery=productGallery(product);
  const rating=productRating(product.id);productModalContent.innerHTML=`<div class="product-modal-media">${gallery.length?`<img src="${esc(gallery[0])}" alt="${esc(product.name)}">`:art(product)}</div><div class="product-modal-copy"><p>${esc(product.collection||product.category)} · ${esc(product.condition)}</p><h2 id="productModalTitle">${esc(product.name)}</h2>${rating?`<div class="product-rating">★ ${rating.average.toFixed(1)} from ${rating.count} verified review${rating.count===1?'':'s'}</div>`:''}<div class="modal-price">${product.salePrice?`<del>${money(product.price)}</del><strong>${money(product.salePrice)}</strong>`:`<strong>${money(product.price)}</strong>`}</div><p class="modal-description">${esc(product.description||'A considered JZ Market find, quality checked and personally supported.')}</p><ul><li>Personally checked before handover</li><li>${product.stock>0?`${product.stock} currently available`:'Currently unavailable'}</li><li>Direct support from question to delivery</li></ul>${(product.variants||[]).length?`<label>Choose option<select id="modalVariant">${product.variants.map(variant=>`<option>${esc(variant)}</option>`).join('')}</select></label>`:''}<div class="modal-actions"><button class="modal-add-cart" type="button" data-modal-add="${esc(product.id)}" ${product.stock<1?'disabled':''}>${product.stock<1?'Sold out':product.category==='cars'?'Add to inquiry':'Add to bag'} <span>↗</span></button><button class="modal-save ${savedProducts.includes(product.id)?'saved':''}" type="button" data-modal-save="${esc(product.id)}">${savedProducts.includes(product.id)?'♥ Saved':'♡ Save item'}</button></div><small>Availability and delivery are personally confirmed before payment.</small></div>`;
  productModal.classList.add('open');productModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'product_view',path:location.pathname,itemId:product.id,label:product.name})}).catch(()=>{});
}
function closeProduct(){productModal.classList.remove('open');productModal.setAttribute('aria-hidden','true');document.body.style.overflow=''}

function renderCart(){
  cart=cart.filter(item=>products.some(product=>product.id===item.id));
  const rows=cart.map((item,index)=>({...item,index,product:products.find(product=>product.id===item.id)}));
  cartItems.innerHTML=rows.map(({product,quantity,variant,index})=>`<div class="cart-item">${productGallery(product)[0]?`<img src="${esc(productGallery(product)[0])}" alt="">`:`<span class="cart-item-fallback">${esc(product.name[0])}</span>`}<div><h3>${esc(product.name)}</h3><p>${money(product.salePrice||product.price)}${variant?` · ${esc(variant)}`:''} · ${product.stock} available</p><div class="qty"><button data-qty="-1" data-index="${index}" aria-label="Decrease quantity">−</button><span>${quantity}</span><button data-qty="1" data-index="${index}" aria-label="Increase quantity">＋</button></div></div><button data-remove-index="${index}">Remove</button></div>`).join('');
  cartCount.textContent=cart.reduce((sum,item)=>sum+item.quantity,0);
  cartTotal.textContent=money(rows.reduce((sum,row)=>sum+(row.product.salePrice||row.product.price)*row.quantity,0));
  cartEmpty.classList.toggle('hidden',Boolean(cart.length));checkoutLink.href=cart.length?'checkout.html':'#';checkoutLink.classList.toggle('disabled',!cart.length);
  localStorage.setItem('jz-market-cart',JSON.stringify(cart));
}
function openCart(){drawer.classList.add('open');overlay.classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeCart(){drawer.classList.remove('open');overlay.classList.remove('open');drawer.setAttribute('aria-hidden','true');document.body.style.overflow=''}

function setFilter(category){
  currentFilter=category;showSavedProducts=false;filters.forEach(button=>button.classList.toggle('active',button.dataset.filter===category));renderProducts();
}
searchInput.addEventListener('input',renderProducts);
sortInput.addEventListener('change',renderProducts);
document.querySelector('#clearProductFilters').addEventListener('click',()=>{searchInput.value='';sortInput.value='featured';setFilter('all')});
document.querySelector('#savedProductsFilter').addEventListener('click',()=>{showSavedProducts=!showSavedProducts;renderProducts()});
grid.addEventListener('click',event=>{
  const card=event.target.closest('.product');if(!card)return;
  const product=products.find(item=>item.id===card.dataset.id);
  if(event.target.closest('.save-product')){toggleSavedProduct(product.id);return}
  if(event.target.closest('.quick-view')||event.target.closest('.product-art')){openProduct(product);return}
  const button=event.target.closest('.add-cart');if(!button||button.disabled)return;
  addProductToCart(product,card.querySelector('.variant-select')?.value||'');openCart();
});
productModal.addEventListener('click',event=>{
  if(event.target.closest('[data-close-product]'))closeProduct();
  const add=event.target.closest('[data-modal-add]');if(add){const product=products.find(item=>item.id===add.dataset.modalAdd);addProductToCart(product,document.querySelector('#modalVariant')?.value||'');closeProduct();openCart()}
  const save=event.target.closest('[data-modal-save]');if(save){toggleSavedProduct(save.dataset.modalSave);openProduct(products.find(item=>item.id===save.dataset.modalSave))}
});
cartItems.addEventListener('click',event=>{
  if(event.target.dataset.removeIndex!==undefined)cart.splice(Number(event.target.dataset.removeIndex),1);
  const index=event.target.dataset.index;
  if(index!==undefined){const item=cart[Number(index)],product=products.find(entry=>entry.id===item.id);item.quantity=Math.max(0,Math.min(product.stock,item.quantity+Number(event.target.dataset.qty)));if(!item.quantity)cart.splice(Number(index),1)}
  renderCart();
});
document.querySelector('#cartTrigger').addEventListener('click',openCart);
document.querySelector('#cartClose').addEventListener('click',closeCart);
document.querySelector('#cartContinue').addEventListener('click',closeCart);
overlay.addEventListener('click',closeCart);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeCart();closeProduct()}});
document.querySelector('#year').textContent=new Date().getFullYear();

const requested=new URLSearchParams(location.search).get('category');
fetch('/api/products')
  .then(response=>response.ok?response.json():Promise.reject())
  .then(async data=>{
    products=data;
    reviews=await fetch('/api/reviews').then(response=>response.ok?response.json():[]).catch(()=>[]);
    if(accountToken){const response=await fetch('/api/account/me',{headers:{Authorization:`Bearer ${accountToken}`}}).catch(()=>null);if(response?.ok){const account=await response.json(),serverSaved=account.customer.savedProducts||[];savedProducts=[...new Set([...savedProducts,...serverSaved])];localStorage.setItem('jz-market-saved',JSON.stringify(savedProducts))}}
    const categories=[...new Set(products.map(product=>product.category).filter(Boolean))];
    const filterHost=document.querySelector('.filters');
    filterHost.innerHTML=`<button class="filter active" data-filter="all">All</button>${categories.map(category=>`<button class="filter" data-filter="${esc(category)}">${esc(category.replace(/(^|\s)\S/g,letter=>letter.toUpperCase()))}</button>`).join('')}`;
    filters=[...filterHost.querySelectorAll('.filter')];filters.forEach(button=>button.addEventListener('click',()=>setFilter(button.dataset.filter)));
    document.querySelector('#categoryRail').innerHTML=categories.slice(0,5).map((category,index)=>{const count=products.filter(product=>product.category===category).length;return `<button type="button" data-rail-category="${esc(category)}"><small>0${index+1} / ${count} finds</small><strong>${esc(category)}</strong><span>Explore ↗</span></button>`}).join('');
    document.querySelector('#categoryRail').addEventListener('click',event=>{const button=event.target.closest('[data-rail-category]');if(button){setFilter(button.dataset.railCategory);document.querySelector('#catalogSummary').scrollIntoView({behavior:'smooth',block:'center'})}});
    if(categories.includes(requested))setFilter(requested);else renderProducts();renderCart();
  })
  .catch(()=>{grid.innerHTML='<p class="load-error">The collection could not load. Please refresh the page.</p>'});
