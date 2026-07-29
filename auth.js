const tokenKey='jz-account-token';
const resetToken=new URLSearchParams(location.search).get('reset');
if(localStorage.getItem(tokenKey)&&!resetToken)location.href='account.html';
const panels=[...document.querySelectorAll('[data-auth-panel]')],tabs=[...document.querySelectorAll('[data-auth-tab]')];
function showPanel(name){
  panels.forEach(panel=>{const active=panel.dataset.authPanel===name;panel.classList.toggle('active',active);panel.setAttribute('aria-hidden',String(!active))});
  tabs.forEach(tab=>{const active=tab.dataset.authTab===name;tab.classList.toggle('active',active);if(tab.getAttribute('role')==='tab')tab.setAttribute('aria-selected',String(active))});
}
tabs.forEach(tab=>tab.addEventListener('click',()=>showPanel(tab.dataset.authTab)));document.querySelector('#showRecovery').addEventListener('click',()=>showPanel('recovery'));
async function submit(form,url,messageId){
  const message=document.querySelector(messageId),button=form.querySelector('[type=submit]'),buttonLabel=button.innerHTML;
  message.textContent='';message.classList.remove('success','error');button.disabled=true;button.classList.add('is-loading');button.innerHTML='<span>Please wait</span><i aria-hidden="true"></i>';form.setAttribute('aria-busy','true');
  try{
    const data=Object.fromEntries(new FormData(form));
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'We could not complete that request.');
    if(result.token){localStorage.setItem(tokenKey,result.token);location.href=new URLSearchParams(location.search).get('next')||'account.html'}else{message.textContent=result.message;message.classList.add('success')}
  }catch(error){message.textContent=error.message||'Something went wrong. Please try again.';message.classList.add('error')}
  finally{button.disabled=false;button.classList.remove('is-loading');button.innerHTML=buttonLabel;form.removeAttribute('aria-busy')}
}
document.querySelector('#loginForm').addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,'/api/account/login','#loginMessage')});
document.querySelector('#registerForm').addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,'/api/account/register','#registerMessage')});
document.querySelector('#recoveryForm').addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,'/api/account/recover','#recoveryMessage')});
document.querySelector('#resetForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,message=document.querySelector('#resetMessage'),password=form.elements.password.value;if(password!==form.elements.confirmPassword.value){message.textContent='Passwords do not match.';message.className='auth-message error';return}const button=form.querySelector('[type=submit]'),buttonLabel=button.innerHTML;button.disabled=true;button.classList.add('is-loading');button.innerHTML='<span>Please wait</span><i aria-hidden="true"></i>';try{const response=await fetch('/api/account/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:resetToken,password})}),result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'We could not reset your password.');message.textContent=result.message;message.className='auth-message success';setTimeout(()=>{history.replaceState(null,'','auth.html');showPanel('login')},1200)}catch(error){message.textContent=error.message||'Something went wrong. Please try again.';message.className='auth-message error'}finally{button.disabled=false;button.classList.remove('is-loading');button.innerHTML=buttonLabel}});
document.querySelectorAll('[data-toggle-password]').forEach(button=>button.addEventListener('click',()=>{const input=button.parentElement.querySelector('input'),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Hide':'Show';button.setAttribute('aria-label',`${show?'Hide':'Show'} password`)}));
if(resetToken)showPanel('reset');else showPanel('login');
