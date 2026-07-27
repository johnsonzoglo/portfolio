const academyGrid=document.querySelector('#replayGrid');
const emptyState=document.querySelector('#emptyVault');
const contentCount=document.querySelector('#streamCount');
const searchInput=document.querySelector('#academySearch');
const filterButtons=[...document.querySelectorAll('[data-filter]')];
let academyItems=[];
let activeFilter='all';

function escapeHtml(value){
  const element=document.createElement('span');
  element.textContent=String(value??'');
  return element.innerHTML;
}

function formatDate(value){
  if(!value)return 'New';
  return new Intl.DateTimeFormat('en',{year:'numeric',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`));
}

function itemType(item){
  return item.contentType==='course'?'course':'video';
}

function visibleItems(){
  const query=searchInput.value.trim().toLowerCase();
  return academyItems.filter(item=>(activeFilter==='all'||itemType(item)===activeFilter)&&(!query||[item.title,item.game,item.description,item.level].some(value=>String(value||'').toLowerCase().includes(query))));
}

function media(item){
  if(item.src)return `<video controls preload="metadata" playsinline src="${escapeHtml(item.src)}"></video>`;
  return `<div class="academy-placeholder"><small>JZ / ${itemType(item).toUpperCase()}</small><strong>${escapeHtml(item.game||'Learn by doing')}</strong><b>▶</b></div>`;
}

function renderAcademy(){
  const visible=visibleItems();
  academyGrid.innerHTML=visible.map(item=>`<article class="academy-card"><div class="academy-card-media">${media(item)}<div class="academy-card-badges"><span>${itemType(item)}</span>${item.featured?'<span class="featured">Featured</span>':''}</div></div><div class="academy-card-info"><div class="academy-card-meta"><span>${escapeHtml(item.game||'JZ Academy')}</span><span>${escapeHtml(item.level||'All levels')}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description||'A practical JZ Academy lesson designed to help you learn by building.')}</p><div class="academy-card-footer"><span>${itemType(item)==='course'?`${Number(item.lessons)||1} lessons`:'Video lesson'} · ${escapeHtml(item.duration||formatDate(item.date))}</span><span>${item.src?'Watch now →':'Coming soon'}</span></div></div></article>`).join('');
  emptyState.classList.toggle('hidden',visible.length>0);
}

filterButtons.forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;
  filterButtons.forEach(item=>item.classList.toggle('active',item===button));
  renderAcademy();
}));
searchInput.addEventListener('input',renderAcademy);
document.querySelectorAll('[data-path]').forEach(link=>link.addEventListener('click',()=>{
  searchInput.value=link.dataset.path;
  activeFilter='all';
  filterButtons.forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));
  setTimeout(renderAcademy,50);
}));
document.querySelector('#year').textContent=new Date().getFullYear();

fetch('/api/streams')
  .then(response=>response.ok?response.json():Promise.reject())
  .then(items=>{
    academyItems=items;
    contentCount.textContent=items.length;
    document.querySelector('#heroCourseCount').textContent=items.filter(item=>itemType(item)==='course').length;
    document.querySelector('#heroVideoCount').textContent=items.filter(item=>itemType(item)==='video').length;
    renderAcademy();
  })
  .catch(()=>{
    emptyState.classList.remove('hidden');
    emptyState.querySelector('h3').textContent='The academy is unavailable';
    emptyState.querySelector('p').textContent='Please check back shortly.';
  });
