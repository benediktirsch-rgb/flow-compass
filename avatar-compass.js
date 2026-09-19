/* Adapter only: master and personal data are owned by the cloud module. */
window.addEventListener('avatar-talk',function(e){
  if(e.detail.avatar==='john' && typeof window.johnOpen==='function'){e.preventDefault();window.johnOpen();}
  if(e.detail.avatar==='madeleine' && typeof window.madOpen==='function'){e.preventDefault();window.madOpen();}
});
