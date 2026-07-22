const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const loginView=$('#loginView'),dashboard=$('#dashboard'),loginForm=$('#loginForm'),editor=$('#editor'),streamEditor=$('#streamEditor'),editorOverlay=$('#editorOverlay'),sidebar=$('#sidebar'),sidebarOverlay=$('#sidebarOverlay');
let token=sessionStorage.getItem('jz-admin-token')||'',products=[],orders=[],streams=[],activeView='overview';

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);
const esc=value=>{const node=document.createElement('span');node.textContent=String(value??'');return node.innerHTML};
const icons=()=>window.lucide?.createIcons();
const plural=(count,word)=>`${count} ${word}${count===1?'':'s'}`;
const date=value=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});

async function api(url,options={}){
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}});
  const result=await response.json().catch(()=>({}));
  if(response.status===401){signOut();throw new Error(result.error||'Your session expired.')}
  if(!response.ok)throw new Error(result.error||'Request failed');
  return result;
}

function emptyState(icon,title,copy){return `<div class="empty-state"><div><i data-lucide="${icon}"></i><strong>${title}</strong><p>${copy}</p></div></div>`}
function initials(name){return String(name||'JZ').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}

function showDashboard(user){
  loginView.style.display='none';dashboard.classList.add('visible');
  if(user){$('#accountName').textContent=user.name||user.username;$('#accountAvatar').textContent=initials(user.name||user.username)}
  loadAll();
}
function signOut(){
  token='';sessionStorage.removeItem('jz-admin-token');dashboard.classList.remove('visible');loginView.style.display='grid';$('#password').value='';
}

loginForm.addEventListener('submit',async event=>{
  event.preventDefault();const message=$('#loginMessage'),button=loginForm.querySelector('button[type=submit]');message.textContent='';button.disabled=true;
  try{
    const result=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#username').value,password:$('#password').value})}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);return data});
    token=result.token;sessionStorage.setItem('jz-admin-token',token);showDashboard(result.user);
  }catch(error){message.textContent=error.message}finally{button.disabled=false}
});
$('#logout').addEventListener('click',signOut);

async function loadAll(){
  $('#refreshData').classList.add('loading');
  try{[products,orders,streams]=await Promise.all([api('/api/admin/products'),api('/api/admin/orders'),api('/api/admin/streams')]);renderAll()}
  catch(error){console.error(error)}finally{$('#refreshData').classList.remove('loading')}
}
function renderAll(){renderOverview();renderProducts();renderStreams();renderOrders();$('#newOrders').textContent=orders.filter(order=>order.status==='new').length;icons()}

function renderOverview(){
  const validOrders=orders.filter(order=>order.status!=='cancelled'),lowStock=products.filter(product=>product.stock<3);
  $('#overviewRevenue').textContent=money(validOrders.reduce((sum,order)=>sum+order.total,0));
  $('#overviewOpen').textContent=orders.filter(order=>!['completed','cancelled'].includes(order.status)).length;
  $('#overviewProducts').textContent=products.length;
  $('#overviewStock').textContent=`${products.reduce((sum,product)=>sum+product.stock,0)} units in stock`;
  $('#overviewLow').textContent=lowStock.length;
  $('#recentOrders').innerHTML=orders.length?orders.slice(0,5).map(order=>`<div class="compact-row"><div><strong>${esc(order.number)}</strong><span>${esc(order.customer.name)} · ${date(order.createdAt)}</span></div><div><span class="status-pill ${esc(order.status)}">${esc(order.status)}</span></div><b>${money(order.total)}</b></div>`).join(''):emptyState('receipt-text','No orders yet','New customer orders will appear here.');
  $('#stockAlerts').innerHTML=lowStock.length?lowStock.slice(0,5).map(product=>`<div class="compact-row"><div><strong>${esc(product.name)}</strong><span>${esc(product.category)}</span></div><div><span>${product.stock===0?'Out of stock':`${product.stock} remaining`}</span></div><button class="icon-button" data-quick-edit="${esc(product.id)}" title="Edit product" aria-label="Edit ${esc(product.name)}"><i data-lucide="pencil"></i></button></div>`).join(''):emptyState('circle-check','Inventory looks good','No products are currently below the stock threshold.');
}

function filteredProducts(){
  const query=$('#productSearch').value.trim().toLowerCase(),filter=$('#productFilter').value;
  return products.filter(product=>(!query||[product.name,product.category,product.condition].some(value=>String(value).toLowerCase().includes(query)))&&(filter==='all'||(filter==='visible'&&product.active!==false)||(filter==='hidden'&&product.active===false)||(filter==='low'&&product.stock<3)));
}
function renderProducts(){
  const visible=filteredProducts();$('#productResultCount').textContent=plural(visible.length,'product');
  $('#productsTable').innerHTML=visible.length?`<div class="table-row header"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Visibility</span><span></span></div>${visible.map(product=>`<div class="table-row"><div class="product-cell">${product.image?`<img class="product-thumb" src="${esc(product.image)}" alt="">`:`<span class="product-thumb">${esc(product.name[0]||'?')}</span>`}<div><h3>${esc(product.name)}</h3><small>${esc(product.condition)}</small></div></div><span>${esc(product.category)}</span><span>${money(product.price)}</span><span class="stock-value ${product.stock<3?'low':''}">${product.stock}</span><span class="visibility-pill ${product.active===false?'hidden':''}">${product.active===false?'Hidden':'Visible'}</span><div class="table-actions"><button class="icon-button" data-edit="${esc(product.id)}" title="Edit product" aria-label="Edit ${esc(product.name)}"><i data-lucide="pencil"></i></button><button class="icon-button danger" data-delete="${esc(product.id)}" title="Delete product" aria-label="Delete ${esc(product.name)}"><i data-lucide="trash-2"></i></button></div></div>`).join('')}`:emptyState('package-open','No products found',products.length?'Try a different search or filter.':'Your inventory is ready for its first product.');
  icons();
}

function filteredStreams(){
  const query=$('#streamSearch').value.trim().toLowerCase(),filter=$('#streamFilter').value;
  return streams.filter(stream=>(!query||[stream.title,stream.game].some(value=>String(value).toLowerCase().includes(query)))&&(filter==='all'||(filter==='published'&&stream.published!==false)||(filter==='draft'&&stream.published===false)||(filter==='featured'&&stream.featured)));
}
function renderStreams(){
  const visible=filteredStreams();$('#streamResultCount').textContent=plural(visible.length,'stream');
  $('#streamsTable').innerHTML=visible.length?`<div class="stream-row header"><span>Stream</span><span>Date</span><span>File size</span><span>Status</span><span>Placement</span><span></span></div>${visible.map(stream=>`<div class="stream-row"><div class="stream-cell"><video class="stream-preview" src="${esc(stream.src)}" preload="metadata" muted></video><div><h3>${esc(stream.title)}</h3><small>${esc(stream.game)}</small></div></div><span>${date(stream.date)}</span><span>${(Number(stream.size||0)/1048576).toFixed(1)} MB</span><span class="visibility-pill ${stream.published===false?'hidden':''}">${stream.published===false?'Draft':'Published'}</span><span>${stream.featured?'<b class="feature-pill">Featured</b>':'Standard'}</span><div class="table-actions"><button class="icon-button" data-edit-stream="${esc(stream.id)}" title="Edit stream" aria-label="Edit ${esc(stream.title)}"><i data-lucide="pencil"></i></button><button class="icon-button danger" data-delete-stream="${esc(stream.id)}" title="Delete stream" aria-label="Delete ${esc(stream.title)}"><i data-lucide="trash-2"></i></button></div></div>`).join('')}`:emptyState('clapperboard','No streams found',streams.length?'Try a different search or filter.':'Upload your first replay to the Stream Vault.');
  icons();
}

function filteredOrders(){
  const query=$('#orderSearch').value.trim().toLowerCase(),filter=$('#orderFilter').value;
  return orders.filter(order=>(!query||[order.number,order.customer.name,order.customer.email,order.customer.phone].some(value=>String(value).toLowerCase().includes(query)))&&(filter==='all'||order.status===filter));
}
function renderOrders(){
  const visible=filteredOrders();$('#orderResultCount').textContent=plural(visible.length,'order');
  $('#ordersList').innerHTML=visible.length?visible.map(order=>`<article class="order-card"><div class="order-summary"><div><strong>${esc(order.number)}</strong><span>${date(order.createdAt)}</span></div><div><strong>${esc(order.customer.name)}</strong><span>${esc(order.customer.email)}</span></div><strong>${money(order.total)}</strong><select data-status="${esc(order.id)}" aria-label="Status for ${esc(order.number)}">${['new','confirmed','processing','ready','completed','cancelled'].map(status=>`<option value="${status}" ${status===order.status?'selected':''}>${status[0].toUpperCase()+status.slice(1)}</option>`).join('')}</select><button class="icon-button" data-expand="${esc(order.id)}" title="View order" aria-label="View ${esc(order.number)}"><i data-lucide="chevron-down"></i></button></div><div class="order-details"><div><h4>Delivery</h4><p>${esc(order.customer.address)}<br>${esc(order.customer.phone)}</p></div><div><h4>Items</h4><p>${order.items.map(item=>`${item.quantity} × ${esc(item.name)}`).join('<br>')}</p></div><div><h4>Payment</h4><p>${esc(order.paymentMethod)} · ${esc(order.paymentStatus)}${order.customer.note?`<br>${esc(order.customer.note)}`:''}</p></div></div></article>`).join(''):emptyState('shopping-bag','No orders found',orders.length?'Try a different search or status.':'Customer orders will appear here.');
  icons();
}

const viewMeta={overview:['Overview','Business snapshot'],products:['Products','Inventory management'],streams:['Streams','Video library'],orders:['Orders','Order management']};
function setView(view){
  activeView=view;$$('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===view));$$('.app-view').forEach(panel=>panel.classList.toggle('active',panel.id===`${view}View`));
  $('#viewTitle').textContent=viewMeta[view][0];$('#viewEyebrow').textContent=viewMeta[view][1];$('#newProduct').hidden=['streams','orders'].includes(view);$('#newStream').hidden=view!=='streams';closeSidebar();
}
$$('.nav-item').forEach(item=>item.addEventListener('click',()=>setView(item.dataset.view)));
document.addEventListener('click',event=>{const button=event.target.closest('[data-go-view]');if(button)setView(button.dataset.goView);const quickEdit=event.target.closest('[data-quick-edit]');if(quickEdit)openEditor(products.find(product=>product.id===quickEdit.dataset.quickEdit))});

function openEditor(product){
  closeStreamEditor();$('#editorTitle').textContent=product?'Edit product':'Add product';$('#productId').value=product?.id||'';$('#productName').value=product?.name||'';$('#productCategory').value=product?.category||'phones';$('#productPrice').value=product?.price??'';$('#productStock').value=product?.stock??0;$('#productCondition').value=product?.condition||'new';$('#productDescription').value=product?.description||'';$('#productImage').value=product?.image||'';$('#productActive').checked=product?.active!==false;$('#productPhoto').value='';$('#photoName').textContent=product?.image?'Keep current image or choose a replacement':'Choose product image';$('#editorMessage').textContent='';editor.classList.add('open');editorOverlay.classList.add('open');editor.setAttribute('aria-hidden','false');setTimeout(()=>$('#productName').focus(),200);
}
function closeEditor(){editor.classList.remove('open');editorOverlay.classList.remove('open');editor.setAttribute('aria-hidden','true')}
function openStreamEditor(stream){
  closeEditor();$('#streamEditorTitle').textContent=stream?'Edit stream':'Upload stream';$('#streamId').value=stream?.id||'';$('#streamTitle').value=stream?.title||'';$('#streamGame').value=stream?.game||'';$('#streamDate').value=stream?.date||new Date().toISOString().slice(0,10);$('#streamPublished').checked=stream?.published!==false;$('#streamFeatured').checked=Boolean(stream?.featured);$('#streamFile').value='';$('#streamFile').required=!stream;$('#streamUploadField').hidden=Boolean(stream);$('#streamFileName').textContent='Choose replay video';$('#streamSaveLabel').textContent=stream?'Save changes':'Upload stream';$('#streamEditorMessage').textContent='';streamEditor.classList.add('open');editorOverlay.classList.add('open');streamEditor.setAttribute('aria-hidden','false');setTimeout(()=>$('#streamTitle').focus(),200);
}
function closeStreamEditor(){streamEditor.classList.remove('open');editorOverlay.classList.remove('open');streamEditor.setAttribute('aria-hidden','true')}
$('#newProduct').addEventListener('click',()=>openEditor());$('#newStream').addEventListener('click',()=>openStreamEditor());$('#editorClose').addEventListener('click',closeEditor);$('#editorCancel').addEventListener('click',closeEditor);$('#streamEditorClose').addEventListener('click',closeStreamEditor);$('#streamEditorCancel').addEventListener('click',closeStreamEditor);editorOverlay.addEventListener('click',()=>{closeEditor();closeStreamEditor()});
function openSidebar(){sidebar.classList.add('open');sidebarOverlay.classList.add('open')}function closeSidebar(){sidebar.classList.remove('open');sidebarOverlay.classList.remove('open')}
$('#mobileMenu').addEventListener('click',openSidebar);sidebarOverlay.addEventListener('click',closeSidebar);
$('#refreshData').addEventListener('click',loadAll);$('#productSearch').addEventListener('input',renderProducts);$('#productFilter').addEventListener('change',renderProducts);$('#streamSearch').addEventListener('input',renderStreams);$('#streamFilter').addEventListener('change',renderStreams);$('#orderSearch').addEventListener('input',renderOrders);$('#orderFilter').addEventListener('change',renderOrders);

$('#productsTable').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-edit]'),remove=event.target.closest('[data-delete]');
  if(edit)openEditor(products.find(product=>product.id===edit.dataset.edit));
  if(remove&&confirm('Delete this product permanently?')){await api(`/api/admin/products/${remove.dataset.delete}`,{method:'DELETE'});products=await api('/api/admin/products');renderAll()}
});
$('#streamsTable').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-edit-stream]'),remove=event.target.closest('[data-delete-stream]');
  if(edit)openStreamEditor(streams.find(stream=>stream.id===edit.dataset.editStream));
  if(remove&&confirm('Delete this replay and its video file permanently?')){await api(`/api/admin/streams/${remove.dataset.deleteStream}`,{method:'DELETE'});streams=await api('/api/admin/streams');renderAll()}
});
$('#ordersList').addEventListener('click',event=>{const button=event.target.closest('[data-expand]');if(button)button.closest('.order-card').classList.toggle('open')});
$('#ordersList').addEventListener('change',async event=>{if(event.target.dataset.status){await api(`/api/admin/orders/${event.target.dataset.status}`,{method:'PATCH',body:JSON.stringify({status:event.target.value})});orders=await api('/api/admin/orders');renderAll()}});
$('#productPhoto').addEventListener('change',event=>{$('#photoName').textContent=event.target.files[0]?.name||'Choose product image'});
$('#productForm').addEventListener('submit',async event=>{
  event.preventDefault();const message=$('#editorMessage'),button=event.submitter;message.textContent='';button.disabled=true;
  try{
    let image=$('#productImage').value,file=$('#productPhoto').files[0];
    if(file){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});image=(await api('/api/admin/upload',{method:'POST',body:JSON.stringify({data})})).url}
    const id=$('#productId').value,payload={name:$('#productName').value,category:$('#productCategory').value,price:Number($('#productPrice').value),stock:Number($('#productStock').value),condition:$('#productCondition').value,description:$('#productDescription').value,image,active:$('#productActive').checked};
    await api(id?`/api/admin/products/${id}`:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(payload)});products=await api('/api/admin/products');renderAll();closeEditor();event.target.reset();
  }catch(error){message.textContent=error.message}finally{button.disabled=false}
});
$('#streamFile').addEventListener('change',event=>{$('#streamFileName').textContent=event.target.files[0]?.name||'Choose replay video'});
$('#streamForm').addEventListener('submit',async event=>{
  event.preventDefault();const id=$('#streamId').value,file=$('#streamFile').files[0],message=$('#streamEditorMessage'),button=event.submitter,payload={title:$('#streamTitle').value,game:$('#streamGame').value,date:$('#streamDate').value,published:$('#streamPublished').checked,featured:$('#streamFeatured').checked};message.textContent='';button.disabled=true;$('#streamUploadMeter').hidden=Boolean(id);
  try{
    if(id)await api(`/api/admin/streams/${id}`,{method:'PATCH',body:JSON.stringify(payload)});
    else{
      if(!file)throw new Error('Choose a replay video.');
      const type=file.type||({mp4:'video/mp4',webm:'video/webm',ogg:'video/ogg',ogv:'video/ogg',mov:'video/quicktime'}[file.name.split('.').pop().toLowerCase()]);
      const params=new URLSearchParams({...payload,published:String(payload.published),featured:String(payload.featured)}),response=await fetch(`/api/admin/streams?${params}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':type||'application/octet-stream'},body:file}),result=await response.json().catch(()=>({}));if(response.status===401){signOut();throw new Error(result.error||'Your session expired.')}if(!response.ok)throw new Error(result.error||'Upload failed.');
    }
    streams=await api('/api/admin/streams');renderAll();closeStreamEditor();event.target.reset();
  }catch(error){message.textContent=error.message}finally{button.disabled=false;$('#streamUploadMeter').hidden=true}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeEditor();closeStreamEditor();closeSidebar()}});

icons();if(token)showDashboard();
