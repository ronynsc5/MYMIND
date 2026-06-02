(function(){
'use strict';

// ── Viewer de mídia ───────────────────────────────────────────────
window.addEventListener('load', function(){
var mvM=document.getElementById('mv-modal'), mvC=document.getElementById('mv-content');
if(!mvM||!mvC) return;
var mvClose=document.getElementById('mv-close');
if(mvClose) mvClose.onclick=function(){mvM.classList.remove('show');mvC.innerHTML='';};
mvM.addEventListener('click',function(e){if(e.target===mvM){mvM.classList.remove('show');mvC.innerHTML='';}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&mvM.classList.contains('show')){mvM.classList.remove('show');mvC.innerHTML='';}});
});

function isImg(u){return u&&(/\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i.test(u)||u.startsWith('data:image/'));}
function isVid(u){return u&&(/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)||u.startsWith('data:video/')||/youtu\.?be|vimeo\.com/i.test(u));}
function isWin(u){return u&&(/^[a-zA-Z]:\\/.test(u)||/^\\\\/.test(u));}

function openViewer(url){
  mvC.innerHTML='';
  if(isImg(url)){
    var i=document.createElement('img');i.src=url;mvC.appendChild(i);
  }else if(/youtu\.?be/i.test(url)){
    var m=url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if(m){
      var vid=m[1];
      var ytUrl='https://www.youtube.com/watch?v='+vid;

      // Tenta embed. Se o vídeo bloqueou embed (erro 153 etc),
      // fecha o viewer e abre diretamente no YouTube.
      var wrap=document.createElement('div');
      wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:10px;position:relative;';

      // Overlay de loading
      var loading=document.createElement('div');
      loading.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;pointer-events:none;';
      loading.textContent='Carregando...';
      wrap.appendChild(loading);

      var f=document.createElement('iframe');
      f.src='https://www.youtube-nocookie.com/embed/'+vid+'?autoplay=1&rel=0&enablejsapi=1';
      f.style.cssText='width:min(860px,90vw);height:min(480px,52vw);border:none;border-radius:8px;';
      f.allow='accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen';
      f.setAttribute('allowfullscreen','');

      // Detecta erro via postMessage da YouTube iframe API
      window.addEventListener('message',function ytMsg(e){
        try{
          var d=JSON.parse(e.data);
          // info=2 = erro no player (inclui erro 153 - embed bloqueado)
          if(d.event==='infoDelivery'&&d.info&&d.info.error){
            window.removeEventListener('message',ytMsg);
            mvM.classList.remove('show');mvC.innerHTML='';
            window.open(ytUrl,'_blank','noopener');
          }
          if(d.event==='video-progress'||d.event==='onStateChange'){
            loading.style.display='none';
          }
        }catch(ex){}
      });

      // Fallback: se após 4s o iframe ainda não carregou nada útil,
      // mostra botão de abertura direta em vez da tela preta de erro
      var fallbackTimer=setTimeout(function(){
        if(!mvM.classList.contains('show'))return;
        loading.style.display='none';
        var btn=document.createElement('a');
        btn.href=ytUrl;btn.target='_blank';btn.rel='noopener';
        btn.style.cssText='font-size:14px;color:#fff;background:rgba(255,0,0,0.8);padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;';
        btn.textContent='▶ Abrir no YouTube';
        wrap.appendChild(btn);
      },4000);

      f.onload=function(){
        loading.style.display='none';
        clearTimeout(fallbackTimer);
        // Ainda pode estar mostrando erro 153 dentro do iframe.
        // Após 1.5s sem evento de play, considera bloqueado e mostra botão.
        setTimeout(function(){
          if(!mvM.classList.contains('show'))return;
          var btn=wrap.querySelector('a');
          if(!btn){
            btn=document.createElement('a');
            btn.href=ytUrl;btn.target='_blank';btn.rel='noopener';
            btn.style.cssText='font-size:13px;color:#fff;opacity:.75;text-decoration:underline;cursor:pointer;margin-top:4px;';
            btn.textContent='▶ Vídeo bloqueado? Abrir no YouTube';
            wrap.appendChild(btn);
          }
        },1500);
      };

      wrap.appendChild(f);
      mvC.appendChild(wrap);
    }
  }else if(/vimeo\.com/i.test(url)){
    var m2=url.match(/vimeo\.com\/(\d+)/);
    if(m2){var f2=document.createElement('iframe');f2.src='https://player.vimeo.com/video/'+m2[1]+'?autoplay=1';f2.style.cssText='width:min(860px,90vw);height:min(480px,52vw);border:none;border-radius:8px;';mvC.appendChild(f2);}
  }else if(isVid(url)){
    var v=document.createElement('video');v.src=url;v.controls=true;v.autoplay=true;mvC.appendChild(v);
  }
  mvM.classList.add('show');
}

function openWin(path){
  var bat='@echo off\r\nstart "" "'+path.trim().replace(/"/g,'\\"')+'"\r\n';
  var blob=new Blob([bat],{type:'application/octet-stream'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='abrir.bat';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(a.href);},500);
}

// ── runAction estendido ───────────────────────────────────────────
var _run=window.runAction;
window.runAction=function(act){
  if(!act)return;
  if(act.type==='media'){openViewer(act.dest||'');return;}
  if(act.type==='windows'){openWin(act.dest||'');return;}
  if(act.type==='url'&&act.dest){
    var u=act.dest.trim();
    if(isWin(u)){openWin(u);return;}
    if(isImg(u)||isVid(u)){openViewer(u);return;}
  }
  if(typeof _run==='function')_run(act);
};

// ── Foto: renderiza ocupando o card todo ──────────────────────────
// Sem camera.zoom hack — sem risco de freeze
(function(){
  var _dn=window.drawNode;
  function isPure(n){
    return n&&n.imageUrl&&(n.imgObj instanceof HTMLImageElement)&&(n.photoOnly||n.type==='image');
  }
  function drawPhoto(node){
    var z=camera.zoom||1,x=node.x,y=node.y,w=node.width,h=node.minimized?44:node.height;
    var pad=10/z,bot=26/z,r=6/z,sel=!!(selectedNode&&selectedNode.id===node.id);
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.13)';ctx.shadowBlur=10/z;ctx.shadowOffsetY=3/z;
    ctx.fillStyle='#fff';ctx.strokeStyle=sel?'#3b82f6':'rgba(0,0,0,0.09)';ctx.lineWidth=sel?2/z:1/z;
    if(typeof roundRect==='function')roundRect(ctx,x,y,w,h,r);
    else{ctx.beginPath();ctx.rect(x,y,w,h);}
    ctx.fill();ctx.shadowColor='transparent';ctx.stroke();
    var iw=Math.max(10,w-pad*2),ih=Math.max(10,h-pad-bot);
    ctx.save();
    ctx.beginPath();
    if(typeof roundRect==='function')roundRect(ctx,x+pad,y+pad,iw,ih,r);
    else ctx.rect(x+pad,y+pad,iw,ih);
    ctx.clip();
    ctx.fillStyle='#eee';ctx.fillRect(x+pad,y+pad,iw,ih);
    try{
      var ratio=node.photoRatio||(node.imgObj.naturalWidth&&node.imgObj.naturalHeight?node.imgObj.naturalWidth/node.imgObj.naturalHeight:4/3);
      var boxR=iw/ih,dw,dh,dx,dy;
      if(ratio>boxR){dw=iw;dh=iw/ratio;dx=x+pad;dy=y+pad+(ih-dh)/2;}
      else{dh=ih;dw=ih*ratio;dx=x+pad+(iw-dw)/2;dy=y+pad;}
      ctx.drawImage(node.imgObj,dx,dy,dw,dh);
    }catch(e){}
    ctx.restore();
    if(sel&&!node.locked){ctx.fillStyle='#3b82f6';ctx.beginPath();ctx.arc(x+w,y+h,5/z,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  window.drawNode=function(node){
    if(!node)return;
    // Limpa objetos corrompidos pelo JSON — sem exceção possível
    if(node.imgObj &&!(node.imgObj  instanceof HTMLImageElement))node.imgObj =null;
    if(node.iconObj&&!(node.iconObj instanceof HTMLImageElement))node.iconObj=null;
    if(isPure(node)){drawPhoto(node);return;}
    _dn(node);
  };
})();

// ── Seleção pasta/nota limpa ──────────────────────────────────────
(function(){
  var T=new Set(['folder','note']),_d=window.draw;
  window.draw=function(){
    var n=selectedNode,f=n&&T.has(n.type);
    if(f)selectedNode=null;
    _d.apply(this,arguments);
    if(f)selectedNode=n;
    if(!f)return;
    try{
      var z=camera.zoom||1,p=6/z,b={x:n.x-p,y:n.y-p,w:n.width+p*2,h:(n.minimized?44:n.height)+p*2};
      ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(z,z);ctx.setLineDash([]);
      ctx.fillStyle='rgba(37,99,235,.12)';ctx.strokeStyle='rgba(37,99,235,.85)';ctx.lineWidth=1.5/z;
      if(typeof roundRect==='function')roundRect(ctx,b.x,b.y,b.w,b.h,5/z);
      else{ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);}
      ctx.fill();ctx.stroke();
      if(!n.locked){
        var s=14/z;
        ctx.fillStyle='#2563eb';ctx.strokeStyle='#fff';ctx.lineWidth=2/z;
        ctx.beginPath();ctx.arc(b.x+b.w,b.y+b.h,s/2,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='bold '+(9/z)+'px Arial';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('\u2198',b.x+b.w,b.y+b.h+0.5/z);
      }
      ctx.restore();
    }catch(e){}
  };
  var _r=window.isResizeHandle;
  window.isResizeHandle=function(node,x,y){
    if(node&&T.has(node.type)){
      var z=camera.zoom||1;
      var hx=node.x+node.width, hy=node.y+(node.minimized?44:node.height);
      var thr=24/z;
      return Math.abs(x-hx)<=thr&&Math.abs(y-hy)<=thr;
    }
    return _r?_r(node,x,y):false;
  };
})();

// ── Upload foto handler único ─────────────────────────────────────
(function(){
  var old=document.getElementById('image-file');if(!old)return;
  var inp=old.cloneNode(true);old.parentNode.replaceChild(inp,old);
  inp.addEventListener('change',function(e){
    var f=e.target.files&&e.target.files[0];if(!f||!selectedNode)return;
    var target=selectedNode,reader=new FileReader();
    reader.onload=function(ev){
      var img=new Image();
      img.onload=function(){
        var ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:4/3;
        target.imageUrl=ev.target.result;target.imgObj=img;target.photoRatio=ratio;
        target.type='image';target.photoOnly=true;
        target.bgColor='none';target.borderColor='none';target.borderWidth=0;
        var pad=10,bot=26;target.width=Math.max(90,Math.min(400,target.width||280));
        target.height=Math.max(60,Math.round(Math.max(20,target.width-pad*2)/ratio+pad+bot));
        if(typeof updatePanel==='function')updatePanel();
        if(typeof saveHist==='function')saveHist();
        draw();if(typeof triggerSave==='function')triggerSave();
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(f);e.target.value='';
  });
  var b1=document.getElementById('rp-image-btn');if(b1)b1.onclick=function(){inp.click();};
  var b2=document.getElementById('ctx-add-image');if(b2)b2.onclick=function(){if(selectedNode)inp.click();if(typeof hideContextMenu==='function')hideContextMenu();};
})();

// ── Migra nós foto antigos sem photoOnly ─────────────────────────
setTimeout(function(){
  try{
    Object.values(workspaces||{}).forEach(function(ws){
      (ws.nodes||[]).forEach(function(n){if(n&&n.imageUrl&&n.type==='image')n.photoOnly=true;});
    });
    (nodes||[]).forEach(function(n){if(n&&n.imageUrl&&n.type==='image')n.photoOnly=true;});
    draw();
  }catch(e){}
},0);

// ── Modal de ação com 4 abas ──────────────────────────────────────
(function(){
  var modal=document.getElementById('modal-action');
  if(!modal)return;
  var mb=modal.querySelector('.modal-body');
  if(!mb)return;

  // Esconde campos originais (type + dest) para não conflitar
  var rows=modal.querySelectorAll('.modal-row');
  if(rows[0])rows[0].style.display='none';
  if(rows[1])rows[1].style.display='none';

  // Injeta nova UI
  var wrap=document.createElement('div');
  wrap.innerHTML=
    '<div id="action-type-tabs">'+
      '<div class="act-tab active" data-p="url">🔗 Link</div>'+
      '<div class="act-tab" data-p="media">🎬 Mídia</div>'+
      '<div class="act-tab" data-p="internal">📁 Projeto</div>'+
      '<div class="act-tab" data-p="windows">🖥️ Windows</div>'+
    '</div>'+
    '<div id="action-panels">'+
      '<div id="ap-url" class="active">'+
        '<div class="act-label">URL externa</div>'+
        '<input id="act-url" class="rpanel-input" style="width:100%;box-sizing:border-box" placeholder="https://... | YouTube | link de imagem/vídeo">'+
        '<div style="font-size:11px;color:var(--text3);margin-top:5px">Imagens e vídeos abrem dentro do MySpace.</div>'+
      '</div>'+
      '<div id="ap-media">'+
        '<div class="act-label">Imagem ou vídeo do computador</div>'+
        '<button id="act-media-btn" class="rpanel-btn" style="width:100%">📂 Escolher arquivo...</button>'+
        '<input id="act-media-file" type="file" accept="image/*,video/*" style="display:none">'+
        '<div id="act-media-info" style="display:none;margin-top:6px;font-size:12px;color:var(--text2);padding:6px 8px;background:var(--bg2);border-radius:6px;display:none;justify-content:space-between;align-items:center">'+
          '<span id="act-media-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"></span>'+
          '<span id="act-media-clear" style="cursor:pointer;margin-left:8px;color:var(--text3)">✕</span>'+
        '</div>'+
        '<div style="font-size:11px;color:var(--text3);margin-top:5px">Salvo no projeto. Abre no viewer interno ao ativar o card.</div>'+
      '</div>'+
      '<div id="ap-internal">'+
        '<div class="act-label">Navegar para item do projeto</div>'+
        '<select id="act-int-type" class="rpanel-input rpanel-select" style="width:100%;margin-bottom:6px">'+
          '<option value="folder">Pastas</option>'+
          '<option value="card">Cards</option>'+
          '<option value="note">Notas</option>'+
        '</select>'+
        '<div id="act-int-list"></div>'+
      '</div>'+
      '<div id="ap-windows">'+
        '<div class="act-label">Caminho do Windows</div>'+
        '<input id="act-win" class="rpanel-input" style="width:100%;box-sizing:border-box" placeholder="C:\\Pasta  ou  C:\\App\\app.exe">'+
        '<div style="font-size:11px;color:var(--text3);margin-top:5px">Baixa um <b>abrir.bat</b> de 1 clique para abrir pastas e programas.</div>'+
      '</div>'+
    '</div>';
  mb.insertBefore(wrap,mb.firstChild);

  var curPanel='url', selInternal=null, mediaData=null, mediaName_='';

  // Troca de abas
  wrap.querySelectorAll('.act-tab').forEach(function(tab){
    tab.addEventListener('click',function(){
      curPanel=tab.dataset.p;
      wrap.querySelectorAll('.act-tab').forEach(function(t){t.classList.toggle('active',t===tab);});
      wrap.querySelectorAll('#action-panels>div').forEach(function(p){p.classList.toggle('active',p.id==='ap-'+curPanel);});
      if(curPanel==='internal')buildList();
    });
  });

  // Mídia local
  var mBtn=document.getElementById('act-media-btn');
  var mFile=document.getElementById('act-media-file');
  var mInfo=document.getElementById('act-media-info');
  var mName=document.getElementById('act-media-name');
  var mClear=document.getElementById('act-media-clear');
  mBtn.onclick=function(){mFile.click();};
  mFile.addEventListener('change',function(e){
    var f=e.target.files&&e.target.files[0];if(!f)return;
    var r=new FileReader();
    r.onload=function(ev){mediaData=ev.target.result;mediaName_=f.name;mName.textContent=f.name;mInfo.style.display='flex';};
    r.readAsDataURL(f);e.target.value='';
  });
  mClear.onclick=function(){mediaData=null;mediaName_='';mInfo.style.display='none';};

  // Lista interna
  function buildList(){
    var list=document.getElementById('act-int-list');
    var type=document.getElementById('act-int-type').value;
    list.innerHTML='';
    var items=[],seen={};
    function addNode(n,k){if(!seen[n.id]&&n.type===type&&n.title){seen[n.id]=1;items.push({n:n,k:k});}}
    Object.entries(workspaces||{}).forEach(function(e){(e[1].nodes||[]).forEach(function(n){addNode(n,e[0]);});});
    (nodes||[]).forEach(function(n){addNode(n,currentLevel);});
    items.sort(function(a,b){return a.k===currentLevel?-1:1;});
    if(!items.length){list.innerHTML='<div class="act-empty">Nenhum item encontrado</div>';return;}
    items.forEach(function(item){
      var d=document.createElement('div');d.className='act-item';
      if(selInternal&&selInternal.id===item.n.id)d.classList.add('selected');
      d.innerHTML='<span>'+(item.n.emoji||'📄')+'</span><span style="flex:1">'+item.n.title+'</span>';
      d.onclick=function(){
        selInternal=item.n;
        list.querySelectorAll('.act-item').forEach(function(x){x.classList.remove('selected');});
        d.classList.add('selected');
      };
      list.appendChild(d);
    });
  }
  document.getElementById('act-int-type').addEventListener('change',buildList);

  // Reset ao abrir
  var addBtn=document.getElementById('rp-add-action-btn');
  if(addBtn){
    var _ao=addBtn.onclick;
    addBtn.onclick=function(){
      if(typeof _ao==='function')_ao();
      curPanel='url';selInternal=null;mediaData=null;mediaName_='';
      wrap.querySelectorAll('.act-tab').forEach(function(t){t.classList.toggle('active',t.dataset.p==='url');});
      wrap.querySelectorAll('#action-panels>div').forEach(function(p){p.classList.toggle('active',p.id==='ap-url');});
      var u=document.getElementById('act-url');if(u)u.value='';
      var w=document.getElementById('act-win');if(w)w.value='';
      if(mInfo)mInfo.style.display='none';
      var il=document.getElementById('act-int-list');if(il)il.innerHTML='';
    };
  }

  // Confirmar — injeta nos campos originais que o handler nativo usa
  var okBtn=document.getElementById('action-ok');
  if(okBtn){
    var _oo=okBtn.onclick;
    okBtn.onclick=function(){
      var tEl=document.getElementById('action-type');
      var dEl=document.getElementById('action-dest');
      // Mostra os campos originais momentaneamente para o handler nativo funcionar
      if(tEl)tEl.closest&&tEl.closest('.modal-row')&&(tEl.closest('.modal-row').style.display='');
      if(dEl)dEl.closest&&dEl.closest('.modal-row')&&(dEl.closest('.modal-row').style.display='');

      if(curPanel==='url'){
        var url=(document.getElementById('act-url')||{}).value||'';
        if(!url.trim())return;
        if(tEl)tEl.value='url';
        if(dEl)dEl.value=url.trim();
      }else if(curPanel==='media'){
        if(!mediaData)return;
        if(tEl)tEl.value='media';
        if(dEl)dEl.value=mediaData;
      }else if(curPanel==='internal'){
        if(!selInternal)return;
        var it=document.getElementById('act-int-type').value;
        if(tEl)tEl.value=it;
        if(dEl)dEl.value=selInternal.title;
      }else if(curPanel==='windows'){
        var wp=(document.getElementById('act-win')||{}).value||'';
        if(!wp.trim())return;
        if(tEl)tEl.value='windows';
        if(dEl)dEl.value=wp.trim();
      }

      if(typeof _oo==='function')_oo();

      // Esconde de novo
      if(rows[0])rows[0].style.display='none';
      if(rows[1])rows[1].style.display='none';
    };
  }
})();

})();

(function(){
  'use strict';
  if(window.__v30)return;
  window.__v30=true;
  var byId=function(id){return document.getElementById(id);};
  function go(){if(typeof saveHist==='function')saveHist();if(typeof draw==='function')draw();if(typeof triggerSave==='function')triggerSave();}
  function hideCtx(){if(typeof hideContextMenu==='function')hideContextMenu();}
  function wireCtx(){
    ['ctx-convert-type','ctx-add-card','ctx-add-text','ctx-behavior','ctx-links'].forEach(function(id){var el=byId(id);if(el)el.style.display='none';});
    function wire(id,fn){var el=byId(id);if(el&&!el.dataset.v30){el.dataset.v30='1';el.addEventListener('click',fn);}}
    wire('ctx-add-icon',function(){if(!selectedNode){hideCtx();return;}var ic=createNode(selectedNode.x+selectedNode.width+32,selectedNode.y,'icon');nodes.push(ic);if(typeof selectNodeObj==='function')selectNodeObj(ic);go();hideCtx();});
    wire('ctx-add-sub',function(){if(!selectedNode){hideCtx();return;}var sub=createNode(selectedNode.x+selectedNode.width+60,selectedNode.y+20,'card');nodes.push(sub);connections.push({id:'c'+Date.now(),from:selectedNode.id,to:sub.id,style:settings.defaultConnStyle||'curved',width:2,color:'default',opacity:1,curve:70});if(typeof selectNodeObj==='function')selectNodeObj(sub);go();hideCtx();});
    wire('ctx-add-note',function(){if(selectedNode&&typeof openNoteWindow==='function')openNoteWindow(selectedNode);else if(selectedNode&&typeof startInlineEdit==='function')startInlineEdit(selectedNode);hideCtx();});
    wire('ctx-add-button',function(){if(!selectedNode){hideCtx();return;}byId('right-panel').classList.add('show');var ab=byId('rp-add-action-btn');if(ab)setTimeout(function(){ab.scrollIntoView({behavior:'smooth',block:'center'});ab.click();},80);hideCtx();});
    wire('ctx-add-image',function(){hideCtx();var fi=byId('image-file');if(fi)fi.click();});
  }
  var _oc=window.showCtxMenu;
  window.showCtxMenu=showCtxMenu=function(x,y,node){if(typeof _oc==='function')_oc(x,y,node);wireCtx();var of=byId('ctx-open-folder');if(of)of.style.display=(node&&node.type==='folder')?'flex':'none';var ai=byId('ctx-add-icon');if(ai)ai.style.display=(node&&node.type==='card')?'flex':'none';};
  function syncSliders(){var style=selectedConn?selectedConn.style:(byId('rp-conn-style')?byId('rp-conn-style').value:'curved');var se=byId('rp-conn-step'),ce=byId('rp-conn-curve');if(se){var ss=se.closest('.rpanel-section');if(ss)ss.style.display=(style==='stepped')?'':'none';}if(ce){var cs=ce.closest('.rpanel-section');if(cs)cs.style.display=(style==='curved')?'':'none';}}
  var cs=byId('rp-conn-style');if(cs)cs.addEventListener('change',function(){if(selectedConn)selectedConn.style=cs.value;syncSliders();if(typeof draw==='function')draw();if(typeof triggerSave==='function')triggerSave();});
  var _op=window.populateConnPanel;window.populateConnPanel=populateConnPanel=function(c){if(typeof _op==='function')_op(c);setTimeout(syncSliders,50);};
  var _oc2=window.createNode;window.createNode=createNode=function(x,y,type){var n=_oc2(x,y,type);if(n&&type==='card'&&(!n.bgColor||n.bgColor==='none')){var dark=document.body.classList.contains('theme-dark');if(dark){n.bgColor='#252523';n.borderColor='#4a4a48';n.textColor='#e8e8e5';n.titleColor='#f5f5f4';}else{n.bgColor='#ffffff';n.borderColor='#e0e0dd';n.textColor='#525250';n.titleColor='#1a1a18';}n.borderWidth=1.5;}return n;};
  setTimeout(function(){wireCtx();syncSliders();if(typeof draw==='function')draw();},400);
})();

(function(){
  'use strict';
  if (window.__MYSPACE_V311_STABILIZATION__) return;
  window.__MYSPACE_V311_STABILIZATION__ = true;

  const STORAGE_KEY = 'myspace-v2'; // mantém compatibilidade com versões anteriores
  const byId = (id) => document.getElementById(id);
  const toNum = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  let nodeIndex = new Map();

  function getNodes(){ try { return Array.isArray(nodes) ? nodes : []; } catch(_) { return []; } }
  function getConnections(){ try { return Array.isArray(connections) ? connections : []; } catch(_) { return []; } }
  function getWorkspaces(){ try { return workspaces && typeof workspaces === 'object' ? workspaces : {}; } catch(_) { return {}; } }

  function rebuildNodeIndex(){
    nodeIndex = new Map();
    getNodes().forEach((node) => {
      if (node && node.id != null) nodeIndex.set(String(node.id), node);
    });
    return nodeIndex;
  }

  function findNodeById(id){
    if (id == null) return null;
    const key = String(id);
    const indexed = nodeIndex.get(key);
    if (indexed) return indexed;
    rebuildNodeIndex();
    return nodeIndex.get(key) || null;
  }

  function sanitizeText(value, fallback){
    if (value == null) return fallback || '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 5000);
  }

  function sanitizeNode(node){
    if (!node || typeof node !== 'object') return node;
    node.id = sanitizeText(node.id || ('n' + Date.now()), 'n' + Date.now());
    node.type = ['card','folder','note','text','image','icon'].includes(node.type) ? node.type : 'card';
    node.x = toNum(node.x, 0);
    node.y = toNum(node.y, 0);
    node.width = Math.min(2000, Math.max(10, toNum(node.width, 180)));
    node.height = Math.min(2000, Math.max(10, toNum(node.height, 120)));
    node.title = sanitizeText(node.title, 'Sem título');
    node.note = sanitizeText(node.note, '');
    node.emoji = sanitizeText(node.emoji, '');
    node.iconSize = Math.min(256, Math.max(8, toNum(node.iconSize, 28)));
    node.bgOpacity = Math.min(1, Math.max(0, toNum(node.bgOpacity, 1)));
    node.borderWidth = Math.min(20, Math.max(0, toNum(node.borderWidth, 1.5)));
    node.textSize = Math.min(72, Math.max(6, toNum(node.textSize, 13)));
    node.noteSize = Math.min(72, Math.max(6, toNum(node.noteSize, 11)));
    if (!Array.isArray(node.actions)) node.actions = [];
    if (!Array.isArray(node.children)) node.children = [];
    node.children = [...new Set(node.children.map(String).filter((id) => id && id !== node.id))];
    return node;
  }

  function sanitizeConnection(conn){
    if (!conn || typeof conn !== 'object') return conn;
    conn.id = sanitizeText(conn.id || ('c' + Date.now()), 'c' + Date.now());
    conn.from = sanitizeText(conn.from, '');
    conn.to = sanitizeText(conn.to, '');
    conn.style = ['curved','straight','stepped','dashed'].includes(conn.style) ? conn.style : 'curved';
    conn.width = Math.min(12, Math.max(1, toNum(conn.width, 2)));
    conn.opacity = Math.min(1, Math.max(0.05, toNum(conn.opacity, 1)));
    conn.curve = Math.min(500, Math.max(-500, toNum(conn.curve, 70)));
    return conn;
  }

  function sanitizeCurrentState(){
    getNodes().forEach(sanitizeNode);
    getConnections().forEach(sanitizeConnection);
    rebuildNodeIndex();
  }

  function updateSaveStatus(label, color){
    const dot = byId('save-dot');
    const lbl = byId('save-label');
    if (dot && color) dot.style.background = color;
    if (lbl && label) lbl.textContent = label;
  }

  function safeSave(){
    try {
      sanitizeCurrentState();
      const data = {
        version: '3.11-stabilized',
        workspaces: getWorkspaces(),
        currentLevel: (typeof currentLevel !== 'undefined' ? currentLevel : 'root'),
        navStack: (Array.isArray(window.navStack) ? window.navStack : (typeof navStack !== 'undefined' ? navStack : [])),
        settings: (typeof settings !== 'undefined' ? settings : {}),
        ts: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      try { lastSave = new Date(data.ts); } catch(_) {}
      updateSaveStatus('Salvo', '#22c55e');
      if (typeof updateSaveLabel === 'function') updateSaveLabel();
      return true;
    } catch (err) {
      console.warn('[MySpace] Falha ao salvar:', err);
      updateSaveStatus('Erro ao salvar', '#ef4444');
      if (err && (err.name === 'QuotaExceededError' || String(err).includes('quota'))) {
        alert('O navegador ficou sem espaço para salvar este projeto. Remova imagens grandes ou exporte um backup antes de continuar.');
      }
      return false;
    }
  }

  function patchMissingAliases(){
    // Patches antigos chamam #rp-emoji-btn, mas a UI atual usa #rp-icon-change-btn.
    if (!byId('rp-emoji-btn')) {
      const alias = document.createElement('button');
      alias.id = 'rp-emoji-btn';
      alias.type = 'button';
      alias.hidden = true;
      alias.addEventListener('click', function(){
        const real = byId('rp-icon-change-btn') || byId('rp-icon-preview');
        if (real) real.click();
      });
      document.body.appendChild(alias);
    }
  }

  function patchDrawLifecycle(){
    const previousDraw = window.draw || (typeof draw === 'function' ? draw : null);
    if (!previousDraw || previousDraw.__v311Wrapped) return;
    const wrapped = function(){
      sanitizeCurrentState();
      return previousDraw.apply(this, arguments);
    };
    wrapped.__v311Wrapped = true;
    window.draw = draw = wrapped;
  }

  function patchSaveLifecycle(){
    const previousDoSave = window.doSave || (typeof doSave === 'function' ? doSave : null);
    if (!previousDoSave || previousDoSave.__v311Wrapped) return;
    const wrapped = function(){
      // Usa a rotina segura. Se algo externo depender do antigo doSave, o contrato continua: salvar e atualizar UI.
      return safeSave();
    };
    wrapped.__v311Wrapped = true;
    window.doSave = doSave = wrapped;
  }

  function patchLoadLifecycle(){
    const previousLoadSave = window.loadSave || (typeof loadSave === 'function' ? loadSave : null);
    if (!previousLoadSave || previousLoadSave.__v311Wrapped) return;
    const wrapped = function(){
      const ok = previousLoadSave.apply(this, arguments);
      sanitizeCurrentState();
      return ok;
    };
    wrapped.__v311Wrapped = true;
    window.loadSave = loadSave = wrapped;
  }

  function exportSnapshot(){
    sanitizeCurrentState();
    return {
      version: '3.11-stabilized',
      exportedAt: new Date().toISOString(),
      workspaces: getWorkspaces(),
      currentLevel: (typeof currentLevel !== 'undefined' ? currentLevel : 'root'),
      navStack: (typeof navStack !== 'undefined' ? navStack : []),
      settings: (typeof settings !== 'undefined' ? settings : {})
    };
  }

  window.MySpace = Object.freeze({
    version: '3.11-stabilized',
    state: {
      get nodes(){ return getNodes(); },
      get connections(){ return getConnections(); },
      get workspaces(){ return getWorkspaces(); },
      get selectedNode(){ try { return selectedNode || null; } catch(_) { return null; } },
      get selectedConnection(){ try { return selectedConn || null; } catch(_) { return null; } },
      get camera(){ try { return camera || {x:0,y:0,zoom:1}; } catch(_) { return {x:0,y:0,zoom:1}; } }
    },
    rebuildNodeIndex,
    findNodeById,
    sanitizeCurrentState,
    save: safeSave,
    exportSnapshot,
    redraw(){ if (typeof draw === 'function') draw(); },
    selectNode(id){
      const node = findNodeById(id);
      if (node && typeof selectNodeObj === 'function') selectNodeObj(node);
      return node;
    }
  });

  patchMissingAliases();
  patchDrawLifecycle();
  patchSaveLifecycle();
  patchLoadLifecycle();
  sanitizeCurrentState();

  document.addEventListener('DOMContentLoaded', function(){
    patchMissingAliases();
    sanitizeCurrentState();
  });
})();

(function(){
  'use strict';
  if (window.__MYSPACE_V312_ARCHITECTURE__) return;
  window.__MYSPACE_V312_ARCHITECTURE__ = true;

  const VERSION = '3.12-architecture-foundation';
  const STORAGE_KEY = 'myspace-v2';
  const DB_NAME = 'myspace-pro';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  const AUTOSAVE_ID = 'default';
  const MAX_TEXT = 12000;
  const byId = (id) => document.getElementById(id);
  const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const clamp = (v, min, max, fallback) => Math.min(max, Math.max(min, num(v, fallback)));
  const copy = (obj) => {
    try { return structuredClone(obj); }
    catch (_) { return JSON.parse(JSON.stringify(obj)); }
  };

  function cleanText(value, fallback=''){
    if (value == null) return fallback;
    return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, MAX_TEXT);
  }

  function cleanUrl(value){
    const u = cleanText(value, '').trim();
    if (!u) return '';
    if (/^(https?:|data:image\/|data:video\/|mailto:|tel:|#)/i.test(u)) return u;
    if (/^[a-zA-Z]:\\/.test(u) || /^\\\\/.test(u)) return u;
    return u.replace(/^javascript:/i, '');
  }

  function normalizeNode(node){
    if (!node || typeof node !== 'object') return null;
    const n = node;
    n.id = cleanText(n.id || ('n' + Date.now() + Math.random().toString(16).slice(2)), 'node');
    n.type = ['card','folder','note','text','image','icon'].includes(n.type) ? n.type : 'card';
    n.x = clamp(n.x, -1000000, 1000000, 0);
    n.y = clamp(n.y, -1000000, 1000000, 0);
    n.width = clamp(n.width, 10, 4000, n.type === 'note' ? 220 : 180);
    n.height = clamp(n.height, 10, 4000, n.type === 'note' ? 140 : 120);
    n.title = cleanText(n.title, 'Sem título');
    n.note = cleanText(n.note, '');
    n.emoji = cleanText(n.emoji, '');
    n.bgColor = cleanText(n.bgColor, n.bgColor === null ? null : 'none');
    n.borderColor = cleanText(n.borderColor, 'none');
    n.textColor = cleanText(n.textColor, '#1a1a18');
    n.titleColor = cleanText(n.titleColor, n.textColor || '#1a1a18');
    n.bgOpacity = clamp(n.bgOpacity, 0, 1, 1);
    n.borderWidth = clamp(n.borderWidth, 0, 24, 1.5);
    n.iconSize = clamp(n.iconSize, 8, 256, 28);
    n.iconX = clamp(n.iconX, -1000, 1000, 0);
    n.iconY = clamp(n.iconY, -1000, 1000, 0);
    n.textSize = clamp(n.textSize, 6, 96, 13);
    n.noteSize = clamp(n.noteSize, 6, 96, 11);
    n.textPadTop = clamp(n.textPadTop, -2000, 4000, 0);
    n.textPadLeft = clamp(n.textPadLeft, -2000, 2000, 0);
    n.imageUrl = cleanUrl(n.imageUrl || '');
    n.iconUrl = cleanUrl(n.iconUrl || '');
    n.locked = !!n.locked;
    n.minimized = !!n.minimized;
    n.children = Array.isArray(n.children) ? [...new Set(n.children.map(String).filter((id) => id && id !== n.id))] : [];
    n.actions = Array.isArray(n.actions) ? n.actions.map((a) => ({
      type: cleanText(a && a.type, 'url'),
      label: cleanText(a && a.label, 'Abrir'),
      dest: cleanUrl(a && a.dest),
      target: cleanText(a && a.target, '')
    })).slice(0, 50) : [];
    return n;
  }

  function normalizeConnection(conn, nodeIds){
    if (!conn || typeof conn !== 'object') return null;
    const c = conn;
    c.id = cleanText(c.id || ('c' + Date.now() + Math.random().toString(16).slice(2)), 'conn');
    c.from = cleanText(c.from, '');
    c.to = cleanText(c.to, '');
    if (!c.from || !c.to || c.from === c.to) return null;
    if (nodeIds && (!nodeIds.has(String(c.from)) || !nodeIds.has(String(c.to)))) return null;
    c.style = ['curved','straight','stepped','dashed'].includes(c.style) ? c.style : 'curved';
    c.color = cleanText(c.color || 'default', 'default');
    c.width = clamp(c.width, 1, 16, 2);
    c.opacity = clamp(c.opacity, 0.05, 1, 1);
    c.curve = clamp(c.curve, -800, 800, 70);
    return c;
  }

  function getLegacyState(){
    let ws = {};
    try { ws = (typeof workspaces !== 'undefined' && workspaces && typeof workspaces === 'object') ? workspaces : {}; } catch(_) {}
    return {
      version: VERSION,
      workspaces: ws,
      currentLevel: (typeof currentLevel !== 'undefined' ? currentLevel : 'root'),
      navStack: (typeof navStack !== 'undefined' && Array.isArray(navStack) ? navStack : []),
      settings: (typeof settings !== 'undefined' && settings ? settings : {}),
      ts: new Date().toISOString()
    };
  }

  function normalizeProject(project){
    const p = project && typeof project === 'object' ? project : {};
    const out = {
      version: VERSION,
      workspaces: {},
      currentLevel: cleanText(p.currentLevel || 'root', 'root'),
      navStack: Array.isArray(p.navStack) ? p.navStack.map(String).slice(0, 100) : [],
      settings: Object.assign({}, p.settings || {}),
      ts: p.ts || new Date().toISOString()
    };
    const sourceWs = p.workspaces && typeof p.workspaces === 'object' ? p.workspaces : { root: { nodes: [], connections: [], camera: {x:0,y:0,zoom:1} } };
    Object.keys(sourceWs).forEach((key) => {
      const ws = sourceWs[key] || {};
      const cleanNodes = (Array.isArray(ws.nodes) ? ws.nodes : []).map(normalizeNode).filter(Boolean);
      const ids = new Set(cleanNodes.map((n) => String(n.id)));
      const cleanConns = (Array.isArray(ws.connections) ? ws.connections : []).map((c) => normalizeConnection(c, ids)).filter(Boolean);
      out.workspaces[cleanText(key, 'root')] = {
        nodes: cleanNodes,
        connections: cleanConns,
        camera: {
          x: clamp(ws.camera && ws.camera.x, -1000000, 1000000, 0),
          y: clamp(ws.camera && ws.camera.y, -1000000, 1000000, 0),
          zoom: clamp(ws.camera && ws.camera.zoom, 0.05, 8, 1)
        }
      };
    });
    if (!out.workspaces.root) out.workspaces.root = { nodes: [], connections: [], camera: {x:0,y:0,zoom:1} };
    if (!out.workspaces[out.currentLevel]) out.currentLevel = 'root';
    return out;
  }

  class EventBus {
    constructor(){ this.listeners = new Map(); }
    on(type, handler){
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
      return () => this.off(type, handler);
    }
    off(type, handler){ const set = this.listeners.get(type); if (set) set.delete(handler); }
    emit(type, payload){
      const set = this.listeners.get(type);
      if (!set) return;
      set.forEach((fn) => { try { fn(payload); } catch (err) { console.warn('[MySpace EventBus]', err); } });
    }
  }

  class Store {
    constructor(bus){ this.bus = bus; this.nodeIndex = new Map(); }
    snapshot(){ return normalizeProject(getLegacyState()); }
    rebuildIndex(){
      this.nodeIndex.clear();
      try { (Array.isArray(nodes) ? nodes : []).forEach((n) => { if (n && n.id != null) this.nodeIndex.set(String(n.id), n); }); } catch(_) {}
      return this.nodeIndex;
    }
    getNode(id){
      if (id == null) return null;
      const key = String(id);
      if (!this.nodeIndex.has(key)) this.rebuildIndex();
      return this.nodeIndex.get(key) || null;
    }
    normalizeLive(){
      try {
        if (Array.isArray(nodes)) {
          for (let i = nodes.length - 1; i >= 0; i--) {
            const clean = normalizeNode(nodes[i]);
            if (!clean) nodes.splice(i, 1); else nodes[i] = clean;
          }
        }
        const ids = new Set((Array.isArray(nodes) ? nodes : []).map((n) => String(n.id)));
        if (Array.isArray(connections)) {
          for (let i = connections.length - 1; i >= 0; i--) {
            const clean = normalizeConnection(connections[i], ids);
            if (!clean) connections.splice(i, 1); else connections[i] = clean;
          }
        }
      } catch(err){ console.warn('[MySpace] normalizeLive failed', err); }
      this.rebuildIndex();
      this.bus.emit('state:normalized', this.snapshot());
    }
    commit(reason='manual'){
      this.normalizeLive();
      try { if (typeof draw === 'function') draw(); } catch(_) {}
      try { if (typeof triggerSave === 'function') triggerSave(); } catch(_) {}
      this.bus.emit('state:commit', { reason, snapshot: this.snapshot() });
    }
  }

  class Repository {
    constructor(bus){ this.bus = bus; this.dbPromise = null; }
    open(){
      if (!('indexedDB' in window)) return Promise.resolve(null);
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { console.warn('[MySpace] IndexedDB indisponível:', req.error); resolve(null); };
      });
      return this.dbPromise;
    }
    async save(project, id=AUTOSAVE_ID){
      const normalized = normalizeProject(project);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch(err){ console.warn('[MySpace] localStorage failed', err); }
      const db = await this.open();
      if (db) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put({ id, project: normalized, updatedAt: new Date().toISOString() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => { console.warn('[MySpace] IndexedDB save failed', tx.error); resolve(false); };
        });
      }
      this.bus.emit('repository:saved', { id, project: normalized });
      return normalized;
    }
    async load(id=AUTOSAVE_ID){
      const db = await this.open();
      if (db) {
        const fromDb = await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(id);
          req.onsuccess = () => resolve(req.result && req.result.project);
          req.onerror = () => resolve(null);
        });
        if (fromDb) return normalizeProject(fromDb);
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? normalizeProject(JSON.parse(raw)) : null;
      } catch(_) { return null; }
    }
  }

  class CommandManager {
    constructor(store, bus){ this.store = store; this.bus = bus; this.undoStack = []; this.redoStack = []; this.limit = 100; }
    execute(command){
      if (!command || typeof command.do !== 'function') return false;
      command.do();
      this.undoStack.push(command);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
      this.redoStack.length = 0;
      this.store.commit(command.name || 'command');
      this.bus.emit('command:execute', command);
      return true;
    }
    undo(){
      const command = this.undoStack.pop();
      if (!command || typeof command.undo !== 'function') return false;
      command.undo();
      this.redoStack.push(command);
      this.store.commit('undo:' + (command.name || 'command'));
      return true;
    }
    redo(){
      const command = this.redoStack.pop();
      if (!command || typeof command.do !== 'function') return false;
      command.do();
      this.undoStack.push(command);
      this.store.commit('redo:' + (command.name || 'command'));
      return true;
    }
  }

  function createCommands(store){
    return {
      updateNode(id, patch){
        const before = copy(store.getNode(id));
        return {
          name: 'updateNode',
          do(){ const n = store.getNode(id); if (n) Object.assign(n, patch); },
          undo(){ const n = store.getNode(id); if (n && before) { Object.keys(n).forEach((k) => delete n[k]); Object.assign(n, copy(before)); } }
        };
      },
      deleteNode(id){
        let backupNode = null, backupConnections = [];
        return {
          name: 'deleteNode',
          do(){
            const key = String(id);
            const idx = nodes.findIndex((n) => String(n.id) === key);
            if (idx >= 0) backupNode = nodes.splice(idx, 1)[0];
            backupConnections = connections.filter((c) => String(c.from) === key || String(c.to) === key);
            for (let i = connections.length - 1; i >= 0; i--) if (String(connections[i].from) === key || String(connections[i].to) === key) connections.splice(i, 1);
          },
          undo(){ if (backupNode) nodes.push(backupNode); backupConnections.forEach((c) => connections.push(c)); }
        };
      }
    };
  }

  const bus = new EventBus();
  const store = new Store(bus);
  const repository = new Repository(bus);
  const commands = new CommandManager(store, bus);
  const commandFactory = createCommands(store);

  function patchSave(){
    const previous = window.doSave || (typeof doSave === 'function' ? doSave : null);
    if (!previous || previous.__v312Wrapped) return;
    const wrapped = function(){
      store.normalizeLive();
      const snapshot = store.snapshot();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        try { lastSave = new Date(snapshot.ts); } catch(_) {}
        if (typeof updateSaveLabel === 'function') updateSaveLabel();
        if (typeof flashSave === 'function') flashSave();
        const e = byId('last-save-time'); if (e) e.textContent = 'Agora mesmo';
      } catch(err) {
        console.error(err);
        const dot = byId('save-dot'), lbl = byId('save-label');
        if (dot) dot.style.background = '#ef4444';
        if (lbl) lbl.textContent = 'Erro ao salvar';
        if (err && (err.name === 'QuotaExceededError' || String(err).includes('quota'))) {
          alert('Sem espaço no navegador para salvar. Exporte um backup ou remova imagens grandes.');
        }
        return false;
      }
      repository.save(snapshot).catch((err) => console.warn('[MySpace] mirror save failed', err));
      return true;
    };
    wrapped.__v312Wrapped = true;
    window.doSave = doSave = wrapped;
  }

  function patchDraw(){
    const previous = window.draw || (typeof draw === 'function' ? draw : null);
    if (!previous || previous.__v312Wrapped) return;
    const wrapped = function(){
      store.normalizeLive();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      try { if (ctx && ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } catch(_) {}
      return previous.apply(this, arguments);
    };
    wrapped.__v312Wrapped = true;
    window.draw = draw = wrapped;
  }

  function patchResizeHiDPI(){
    const previous = window.resize || (typeof resize === 'function' ? resize : null);
    if (!previous || previous.__v312Wrapped) return;
    const wrapped = function(){
      const wrap = byId('canvas-wrap');
      if (!wrap || !window.cvs && typeof cvs === 'undefined') return previous.apply(this, arguments);
      const canvas = window.cvs || cvs;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      try {
        W = wrap.clientWidth;
        H = wrap.clientHeight;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        canvas.width = Math.max(1, Math.round(W * dpr));
        canvas.height = Math.max(1, Math.round(H * dpr));
        if (typeof draw === 'function') draw();
      } catch(err) {
        return previous.apply(this, arguments);
      }
    };
    wrapped.__v312Wrapped = true;
    window.resize = resize = wrapped;
  }

  function patchImportExportSafety(){
    const exportBtn = byId('btn-export');
    if (exportBtn && !exportBtn.dataset.v312SafeExport) {
      exportBtn.dataset.v312SafeExport = '1';
      exportBtn.addEventListener('click', function(){ store.normalizeLive(); }, true);
    }
    document.addEventListener('change', function(ev){
      const input = ev.target;
      if (!input || input.type !== 'file') return;
      store.normalizeLive();
    }, true);
  }

  function installDevTools(){
    const previous = window.MySpace || {};
    window.MySpace = Object.assign({}, previous, {
      version: VERSION,
      bus,
      store,
      repository,
      commands,
      commandFactory,
      normalizeProject,
      normalizeNode,
      normalizeConnection,
      snapshot: () => store.snapshot(),
      saveNow: () => repository.save(store.snapshot()),
      getNode: (id) => store.getNode(id),
      commit: (reason) => store.commit(reason || 'manual'),
      execute: (command) => commands.execute(command),
      undoCommand: () => commands.undo(),
      redoCommand: () => commands.redo()
    });
  }

  patchSave();
  patchDraw();
  patchResizeHiDPI();
  patchImportExportSafety();
  installDevTools();
  store.normalizeLive();
  repository.save(store.snapshot()).catch(() => {});
  setTimeout(function(){ try { if (typeof resize === 'function') resize(); else if (typeof draw === 'function') draw(); } catch(_) {} }, 80);
})();

/* MySpace v3.13 - Engine Refactor Layer
   Goal: improve engine internals without changing the existing UI/UX contract. */
(function(){
  'use strict';
  const VERSION = '3.13-engine-refactor';
  const root = window.MySpace = window.MySpace || {};
  const previousEngine = root.Engine || {};

  function safeClone(value){
    return JSON.parse(JSON.stringify(value, function(key, val){
      if (key === 'imgObj') return undefined;
      if (val instanceof HTMLImageElement) return undefined;
      return val;
    }));
  }

  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  class NodeIndex {
    constructor(){ this.byId = new Map(); this.version = 0; this.lastSize = -1; }
    rebuild(list){
      this.byId.clear();
      (Array.isArray(list) ? list : []).forEach((node) => {
        if (node && node.id != null) this.byId.set(String(node.id), node);
      });
      this.lastSize = Array.isArray(list) ? list.length : 0;
      this.version++;
      return this;
    }
    ensure(){
      if (!Array.isArray(nodes)) return this.rebuild([]);
      if (this.lastSize !== nodes.length) return this.rebuild(nodes);
      // Cheap integrity check for common replace/undo cases.
      for (const n of nodes) {
        if (!n || n.id == null || this.byId.get(String(n.id)) !== n) return this.rebuild(nodes);
      }
      return this;
    }
    get(id){ this.ensure(); return this.byId.get(String(id)) || null; }
  }

  const nodeIndex = previousEngine.nodeIndex || new NodeIndex();

  const Viewport = {
    padding: 240,
    worldBounds(){
      const z = Math.max(0.05, camera && camera.zoom ? camera.zoom : 1);
      const pad = this.padding / z;
      return {
        left: (-camera.x / z) - pad,
        top: (-camera.y / z) - pad,
        right: ((W - camera.x) / z) + pad,
        bottom: ((H - camera.y) / z) + pad
      };
    },
    nodeVisible(node){
      if (!node) return false;
      const b = this.worldBounds();
      const h = node.minimized ? 44 : (node.height || 0);
      return !(node.x + (node.width || 0) < b.left || node.x > b.right || node.y + h < b.top || node.y > b.bottom);
    },
    connectionVisible(conn){
      const a = nodeIndex.get(conn && conn.from);
      const b = nodeIndex.get(conn && conn.to);
      return !!(a && b && (this.nodeVisible(a) || this.nodeVisible(b)));
    }
  };

  const DrawScheduler = {
    pending: false,
    lastReason: 'init',
    request(reason){
      this.lastReason = reason || 'draw';
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => {
        this.pending = false;
        try { if (typeof draw === 'function') draw(); } catch(err){ console.error('[MySpace v3.13] draw failed', err); }
      });
    }
  };

  const Text = {
    escape(value){
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    url(value){
      const raw = String(value || '').trim();
      if (!raw) return '';
      try {
        const u = new URL(raw, location.href);
        if (!['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol)) return '';
        return u.href;
      } catch(_) { return ''; }
    }
  };

  function normalizeNodeRuntime(node){
    if (!node || typeof node !== 'object') return node;
    node.id = node.id || ('n' + (typeof nodeIdCtr === 'number' ? nodeIdCtr++ : Date.now()));
    node.type = ['card','folder','note','image','text','wormhole'].includes(node.type) ? node.type : 'card';
    node.x = Number.isFinite(+node.x) ? +node.x : 0;
    node.y = Number.isFinite(+node.y) ? +node.y : 0;
    node.width = Math.max(40, Number.isFinite(+node.width) ? +node.width : 180);
    node.height = Math.max(30, Number.isFinite(+node.height) ? +node.height : 120);
    node.title = String(node.title == null ? '' : node.title).slice(0, 400);
    node.note = String(node.note == null ? '' : node.note).slice(0, 8000);
    node.actions = Array.isArray(node.actions) ? node.actions.slice(0, 16).map((a) => ({
      type: String((a && a.type) || 'url'),
      dest: String((a && a.dest) || '').slice(0, 2000),
      label: String((a && a.label) || '').slice(0, 120)
    })) : [];
    return node;
  }

  function normalizeRuntime(){
    if (Array.isArray(nodes)) nodes.forEach(normalizeNodeRuntime);
    if (Array.isArray(connections)) {
      nodeIndex.rebuild(nodes);
      for (let i = connections.length - 1; i >= 0; i--) {
        const c = connections[i];
        if (!c || !nodeIndex.get(c.from) || !nodeIndex.get(c.to)) connections.splice(i, 1);
      }
    }
    nodeIndex.rebuild(nodes);
  }

  function patchCreateNode(){
    const prev = window.createNode || (typeof createNode === 'function' ? createNode : null);
    if (!prev || prev.__v313Wrapped) return;
    const wrapped = function(){
      const node = prev.apply(this, arguments);
      normalizeNodeRuntime(node);
      return node;
    };
    wrapped.__v313Wrapped = true;
    window.createNode = createNode = wrapped;
  }

  function patchDrawNodeCulling(){
    const prev = window.drawNode || (typeof drawNode === 'function' ? drawNode : null);
    if (!prev || prev.__v313Wrapped) return;
    const wrapped = function(node){
      if (node && selectedNode && selectedNode.id === node.id) return prev.apply(this, arguments);
      if (node && !Viewport.nodeVisible(node)) return;
      return prev.apply(this, arguments);
    };
    wrapped.__v313Wrapped = true;
    window.drawNode = drawNode = wrapped;
  }

  function patchDrawConnIndex(){
    const prev = window.drawConn || (typeof drawConn === 'function' ? drawConn : null);
    if (!prev || prev.__v313Wrapped) return;
    const wrapped = function(conn){
      if (!conn || !Viewport.connectionVisible(conn)) return;
      // Keep the original drawing code for visual compatibility, but ensure index freshness.
      nodeIndex.ensure();
      return prev.apply(this, arguments);
    };
    wrapped.__v313Wrapped = true;
    window.drawConn = drawConn = wrapped;
  }

  function patchHitTesting(){
    const prevNodeAt = window.getNodeAt || (typeof getNodeAt === 'function' ? getNodeAt : null);
    if (prevNodeAt && !prevNodeAt.__v313Wrapped) {
      const wrappedNodeAt = function(x, y){
        // Fast path with the same reverse z-order semantics as the legacy function.
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i]; if (!n) continue;
          const h = n.minimized ? 44 : n.height;
          if (n.shape === 'circle') {
            const r = Math.min(n.width, h) / 2;
            if (Math.hypot(x - n.x - n.width / 2, y - n.y - h / 2) < r) return n;
          } else if (x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + h) return n;
        }
        return null;
      };
      wrappedNodeAt.__v313Wrapped = true;
      window.getNodeAt = getNodeAt = wrappedNodeAt;
    }

    const prevConnAt = window.getConnAt || (typeof getConnAt === 'function' ? getConnAt : null);
    if (prevConnAt && !prevConnAt.__v313Wrapped) {
      const wrappedConnAt = function(x, y){
        const thr = 10 / Math.max(0.05, camera.zoom || 1);
        nodeIndex.ensure();
        for (const c of connections) {
          const f = nodeIndex.get(c.from), t = nodeIndex.get(c.to);
          if (!f || !t) continue;
          const x1 = f.x + f.width / 2, y1 = f.y + f.height / 2;
          const x2 = t.x + t.width / 2, y2 = t.y + t.height / 2;
          if (typeof distToLine === 'function' && distToLine(x, y, x1, y1, x2, y2) < thr) return c;
        }
        return null;
      };
      wrappedConnAt.__v313Wrapped = true;
      window.getConnAt = getConnAt = wrappedConnAt;
    }
  }

  function patchHistory(){
    const prevSaveHist = window.saveHist || (typeof saveHist === 'function' ? saveHist : null);
    if (prevSaveHist && !prevSaveHist.__v313Wrapped) {
      const wrappedSaveHist = function(){
        try {
          const state = { nodes: safeClone(nodes), connections: safeClone(connections), camera: Object.assign({}, camera) };
          const signature = JSON.stringify(state);
          if (history[histIdx] && history[histIdx].__signature === signature) return;
          state.__signature = signature;
          history = history.slice(0, histIdx + 1);
          history.push(state);
          if (history.length > MAX_HIST) history.shift(); else histIdx++;
        } catch(err) {
          console.warn('[MySpace v3.13] optimized history failed, fallback used', err);
          return prevSaveHist.apply(this, arguments);
        }
      };
      wrappedSaveHist.__v313Wrapped = true;
      window.saveHist = saveHist = wrappedSaveHist;
    }

    const wrapRestore = (fnName) => {
      const prev = window[fnName] || (typeof globalThis[fnName] === 'function' ? globalThis[fnName] : null);
      if (!prev || prev.__v313Wrapped) return;
      const wrapped = function(){
        const result = prev.apply(this, arguments);
        normalizeRuntime();
        return result;
      };
      wrapped.__v313Wrapped = true;
      window[fnName] = wrapped;
      try { eval(fnName + ' = wrapped'); } catch(_) {}
    };
    wrapRestore('undo');
    wrapRestore('redo');
  }

  function patchUnsafeActionHtml(){
    // Capture action-panel clicks before legacy HTML rendering can run unsafe URLs.
    document.addEventListener('click', function(ev){
      const actionEl = ev.target && ev.target.closest ? ev.target.closest('.rpanel-action') : null;
      if (!actionEl) return;
      const val = actionEl.querySelector && actionEl.querySelector('.rpanel-action-val');
      if (!val) return;
      const raw = val.textContent || '';
      if (/^javascript:/i.test(raw.trim())) {
        ev.preventDefault(); ev.stopPropagation();
        alert('Ação bloqueada: URLs javascript: não são permitidas.');
      }
    }, true);
  }

  function patchDrawMetrics(){
    const prevDraw = window.draw || (typeof draw === 'function' ? draw : null);
    if (!prevDraw || prevDraw.__v313MetricsWrapped) return;
    const wrapped = function(){
      normalizeRuntime();
      const start = now();
      const result = prevDraw.apply(this, arguments);
      root.Engine.metrics.lastDrawMs = +(now() - start).toFixed(2);
      root.Engine.metrics.nodes = Array.isArray(nodes) ? nodes.length : 0;
      root.Engine.metrics.connections = Array.isArray(connections) ? connections.length : 0;
      return result;
    };
    wrapped.__v313MetricsWrapped = true;
    window.draw = draw = wrapped;
  }

  root.Engine = Object.assign(previousEngine, {
    version: VERSION,
    nodeIndex,
    viewport: Viewport,
    scheduler: DrawScheduler,
    text: Text,
    normalizeRuntime,
    requestDraw: (reason) => DrawScheduler.request(reason),
    metrics: Object.assign({ lastDrawMs: 0, nodes: 0, connections: 0 }, previousEngine.metrics || {})
  });

  patchCreateNode();
  patchDrawNodeCulling();
  patchDrawConnIndex();
  patchHitTesting();
  patchHistory();
  patchUnsafeActionHtml();
  patchDrawMetrics();
  normalizeRuntime();
  try { if (typeof draw === 'function') draw(); } catch(err){ console.warn('[MySpace v3.13] initial draw failed', err); }
})();

/* MySpace AI Bridge v2 - salva no IndexedDB */
(function(){
  function aiSave() {
    try {
      if (typeof saveHist === 'function') saveHist();
      if (typeof draw === 'function') draw();
      if (typeof triggerSave === 'function') triggerSave();
      // Força save no IndexedDB via repository
      if (window.MySpace && typeof window.MySpace.saveNow === 'function') {
        window.MySpace.saveNow().catch(() => {});
      }
    } catch(e) {}
  }

  window.MySpace_addNode = function(title, note, x, y, type) {
    try {
      const n = createNode(x || 300, y || 300, type || 'card');
      n.title = title || 'Novo nó';
      n.note = note || '';
      nodes.push(n);
      selectNodeObj(n);
      aiSave();
      return n;
    } catch(e) { console.warn('[AI Bridge] addNode error:', e); return null; }
  };

  window.MySpace_deleteNode = function(id) {
    try {
      const idx = nodes.findIndex(n => String(n.id) === String(id));
      if (idx >= 0) {
        nodes.splice(idx, 1);
        for (let i = connections.length - 1; i >= 0; i--) {
          if (String(connections[i].from) === String(id) || String(connections[i].to) === String(id)) connections.splice(i, 1);
        }
        aiSave();
        return true;
      }
      return false;
    } catch(e) { return false; }
  };

  window.MySpace_updateNode = function(id, patch) {
    try {
      const n = nodes.find(n => String(n.id) === String(id));
      if (n) { Object.assign(n, patch); aiSave(); return true; }
      return false;
    } catch(e) { return false; }
  };

  window.MySpace_addConnection = function(from, to, style, color) {
    try {
      connections.push({
        id: 'ac_' + Date.now(), from, to,
        style: style || 'curved', width: 2,
        color: color || 'default', opacity: 1
      });
      aiSave();
      return true;
    } catch(e) { return false; }
  };

  window.MySpace_getNodes = function() {
    try { return nodes.map(n => ({ id: n.id, title: n.title, note: n.note, type: n.type, x: n.x, y: n.y })); }
    catch(e) { return []; }
  };
})();
// ── AUTO-LAYOUT IA ──────────────────────────────────────────────
(function(){
  'use strict';

  const SETTINGS_KEY = 'myspace-ai-settings';

  function getAISettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch(_) { return {}; }
  }

  async function callAIForLayout(nodesData) {
    const s = getAISettings();
    const keys = s.keys || {};
    const models = s.models || {};

    const prompt = `Você é um organizador de mapas mentais. Analise os cards abaixo e reorganize-os no layout mais adequado ao conteúdo (roteiro linear, árvore, radial, timeline, etc).

Cards:
${nodesData.map(n => `- id:"${n.id}" titulo:"${n.title||''}" nota:"${(n.note||'').slice(0,80)}"`).join('\n')}

Responda APENAS com JSON válido, sem texto fora do JSON:
{
  "layout": "linear|tree|radial|timeline",
  "reasoning": "breve explicação",
  "positions": [
    {"id": "ID_DO_CARD", "x": 100, "y": 200}
  ]
}

Regras:
- Use layout LINEAR (horizontal, espaçamento x+280) para roteiros, sequências, fluxos
- Use layout TREE (hierárquico) para hierarquias, categorias
- Use layout RADIAL para mapas mentais
- Espaçamento mínimo 280px entre cards horizontal, 200px vertical
- Comece em x:100, y:300
- Retorne posição para TODOS os ${nodesData.length} cards`;

    // Tenta via proxy Vercel primeiro
    try {
      const res = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, keys, models, history: [] })
      });
      const data = await res.json();
      const text = (data.text || data.reply || '').replace(/```json|```/g,'').trim();
      return JSON.parse(text);
    } catch(_) {}

    // Fallback: chama provider direto
    const PROVIDERS = [
      { id:'groq', endpoint:'https://api.groq.com/openai/v1/chat/completions', auth:'Bearer', defaultModel:'llama-3.3-70b-versatile' },
      { id:'gemini', endpoint:null }, // tratado separado
      { id:'openai', endpoint:'https://api.openai.com/v1/chat/completions', auth:'Bearer', defaultModel:'gpt-4o-mini' },
    ];

    for(const p of PROVIDERS) {
      const key = keys[p.id];
      if(!key) continue;
      try {
        if(p.id === 'gemini') {
          const model = models['gemini'] || 'gemini-2.0-flash';
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ contents:[{ parts:[{text: prompt}] }] })
          });
          const d = await r.json();
          const text = (d.candidates?.[0]?.content?.parts?.[0]?.text||'').replace(/```json|```/g,'').trim();
          return JSON.parse(text);
        }
        const r = await fetch(p.endpoint, {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`${p.auth} ${key}`},
          body: JSON.stringify({ model: models[p.id]||p.defaultModel, messages:[{role:'user',content:prompt}], max_tokens:2000 })
        });
        const d = await r.json();
        const text = (d.choices?.[0]?.message?.content||'').replace(/```json|```/g,'').trim();
        return JSON.parse(text);
      } catch(_) { continue; }
    }
    throw new Error('Nenhum provider configurado com API key válida.');
  }

  function showLayoutToast(msg, color) {
    let t = document.getElementById('ai-layout-toast');
    if(!t) {
      t = document.createElement('div');
      t.id = 'ai-layout-toast';
      t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e1e1e;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;border:1px solid #333;transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.borderColor = color || '#333';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>{ t.style.opacity='0'; }, 3000);
  }

  document.addEventListener('DOMContentLoaded', function(){
    const btn = document.getElementById('btn-ai-layout');
    if(!btn) return;

    btn.addEventListener('click', async function(){
      const _nodes = window.MySpace_getNodes ? window.MySpace_getNodes() : (typeof nodes !== 'undefined' ? nodes : []);
      if(!_nodes || _nodes.length === 0) {
        showLayoutToast('⚠️ Nenhum card no canvas.', '#f59e0b');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="ti ti-loader-2"></i>';
      showLayoutToast('🤖 Analisando o mapa...', '#8b5cf6');

      try {
        const nodesData = _nodes.map(n => ({ id:n.id, title:n.title||'', note:n.note||'', type:n.type }));
        const result = await callAIForLayout(nodesData);

        if(!result.positions || !Array.isArray(result.positions)) throw new Error('Resposta inválida da IA');

        // Aplica posições
        let moved = 0;
        result.positions.forEach(p => {
          if(window.MySpace_updateNode) {
            if(window.MySpace_updateNode(p.id, {x: p.x, y: p.y})) moved++;
          } else {
            const n = (typeof nodes !== 'undefined') ? nodes.find(n => String(n.id) === String(p.id)) : null;
            if(n) { n.x = p.x; n.y = p.y; moved++; }
          }
        });

        saveHist();
        draw();
        triggerSave();

        const layoutName = { linear:'Linear', tree:'Árvore', radial:'Radial', timeline:'Timeline' }[result.layout] || result.layout;
        showLayoutToast(`✨ Reorganizado em ${layoutName} — ${moved} cards`, '#22c55e');
      } catch(err) {
        showLayoutToast('❌ ' + err.message, '#ef4444');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-wand"></i>';
      }
    });
  });
})();
