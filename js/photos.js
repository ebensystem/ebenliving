'use strict';
(function () {
  const CLOUD='ztdylmq7',PRESET='ebenliving_imoveis',LIMIT=8,MAX_BYTES=10*1024*1024;
  function uploadURL(value) {
    try {const url=new URL(value);return url.protocol==='https:'&&url.hostname==='res.cloudinary.com'&&url.pathname.startsWith('/'+CLOUD+'/image/upload/')?url.href:'';}catch{return '';}
  }
  function validateFile(file) {
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return 'Escolha fotos JPG, PNG ou WebP.';
    if(file.size>MAX_BYTES)return 'Cada foto deve ter no máximo 10 MB.';
    return '';
  }
  async function optimize(file) {
    const url=URL.createObjectURL(file),image=new Image();
    try {
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Não foi possível abrir esta foto.'));image.src=url;});
      const scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
      if(!blob)throw Error('Não foi possível preparar esta foto.');return blob;
    } finally {URL.revokeObjectURL(url);}
  }
  function upload(blob,onProgress) {
    return new Promise((resolve,reject)=>{
      const request=new XMLHttpRequest(),body=new FormData();
      body.append('file',blob,'imovel.webp');body.append('upload_preset',PRESET);body.append('asset_folder','ebenliving/imoveis');
      request.open('POST',`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`);request.timeout=120000;
      request.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
      request.onerror=request.ontimeout=()=>reject(Error('Não foi possível enviar a foto. Verifique sua conexão e tente novamente.'));
      request.onload=()=>{let result;try{result=JSON.parse(request.responseText);}catch{}
        const url=uploadURL(result?.secure_url);
        if(request.status>=200&&request.status<300&&url)resolve(url);
        else reject(Error('Não foi possível enviar a foto. Tente novamente ou entre em contato com o suporte.'));
      };request.send(body);
    });
  }
  function mount(form,initialImages=[]) {
    const field=form.querySelector('#prop-images'),list=form.querySelector('#propertyPhotos'),input=form.querySelector('#photoFiles'),button=form.querySelector('#addPhotos'),status=form.querySelector('#photoStatus'),submit=form.querySelector('[type="submit"]')||form.querySelector('button:not([type])');
    let images=[...initialImages],busy=false;
    const showError=message=>{const error=form.querySelector('#propertyError');error.textContent=message;error.hidden=!message;};
    function render() {
      field.value=images.join('\n');button.disabled=busy||images.length>=LIMIT;
      list.innerHTML=images.map((url,i)=>`<div class="photo-preview"><img src="${Living.escape(Living.safeImage(url))}" alt="Foto ${i+1} do imóvel"><div class="photo-preview-actions"><button type="button" class="text-button" data-photo-cover="${i}" ${busy?'disabled':''}>${i===0?'✓ Capa':'Definir capa'}</button><button type="button" class="text-button" data-photo-remove="${i}" ${busy?'disabled':''} aria-label="Remover foto ${i+1} do anúncio">Remover</button></div></div>`).join('');
    }
    button.addEventListener('click',()=>{if(!window.EbenFirestore?.uid||!window.EbenFirestore.isReady){showError('Entre na sua conta e aguarde o carregamento antes de enviar fotos.');return;}input.click();});
    list.addEventListener('click',event=>{if(busy)return;const cover=event.target.closest('[data-photo-cover]'),remove=event.target.closest('[data-photo-remove]');if(cover){const index=Number(cover.dataset.photoCover);images.unshift(...images.splice(index,1));render();}if(remove){images.splice(Number(remove.dataset.photoRemove),1);render();}});
    input.addEventListener('change',async()=>{
      const files=Array.from(input.files||[]);input.value='';if(!files.length||busy)return;
      if(files.length+images.length>LIMIT){showError('Você pode adicionar até 8 fotos por imóvel.');return;}
      const invalid=files.map(validateFile).find(Boolean);if(invalid){showError(invalid);return;}
      showError('');busy=true;submit.disabled=true;render();
      let completed=0;
      try {for(const file of files){status.textContent=`Preparando foto ${completed+1} de ${files.length}…`;const blob=await optimize(file);const url=await upload(blob,percent=>status.textContent=`Enviando foto ${completed+1} de ${files.length}: ${percent}%`);images.push(url);completed++;render();}status.textContent='Fotos enviadas. Salve o imóvel para atualizar o anúncio.';}
      catch(error){showError(error.message);status.textContent=completed?`${completed} foto(s) enviada(s). Você pode salvar ou adicionar as restantes.`:'Nenhuma foto enviada.';}
      finally {busy=false;submit.disabled=false;render();}
    });
    form.addEventListener('submit',event=>{if(busy){event.preventDefault();event.stopImmediatePropagation();showError('Aguarde o envio das fotos antes de salvar.');}},true);
    render();
  }
  window.EbenPhotos={mount,validateFile,uploadURL};
})();
