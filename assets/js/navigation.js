(() => {
 'use strict';
 const init=()=>{
  const nav=document.getElementById('navmenu');if(!nav)return;
  const buttons=[...nav.querySelectorAll('.nav-dropdown-button')];
  const close=(except=null)=>buttons.forEach(button=>{if(button!==except){button.setAttribute('aria-expanded','false');button.parentElement.classList.remove('is-open');}});
  buttons.forEach(button=>{
   button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')==='true';close();button.setAttribute('aria-expanded',String(!open));button.parentElement.classList.toggle('is-open',!open);});
   button.parentElement.addEventListener('focusout',event=>{if(event.relatedTarget&&!button.parentElement.contains(event.relatedTarget)){button.setAttribute('aria-expanded','false');button.parentElement.classList.remove('is-open');}});
  });
  nav.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  document.addEventListener('click',event=>{if(!nav.contains(event.target))close();});
  nav.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=buttons.find(b=>b.getAttribute('aria-expanded')==='true');if(open){event.preventDefault();event.stopPropagation();close();open.focus();}}});
  window.addEventListener('resize',()=>close());
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
