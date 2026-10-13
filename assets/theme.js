(()=>{
 'use strict';
 const key='cahnk-color-theme';
 const read=()=>{try{return localStorage.getItem(key)}catch{return null}};
 const preferred=()=>matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
 const apply=theme=>{
  const value=theme==='dark'?'dark':'light';document.body.classList.toggle('theme-dark',value==='dark');
  const button=document.getElementById('themeToggle');if(button){button.textContent=value==='dark'?'☀️ โหมดสว่าง':'🌙 โหมดมืด';button.setAttribute('aria-label',value==='dark'?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด');button.title=value==='dark'?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด'}
 };
 const addStyles=()=>{if(document.querySelector('link[data-theme-styles]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=(location.pathname.includes('/modules/')?'../':'')+'assets/theme.css?v=20261014-theme-responsive';link.dataset.themeStyles='true';document.head.append(link)};
 const mount=()=>{
  if(location.pathname.endsWith('/pp5-home.html'))document.body.classList.add('pp5-home');
  if(location.pathname.endsWith('/pp5-review.html'))document.body.classList.add('pp5-review-page');
  addStyles();apply(read()||preferred());
  if(document.getElementById('themeToggle'))return;
  const button=document.createElement('button');button.id='themeToggle';button.type='button';button.className='theme-toggle';button.addEventListener('click',()=>{const next=document.body.classList.contains('theme-dark')?'light':'dark';try{localStorage.setItem(key,next)}catch{}apply(next)});
  const host=document.querySelector('.suite-breadcrumb,.topbar,.editor-header,.role-dashboard-toolbar,.content>.top,.workspace>.welcome,.classroom-page-head,.admin-page-head,header');
  if(host){host.classList.add('theme-host');host.append(button)}else{button.classList.add('theme-toggle-floating');document.body.append(button)}
  apply(read()||preferred());
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 addEventListener('storage',event=>{if(event.key===key)apply(event.newValue||preferred())});
})();
