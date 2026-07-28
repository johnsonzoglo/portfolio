const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const loginView=$('#loginView'),dashboard=$('#dashboard'),loginForm=$('#loginForm'),editor=$('#editor'),streamEditor=$('#streamEditor'),editorOverlay=$('#editorOverlay'),sidebar=$('#sidebar'),sidebarOverlay=$('#sidebarOverlay');
let token=sessionStorage.getItem('jz-admin-token')||'',products=[],orders=[],streams=[],siteContent={homepage:{},draft:{}},mediaItems=[],analytics={},selectedProducts=new Set(),activeView='overview';

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);
const esc=value=>{const node=document.createElement('span');node.textContent=String(value??'');return node.innerHTML};
const icons=()=>window.lucide?.createIcons();
const plural=(count,word)=>`${count} ${word}${count===1?'':'s'}`;
const date=value=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const fileData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});

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
  if(user){const displayName=user.name||user.username;$('#accountName').textContent=displayName;$('#accountAvatar').textContent=initials(displayName);$('#welcomeName').textContent=displayName.split(/\s+/)[0];$('#accountRole').textContent=user.role?`${user.role[0].toUpperCase()}${user.role.slice(1)}`:'Administrator'}
  const now=new Date(),hour=now.getHours();
  $('#dayPeriod').textContent=hour<12?'morning':hour<18?'afternoon':'evening';
  $('#currentDate').textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
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
  try{[products,orders,streams,siteContent,mediaItems,analytics]=await Promise.all([api('/api/admin/products'),api('/api/admin/orders'),api('/api/admin/streams'),api('/api/admin/site-content'),api('/api/admin/media'),api('/api/admin/analytics')]);renderAll()}
  catch(error){console.error(error)}finally{$('#refreshData').classList.remove('loading')}
}
function renderAll(){renderOverview();renderMedia();renderLibrary();renderProducts();renderStreams();renderOrders();renderAnalytics();$('#newOrders').textContent=orders.filter(order=>order.status==='new').length;icons()}

function setMediaPreview(slot,url){
  $(`#${slot}ImageUrl`).value=url||'';
  const preview=$(`#${slot}ImagePreview`),frame=preview.closest('.media-preview');
  preview.src=url||'';frame.classList.toggle('has-image',Boolean(url));
}
function renderMedia(){
  const homepage=siteContent.draft||siteContent.homepage||{};
  const fields={SiteTitle:'siteTitle',MetaDescription:'metaDescription',HeroEyebrow:'heroEyebrow',HeroIntro:'heroIntro',HeroPrimaryLabel:'heroPrimaryLabel',HeroSecondaryLabel:'heroSecondaryLabel',HeroSecondaryUrl:'heroSecondaryUrl',StudioTitle:'studioTitle',StudioDescription:'studioDescription',StudioCtaLabel:'studioCtaLabel',StudioCtaUrl:'studioCtaUrl',AcademyTitle:'academyTitle',AcademyDescription:'academyDescription',AcademyCtaLabel:'academyCtaLabel',AcademyCtaUrl:'academyCtaUrl',MarketTitle:'marketTitle',MarketDescription:'marketDescription',MarketCtaLabel:'marketCtaLabel',MarketCtaUrl:'marketCtaUrl',ContactTitle:'contactTitle'};
  Object.entries(fields).forEach(([id,key])=>{const input=$(`#content${id}`);if(input)input.value=homepage[key]||''});
  ['studio','academy','market'].forEach(slot=>{setMediaPreview(slot,homepage[`${slot}Image`]||'');$(`#${slot}ImageAlt`).value=homepage[`${slot}ImageAlt`]||''});
  updateContentPreview();
  $('#draftStatus').textContent=siteContent.updatedAt&&siteContent.updatedAt!==siteContent.publishedAt?'Draft saved':'Published';$('#draftStatus').classList.remove('unsaved');
}
async function uploadImage(file,altText=''){
  const data=await fileData(file);
  return (await api('/api/admin/upload',{method:'POST',body:JSON.stringify({data,name:file.name,altText})})).url;
}
async function uploadAcademyFile(file){
  const response=await fetch('/api/admin/academy-upload',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file}),result=await response.json().catch(()=>({}));
  if(response.status===401){signOut();throw new Error(result.error||'Your session expired.')}
  if(!response.ok)throw new Error(result.error||'The lesson file could not be uploaded.');
  return result.url;
}
function collectHomepageFromEditor(usePreviewImages=true){
  const homepage={siteTitle:$('#contentSiteTitle').value,metaDescription:$('#contentMetaDescription').value,heroEyebrow:$('#contentHeroEyebrow').value,heroIntro:$('#contentHeroIntro').value,heroPrimaryLabel:$('#contentHeroPrimaryLabel').value,heroSecondaryLabel:$('#contentHeroSecondaryLabel').value,heroSecondaryUrl:$('#contentHeroSecondaryUrl').value,studioTitle:$('#contentStudioTitle').value,studioDescription:$('#contentStudioDescription').value,studioCtaLabel:$('#contentStudioCtaLabel').value,studioCtaUrl:$('#contentStudioCtaUrl').value,academyTitle:$('#contentAcademyTitle').value,academyDescription:$('#contentAcademyDescription').value,academyCtaLabel:$('#contentAcademyCtaLabel').value,academyCtaUrl:$('#contentAcademyCtaUrl').value,marketTitle:$('#contentMarketTitle').value,marketDescription:$('#contentMarketDescription').value,marketCtaLabel:$('#contentMarketCtaLabel').value,marketCtaUrl:$('#contentMarketCtaUrl').value,contactTitle:$('#contentContactTitle').value};
  ['studio','academy','market'].forEach(slot=>{const preview=$(`#${slot}ImagePreview`);homepage[`${slot}Image`]=usePreviewImages&&preview.closest('.media-preview').classList.contains('has-image')?preview.src:$(`#${slot}ImageUrl`).value;homepage[`${slot}ImageAlt`]=$(`#${slot}ImageAlt`).value});
  return homepage;
}
function updateContentPreview(markDirty=false){
  const homepage=collectHomepageFromEditor();
  $('#searchPreviewTitle').textContent=homepage.siteTitle||'JZ — Creator, Academy & Market';
  $('#searchPreviewDescription').textContent=homepage.metaDescription||'A creative studio, practical academy, and considered marketplace.';
  $('#homepagePreview')?.contentWindow?.postMessage({type:'jz-editor-preview',homepage},location.origin);
  if(markDirty){$('#draftStatus').textContent='Unsaved changes';$('#draftStatus').classList.add('unsaved')}
}
const editorSections={
  hero:['Hero','Set the first message visitors see.'],
  studio:['Studio','Introduce your creative work and services.'],
  academy:['Academy','Present your courses and practical learning.'],
  market:['Market','Describe your products and marketplace.'],
  images:['Card images','Choose the visuals shown on the homepage.'],
  seo:['SEO & contact','Control search results and the contact message.']
};
function selectEditorSection(section,scrollPreview=true){
  if(!editorSections[section])return;
  $$('.editor-section-tab').forEach(button=>button.classList.toggle('active',button.dataset.editorSection===section));
  $$('.editor-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.editorPanel===section));
  $('#editorPanelTitle').textContent=editorSections[section][0];$('#editorPanelCopy').textContent=editorSections[section][1];
  if(scrollPreview)$('#homepagePreview')?.contentWindow?.postMessage({type:'jz-editor-scroll',section},location.origin);
}
function renderLibrary(){
  $('#mediaLibraryGrid').innerHTML=mediaItems.length?mediaItems.map(item=>`<article class="library-item" data-media-name="${esc(item.name)}"><div class="library-thumb">${item.type==='image'?`<img src="${esc(item.url)}" alt="${esc(item.altText)}">`:`<i data-lucide="${item.type==='document'?'file-text':'file'}"></i>`}</div><h3 title="${esc(item.name)}">${esc(item.name)}</h3><span>${(item.size/1048576).toFixed(1)} MB · ${esc(item.type)}</span><input class="library-alt" value="${esc(item.altText)}" placeholder="Description / alt text"><div class="library-use"><select aria-label="Reuse media"><option value="">Use on…</option><option value="studio">Homepage studio</option><option value="academy">Homepage academy</option><option value="market">Homepage market</option></select><button type="button" data-use-media="${esc(item.url)}">Use</button></div><div class="library-actions"><button type="button" data-copy-media>Copy URL</button><button type="button" data-rename-media>Rename / save</button><button class="danger" type="button" data-delete-media>Delete</button></div></article>`).join(''):emptyState('images','No media yet','Upload images or files to build your reusable library.');
}
function renderAnalytics(){
  $('#analyticsPageViews').textContent=analytics.pageViews||0;$('#analyticsProductViews').textContent=analytics.productViews||0;$('#analyticsCourseViews').textContent=analytics.courseViews||0;$('#analyticsCartAdds').textContent=analytics.cartAdds||0;$('#analyticsCheckoutStarts').textContent=analytics.checkoutStarts||0;
  $('#analyticsTopPages').innerHTML=(analytics.topPages||[]).length?analytics.topPages.map(item=>`<div class="event-row"><div><strong>${esc(item.page)}</strong><span>Public page</span></div><b>${item.views}</b></div>`).join(''):emptyState('chart-no-axes-combined','No page views yet','Traffic appears here as visitors use the site.');
  $('#analyticsRecent').innerHTML=(analytics.recent||[]).length?analytics.recent.map(item=>`<div class="event-row"><div><strong>${esc(String(item.type).replaceAll('_',' '))}</strong><span>${esc(item.label||item.path||'Site activity')}</span></div><b>${date(item.at)}</b></div>`).join(''):emptyState('activity','No activity yet','Recent product, course, cart, and checkout activity appears here.');
}

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
  $('#productsTable').innerHTML=visible.length?`<div class="table-row header product-table-head"><input class="table-select" id="selectAllProducts" type="checkbox" aria-label="Select all products"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Visibility</span><span></span></div>${visible.map(product=>`<div class="table-row product-table-row"><input class="table-select" data-select-product="${esc(product.id)}" type="checkbox" ${selectedProducts.has(product.id)?'checked':''} aria-label="Select ${esc(product.name)}"><div class="product-cell">${product.image?`<img class="product-thumb" src="${esc(product.image)}" alt="">`:`<span class="product-thumb">${esc(product.name[0]||'?')}</span>`}<div><h3>${esc(product.name)} ${product.featured?'<b class="feature-pill">Featured</b>':''}</h3><small>${esc(product.collection||product.condition)}</small></div></div><span>${esc(product.category)}</span><span><b class="regular-price ${product.salePrice?'on-sale':''}">${money(product.price)}</b>${product.salePrice?`<b class="sale-price">${money(product.salePrice)}</b>`:''}</span><span class="stock-value ${product.stock<3?'low':''}">${product.stock}</span><span class="visibility-pill ${product.active===false?'hidden':''}">${product.active===false?'Hidden':'Visible'}</span><div class="table-actions"><button class="icon-button" data-edit="${esc(product.id)}" title="Edit product" aria-label="Edit ${esc(product.name)}"><i data-lucide="pencil"></i></button><button class="icon-button danger" data-delete="${esc(product.id)}" title="Delete product" aria-label="Delete ${esc(product.name)}"><i data-lucide="trash-2"></i></button></div></div>`).join('')}`:emptyState('package-open','No products found',products.length?'Try a different search or filter.':'Your inventory is ready for its first product.');
  $('#selectedProductCount').textContent=`${selectedProducts.size} selected`;
  icons();
}

function filteredStreams(){
  const query=$('#streamSearch').value.trim().toLowerCase(),filter=$('#streamFilter').value;
  return streams.filter(stream=>(!query||[stream.title,stream.game,stream.description,stream.level].some(value=>String(value||'').toLowerCase().includes(query)))&&(filter==='all'||filter===stream.contentType||(filter==='published'&&stream.published!==false)||(filter==='draft'&&stream.published===false)||(filter==='featured'&&stream.featured)));
}
function renderStreams(){
  const visible=filteredStreams();$('#streamResultCount').textContent=plural(visible.length,'resource');
  const courseCount=streams.filter(stream=>stream.contentType==='course').length,lessonCount=streams.reduce((total,stream)=>total+(stream.contentType==='course'?(stream.modules||[]).reduce((sum,module)=>sum+(module.lessons||[]).length,0):1),0);
  $('#academyCourseCount').textContent=courseCount;$('#academyLessonCount').textContent=lessonCount;$('#academyPaidCount').textContent=streams.filter(stream=>stream.accessType==='paid').length;
  $('#streamsTable').innerHTML=visible.length?`<div class="stream-row header"><span>Resource and actions</span><span>Type</span><span>Level</span><span>Status</span><span>Access</span></div>${visible.map(stream=>{const lessons=stream.contentType==='course'?(stream.modules||[]).reduce((sum,module)=>sum+(module.lessons||[]).length,0):1;return `<div class="stream-row"><div class="stream-cell">${stream.src?`<video class="stream-preview" src="${esc(stream.src)}" ${stream.coverImage?`poster="${esc(stream.coverImage)}"`:''} preload="metadata" muted></video>`:stream.coverImage?`<img class="stream-preview" src="${esc(stream.coverImage)}" alt="">`:`<span class="stream-preview stream-fallback"><i data-lucide="${stream.contentType==='course'?'book-open':'play'}"></i></span>`}<div class="stream-info"><h3>${esc(stream.title)}</h3><small>${esc(stream.game)} · ${plural(lessons,'lesson')}</small><div class="stream-inline-actions"><button class="course-edit-button" data-edit-stream="${esc(stream.id)}" type="button"><i data-lucide="pencil"></i><span>Edit course</span></button><button class="stream-delete-button" data-delete-stream="${esc(stream.id)}" type="button" aria-label="Delete ${esc(stream.title)}"><i data-lucide="trash-2"></i></button></div></div></div><span>${stream.contentType==='course'?'Course':'Video lesson'}</span><span>${esc(stream.level||'All levels')}</span><span class="visibility-pill ${stream.published===false?'hidden':''}">${stream.published===false?'Draft':stream.publishAt&&new Date(stream.publishAt)>new Date()?'Scheduled':'Published'}</span><span>${stream.accessType==='paid'?`<b class="feature-pill">Paid · ${money(stream.price)}</b>`:stream.featured?'<b class="feature-pill">Free · Featured</b>':'Free'}</span></div>`}).join('')}`:emptyState('graduation-cap','No academy content found',streams.length?'Try a different search or filter.':'Add your first course or video lesson.');
  icons();
}

function filteredOrders(){
  const query=$('#orderSearch').value.trim().toLowerCase(),filter=$('#orderFilter').value;
  return orders.filter(order=>(!query||[order.number,order.customer.name,order.customer.email,order.customer.phone].some(value=>String(value).toLowerCase().includes(query)))&&(filter==='all'||order.status===filter));
}
function renderOrders(){
  const visible=filteredOrders();$('#orderResultCount').textContent=plural(visible.length,'order');
  $('#ordersList').innerHTML=visible.length?visible.map(order=>`<article class="order-card" data-order-id="${esc(order.id)}"><div class="order-summary"><div><strong>${esc(order.number)}</strong><span>${date(order.createdAt)}</span></div><div><strong>${esc(order.customer.name)}</strong><span>${esc(order.customer.email)}</span></div><strong>${money(order.total)}</strong><select data-status="${esc(order.id)}" aria-label="Status for ${esc(order.number)}">${['new','confirmed','processing','ready','completed','cancelled'].map(status=>`<option value="${status}" ${status===order.status?'selected':''}>${status[0].toUpperCase()+status.slice(1)}</option>`).join('')}</select><button class="icon-button" data-expand="${esc(order.id)}" title="View order" aria-label="View ${esc(order.number)}"><i data-lucide="chevron-down"></i></button></div><div class="order-details"><div><h4>Delivery</h4><p>${esc(order.customer.address)}<br>${esc(order.customer.phone)}</p><div class="communication-actions"><button type="button" data-contact="email">Email customer</button><button type="button" data-contact="whatsapp">WhatsApp</button></div></div><div><h4>Items</h4><p>${order.items.map(item=>`${item.quantity} × ${esc(item.name)}${item.variant?` · ${esc(item.variant)}`:''}`).join('<br>')}</p></div><div><h4>Payment</h4><p>${esc(order.paymentMethod)} · ${esc(order.paymentStatus)}${order.customer.note?`<br>${esc(order.customer.note)}`:''}</p><div class="communication-history"><small>Communication history</small>${(order.communications||[]).slice(0,4).map(entry=>`<div class="communication-entry">${esc(entry.channel)} · ${date(entry.at)} · ${esc(entry.template||'message')}</div>`).join('')||'<div class="communication-entry">No messages logged yet.</div>'}</div></div></div></article>`).join(''):emptyState('shopping-bag','No orders found',orders.length?'Try a different search or status.':'Customer orders will appear here.');
  icons();
}

const viewMeta={overview:['Overview','Business snapshot'],media:['Content & media','Public website editor'],products:['Products','Inventory management'],streams:['Academy','Courses and video lessons'],orders:['Orders','Order management'],analytics:['Analytics','Visitor and conversion activity']};
function setView(view){
  activeView=view;$$('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===view));$$('.app-view').forEach(panel=>panel.classList.toggle('active',panel.id===`${view}View`));
  $('#viewTitle').textContent=viewMeta[view][0];$('#viewEyebrow').textContent=viewMeta[view][1];$('#newProduct').hidden=view!=='products';$('#newStream').hidden=view!=='streams';closeSidebar();
}
$$('.nav-item').forEach(item=>item.addEventListener('click',()=>setView(item.dataset.view)));
document.addEventListener('click',event=>{const button=event.target.closest('[data-go-view]');if(button)setView(button.dataset.goView);const quickEdit=event.target.closest('[data-quick-edit]');if(quickEdit)openEditor(products.find(product=>product.id===quickEdit.dataset.quickEdit))});

function openEditor(product){
  closeStreamEditor();$('#editorTitle').textContent=product?'Edit product':'Add product';$('#productId').value=product?.id||'';$('#productName').value=product?.name||'';$('#productCategory').value=product?.category||'phones';$('#productPrice').value=product?.price??'';$('#productSalePrice').value=product?.salePrice||'';$('#productStock').value=product?.stock??0;$('#productCollection').value=product?.collection||'';$('#productVariants').value=(product?.variants||[]).join(', ');$('#productCondition').value=product?.condition||'new';$('#productDescription').value=product?.description||'';$('#productImage').value=product?.image||'';$('#productImages').value=JSON.stringify(product?.images||[]);$('#productActive').checked=product?.active!==false;$('#productFeatured').checked=Boolean(product?.featured);$('#productPhoto').value='';$('#productGallery').value='';$('#photoName').textContent=product?.image?'Keep current image or choose a replacement':'Choose product image';$('#galleryName').textContent=(product?.images||[]).length?`${product.images.length} current gallery images`:'Add gallery images';$('#editorMessage').textContent='';editor.classList.add('open');editorOverlay.classList.add('open');editor.setAttribute('aria-hidden','false');setTimeout(()=>$('#productName').focus(),200);
}
function closeEditor(){editor.classList.remove('open');editorOverlay.classList.remove('open');editor.setAttribute('aria-hidden','true')}
function renderModules(modules){
  const list=modules||[];
  $('#moduleList').innerHTML=list.map((module,moduleIndex)=>`<section class="course-module" data-module-index="${moduleIndex}" data-module-id="${esc(module.id||'')}"><div class="module-head"><div class="module-head-main"><span class="module-number">${String(moduleIndex+1).padStart(2,'0')}</span><input class="module-title" value="${esc(module.title||`Module ${moduleIndex+1}`)}" placeholder="Module title" aria-label="Module ${moduleIndex+1} title"><span class="module-lesson-count">${plural((module.lessons||[]).length,'lesson')}</span></div><div class="module-actions"><button type="button" data-module-move="-1" title="Move module up" aria-label="Move module up">↑</button><button type="button" data-module-move="1" title="Move module down" aria-label="Move module down">↓</button><button class="danger" type="button" data-remove-module title="Remove module" aria-label="Remove module">×</button></div></div><div class="lesson-list">${(module.lessons||[]).map((lesson,lessonIndex)=>lessonRow(lesson,lessonIndex)).join('')}</div><button class="add-lesson" type="button" data-add-lesson>+ Add lesson to ${esc(module.title||`Module ${moduleIndex+1}`)}</button></section>`).join('');
  $('#curriculumEmpty').hidden=Boolean(list.length);updateCurriculumStatus();icons();
}
function lessonRow(lesson={},index=0){return `<article class="lesson-row" data-lesson-id="${esc(lesson.id||'')}"><div class="lesson-row-head"><span class="lesson-index">${String(index+1).padStart(2,'0')}</span><input class="lesson-title" value="${esc(lesson.title||`Lesson ${index+1}`)}" placeholder="Lesson title" aria-label="Lesson ${index+1} title"><div class="lesson-actions"><button type="button" data-lesson-move="-1" title="Move lesson up" aria-label="Move lesson up">↑</button><button type="button" data-lesson-move="1" title="Move lesson down" aria-label="Move lesson down">↓</button><button class="danger" type="button" data-remove-lesson title="Remove lesson" aria-label="Remove lesson">×</button></div></div><div class="lesson-fields"><label>Duration<input class="lesson-duration" value="${esc(lesson.duration||'')}" placeholder="12 min"></label><label><span>Lesson video</span><div class="lesson-media-field"><input class="lesson-video" value="${esc(lesson.video||'')}" placeholder="Paste a video URL or upload"><label class="lesson-upload" title="Upload lesson video"><input class="lesson-video-file" type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime,.mov"><i data-lucide="upload"></i><span>Upload</span></label></div><small class="lesson-upload-state">${lesson.video?'Video attached':''}</small></label><label><span>Worksheet or download</span><div class="lesson-media-field"><input class="lesson-resource" value="${esc(lesson.resource||'')}" placeholder="Paste a file URL or upload"><label class="lesson-upload" title="Upload lesson resource"><input class="lesson-resource-file" type="file" accept="application/pdf,application/zip,.zip"><i data-lucide="paperclip"></i><span>Upload</span></label></div><small class="lesson-upload-state">${lesson.resource?'Resource attached':''}</small></label><label class="wide">Lesson description<textarea class="lesson-description" rows="3" placeholder="What will the student learn in this lesson?">${esc(lesson.description||'')}</textarea></label></div></article>`}
function collectModules(){return $$('.course-module').map(module=>({id:module.dataset.moduleId,title:module.querySelector('.module-title').value,lessons:[...module.querySelectorAll('.lesson-row')].map(lesson=>({id:lesson.dataset.lessonId,title:lesson.querySelector('.lesson-title').value,duration:lesson.querySelector('.lesson-duration').value,video:lesson.querySelector('.lesson-video').value,resource:lesson.querySelector('.lesson-resource').value,description:lesson.querySelector('.lesson-description').value}))}))}
function updateCurriculumStatus(){const modules=collectModules(),lessons=modules.reduce((sum,module)=>sum+module.lessons.length,0);$('#streamLessons').value=Math.max(1,lessons);$('#curriculumStatus').textContent=`${plural(modules.length,'module')} · ${plural(lessons,'lesson')}`;$('#streamEditorSummary').textContent=modules.length?`${plural(modules.length,'module')} with ${plural(lessons,'lesson')} ready to edit.`:'Set up the course and build its curriculum.'}
function openStreamEditor(stream){
  closeEditor();const isCourse=(stream?.contentType||'course')==='course';$('#streamEditorTitle').textContent=stream?`Edit ${stream.title}`:'Create a new course';$('#streamId').value=stream?.id||'';$('#streamSource').value=stream?.src||'';$('#streamTitle').value=stream?.title||'';$('#streamType').value=stream?.contentType||'course';$('#streamAccess').value=stream?.accessType||'free';$('#streamPrice').value=stream?.price||0;$('#streamPrice').disabled=$('#streamAccess').value!=='paid';$('#streamGame').value=stream?.game||'';$('#streamLevel').value=stream?.level||'Beginner';$('#streamDate').value=stream?.date||new Date().toISOString().slice(0,10);$('#streamPublishAt').value=stream?.publishAt?new Date(stream.publishAt).toISOString().slice(0,16):'';$('#streamDuration').value=stream?.duration||'';$('#streamLessons').value=stream?.lessons||1;$('#streamDescription').value=stream?.description||'';$('#streamCoverImage').value=stream?.coverImage||'';$('#streamCoverPhoto').value='';$('#streamCoverName').textContent=stream?.coverImage?'Replace current course cover':'Choose course cover image';$('#streamPublished').checked=stream?.published!==false;$('#streamFeatured').checked=Boolean(stream?.featured);$('#streamFile').value='';$('#streamFile').required=false;$('#streamUploadField').hidden=isCourse;$('#streamFileName').textContent=stream?.src?'Replace main video':'Choose main video';$('#streamSaveLabel').textContent=stream?'Save course changes':'Create course';const modules=isCourse?(stream?.modules?.length?stream.modules:[{title:'Getting started',lessons:[]}]):[];renderModules(modules);$('#courseBuilder').hidden=!isCourse;$('#streamPreviewLink').href=stream?`learn.html?id=${encodeURIComponent(stream.id)}`:'streams.html';$('#streamEditorMessage').textContent='';streamEditor.classList.add('open');editorOverlay.classList.add('open');streamEditor.setAttribute('aria-hidden','false');updateCurriculumStatus();setTimeout(()=>$('#streamTitle').focus(),200);
}
function closeStreamEditor(){streamEditor.classList.remove('open');editorOverlay.classList.remove('open');streamEditor.setAttribute('aria-hidden','true')}
$('#newProduct').addEventListener('click',()=>openEditor());$('#newStream').addEventListener('click',()=>openStreamEditor());$('#editorClose').addEventListener('click',closeEditor);$('#editorCancel').addEventListener('click',closeEditor);$('#streamEditorClose').addEventListener('click',closeStreamEditor);$('#streamEditorCancel').addEventListener('click',closeStreamEditor);editorOverlay.addEventListener('click',()=>{closeEditor();closeStreamEditor()});
function openSidebar(){sidebar.classList.add('open');sidebarOverlay.classList.add('open')}function closeSidebar(){sidebar.classList.remove('open');sidebarOverlay.classList.remove('open')}
$('#mobileMenu').addEventListener('click',openSidebar);sidebarOverlay.addEventListener('click',closeSidebar);
$('#refreshData').addEventListener('click',loadAll);$('#productSearch').addEventListener('input',renderProducts);$('#productFilter').addEventListener('change',renderProducts);$('#streamSearch').addEventListener('input',renderStreams);$('#streamFilter').addEventListener('change',renderStreams);$('#orderSearch').addEventListener('input',renderOrders);$('#orderFilter').addEventListener('change',renderOrders);
$$('.content-fields input,.content-fields textarea,.media-alt input').forEach(input=>input.addEventListener('input',()=>updateContentPreview(true)));
$$('.editor-section-tab').forEach(button=>button.addEventListener('click',()=>selectEditorSection(button.dataset.editorSection)));
$$('[data-preview-device]').forEach(button=>button.addEventListener('click',()=>{$$('[data-preview-device]').forEach(item=>item.classList.toggle('active',item===button));$('#previewFrameWrap').className=`preview-frame-wrap ${button.dataset.previewDevice}`}));
$('#homepagePreview').addEventListener('load',()=>setTimeout(()=>updateContentPreview(),80));
$('#previewRefresh').addEventListener('click',()=>{$('#homepagePreview').contentWindow.location.reload()});
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='jz-preview-select')selectEditorSection(event.data.section,false);if(event.data?.type==='jz-preview-ready')updateContentPreview()});
['studio','academy','market'].forEach(slot=>{
  $(`#${slot}ImageFile`).addEventListener('change',event=>{const file=event.target.files[0];if(file){const temporary=URL.createObjectURL(file);const preview=$(`#${slot}ImagePreview`);preview.src=temporary;preview.closest('.media-preview').classList.add('has-image');updateContentPreview(true)}});
});
$$('[data-remove-media]').forEach(button=>button.addEventListener('click',()=>{const slot=button.dataset.removeMedia;setMediaPreview(slot,'');$(`#${slot}ImageFile`).value='';updateContentPreview(true)}));
$('#pageMediaForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter,message=$('#mediaMessage'),mode=button.value||'publish';button.disabled=true;message.textContent=mode==='draft'?'Saving draft…':'Publishing homepage…';
  try{
    const homepage=collectHomepageFromEditor(false);
    for(const slot of ['studio','academy','market']){
      const file=$(`#${slot}ImageFile`).files[0];
      homepage[`${slot}ImageAlt`]=$(`#${slot}ImageAlt`).value;
      homepage[`${slot}Image`]=file?await uploadImage(file,homepage[`${slot}ImageAlt`]):$(`#${slot}ImageUrl`).value;
    }
    siteContent=await api('/api/admin/site-content',{method:'PUT',body:JSON.stringify({homepage,mode})});
    ['studio','academy','market'].forEach(slot=>$(`#${slot}ImageFile`).value='');
    mediaItems=await api('/api/admin/media');renderMedia();renderLibrary();message.textContent=mode==='draft'?'Draft saved. Review the preview, then publish when ready.':'Homepage published successfully.';
  }catch(error){message.textContent=error.message}finally{button.disabled=false}
});
$('#libraryUpload').addEventListener('change',async event=>{const files=[...event.target.files],message=$('#mediaMessage');try{message.textContent=`Uploading ${files.length} file${files.length===1?'':'s'}…`;for(const file of files)await uploadImage(file);mediaItems=await api('/api/admin/media');renderLibrary();icons();message.textContent='Media library updated.'}catch(error){message.textContent=error.message}finally{event.target.value=''}});
$('#mediaLibraryGrid').addEventListener('click',async event=>{
  const card=event.target.closest('.library-item');if(!card)return;const name=card.dataset.mediaName,item=mediaItems.find(entry=>entry.name===name);
  if(event.target.closest('[data-use-media]')){const slot=card.querySelector('select').value;if(!slot)return;setMediaPreview(slot,item.url);$(`#${slot}ImageAlt`).value=card.querySelector('.library-alt').value||item.altText;updateContentPreview(true);selectEditorSection('images');$('#mediaMessage').textContent=`Selected for homepage ${slot}. Save a draft or publish to apply.`}
  if(event.target.closest('[data-copy-media]')){await navigator.clipboard.writeText(item.url);$('#mediaMessage').textContent='Media URL copied. Paste it into a course lesson video or resource field.'}
  if(event.target.closest('[data-rename-media]')){const requested=prompt('File name',name);if(requested===null)return;await api(`/api/admin/media/${encodeURIComponent(name)}`,{method:'PATCH',body:JSON.stringify({name:requested,altText:card.querySelector('.library-alt').value})});[mediaItems,siteContent]=await Promise.all([api('/api/admin/media'),api('/api/admin/site-content')]);renderMedia();renderLibrary();icons()}
  if(event.target.closest('[data-delete-media]')&&confirm(`Delete ${name}?`)){try{await api(`/api/admin/media/${encodeURIComponent(name)}`,{method:'DELETE'});mediaItems=await api('/api/admin/media');renderLibrary();icons()}catch(error){alert(error.message)}}
});

$('#productsTable').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-edit]'),remove=event.target.closest('[data-delete]');
  if(edit)openEditor(products.find(product=>product.id===edit.dataset.edit));
  if(remove&&confirm('Delete this product permanently?')){await api(`/api/admin/products/${remove.dataset.delete}`,{method:'DELETE'});products=await api('/api/admin/products');renderAll()}
});
$('#productsTable').addEventListener('change',event=>{if(event.target.id==='selectAllProducts'){filteredProducts().forEach(product=>event.target.checked?selectedProducts.add(product.id):selectedProducts.delete(product.id));renderProducts()}if(event.target.dataset.selectProduct){event.target.checked?selectedProducts.add(event.target.dataset.selectProduct):selectedProducts.delete(event.target.dataset.selectProduct);$('#selectedProductCount').textContent=`${selectedProducts.size} selected`}});
$('#bulkToolbar').addEventListener('click',async event=>{const action=event.target.dataset.bulkAction;if(!action||!selectedProducts.size)return;const payload={ids:[...selectedProducts]};if(action==='show')payload.active=true;if(action==='hide')payload.active=false;if(action==='feature')payload.featured=true;if(action==='unfeature')payload.featured=false;if(action==='stock'){const amount=Number(prompt('How many units should be added to each selected product?','1'));if(!Number.isFinite(amount))return;payload.stockDelta=amount}products=await api('/api/admin/products/bulk',{method:'POST',body:JSON.stringify(payload)});selectedProducts.clear();renderAll()});
$('#streamsTable').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-edit-stream]'),remove=event.target.closest('[data-delete-stream]');
  if(edit)openStreamEditor(streams.find(stream=>stream.id===edit.dataset.editStream));
  if(remove&&confirm('Delete this academy resource and its video file permanently?')){await api(`/api/admin/streams/${remove.dataset.deleteStream}`,{method:'DELETE'});streams=await api('/api/admin/streams');renderAll()}
});
$('#ordersList').addEventListener('click',async event=>{const button=event.target.closest('[data-expand]');if(button)button.closest('.order-card').classList.toggle('open');const contact=event.target.closest('[data-contact]');if(contact){const order=orders.find(item=>item.id===contact.closest('[data-order-id]').dataset.orderId),channel=contact.dataset.contact,defaultMessage=`Hello ${order.customer.name}, here is an update for order ${order.number}. Its current status is ${order.status}. The order total is ${money(order.total)}. Reply if you have any questions. — JZ Market`,message=prompt('Review your message before sending',defaultMessage),subject=`JZ Market order ${order.number}`;if(!message)return;if(channel==='email')window.open(`mailto:${encodeURIComponent(order.customer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,'_blank');else window.open(`https://wa.me/${String(order.customer.phone).replace(/\D/g,'')}?text=${encodeURIComponent(message)}`,'_blank');await api(`/api/admin/orders/${order.id}/communications`,{method:'POST',body:JSON.stringify({channel,template:'order status update',message})});orders=await api('/api/admin/orders');renderOrders()}});
$('#ordersList').addEventListener('change',async event=>{if(event.target.dataset.status){await api(`/api/admin/orders/${event.target.dataset.status}`,{method:'PATCH',body:JSON.stringify({status:event.target.value})});orders=await api('/api/admin/orders');renderAll()}});
$('#productPhoto').addEventListener('change',event=>{$('#photoName').textContent=event.target.files[0]?.name||'Choose product image'});
$('#productGallery').addEventListener('change',event=>{$('#galleryName').textContent=plural(event.target.files.length,'new image')});
$('#productForm').addEventListener('submit',async event=>{
  event.preventDefault();const message=$('#editorMessage'),button=event.submitter;message.textContent='';button.disabled=true;
  try{
    let image=$('#productImage').value,file=$('#productPhoto').files[0],images=JSON.parse($('#productImages').value||'[]');
    if(file)image=await uploadImage(file);
    for(const galleryFile of [...$('#productGallery').files])images.push(await uploadImage(galleryFile));
    if(image&&!images.includes(image))images.unshift(image);
    const id=$('#productId').value,payload={name:$('#productName').value,category:$('#productCategory').value,collection:$('#productCollection').value,price:Number($('#productPrice').value),salePrice:Number($('#productSalePrice').value)||0,stock:Number($('#productStock').value),variants:$('#productVariants').value,condition:$('#productCondition').value,description:$('#productDescription').value,image,images:images.slice(0,12),featured:$('#productFeatured').checked,active:$('#productActive').checked};
    await api(id?`/api/admin/products/${id}`:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(payload)});products=await api('/api/admin/products');renderAll();closeEditor();event.target.reset();
  }catch(error){message.textContent=error.message}finally{button.disabled=false}
});
$('#streamFile').addEventListener('change',event=>{$('#streamFileName').textContent=event.target.files[0]?.name||'Choose main video'});
$('#streamCoverPhoto').addEventListener('change',event=>{$('#streamCoverName').textContent=event.target.files[0]?.name||'Choose course cover image'});
$('#streamType').addEventListener('change',()=>{const isCourse=$('#streamType').value==='course';$('#courseBuilder').hidden=!isCourse;$('#streamUploadField').hidden=isCourse;if(isCourse&&!collectModules().length)renderModules([{title:'Getting started',lessons:[]}]);else updateCurriculumStatus()});
$('#streamAccess').addEventListener('change',()=>{$('#streamPrice').disabled=$('#streamAccess').value!=='paid';if($('#streamAccess').value==='free')$('#streamPrice').value=0});
$('#addModule').addEventListener('click',()=>{const modules=collectModules();modules.push({title:`Module ${modules.length+1}`,lessons:[]});renderModules(modules)});
$('#moduleList').addEventListener('click',event=>{const moduleElement=event.target.closest('.course-module');if(!moduleElement)return;let modules=collectModules(),index=Number(moduleElement.dataset.moduleIndex);if(event.target.closest('[data-add-lesson]'))modules[index].lessons.push({title:`Lesson ${modules[index].lessons.length+1}`});if(event.target.closest('[data-remove-module]')){if(!confirm(`Remove ${modules[index].title} and all of its lessons?`))return;modules.splice(index,1)}const lessonElement=event.target.closest('.lesson-row'),lessonIndex=lessonElement?[...moduleElement.querySelectorAll('.lesson-row')].indexOf(lessonElement):-1;if(event.target.closest('[data-remove-lesson]')){if(!confirm(`Remove ${modules[index].lessons[lessonIndex].title}?`))return;modules[index].lessons.splice(lessonIndex,1)}const moduleMove=event.target.closest('[data-module-move]');if(moduleMove){const next=index+Number(moduleMove.dataset.moduleMove);if(next>=0&&next<modules.length)[modules[index],modules[next]]=[modules[next],modules[index]]}const lessonMove=event.target.closest('[data-lesson-move]');if(lessonMove){const next=lessonIndex+Number(lessonMove.dataset.lessonMove);if(next>=0&&next<modules[index].lessons.length)[modules[index].lessons[lessonIndex],modules[index].lessons[next]]=[modules[index].lessons[next],modules[index].lessons[lessonIndex]]}renderModules(modules)});
$('#moduleList').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file||(!event.target.classList.contains('lesson-video-file')&&!event.target.classList.contains('lesson-resource-file')))return;const lesson=event.target.closest('.lesson-row'),upload=event.target.closest('.lesson-upload'),state=upload.parentElement.nextElementSibling,target=lesson.querySelector(event.target.classList.contains('lesson-video-file')?'.lesson-video':'.lesson-resource');upload.classList.add('uploading');state.textContent=`Uploading ${file.name}…`;try{target.value=await uploadAcademyFile(file);state.textContent=`Uploaded ${file.name}`;$('#streamEditorMessage').textContent='File uploaded. Save the course to attach it to this lesson.'}catch(error){state.textContent=error.message}finally{upload.classList.remove('uploading');event.target.value=''}});
$('#streamForm').addEventListener('submit',async event=>{
  event.preventDefault();const id=$('#streamId').value,file=$('#streamFile').files[0],coverFile=$('#streamCoverPhoto').files[0],message=$('#streamEditorMessage'),button=event.submitter,modules=collectModules(),lessonCount=modules.reduce((sum,module)=>sum+module.lessons.length,0),payload={title:$('#streamTitle').value,contentType:$('#streamType').value,accessType:$('#streamAccess').value,price:Number($('#streamPrice').value)||0,game:$('#streamGame').value,level:$('#streamLevel').value,date:$('#streamDate').value,publishAt:$('#streamPublishAt').value?new Date($('#streamPublishAt').value).toISOString():'',duration:$('#streamDuration').value,lessons:$('#streamType').value==='course'?Math.max(1,lessonCount):1,description:$('#streamDescription').value,coverImage:$('#streamCoverImage').value,src:$('#streamSource').value,modules,published:$('#streamPublished').checked,featured:$('#streamFeatured').checked};message.textContent='';if(payload.accessType==='paid'&&payload.price<=0){message.textContent='Set a price greater than zero for paid access.';return}if(payload.contentType==='course'&&payload.published&&!lessonCount){message.textContent='Add at least one lesson before publishing, or turn Published off to save this as a draft.';return}button.disabled=true;$('#streamUploadMeter').hidden=!file;
  try{
    if(coverFile)payload.coverImage=await uploadImage(coverFile);
    if(file)payload.src=await uploadAcademyFile(file);
    await api(id?`/api/admin/streams/${id}`:'/api/admin/academy-resources',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});
    streams=await api('/api/admin/streams');renderAll();closeStreamEditor();event.target.reset();
  }catch(error){message.textContent=error.message}finally{button.disabled=false;$('#streamUploadMeter').hidden=true}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeEditor();closeStreamEditor();closeSidebar()}});

icons();if(token)showDashboard();
