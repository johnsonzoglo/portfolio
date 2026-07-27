const params=new URLSearchParams(location.search);
const courseId=params.get('id');
const loading=document.querySelector('#learnLoading');
const experience=document.querySelector('#learnExperience');
const errorState=document.querySelector('#learnError');
const curriculumList=document.querySelector('#curriculumList');
const savedIds=()=>JSON.parse(localStorage.getItem('jz-academy-saved')||'[]');
const progressStore=()=>JSON.parse(localStorage.getItem('jz-academy-progress')||'{}');
const accountToken=localStorage.getItem('jz-account-token');
let accountSnapshot=null;
let accessInfo=null,course=null,lessons=[],activeIndex=0,completed=[];

const escapeHtml=value=>{const element=document.createElement('span');element.textContent=String(value??'');return element.innerHTML};
function toast(message){const element=document.querySelector('#learnToast');element.textContent=message;element.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove('show'),2100)}
function normalizedCurriculum(item){
  if((item.modules||[]).some(module=>(module.lessons||[]).length))return item.modules.filter(module=>(module.lessons||[]).length).map((module,moduleIndex)=>({id:module.id||`module-${moduleIndex}`,title:module.title||`Module ${moduleIndex+1}`,lessons:(module.lessons||[]).map((lesson,lessonIndex)=>({...lesson,id:lesson.id||`${moduleIndex}-${lessonIndex}`,moduleTitle:module.title||`Module ${moduleIndex+1}`}))}));
  const count=Math.max(1,Number(item.lessons)||1);
  return [{id:'course',title:item.contentType==='video'?'Featured lesson':'Course lessons',lessons:Array.from({length:count},(_,index)=>({id:`lesson-${index+1}`,title:index===0?(item.contentType==='video'?item.title:'Welcome and course overview'):`Lesson ${String(index+1).padStart(2,'0')}`,description:index===0?item.description:'Follow this focused lesson and apply the ideas to your own project.',duration:item.contentType==='video'||index===0?item.duration:'Focused',video:index===0?item.src:'',resource:'',moduleTitle:item.contentType==='video'?'Video lesson':'Course lessons'}))}];
}
function flattenModules(modules){return modules.flatMap((module,moduleIndex)=>module.lessons.map((lesson,lessonIndex)=>({...lesson,moduleIndex,lessonIndex,moduleTitle:module.title})))}
function saveProgress(){
  const store=progressStore();store[course.id]=completed;localStorage.setItem('jz-academy-progress',JSON.stringify(store));
  const completedCourses=JSON.parse(localStorage.getItem('jz-academy-completed')||'[]'),isComplete=completed.length===lessons.length;
  const next=isComplete?[...new Set([...completedCourses,course.id])]:completedCourses.filter(id=>id!==course.id);
  localStorage.setItem('jz-academy-completed',JSON.stringify(next));
  if(accountToken)fetch('/api/account/progress',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accountToken}`},body:JSON.stringify({courseId:course.id,completed,percent:lessons.length?Math.round(completed.length/lessons.length*100):0})}).catch(()=>{});
}
function updateProgress(){
  const percent=lessons.length?Math.round(completed.length/lessons.length*100):0;
  document.querySelector('#courseProgressValue').textContent=`${percent}%`;document.querySelector('#courseProgressBar').style.width=`${percent}%`;
  document.querySelector('#courseProgressCopy').textContent=percent===100?'Course complete. Keep building with what you learned.':completed.length?`${completed.length} of ${lessons.length} lessons complete.`:'Start your first lesson.';
}
function curriculumMarkup(modules){
  return modules.map((module,moduleIndex)=>`<section class="curriculum-module"><header><small>Module ${String(moduleIndex+1).padStart(2,'0')}</small><strong>${escapeHtml(module.title)}</strong></header>${module.lessons.map((lesson,lessonIndex)=>{const flatIndex=lessons.findIndex(item=>item.id===lesson.id);return `<button class="curriculum-lesson ${flatIndex===activeIndex?'active':''} ${completed.includes(lesson.id)?'done':''}" type="button" data-lesson-index="${flatIndex}"><i>${completed.includes(lesson.id)?'✓':String(lessonIndex+1).padStart(2,'0')}</i><span><strong>${escapeHtml(lesson.title)}</strong><small>${escapeHtml(module.title)}</small></span><b>${escapeHtml(lesson.duration||'')}</b></button>`}).join('')}</section>`).join('');
}
function playerMarkup(lesson){
  if(lesson.video)return `<video controls preload="metadata" playsinline src="${escapeHtml(lesson.video)}" ${course.coverImage?`poster="${escapeHtml(course.coverImage)}"`:''}></video>`;
  return `${course.coverImage?`<img src="${escapeHtml(course.coverImage)}" alt="">`:''}<div class="player-placeholder"><small>JZ ACADEMY / ${escapeHtml(lesson.moduleTitle||'LESSON')}</small><strong>${escapeHtml(lesson.title)}</strong><span>▶</span></div>`;
}
function selectLesson(index){
  activeIndex=Math.max(0,Math.min(lessons.length-1,index));const lesson=lessons[activeIndex];
  curriculumList.innerHTML=curriculumMarkup(course.curriculum);
  document.querySelector('#lessonPlayer').innerHTML=playerMarkup(lesson);
  document.querySelector('#lessonPosition').textContent=`Lesson ${String(activeIndex+1).padStart(2,'0')} / ${String(lessons.length).padStart(2,'0')}`;
  document.querySelector('#lessonDuration').textContent=lesson.duration||course.duration||'Focused lesson';
  document.querySelector('#lessonTitle').textContent=lesson.title;document.querySelector('#lessonDescription').textContent=lesson.description||'Follow this lesson, apply the key idea, and mark it complete when you are ready.';
  const complete=document.querySelector('#completeLesson');complete.textContent=completed.includes(lesson.id)?'✓ Lesson completed':'Mark lesson complete';complete.classList.toggle('done',completed.includes(lesson.id));
  document.querySelector('#previousLesson').disabled=activeIndex===0;document.querySelector('#nextLesson').disabled=activeIndex===lessons.length-1;
  const resource=document.querySelector('#lessonResource');
  resource.innerHTML=lesson.resource?`<span>Lesson resource</span><strong>Download and keep building</strong><p>Use the supporting material while completing this lesson.</p><a href="${escapeHtml(lesson.resource)}" target="_blank" rel="noopener">Open resource ↗</a>`:'<span>Lesson resource</span><strong>No download for this lesson</strong><p>Any worksheets, references, or downloads added by the instructor will appear here.</p>';
  history.replaceState(null,'',`learn.html?id=${encodeURIComponent(course.id)}&lesson=${activeIndex+1}`);
}
function toggleSaved(){
  const items=savedIds(),saved=items.includes(course.id),next=saved?items.filter(id=>id!==course.id):[...items,course.id];
  localStorage.setItem('jz-academy-saved',JSON.stringify(next));if(accountToken){const serverCourses=accountSnapshot?.customer?.savedCourses||[];const courses=saved?serverCourses.filter(id=>id!==course.id):[...new Set([...serverCourses,course.id])];fetch('/api/account/saved',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accountToken}`},body:JSON.stringify({courses})}).then(()=>{if(accountSnapshot)accountSnapshot.customer.savedCourses=courses}).catch(()=>{})}renderSaved();toast(saved?'Removed from saved':'Saved for later');
}
function renderSaved(){const saved=savedIds().includes(course.id),button=document.querySelector('#learnSave');button.classList.toggle('saved',saved);button.textContent=saved?'♥ Saved course':'♡ Save course'}
function renderCourse(item){
  course=item;course.curriculum=normalizedCurriculum(item);lessons=flattenModules(course.curriculum);completed=(progressStore()[course.id]||[]).filter(id=>lessons.some(lesson=>lesson.id===id));
  document.title=`${course.title} · JZ Academy`;document.querySelector('meta[name="description"]').content=course.description||'Learn practical skills with JZ Academy.';
  document.querySelector('#courseEyebrow').textContent=`JZ Academy / ${course.contentType==='course'?'Course': 'Video lesson'} / ${course.game||'Practical learning'}`;
  document.querySelector('#courseTitle').textContent=course.title;document.querySelector('#courseDescription').textContent=course.description||'A practical JZ Academy lesson designed to help you learn by building.';
  document.querySelector('#courseLevel').textContent=course.level||'All levels';document.querySelector('#courseDuration').textContent=course.duration||'Focused';
  document.querySelector('#courseLessonCount').textContent=`${lessons.length} lesson${lessons.length===1?'':'s'}`;document.querySelector('#curriculumCount').textContent=`${lessons.length} lesson${lessons.length===1?'':'s'}`;
  updateProgress();renderSaved();loading.hidden=true;experience.hidden=false;
  fetch(`/api/reviews?targetId=${encodeURIComponent(course.id)}`).then(response=>response.ok?response.json():[]).then(reviews=>{document.querySelector('#courseReviewList').innerHTML=reviews.length?reviews.map(review=>`<article><strong>${'★'.repeat(review.rating)} ${escapeHtml(review.title||'Student review')}</strong><p>${escapeHtml(review.comment)}</p><small>${escapeHtml(review.customerName)} · ${new Date(review.createdAt).toLocaleDateString()}</small></article>`).join(''):'<p class="no-outline">No public reviews yet. Complete the course and share your experience.</p>'}).catch(()=>{});
  const requestedLesson=Math.max(0,Number(params.get('lesson')||1)-1);selectLesson(requestedLesson);
  if(accessInfo?.requiresPurchase&&!accessInfo.hasAccess){document.querySelector('#learningSpace').hidden=true;document.querySelector('#accessGate').hidden=false;document.querySelector('#accessPrice').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:accessInfo.currency||'USD',maximumFractionDigits:0}).format(accessInfo.price||0);document.querySelector('.course-progress-card a').href='#accessGate';document.querySelector('.course-progress-card a').firstChild.textContent='Unlock full course ';if(!accessInfo.payments?.stripe){document.querySelector('#courseStripePayment')?.remove();document.querySelector('#coursePaymentMethod').value='bank'}}
  fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'course_view',path:location.pathname,itemId:course.id,label:course.title})}).catch(()=>{});
}
curriculumList.addEventListener('click',event=>{const button=event.target.closest('[data-lesson-index]');if(button)selectLesson(Number(button.dataset.lessonIndex))});
document.querySelector('#completeLesson').addEventListener('click',()=>{const id=lessons[activeIndex].id;completed=completed.includes(id)?completed.filter(item=>item!==id):[...completed,id];saveProgress();updateProgress();selectLesson(activeIndex);toast(completed.includes(id)?'Lesson completed':'Lesson marked incomplete')});
document.querySelector('#previousLesson').addEventListener('click',()=>selectLesson(activeIndex-1));document.querySelector('#nextLesson').addEventListener('click',()=>selectLesson(activeIndex+1));
document.querySelector('#learnSave').addEventListener('click',toggleSaved);
document.querySelector('#purchaseCourse').addEventListener('click',async()=>{if(!accountToken){location.href=`auth.html?next=${encodeURIComponent(location.pathname+location.search)}`;return}const button=document.querySelector('#purchaseCourse'),message=document.querySelector('#purchaseMessage');button.disabled=true;message.textContent='Preparing secure access…';try{const response=await fetch('/api/account/purchase-course',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accountToken}`},body:JSON.stringify({courseId:course.id,paymentMethod:document.querySelector('#coursePaymentMethod').value})}),result=await response.json();if(!response.ok)throw new Error(result.error);if(result.checkoutUrl){location.href=result.checkoutUrl;return}message.textContent=`Request ${result.orderNumber} created. Access unlocks after payment is confirmed.`;button.textContent='Access request pending'}catch(error){message.textContent=error.message}finally{button.disabled=false}});
document.querySelector('#curriculumToggle').addEventListener('click',event=>{const panel=document.querySelector('.curriculum-panel');panel.classList.toggle('collapsed');const expanded=!panel.classList.contains('collapsed');event.currentTarget.textContent=expanded?'Hide':'Show';event.currentTarget.setAttribute('aria-expanded',String(expanded))});

Promise.all([fetch(`/api/learning/${encodeURIComponent(courseId||'')}`,{headers:accountToken?{Authorization:`Bearer ${accountToken}`}:{}}).then(response=>response.ok?response.json():Promise.reject()),accountToken?fetch('/api/account/me',{headers:{Authorization:`Bearer ${accountToken}`}}).then(response=>response.ok?response.json():null).catch(()=>null):Promise.resolve(null)]).then(([learning,account])=>{accessInfo=learning;accountSnapshot=account;const item=learning.course;if(account?.customer?.progress?.[item.id]){const store=progressStore();store[item.id]=account.customer.progress[item.id].completed||[];localStorage.setItem('jz-academy-progress',JSON.stringify(store))}if(account?.customer?.savedCourses?.includes(item.id)){const saved=savedIds();if(!saved.includes(item.id))localStorage.setItem('jz-academy-saved',JSON.stringify([...saved,item.id]))}renderCourse(item);if(accountToken&&!learning.requiresPurchase)fetch('/api/account/enroll',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accountToken}`},body:JSON.stringify({courseId:item.id})}).catch(()=>{})}).catch(()=>{loading.hidden=true;errorState.hidden=false});
