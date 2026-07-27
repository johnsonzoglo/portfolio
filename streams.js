const academyGrid=document.querySelector('#replayGrid');
const emptyState=document.querySelector('#emptyVault');
const contentCount=document.querySelector('#streamCount');
const searchInput=document.querySelector('#academySearch');
const filterButtons=[...document.querySelectorAll('.academy-filters [data-filter]')];
const levelInput=document.querySelector('#academyLevel');
const lessonModal=document.querySelector('#lessonModal');
const lessonModalContent=document.querySelector('#lessonModalContent');
const academyToast=document.querySelector('#academyToast');
let academyItems=[];
let activeFilter='all';
let savedLearning=JSON.parse(localStorage.getItem('jz-academy-saved')||'[]');
let completedLearning=JSON.parse(localStorage.getItem('jz-academy-completed')||'[]');
let showSavedLearning=false;
let featuredItem=null;
const academyMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);

function escapeHtml(value){
  const element=document.createElement('span');element.textContent=String(value??'');return element.innerHTML;
}
function formatDate(value){
  if(!value)return 'New';
  return new Intl.DateTimeFormat('en',{year:'numeric',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`));
}
function itemType(item){return item.contentType==='course'?'course':'video'}
function visibleItems(){
  const query=searchInput.value.trim().toLowerCase(),level=levelInput.value;
  return academyItems.filter(item=>(activeFilter==='all'||itemType(item)===activeFilter)&&(level==='all'||item.level===level)&&(!showSavedLearning||savedLearning.includes(item.id))&&(!query||[item.title,item.game,item.description,item.level].some(value=>String(value||'').toLowerCase().includes(query))));
}
function cardMedia(item){
  if(item.coverImage)return `<img src="${escapeHtml(item.coverImage)}" alt="${escapeHtml(item.title)} cover" loading="lazy">`;
  return `<div class="academy-placeholder"><small>JZ / ${itemType(item).toUpperCase()}</small><strong>${escapeHtml(item.game||'Learn by doing')}</strong><b>▶</b></div>`;
}
function showAcademyToast(message){
  academyToast.textContent=message;academyToast.classList.add('show');clearTimeout(showAcademyToast.timer);showAcademyToast.timer=setTimeout(()=>academyToast.classList.remove('show'),2200);
}
function toggleSaved(id){
  savedLearning=savedLearning.includes(id)?savedLearning.filter(item=>item!==id):[...savedLearning,id];
  localStorage.setItem('jz-academy-saved',JSON.stringify(savedLearning));renderAcademy();showAcademyToast(savedLearning.includes(id)?'Saved to your learning list':'Removed from saved');
}
function toggleCompleted(id){
  completedLearning=completedLearning.includes(id)?completedLearning.filter(item=>item!==id):[...completedLearning,id];
  localStorage.setItem('jz-academy-completed',JSON.stringify(completedLearning));renderAcademy();
}
function renderAcademy(){
  const visible=visibleItems(),query=searchInput.value.trim();
  contentCount.textContent=visible.length;
  document.querySelector('#savedLearningCount').textContent=savedLearning.length;
  document.querySelector('#savedLearningFilter').classList.toggle('active',showSavedLearning);
  document.querySelector('#academySummary').textContent=showSavedLearning?`${visible.length} saved learning resource${visible.length===1?'':'s'}`:query?`${visible.length} result${visible.length===1?'':'s'} for “${query}”`:activeFilter==='all'&&levelInput.value==='all'?'Showing all learning':`${visible.length} matching resource${visible.length===1?'':'s'}`;
  academyGrid.innerHTML=visible.map(item=>`<article class="academy-card ${completedLearning.includes(item.id)?'completed':''}" data-academy-id="${escapeHtml(item.id)}"><div class="academy-card-media">${cardMedia(item)}<div class="academy-card-badges"><span>${itemType(item)}</span>${item.accessType==='paid'?`<span class="paid-badge">🔒 ${academyMoney(item.price)}</span>`:'<span class="free-badge">Free</span>'}${item.featured?'<span class="featured">Featured</span>':''}${completedLearning.includes(item.id)?'<span class="completed-badge">Completed</span>':''}</div><button class="card-play" type="button" aria-label="Open ${escapeHtml(item.title)}">▶</button><button class="save-learning ${savedLearning.includes(item.id)?'saved':''}" type="button" aria-label="Save ${escapeHtml(item.title)}">${savedLearning.includes(item.id)?'♥':'♡'}</button></div><div class="academy-card-info"><div class="academy-card-meta"><span>${escapeHtml(item.game||'JZ Academy')}</span><span>${escapeHtml(item.level||'All levels')}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description||'A practical JZ Academy lesson designed to help you learn by building.')}</p><div class="course-progress"><i style="width:${completedLearning.includes(item.id)?'100':'0'}%"></i></div><div class="academy-card-footer"><span>${itemType(item)==='course'?`${Number(item.lessons)||1} lessons`:'Video lesson'} · ${escapeHtml(item.duration||formatDate(item.date))}</span><button class="open-learning" type="button">${item.accessType==='paid'?'View access':completedLearning.includes(item.id)?'Review':'Start learning'} →</button></div></div></article>`).join('');
  emptyState.classList.toggle('hidden',visible.length>0);
}
function lessonOutline(item){
  if(!(item.modules||[]).length)return '<p class="no-outline">A focused lesson designed to move you from learning to doing.</p>';
  return item.modules.map((module,index)=>`<details class="modal-module" ${index===0?'open':''}><summary><span>${String(index+1).padStart(2,'0')} · ${escapeHtml(module.title)}</span><b>${(module.lessons||[]).length} lessons</b></summary>${(module.lessons||[]).map((lesson,lessonIndex)=>`<div class="modal-lesson"><span>${lesson.video?'▶':'○'} ${escapeHtml(lesson.title)}</span><small>${escapeHtml(lesson.duration||'')}</small>${lesson.description?`<p>${escapeHtml(lesson.description)}</p>`:''}</div>`).join('')}</details>`).join('');
}
function openLesson(item){
  if(!item)return;
  location.href=`learn.html?id=${encodeURIComponent(item.id)}`;
}
function closeLesson(){
  lessonModal.classList.remove('open');lessonModal.setAttribute('aria-hidden','true');lessonModalContent.querySelector('video')?.pause();document.body.style.overflow='';
}
function renderSpotlight(){
  featuredItem=academyItems.find(item=>item.featured)||academyItems[0]||null;if(!featuredItem)return;
  document.querySelector('#spotlightTitle').textContent=featuredItem.title;
  document.querySelector('#spotlightDescription').textContent=featuredItem.description||'A practical JZ Academy lesson designed to help you learn by building.';
  document.querySelector('#spotlightMeta').textContent=`${itemType(featuredItem)==='course'?`${featuredItem.lessons||1} lessons`:'Video lesson'} · ${featuredItem.level||'All levels'} · ${featuredItem.accessType==='paid'?academyMoney(featuredItem.price):'Free'}`;
  if(featuredItem.coverImage)document.querySelector('#spotlightVisual').style.backgroundImage=`linear-gradient(90deg,rgba(9,13,10,.25),rgba(9,13,10,.7)),url("${featuredItem.coverImage.replaceAll('"','%22')}")`;
}
filterButtons.forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter;showSavedLearning=false;filterButtons.forEach(item=>item.classList.toggle('active',item===button));renderAcademy()}));
searchInput.addEventListener('input',renderAcademy);levelInput.addEventListener('change',renderAcademy);
document.querySelector('#savedLearningFilter').addEventListener('click',()=>{showSavedLearning=!showSavedLearning;renderAcademy()});
document.querySelector('#clearAcademyFilters').addEventListener('click',()=>{searchInput.value='';levelInput.value='all';activeFilter='all';showSavedLearning=false;filterButtons.forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));renderAcademy()});
academyGrid.addEventListener('click',event=>{
  const card=event.target.closest('[data-academy-id]');if(!card)return;const item=academyItems.find(entry=>entry.id===card.dataset.academyId);
  if(event.target.closest('.save-learning'))toggleSaved(item.id);else openLesson(item);
});
lessonModal.addEventListener('click',event=>{
  if(event.target.closest('[data-close-lesson]'))closeLesson();
  const saved=event.target.closest('[data-save-learning]');if(saved){toggleSaved(saved.dataset.saveLearning);openLesson(academyItems.find(item=>item.id===saved.dataset.saveLearning))}
  const complete=event.target.closest('[data-complete-learning]');if(complete){toggleCompleted(complete.dataset.completeLearning);openLesson(academyItems.find(item=>item.id===complete.dataset.completeLearning));showAcademyToast(completedLearning.includes(complete.dataset.completeLearning)?'Lesson marked complete':'Completion removed')}
});
document.querySelector('#spotlightOpen').addEventListener('click',()=>openLesson(featuredItem));document.querySelector('#spotlightPlay').addEventListener('click',()=>openLesson(featuredItem));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeLesson()});
document.querySelectorAll('[data-path]').forEach(link=>link.addEventListener('click',()=>{searchInput.value=link.dataset.path;activeFilter='all';showSavedLearning=false;filterButtons.forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));setTimeout(renderAcademy,50)}));
document.querySelector('#year').textContent=new Date().getFullYear();

fetch('/api/streams')
  .then(response=>response.ok?response.json():Promise.reject())
  .then(items=>{
    academyItems=items;document.querySelector('#heroCourseCount').textContent=items.filter(item=>itemType(item)==='course').length;document.querySelector('#heroVideoCount').textContent=items.filter(item=>itemType(item)==='video').length;
    renderSpotlight();renderAcademy();
  })
  .catch(()=>{emptyState.classList.remove('hidden');emptyState.querySelector('h3').textContent='The academy is unavailable';emptyState.querySelector('p').textContent='Please check back shortly.'});
