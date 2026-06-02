// ─── CANVAS SETUP ────────────────────────────────────────────────
const cvs = document.getElementById('cvs');
const ctx = cvs.getContext('2d');
let W, H;

function resize() {
  const wrap = document.getElementById('canvas-wrap');
  W = cvs.width = wrap.clientWidth;
  H = cvs.height = wrap.clientHeight;
  draw();
}

// ─── STATE ───────────────────────────────────────────────────────
let nodes = [];
let connections = [];
let selectedNode = null;
let selectedConn = null;
let nodeIdCtr = 1;
let connIdCtr = 1;
let mode = 'select';
let camera = { x: 0, y: 0, zoom: 1 };
let history = []; let histIdx = -1; const MAX_HIST = 50;
let isDragging = false, dragNode = null, dragOffset = {x:0,y:0};
let isPanning = false, panStart = {x:0,y:0};
let isResizing = false, resizeNode = null, resizeStart = {};
let connectStart = null;
let inlineEditing = null;

// Navigation / workspaces
let navStack = [], currentLevel = 'root';
let workspaces = { root: { nodes:[], connections:[], camera:{x:0,y:0,zoom:1} } };

let settings = {
  theme:'light', showGrid:true, showShadows:true, autoMinimize:false,
  defaultConnStyle:'curved', showArrows:true, highlightConn:true,
  autoSave:true, autoRestore:true
};

// ─── AUTO SAVE ───────────────────────────────────────────────────
let autoSaveTimer = null, lastSave = null;

function triggerSave() {
  if (!settings.autoSave) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(doSave, 2000);
}

function doSave() {
  try {
    const data = { workspaces, currentLevel, navStack, settings, ts: new Date().toISOString() };
    localStorage.setItem('myspace-v2', JSON.stringify(data));
    lastSave = new Date();
    updateSaveLabel();
    flashSave();
    const e = document.getElementById('last-save-time');
    if(e) e.textContent = 'Agora mesmo';
  } catch(e) { console.error(e); }
}

function flashSave() {
  const dot = document.getElementById('save-dot');
  const lbl = document.getElementById('save-label');
  if(dot && lbl) { dot.style.background='#22c55e'; lbl.textContent='Salvo'; }
}

function updateSaveLabel() {
  const t = document.getElementById('save-time');
  if(t && lastSave) t.textContent = '• ' + lastSave.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

function loadSave() {
  try {
    const raw = localStorage.getItem('myspace-v2');
    if(!raw) return false;
    const d = JSON.parse(raw);
    workspaces = d.workspaces || workspaces;
    currentLevel = d.currentLevel || 'root';
    navStack = d.navStack || [];
    settings = {...settings, ...(d.settings||{})};
    const cur = workspaces[currentLevel] || workspaces.root;
    nodes = cur.nodes || [];
    connections = cur.connections || [];
    camera = cur.camera || {x:0,y:0,zoom:1};
    lastSave = d.ts ? new Date(d.ts) : null;
    updateSaveLabel();
    applySettings();
    hydrateImages();
    return nodes.length > 0;
  } catch(e) { return false; }
}

// ─── NODE CREATION ───────────────────────────────────────────────
const BG_COLORS = { card:'none', folder:'#fef3c7', note:'#d1fae5' };
const BORDER_COLORS = { card:'none', folder:'#f59e0b', note:'#10b981' };
const EMOJIS_DEFAULT = { card:'📝', folder:'📁', note:'🗒️' };

function createNode(x, y, type='card') {
  const w = type==='folder'?160:(type==='note'?180:200);
  const defaultIconSize = Math.round(w * 0.20); // ~20% da largura = tamanho legível e proporcional
  return {
    id: `n${nodeIdCtr++}`, type, x, y,
    width: w,
    height: type==='folder'?120:(type==='note'?130:140),
    title: type==='folder'?'Nova Pasta':(type==='note'?'Nota':'Novo Card'),
    note: '',
    emoji: EMOJIS_DEFAULT[type]||'',
    iconSize: defaultIconSize,
    bgColor: BG_COLORS[type]||'none',
    bgOpacity: 1,
    borderColor: BORDER_COLORS[type]||'none',
    borderWidth: 1.5,
    textColor: (document.documentElement.getAttribute('data-theme')==='dark' || document.body.classList.contains('dark')) ? '#f8fafc' : '#1a1a18',
    textSize: 13,
    noteSize: 11,
    textBold: true,
    textItalic: false,
    textUnderline: false,
    iconX: 0,
    iconY: 0,
    iconBg: false,
    shape: type==='folder'?'circle':'rectangle',
    minimized: false,
    locked: false,
    actions: [],
    imageUrl: null,
    imgObj: null,
    linkTarget: null,
    
    // ── NOVOS CAMPOS PROFISSIONAIS ──
    // Sistema de formas avançadas
    shapeType: 'rectangle', // rectangle, square, rounded, circle, pill, hexagon, octagon, diamond, triangle, star, custom
    cornerRadius: 12,
    
    // Sistema de estilos visuais
    stylePreset: 'clean', // clean, minimal, neon, futuristic, glassmorphism, darktech, 3d, soft, outline, cyberpunk, terminal, material
    opacity: 1,
    blur: 0,
    glow: 0,
    glowColor: '#3b82f6',
    gradient: null, // {from:'#color1', to:'#color2', angle:90}
    animatedBorder: false,
    shadowIntensity: 1,
    
    // Sistema de hierarquia e elementos internos
    parentId: null, // ID do elemento pai (para cards dentro de cards)
    children: [], // IDs dos elementos filhos
    zIndex: 0, // Camada
    
    // Sistema de texto avançado
    richText: false,
    markdown: false,
    textAlign: 'left', // left, center, right
    bulletPoints: [],
    headingLevel: 0,
    
    // Sistema de ícones avançado
    iconOptional: true,
    iconType: 'emoji', // emoji, svg, custom
    iconUrl: null,
    iconRotation: 0,
    iconAnimated: false,
    
    // Sistema de imagens avançado
    imageCrop: null, // {x, y, width, height}
    imageRotation: 0,
    imageMask: null, // circle, rounded, custom
    imageOpacity: 1,
    
    // Sistema de notas profissionais
    noteExpanded: false,
    noteAttachments: [],
    noteChecklist: [],
    noteLinks: [],
    
    // Sistema de pastas
    folderContents: [], // IDs dos itens dentro da pasta
    folderOpen: false,
    isSubfolder: false,
    
    // Sistema de botões e links
    buttons: [], // [{label, action, target}]
    wormholes: [], // [{type, target, label}] - #ProjetoX, @CardY, !PastaZ
    
    // Sistema de projetos
    projectId: 'root',
    
    // Metadados
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    tags: [],
    priority: 0
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function colorOf(val, fallback) {
  if(!val || val==='none') return fallback;
  return val;
}

function hexToRgb(hex){
  if(!hex || hex==='none') return null;
  const h=hex.replace('#','').trim();
  if(h.length!==6) return null;
  return {r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16)};
}
function luminance(hex){
  const rgb=hexToRgb(hex); if(!rgb) return 1;
  const a=[rgb.r,rgb.g,rgb.b].map(v=>{v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);});
  return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
}
function readableTextColor(bg, preferred){
  // Se fundo é none/transparente, usa o fundo real do canvas (tema)
  const effectiveBg = (!bg || bg==='none' || bg==='transparent') ? cssVar('--bg') : bg;
  const bgLum = luminance(effectiveBg);
  // Sempre preto ou branco puro baseado na luminância do fundo
  // Threshold 0.45: fundos escuros → texto branco, fundos claros → texto preto
  const autoColor = bgLum < 0.45 ? '#ffffff' : '#111827';
  // Se tem cor preferida, verifica se tem contraste suficiente (4.5:1 WCAG AA)
  if (preferred && preferred !== 'none' && preferred !== '#1a1a18' && preferred !== '#f8fafc') {
    const c1 = (Math.max(bgLum, luminance(preferred)) + 0.05) / (Math.min(bgLum, luminance(preferred)) + 0.05);
    if (c1 >= 4.5) return preferred;
  }
  return autoColor;
}

function colorWithAlphaForFill(color, alpha){
  if(alpha === undefined || alpha === null || alpha >= 1 || !color || color === 'none') return color;
  alpha = Math.max(0, Math.min(1, Number(alpha)));
  if(color.startsWith('#')){
    const rgb = hexToRgb(color);
    return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` : color;
  }
  if(color.startsWith('rgb(')){
    return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  }
  if(color.startsWith('rgba(')){
    return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${alpha})`);
  }
  return color;
}

function loadNodeImage(node){
  if(!node || !node.imageUrl) return;
  const img=new Image();
  img.onload=()=>{ node.imgObj=img; draw(); };
  img.src=node.imageUrl;
}
function hydrateImages(){ nodes.forEach(loadNodeImage); }
function drawUnderline(c, text, x, y, size, align='left'){
  const w=c.measureText(text).width;
  const sx=align==='center'?x-w/2:x;
  c.beginPath(); c.moveTo(sx, y+size+2/camera.zoom); c.lineTo(sx+w, y+size+2/camera.zoom); c.stroke();
}


function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  c.beginPath();
  c.moveTo(x+r, y);
  c.lineTo(x+w-r, y);
  c.quadraticCurveTo(x+w,y, x+w,y+r);
  c.lineTo(x+w, y+h-r);
  c.quadraticCurveTo(x+w,y+h, x+w-r,y+h);
  c.lineTo(x+r, y+h);
  c.quadraticCurveTo(x,y+h, x,y+r);
  c.lineTo(x, y+r);
  c.quadraticCurveTo(x,y, x+r,y);
  c.closePath();
}

// ── FORMAS GEOMÉTRICAS AVANÇADAS ──
function drawHexagon(c, x, y, w, h) {
  const cx = x + w/2, cy = y + h/2;
  const rx = w/2, ry = h/2;
  c.beginPath();
  for(let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    if(i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

function drawOctagon(c, x, y, w, h) {
  const cx = x + w/2, cy = y + h/2;
  const rx = w/2, ry = h/2;
  c.beginPath();
  for(let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    if(i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

function drawDiamond(c, x, y, w, h) {
  c.beginPath();
  c.moveTo(x + w/2, y);
  c.lineTo(x + w, y + h/2);
  c.lineTo(x + w/2, y + h);
  c.lineTo(x, y + h/2);
  c.closePath();
}

function drawTriangle(c, x, y, w, h) {
  c.beginPath();
  c.moveTo(x + w/2, y);
  c.lineTo(x + w, y + h);
  c.lineTo(x, y + h);
  c.closePath();
}

function drawStar(c, x, y, w, h, points = 5) {
  const cx = x + w/2, cy = y + h/2;
  const outerRadius = Math.min(w, h) / 2;
  const innerRadius = outerRadius * 0.4;
  c.beginPath();
  for(let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    if(i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

function drawCardShape(c, node) {
  const x = node.x, y = node.y, w = node.width, h = node.height;
  const shape = node.shapeType || node.shape || 'rectangle';
  
  switch(shape) {
    case 'circle':
      c.beginPath();
      c.arc(x+w/2, y+h/2, Math.min(w,h)/2, 0, Math.PI*2);
      break;
    case 'hexagon':
      drawHexagon(c, x, y, w, h);
      break;
    case 'octagon':
      drawOctagon(c, x, y, w, h);
      break;
    case 'diamond':
      drawDiamond(c, x, y, w, h);
      break;
    case 'triangle':
      drawTriangle(c, x, y, w, h);
      break;
    case 'star':
      drawStar(c, x, y, w, h);
      break;
    case 'pill':
      roundRect(c, x, y, w, h, h/2);
      break;
    case 'rounded':
      roundRect(c, x, y, w, h, (node.cornerRadius||12));
      break;
    case 'square':
      const size = Math.min(w, h);
      roundRect(c, x, y, size, size, 8/camera.zoom);
      break;
    default: // rectangle
      const r = shape === 'rectangle' ? 12 : (node.cornerRadius||12);
      roundRect(c, x, y, w, h, r);
  }
}

// ══════════════════════════════════════════════════════════════
// ── FUNÇÕES MODULARES PROFISSIONAIS ──────────────────────────
// ══════════════════════════════════════════════════════════════

/**
 * renderShape - Renderiza forma geométrica com estilos avançados
 * Aplica: blur, glow, gradientes, sombras, opacidade
 * Preserva performance via otimização de canvas API
 */
function renderShape(c, node, isSel, isMin) {
  const x = node.x, y = node.y, w = node.width;
  const h = isMin ? 44 : node.height;
  
  c.save();
  
  // Aplicar opacidade global
  if(node.opacity && node.opacity < 1) {
    c.globalAlpha = node.opacity;
  }
  
  // Aplicar blur (glassmorphism)
  if(node.blur && node.blur > 0 && !isMin) {
    c.filter = `blur(${node.blur/camera.zoom}px)`;
  }
  
  // Aplicar sombra otimizada
  if(settings.showShadows && !isMin) {
    const intensity = node.shadowIntensity || 1;
    c.shadowColor = 'rgba(0,0,0,' + (0.1 * intensity) + ')';
   c.shadowBlur = 14 * intensity;
c.shadowOffsetY = 3 * intensity;
  }
  
  // Desenhar forma
  drawCardShape(c, {...node, height: h});
  
  // Aplicar preenchimento (suporte a gradiente)
  if(node.gradient && node.gradient.from && node.gradient.to) {
    const angle = (node.gradient.angle || 135) * Math.PI / 180;
    const grd = c.createLinearGradient(
      x, y, 
      x + w * Math.cos(angle), 
      y + h * Math.sin(angle)
    );
    grd.addColorStop(0, node.gradient.from);
    grd.addColorStop(1, node.gradient.to);
    c.fillStyle = grd;
  } else {
    const bgFill = colorOf(node.bgColor, cssVar('--bg'));
    c.fillStyle = colorWithAlphaForFill(bgFill, node.bgOpacity === undefined ? 1 : node.bgOpacity);
  }
  
  c.fill();
  c.shadowColor = 'transparent';
  c.filter = 'none';
  
  // Aplicar glow effect
  if(node.glow && node.glow > 0 && !isMin) {
    c.shadowColor = node.glowColor || '#3b82f6';
    c.shadowBlur = node.glow / camera.zoom;
    c.lineWidth = (node.borderWidth || 2) / camera.zoom;
    c.strokeStyle = node.glowColor || '#3b82f6';
    c.stroke();
    c.shadowColor = 'transparent';
  }
  
  // Aplicar borda normal
  const bdCol = colorOf(node.borderColor, cssVar('--border'));
  const bw = (node.borderWidth || 1.5) / camera.zoom;
  c.lineWidth = isSel ? Math.max(bw, 2/camera.zoom) : bw;
  c.strokeStyle = isSel ? '#3b82f6' : bdCol;
  if(bdCol !== 'none' || isSel) c.stroke();
  
  c.restore();
}

/**
 * renderIcon - Renderiza ícone adaptativo
 * Herda transformações do pai: escala, rotação, minimização
 */
function renderIcon(c, node, isMin) {
  if(!node.emoji && !node.iconUrl) return;
  if(isMin) return; // Ícone oculto quando minimizado
  
  const x = node.x, y = node.y;
  const iconSize = node.iconSize || 28; // escala com o zoom (sem /camera.zoom)
  const iconX = node.iconX || 0;
  const iconY = node.iconY || 0;
  
  c.save();
  
  // Aplicar rotação se especificado
  if(node.iconRotation) {
    c.translate(x + iconX + iconSize/2, y + iconY + iconSize/2);
    c.rotate(node.iconRotation * Math.PI / 180);
    c.translate(-(x + iconX + iconSize/2), -(y + iconY + iconSize/2));
  }
  
  // Renderizar emoji ou imagem
  if(node.emoji) {
    c.font = `${iconSize}px Arial`;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(node.emoji, x + iconX, y + iconY);
  } else if(node.iconUrl && node.iconObj instanceof HTMLImageElement) {
    c.drawImage(node.iconObj, x + iconX, y + iconY, iconSize, iconSize);
  }
  
  c.restore();
}

/**
 * renderChildNodes - Renderiza filhos hierarquicamente
 * Aplica transformações proporcionais do pai
 */
function renderChildNodes(c, parentNode) {
  if(!parentNode.children || parentNode.children.length === 0) return;
  if(parentNode.minimized) return; // Filhos ocultos se pai minimizado
  
  c.save();
  
  // Aplicar transformações do pai se necessário
  // (clip region para garantir que filhos não saem do pai)
  if(parentNode.type === 'folder' || parentNode.clipChildren) {
    c.beginPath();
    drawCardShape(c, parentNode);
    c.clip();
  }
  
  // Renderizar cada filho
  parentNode.children.forEach(childId => {
    const child = nodes.find(n => n.id === childId);
    if(child) {
      // Filhos herdam visibilidade do pai
      if(!parentNode.minimized) {
        drawNode(child);
      }
    }
  });
  
  c.restore();
}

/**
 * handleNavigation - Sistema de navegação inteligente
 * Suporta: #Projeto, @Card, !Pasta, nota:Nome, URLs
 */
function handleNavigation(action) {
  if(!action || !action.type || !action.dest) return;
  
  switch(action.type) {
    case 'url':
      window.open(action.dest, '_blank');
      break;
      
    case 'folder':
      const folder = nodes.find(n => n.type === 'folder' && n.title === action.dest);
      if(folder) openFolder(folder);
      break;
      
    case 'card':
      const card = nodes.find(n => n.title === action.dest || n.id === action.dest);
      if(card) {
        selectNodeObj(card);
        centerCameraOn(card);
      }
      break;
      
    case 'wormhole':
      handleWormhole(action.dest);
      break;
      
    case 'project':
      navigateToProject(action.dest);
      break;
  }
}

/**
 * handleWormhole - Navega para wormhole (link inteligente)
 * Sintaxe: #Projeto, @Card, !Pasta, nota:Nome
 */
function handleWormhole(dest) {
  if(!dest) return;
  
  // Detectar tipo de wormhole
  if(dest.startsWith('#')) {
    // #Projeto
    const projectName = dest.substring(1);
    navigateToProject(projectName);
  } else if(dest.startsWith('@')) {
    // @Card
    const cardName = dest.substring(1);
    const card = nodes.find(n => n.title === cardName || n.id === cardName);
    if(card) {
      selectNodeObj(card);
      centerCameraOn(card);
    }
  } else if(dest.startsWith('!')) {
    // !Pasta
    const folderName = dest.substring(1);
    const folder = nodes.find(n => n.type === 'folder' && n.title === folderName);
    if(folder) openFolder(folder);
  } else if(dest.startsWith('nota:')) {
    // nota:Nome
    const noteName = dest.substring(5);
    const note = nodes.find(n => n.type === 'note' && n.title === noteName);
    if(note) {
      selectNodeObj(note);
      centerCameraOn(note);
    }
  }
}

/**
 * navigateToProject - Navega para outro projeto
 * Cross-project: abre projeto e centraliza em elemento específico
 */
function navigateToProject(projectNameOrId, targetElementId = null) {
  // Procurar projeto pelo nome ou ID
  let projectId = null;
  
  Object.keys(workspaces).forEach(key => {
    const ws = workspaces[key];
    if(key === projectNameOrId || ws.name === projectNameOrId) {
      projectId = key;
    }
  });
  
  if(!projectId) {
    alert('Projeto não encontrado: ' + projectNameOrId);
    return;
  }
  
  // Salvar estado atual
  persistCurrentWorkspaceState();
  
  // Carregar novo projeto
  currentLevel = projectId;
  const ws = workspaces[projectId];
  nodes = ws.nodes || [];
  connections = ws.connections || [];
  camera = ws.camera || {x:0, y:0, zoom:1};
  
  // Se especificou elemento alvo, centralizar nele
  if(targetElementId) {
    const target = nodes.find(n => n.id === targetElementId || n.title === targetElementId);
    if(target) {
      centerCameraOn(target);
      selectNodeObj(target);
    }
  }
  
  selectNodeObj(null);
  saveHist();
  draw();
  triggerSave();
  updateBreadcrumb();
}

/**
 * centerCameraOn - Centraliza câmera em um elemento
 */
function centerCameraOn(node) {
  if(!node) return;
  camera.x = W/2 - (node.x + node.width/2) * camera.zoom;
  camera.y = H/2 - (node.y + node.height/2) * camera.zoom;
  draw();
}

/**
 * resizeChildrenProportionally - Redimensiona filhos proporcionalmente
 * Quando pai é redimensionado, filhos acompanham a proporção
 */
function resizeChildrenProportionally(parentNode, oldWidth, oldHeight) {
  // Versão segura: evita recursão via wrapper global, ciclos pai/filho e valores NaN/Infinity.
  const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const visited = new Set();

  function resizeBranch(node, previousWidth, previousHeight) {
    if(!node || visited.has(node.id)) return;
    visited.add(node.id);

    const children = Array.isArray(node.children) ? node.children : [];
    if(children.length === 0) return;

    const baseW = Math.max(1, Math.abs(finite(previousWidth, node.width || 1)));
    const baseH = Math.max(1, Math.abs(finite(previousHeight, node.height || 1)));
    const nodeW = Math.max(1, Math.abs(finite(node.width, baseW)));
    const nodeH = Math.max(1, Math.abs(finite(node.height, baseH)));
    const scaleX = nodeW / baseW;
    const scaleY = nodeH / baseH;

    children.forEach(childId => {
      const child = nodes.find(n => n && n.id === childId);
      if(!child || child === node || visited.has(child.id)) return;

      const childOldW = Math.max(1, Math.abs(finite(child.width, 1)));
      const childOldH = Math.max(1, Math.abs(finite(child.height, 1)));
      const relX = finite(child.x, node.x || 0) - finite(node.x, 0);
      const relY = finite(child.y, node.y || 0) - finite(node.y, 0);

      child.x = finite(node.x, 0) + relX * scaleX;
      child.y = finite(node.y, 0) + relY * scaleY;
      child.width = Math.max(10, childOldW * scaleX);
      child.height = Math.max(10, childOldH * scaleY);

      resizeBranch(child, childOldW, childOldH);
    });
  }

  resizeBranch(parentNode, oldWidth, oldHeight);
}

/**
 * getButtonAt - Detecta se o clique foi em um botão de ação
 */
function getButtonAt(node, mx, my) {
  if(!node.actions || node.actions.length === 0) return null;
  if(node.minimized) return null;
  
  const x = node.x, y = node.y, h = node.height;
  const pad = 14/camera.zoom;
  const btnY = y + h - 35/camera.zoom;
  const btnH = 24/camera.zoom;
  const btnW = 30/camera.zoom;
  const btnPad = 8/camera.zoom;
  
  let btnX = x + pad;
  
  for(let i = 0; i < Math.min(3, node.actions.length); i++) {
    if(mx >= btnX && mx <= btnX + btnW && 
       my >= btnY && my <= btnY + btnH) {
      return node.actions[i];
    }
    btnX += btnW + btnPad;
  }
  
  return null;
}

/**
 * getWormholeAt - Detecta se o clique foi em um wormhole
 */
function getWormholeAt(node, mx, my) {
  if(!node.wormholes || node.wormholes.length === 0) return null;
  if(node.minimized) return null;
  
  const x = node.x, y = node.y, h = node.height;
  const pad = 14/camera.zoom;
  const wormY = y + h - 60/camera.zoom;
  const wormSize = 12/camera.zoom;
  
  let wormX = x + pad;
  
  for(let i = 0; i < Math.min(5, node.wormholes.length); i++) {
    if(mx >= wormX && mx <= wormX + wormSize && 
       my >= wormY && my <= wormY + wormSize) {
      return node.wormholes[i];
    }
    wormX += wormSize + 4/camera.zoom;
  }
  
  return null;
}

function wrapLines(c, text, maxW, maxLines) {
  const lines = [];
  const paragraphs = String(text||'').split('\n');
  for(const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if(words.length===0) { lines.push(''); continue; }
    let cur = '';
    for(const w of words) {
      const test = cur ? cur+' '+w : w;
      if(c.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
      if(maxLines && lines.length >= maxLines) return lines;
    }
    if(cur) lines.push(cur);
    if(maxLines && lines.length >= maxLines) return lines;
  }
  return lines;
}

function fitText(c, text, maxW) {
  if(c.measureText(text).width <= maxW) return text;
  let t = text;
  while(t.length > 0 && c.measureText(t+'…').width > maxW) t=t.slice(0,-1);
  return t+'…';
}

// ─── DRAWING ─────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  if(settings.showGrid) drawGrid();
  connections.forEach(drawConn);
  nodes.forEach(drawNode);
  ctx.restore();

  document.getElementById('zoom-val').textContent = Math.round(camera.zoom*100)+'%';
  document.getElementById('status-text').textContent =
    `Cards: ${nodes.length} | Conexões: ${connections.length} | Zoom: ${Math.round(camera.zoom*100)}%`;
}

function drawGrid() {
  const g = 40;
  const sx = Math.floor(-camera.x/camera.zoom/g)*g;
  const sy = Math.floor(-camera.y/camera.zoom/g)*g;
  const ex = sx + W/camera.zoom + g;
  const ey = sy + H/camera.zoom + g;
  ctx.save();
  ctx.strokeStyle = cssVar('--border');
  ctx.lineWidth = 0.5/camera.zoom;
  ctx.globalAlpha = 0.4;
  for(let x=sx; x<ex; x+=g) { ctx.beginPath(); ctx.moveTo(x,sy); ctx.lineTo(x,ey); ctx.stroke(); }
  for(let y=sy; y<ey; y+=g) { ctx.beginPath(); ctx.moveTo(sx,y); ctx.lineTo(ex,y); ctx.stroke(); }
  ctx.restore();
}

function drawConn(conn) {
  const from = nodes.find(n=>n.id===conn.from);
  const to = nodes.find(n=>n.id===conn.to);
  if(!from||!to) return;
  const x1=from.x+from.width/2, y1=from.y+from.height/2;
  const x2=to.x+to.width/2, y2=to.y+to.height/2;
  const style = conn.style || settings.defaultConnStyle;
  const lw = conn.width||2;
  const col = conn.color==='default'||!conn.color ? cssVar('--connection-color') : conn.color;
  const isSelConn = selectedConn && selectedConn.id===conn.id;
  const isRelated = settings.highlightConn && selectedNode &&
    (conn.from===selectedNode.id||conn.to===selectedNode.id);
  const curve = conn.curve ?? 70;

  ctx.save();
  ctx.strokeStyle = isSelConn ? '#f59e0b' : isRelated ? cssVar('--accent') : col;
  ctx.lineWidth = lw/camera.zoom;
  ctx.globalAlpha = conn.opacity||1;
  if(style==='dashed') ctx.setLineDash([8/camera.zoom, 5/camera.zoom]);

  ctx.beginPath();
  if(style==='straight'||style==='dashed') {
    ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
  } else if(style==='curved') {
    const dx=x2-x1, dy=y2-y1;
    const len=Math.max(1, Math.hypot(dx,dy));
    const nx=-dy/len, ny=dx/len;
    const mx=(x1+x2)/2, my=(y1+y2)/2;
    ctx.moveTo(x1,y1);
    ctx.quadraticCurveTo(mx+nx*curve, my+ny*curve, x2,y2);
  } else {
    const mx=(x1+x2)/2;
    ctx.moveTo(x1,y1); ctx.lineTo(mx,y1); ctx.lineTo(mx,y2); ctx.lineTo(x2,y2);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if(settings.showArrows) {
    const angle = Math.atan2(y2-y1, x2-x1);
    const as = 9/camera.zoom;
    ctx.save();
    ctx.translate(x2,y2); ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(-as,-as/2.2); ctx.lineTo(-as,as/2.2);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

function drawNode(node) {
  if(inlineEditing && inlineEditing.id===node.id) return;
  if(node.imageUrl && !node.imgObj) loadNodeImage(node);

  const isSel = selectedNode && selectedNode.id===node.id;
  const isMin = node.minimized || (settings.autoMinimize && !isSel);
  const w=node.width, h=isMin?44:node.height;
  const x=node.x, y=node.y;
  const bgFill = colorOf(node.bgColor, cssVar('--bg'));
  const txCol = readableTextColor(bgFill, colorOf(node.textColor, cssVar('--text')));

  // ── USAR FUNÇÃO MODULAR PARA RENDERIZAÇÃO ──
  renderShape(ctx, node, isSel, isMin);

  if(isMin) {
    const pad=10/camera.zoom;
    ctx.font = `500 ${13/camera.zoom}px Inter`;
    ctx.fillStyle = txCol;
    ctx.textBaseline='middle';
    ctx.fillText(fitText(ctx, (node.emoji?node.emoji+' ':'')+node.title, w-pad*2), x+pad, y+22/camera.zoom);
    ctx.textBaseline='alphabetic';
    return;
  }

  const pad = 14/camera.zoom;
  const cx = (node.shapeType||node.shape)==='circle' ? x+(w-Math.min(w,h)*0.7)/2 : x+pad;
  const cw = Math.max(20, (node.shapeType||node.shape)==='circle' ? Math.min(w,h)*0.7 : w-pad*2);
  let textY = y+pad;

  if(node.imageUrl && node.imgObj instanceof HTMLImageElement) {
    const imgH = Math.min(h*0.45, h-45/camera.zoom);
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x+2/camera.zoom, y+2/camera.zoom, w-4/camera.zoom, imgH, 10/camera.zoom);
    ctx.clip();
    const imgOpacity = node.imageOpacity || 1;
    ctx.globalAlpha = imgOpacity;
    ctx.drawImage(node.imgObj, x+2/camera.zoom, y+2/camera.zoom, w-4/camera.zoom, imgH);
    ctx.globalAlpha = 1;
    ctx.restore();
    textY = y + imgH + 7/camera.zoom;
  }

  // ── USAR FUNÇÃO MODULAR PARA ÍCONES ──
  if(node.emoji || node.iconUrl) {
    renderIcon(ctx, node, isMin);
    const eis = node.iconSize||28; // proporcional ao zoom
    textY += Math.max(0, eis+7+(node.iconY||0));
  }

  ctx.fillStyle = txCol;
  ctx.strokeStyle = txCol;
  const titleSz = (node.textSize||13)/camera.zoom;
  const weight = node.textBold===false ? 500 : 700;
  const italic = node.textItalic ? 'italic ' : '';
  ctx.font = `${italic}${weight} ${titleSz}px Inter`;
  ctx.textBaseline='top';
  if((node.shapeType||node.shape)==='circle') ctx.textAlign='center';
  
  // ── RENDERIZAR BOTÕES DE AÇÃO ──
  if(node.actions && node.actions.length > 0 && !isMin) {
    const btnY = y + h - 35/camera.zoom;
    const btnH = 24/camera.zoom;
    const btnPad = 8/camera.zoom;
    let btnX = x + pad;
    
    node.actions.forEach((action, idx) => {
      if(idx >= 3) return; // Máximo 3 botões visíveis
      
      const btnText = action.type === 'url' ? '🔗' : 
                      action.type === 'folder' ? '📁' :
                      action.type === 'card' ? '📝' : '🌀';
      
      const btnW = 30/camera.zoom;
      
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      roundRect(ctx, btnX, btnY, btnW, btnH, 4/camera.zoom);
      ctx.fill();
      
      ctx.font = `${16/camera.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = txCol;
      ctx.fillText(btnText, btnX + btnW/2, btnY + btnH/2);
      ctx.restore();
      
      btnX += btnW + btnPad;
    });
  }
  
  // ── RENDERIZAR WORMHOLES ──
  if(node.wormholes && node.wormholes.length > 0 && !isMin) {
    const wormY = y + h - 60/camera.zoom;
    let wormX = x + pad;
    const wormSize = 12/camera.zoom;
    
    node.wormholes.forEach((worm, idx) => {
      if(idx >= 5) return; // Máximo 5 wormholes visíveis
      
      const icon = worm.type === 'project' ? '#' :
                   worm.type === 'card' ? '@' :
                   worm.type === 'folder' ? '!' : '📝';
      
      ctx.save();
      ctx.font = `${wormSize}px Inter`;
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(icon, wormX, wormY);
      ctx.restore();
      
      wormX += wormSize + 4/camera.zoom;
    });
  }

  const titleLines = wrapLines(ctx, node.title||'Sem título', cw, Math.max(1, Math.floor((h-(textY-y)-20/camera.zoom)/(titleSz+4/camera.zoom))));
  titleLines.forEach((ln,i) => {
    const lx = node.shape==='circle' ? x+w/2 : cx;
    const ly = textY + i*(titleSz+4/camera.zoom);
    ctx.fillText(ln, lx, ly);
    if(node.textUnderline) drawUnderline(ctx, ln, lx, ly, titleSz, node.shape==='circle'?'center':'left');
  });
  textY += titleLines.length*(titleSz+4/camera.zoom)+4/camera.zoom;

  if(node.note && !isMin) {
    const noteSz = (node.noteSize||11)/camera.zoom;
    ctx.font = `${node.textItalic?'italic ':''}400 ${noteSz}px Inter`;
    ctx.fillStyle = txCol;
    ctx.strokeStyle = txCol;
    const maxLines = Math.max(1, Math.floor((y+h-pad-textY)/(noteSz+4/camera.zoom)));
    const noteLines = wrapLines(ctx, node.note, cw, maxLines);
    noteLines.forEach((ln,i)=>{
      const lx = node.shape==='circle' ? x+w/2 : cx;
      const ly = textY+i*(noteSz+4/camera.zoom);
      ctx.fillText(ln, lx, ly);
      if(node.textUnderline) drawUnderline(ctx, ln, lx, ly, noteSz, node.shape==='circle'?'center':'left');
    });
  }

  ctx.textAlign='left';
  ctx.textBaseline='alphabetic';

  if(isSel && !node.locked) {
    ctx.save();
    ctx.fillStyle='#3b82f6';
    ctx.beginPath();
    ctx.arc(x+w, y+h, 5/camera.zoom, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}


function getNodeAt(x,y) {
  for(let i=nodes.length-1;i>=0;i--) {
    const n=nodes[i], h=n.minimized?44:n.height;
    if(n.shape==='circle') {
      const r=Math.min(n.width,h)/2;
      if(Math.hypot(x-n.x-n.width/2,y-n.y-h/2)<r) return n;
    } else {
      if(x>=n.x&&x<=n.x+n.width&&y>=n.y&&y<=n.y+h) return n;
    }
  }
  return null;
}

function getConnAt(x,y) {
  const thr=10/camera.zoom;
  for(const c of connections) {
    const f=nodes.find(n=>n.id===c.from), t=nodes.find(n=>n.id===c.to);
    if(!f||!t) continue;
    const x1=f.x+f.width/2,y1=f.y+f.height/2,x2=t.x+t.width/2,y2=t.y+t.height/2;
    if(distToLine(x,y,x1,y1,x2,y2)<thr) return c;
  }
  return null;
}

function distToLine(px,py,x1,y1,x2,y2) {
  const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;
  if(len2===0) return Math.hypot(px-x1,py-y1);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/len2));
  return Math.hypot(px-x1-t*dx,py-y1-t*dy);
}

function isResizeHandle(node, x, y) {
  if(!node) return false;
  const h=node.minimized?44:node.height;
  const thr=16/camera.zoom;
  return Math.hypot(x-(node.x+node.width), y-(node.y+h)) < thr;
}

cvs.addEventListener('mousedown', e=>{
  if(inlineEditing) commitInlineEdit();
  const rect=cvs.getBoundingClientRect();
  const mx=(e.clientX-rect.left-camera.x)/camera.zoom;
  const my=(e.clientY-rect.top-camera.y)/camera.zoom;

  hideContextMenu();

  if(mode==='hand' || (e.button===1)) {
    isPanning=true;
    panStart.x=e.clientX-camera.x;
    panStart.y=e.clientY-camera.y;
    cvs.style.cursor='grabbing';
    return;
  }

  if(mode==='connect') {
    const n=getNodeAt(mx,my);
    if(n) connectStart=n;
    return;
  }

  if(['card','folder','note','text','image','wormhole'].includes(mode)) {
    const t = mode==='text'?'note':mode;
    // Evita criar em cima de outro nó — desloca até achar posição livre
    let px=mx-100, py=my-60;
    let attempts=0;
    while(nodes.some(n=>Math.abs(n.x-px)<40&&Math.abs(n.y-py)<40) && attempts++<8){
      px+=40; py+=40;
    }
    const nn=createNode(px,py,t);
    if(mode==='text') { nn.type='card'; nn.note='Texto'; nn.title=''; nn.emoji=''; nn.bgColor='none'; nn.borderColor='none'; }
    if(mode==='image') { nn.type='card'; nn.title=''; nn.note=''; nn.emoji=''; nn.bgColor='none'; nn.borderColor='none'; nn.borderWidth=0; setTimeout(()=>document.getElementById('image-file').click(),0); }
    if(mode==='wormhole') { nn.type='card'; nn.title='Wormhole'; nn.note='#Projeto'; nn.emoji='🌀'; nn.bgColor='#e9d5ff'; nn.borderColor='#8b5cf6'; nn.actions=[{type:'wormhole',dest:'#Projeto'}]; }
    nodes.push(nn);
    selectNodeObj(nn);
    saveHist(); draw(); triggerSave();
    mode='select';
    document.querySelectorAll('.sidebar-tool').forEach(b=>b.classList.remove('on'));
    document.getElementById('tool-select').classList.add('on');
    return;
  }

  const n=getNodeAt(mx,my);
  if(n) {
    // ── DETECTAR CLIQUE EM BOTÕES ──
    const clickedBtn = getButtonAt(n, mx, my);
    if(clickedBtn) {
      handleNavigation(clickedBtn);
      return;
    }
    
    // ── DETECTAR CLIQUE EM WORMHOLES ──
    const clickedWorm = getWormholeAt(n, mx, my);
    if(clickedWorm) {
      const wormDest = clickedWorm.target || clickedWorm.dest;
      if(wormDest) handleWormhole(wormDest);
      return;
    }
    
    if(e.detail===2) { if(!activateNode(n)) startInlineEdit(n,e); return; }
    if(isResizeHandle(n,mx,my) && !n.locked) {
      isResizing=true; resizeNode=n;
      resizeStart={mx,my,w:n.width,h:n.minimized?44:n.height,iconSize:n.iconSize||({'icon':42,'folder':32,'note':28,'card':28}[n.type]||28)};
      return;
    }
    selectNodeObj(n);
    nodes=nodes.filter(x=>x.id!==n.id).concat(n);
    if(!n.locked) { isDragging=true; dragNode=n; dragOffset.x=mx-n.x; dragOffset.y=my-n.y; }
    draw();
  } else {
    const c=getConnAt(mx,my);
    if(c) { selectConnObj(c); draw(); return; }
    selectNodeObj(null); selectConnObj(null);
    isPanning=true;
    panStart.x=e.clientX-camera.x;
    panStart.y=e.clientY-camera.y;
    draw();
  }
});

cvs.addEventListener('mousemove', e=>{
  const rect=cvs.getBoundingClientRect();
  const mx=(e.clientX-rect.left-camera.x)/camera.zoom;
  const my=(e.clientY-rect.top-camera.y)/camera.zoom;

  if(isResizing&&resizeNode) {
    const dx=mx-resizeStart.mx, dy=my-resizeStart.my;
    const oldW = resizeNode.width, oldH = resizeNode.height;
    const isIcon = resizeNode.type === 'icon';
    const minW = isIcon ? 24 : 80;
    const minH = isIcon ? 24 : 50;
    resizeNode.width  = Math.max(minW, resizeStart.w + dx);
    resizeNode.height = Math.max(minH, resizeStart.h + dy);
    // iconSize escala proporcionalmente em TODOS os tipos de nó
    if(resizeStart.iconSize > 0 && resizeStart.w > 0) {
      const scale = resizeNode.width / resizeStart.w;
      resizeNode.iconSize = Math.max(10, Math.min(200, Math.round(resizeStart.iconSize * scale)));
    }
    // Redimensionar filhos proporcionalmente
    resizeChildrenProportionally(resizeNode, oldW, oldH);
    updatePanel(); draw();
  } else if(isDragging&&dragNode) {
    const oldX=dragNode.x, oldY=dragNode.y;
    dragNode.x=mx-dragOffset.x; dragNode.y=my-dragOffset.y;
    // Mover filhos junto (sistema hierárquico)
    const deltaX=dragNode.x-oldX, deltaY=dragNode.y-oldY;
    if(dragNode.children && dragNode.children.length>0) {
      dragNode.children.forEach(childId=>{
        const child=nodes.find(n=>n.id===childId);
        if(child) { child.x+=deltaX; child.y+=deltaY; }
      });
    }
    draw();
  } else if(isPanning) {
    camera.x=e.clientX-panStart.x;
    camera.y=e.clientY-panStart.y;
    draw();
  } else if(mode==='connect'&&connectStart) {
    draw();
    ctx.save();
    ctx.translate(camera.x,camera.y); ctx.scale(camera.zoom,camera.zoom);
    ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2.5/camera.zoom;
    ctx.shadowColor='rgba(59,130,246,.5)'; ctx.shadowBlur=8/camera.zoom;
    ctx.setLineDash([8/camera.zoom,4/camera.zoom]);
    ctx.beginPath();
    ctx.moveTo(connectStart.x+connectStart.width/2,connectStart.y+connectStart.height/2);
    ctx.lineTo(mx,my); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  // Cursor
  if(selectedNode && isResizeHandle(selectedNode,mx,my)) cvs.style.cursor='nwse-resize';
  else if(isDragging||isPanning) cvs.style.cursor='grabbing';
  else if(mode==='hand') cvs.style.cursor='grab';
  else if(mode==='connect') cvs.style.cursor='crosshair';
  else if(['card','folder','note','text','image','wormhole'].includes(mode)) cvs.style.cursor='copy';
  else cvs.style.cursor='default';
});

cvs.addEventListener('mouseup', e=>{
  if(isResizing) { saveHist(); triggerSave(); }
  if(isDragging&&dragNode) { saveHist(); triggerSave(); }
  if(mode==='connect'&&connectStart) {
    const rect=cvs.getBoundingClientRect();
    const mx=(e.clientX-rect.left-camera.x)/camera.zoom;
    const my=(e.clientY-rect.top-camera.y)/camera.zoom;
    const en=getNodeAt(mx,my);
    if(en&&en.id!==connectStart.id) {
      const ex=connections.some(c=>(c.from===connectStart.id&&c.to===en.id)||(c.from===en.id&&c.to===connectStart.id));
      if(!ex) {
        connections.push({id:`c${connIdCtr++}`,from:connectStart.id,to:en.id,style:settings.defaultConnStyle,width:2,color:'default',opacity:1,curve:70});
        saveHist(); triggerSave();
      }
    }
    connectStart=null;
  }
  isResizing=false; resizeNode=null;
  isDragging=false; dragNode=null;
  isPanning=false;
  cvs.style.cursor='default';
  draw();
});

window.addEventListener('mouseup',()=>{ isDragging=false; dragNode=null; isPanning=false; isResizing=false; resizeNode=null; });

cvs.addEventListener('wheel',e=>{
  e.preventDefault();
  // Shift + scroll → tamanho do ícone do card selecionado
  if(e.shiftKey && selectedNode && !selectedNode.locked) {
    const delta = e.deltaY > 0 ? -2 : 2;
    selectedNode.iconSize = Math.max(10, Math.min(200, (selectedNode.iconSize||28) + delta));
    saveHist(); draw(); triggerSave(); updatePanel();
    return;
  }
  const rect=cvs.getBoundingClientRect();
  const mx=e.clientX-rect.left, my=e.clientY-rect.top;
  const wx=(mx-camera.x)/camera.zoom, wy=(my-camera.y)/camera.zoom;
  const dz=e.deltaY>0?0.9:1.1;
  const nz=Math.max(0.08,Math.min(4,camera.zoom*dz));
  camera.x=mx-wx*nz; camera.y=my-wy*nz; camera.zoom=nz;
  draw();
},{passive:false});

cvs.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const rect=cvs.getBoundingClientRect();
  const mx=(e.clientX-rect.left-camera.x)/camera.zoom;
  const my=(e.clientY-rect.top-camera.y)/camera.zoom;
  const n=getNodeAt(mx,my);
  if(n) { selectNodeObj(n); showCtxMenu(e.clientX,e.clientY,n); draw(); }
});

// ─── INLINE EDITING ──────────────────────────────────────────────
function startInlineEdit(node, evt) {
  inlineEditing = node;
  const ie = document.getElementById('inline-editor');
  const ti = document.getElementById('inline-title-input');
  const ni = document.getElementById('inline-note-input');

  const screenX = node.x*camera.zoom + camera.x;
  const screenY = node.y*camera.zoom + camera.y;
  const wScale = node.width*camera.zoom;
  const hScale = node.height*camera.zoom;

  ie.style.left = (screenX+10)+'px';
  ie.style.top = (screenY + (node.emoji?32*camera.zoom:8*camera.zoom))+'px';
  ie.style.width = (wScale-20)+'px';

  ti.style.fontSize = (13*camera.zoom)+'px';
  ni.style.fontSize = (11*camera.zoom)+'px';
  ti.value = node.title;
  ni.value = node.note;

  ie.classList.add('show');
  ti.focus(); ti.select();
  draw(); // draw nothing for this node (skipped above)
}

function commitInlineEdit() {
  if(!inlineEditing) return;
  const ti=document.getElementById('inline-title-input');
  const ni=document.getElementById('inline-note-input');
  inlineEditing.title = ti.value;
  inlineEditing.note = ni.value;
  inlineEditing=null;
  document.getElementById('inline-editor').classList.remove('show');
  if(selectedNode) updatePanel();
  saveHist(); draw(); triggerSave();
}

document.getElementById('inline-title-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); document.getElementById('inline-note-input').focus(); }
  if(e.key==='Escape') commitInlineEdit();
});
document.getElementById('inline-note-input').addEventListener('keydown',e=>{
  if(e.key==='Escape') commitInlineEdit();
});
document.getElementById('inline-editor').addEventListener('blur',e=>{
  setTimeout(()=>{
    const ie=document.getElementById('inline-editor');
    if(!ie.contains(document.activeElement)) commitInlineEdit();
  },100);
},true);

// ─── SELECTION ───────────────────────────────────────────────────
function selectNodeObj(node) {
  selectedNode=node; selectedConn=null;
  const rp=document.getElementById('right-panel');
  const bb=document.getElementById('bottom-bar');
  if(node) {
    bb.classList.add('show');
    updatePanel();
    rp.classList.add('show');
  } else {
    rp.classList.remove('show');
    bb.classList.remove('show');
  }
}

// ── FLOATING NOTE PANEL ──────────────────────────────────────────
(function(){
  const nf = document.getElementById('note-float');
  const nfText = document.getElementById('note-float-text');
  const nfClose = document.getElementById('note-float-close');
  if(!nf) return;

  let _dragging=false, _dx=0, _dy=0;

  document.getElementById('note-float-header').addEventListener('mousedown', function(e){
    _dragging=true;
    _dx=e.clientX-nf.offsetLeft;
    _dy=e.clientY-nf.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e){
    if(!_dragging) return;
    nf.style.left=(e.clientX-_dx)+'px';
    nf.style.top=(e.clientY-_dy)+'px';
  });
  document.addEventListener('mouseup', function(){ _dragging=false; });

  nfClose.addEventListener('click', function(){
    nf.style.display='none';
    selectNodeObj(null);
  });

  nfText.addEventListener('input', function(){
    if(selectedNode) { selectedNode.note=nfText.value; triggerSave(); draw(); }
  });

  window.openNoteFloat = function(node){
    const rect = document.getElementById('cvs').getBoundingClientRect();
    const sx = (node.x + node.width/2) * camera.zoom + camera.x + rect.left;
    const sy = node.y * camera.zoom + camera.y + rect.top;
    nf.style.display='flex';
    nf.style.left = Math.min(sx, window.innerWidth-300)+'px';
    nf.style.top  = Math.max(sy - 220, 60)+'px';
    nfText.value = node.note||'';
    setTimeout(()=>nfText.focus(),50);
  };
})();

function selectConnObj(conn) {
  selectedConn=conn; selectedNode=null;
  const rp=document.getElementById('right-panel');
  const bb=document.getElementById('bottom-bar');
  if(conn) {
    rp.classList.add('show'); bb.classList.add('show');
    // Switch to conn tab
    document.querySelectorAll('.rpanel-tab').forEach(t=>t.classList.remove('on'));
    document.querySelectorAll('.rpanel-tab-content').forEach(c=>c.style.display='none');
    document.querySelector('.rpanel-tab[data-tab="conn"]').classList.add('on');
    document.getElementById('tab-conn').style.display='block';
    populateConnPanel(conn);
  } else { rp.classList.remove('show'); bb.classList.remove('show'); }
}

function populateConnPanel(conn) {
  document.getElementById('rp-conn-style').value = conn.style||'curved';
  document.getElementById('rp-conn-width').value = conn.width||2;
  document.getElementById('rp-conn-width-val').textContent = (conn.width||2)+'px';
  document.getElementById('rp-conn-opacity').value = conn.opacity||1;
  document.getElementById('rp-conn-opacity-val').textContent = Math.round((conn.opacity||1)*100)+'%';
  document.getElementById('rp-conn-curve').value = conn.curve ?? 70;
  document.getElementById('rp-conn-curve-val').textContent = conn.curve ?? 70;
  document.querySelectorAll('.cdot').forEach(d=>{
    d.classList.toggle('on', d.dataset.cc===(conn.color||'default'));
  });
}


function normalizeHashTarget(txt) {
  const m = String(txt||'').match(/#([\p{L}\p{N}_\- ]+)/u);
  return m ? m[1].trim().toLowerCase() : null;
}
function findNodeByTitleEverywhere(title) {
  const needle = String(title||'').replace(/^#/,'').trim().toLowerCase();
  if(!needle) return null;
  for(const n of nodes) if(String(n.title||'').trim().toLowerCase()===needle) return {level:currentLevel,node:n};
  for(const [level,w] of Object.entries(workspaces||{})) {
    for(const n of (w.nodes||[])) if(String(n.title||'').trim().toLowerCase()===needle) return {level,node:n};
  }
  return null;
}
function jumpToNode(found) {
  if(!found) return false;
  workspaces[currentLevel]={nodes:[...nodes],connections:[...connections],camera:{...camera}};
  currentLevel = found.level;
  const w=workspaces[currentLevel] || workspaces.root;
  nodes=w.nodes||[]; connections=w.connections||[]; camera=w.camera||{x:0,y:0,zoom:1};
  const n = nodes.find(x=>x.id===found.node.id) || found.node;
  selectNodeObj(n);
  camera.x = W/2 - (n.x+n.width/2)*camera.zoom;
  camera.y = H/2 - (n.y+n.height/2)*camera.zoom;
  updateBreadcrumb(); draw(); triggerSave();
  return true;
}
function activateNode(node) {
  if(!node) return false;
  if(node.type==='folder') { openFolder(node); return true; }
  if(node.type==='note') { if(typeof openNoteFloat==='function') openNoteFloat(node); return true; }
  const firstAction=(node.actions||[])[0];
  if(firstAction) { runAction(firstAction); return true; }
  const hash = normalizeHashTarget(node.linkTarget || node.note || node.title);
  if(hash) return jumpToNode(findNodeByTitleEverywhere(hash));
  return false;
}
function runAction(act) {
  if(!act) return;
  if(act.type==='url') {
    if(String(act.dest).trim().startsWith('#')) { jumpToNode(findNodeByTitleEverywhere(act.dest)); return; }
    const url = /^https?:\/\//i.test(act.dest) ? act.dest : 'https://' + act.dest;
    window.open(url, '_blank', 'noopener');
  } else if(act.type==='wormhole') {
    jumpToNode(findNodeByTitleEverywhere(act.dest));
  } else if(act.type==='folder') {
    const folder = nodes.find(n=>n.id===act.dest || n.title===act.dest);
    if(folder) openFolder(folder);
    else alert('Pasta não encontrada: ' + act.dest);
  } else if(act.type==='card') {
    const card = nodes.find(n=>n.id===act.dest || n.title===act.dest);
    if(card) { selectNodeObj(card); camera.x=W/2-card.x*camera.zoom; camera.y=H/2-card.y*camera.zoom; draw(); }
    else alert('Card não encontrado: ' + act.dest);
  }
}

function updatePanel() {
  if(!selectedNode) return;
  const n=selectedNode;
  document.getElementById('rp-title').value=n.title;
  document.getElementById('rp-note').value=n.note||'';
  document.getElementById('rp-type-text').textContent=n.type==='folder'?'Pasta':n.type==='note'?'Nota':'Card';
  document.getElementById('rp-type-icon').textContent=n.emoji||EMOJIS_DEFAULT[n.type]||'📝';
  document.getElementById('rp-type-select').value=n.type;
  document.getElementById('rp-icon-preview').textContent=n.emoji||EMOJIS_DEFAULT[n.type]||'📝';
  document.getElementById('rp-width-slider').value=n.width;
  document.getElementById('rp-height-slider').value=n.height;
  document.getElementById('rp-iconsize-slider').value=n.iconSize||28;
  document.getElementById('rp-iconx-slider').value=n.iconX||0;
  document.getElementById('rp-icony-slider').value=n.iconY||0;
  document.getElementById('rp-textsize-slider').value=n.textSize||13;
  document.getElementById('rp-notesize-slider').value=n.noteSize||11;
  document.getElementById('rp-width-val').textContent=n.width+'px';
  document.getElementById('rp-height-val').textContent=n.height+'px';
  document.getElementById('rp-iconsize-val').textContent=(n.iconSize||28)+'px';
  document.getElementById('rp-iconx-val').textContent=(n.iconX||0)+'px';
  document.getElementById('rp-icony-val').textContent=(n.iconY||0)+'px';
  document.getElementById('rp-textsize-val').textContent=(n.textSize||13)+'px';
  document.getElementById('rp-notesize-val').textContent=(n.noteSize||11)+'px';
  document.getElementById('rp-bold-btn').classList.toggle('on', n.textBold!==false);
  document.getElementById('rp-italic-btn').classList.toggle('on', !!n.textItalic);
  document.getElementById('rp-underline-btn').classList.toggle('on', !!n.textUnderline);
  ['left','center','right'].forEach(a=>document.getElementById('rp-align-'+a+'-btn')?.classList.toggle('on',(n.textAlign||'left')===a));
  const isManual=!!n.textManual;
  document.getElementById('rp-text-auto-btn')?.classList.toggle('on',!isManual);
  document.getElementById('rp-text-manual-btn')?.classList.toggle('on',isManual);
  const mc=document.getElementById('rp-text-manual-controls'); if(mc)mc.style.display=isManual?'block':'none';
  const ai=document.getElementById('rp-text-auto-info'); if(ai)ai.style.display=isManual?'none':'block';
  const ptS=document.getElementById('rp-textpadtop-slider'); if(ptS)ptS.value=n.textPadTop||0;
  const ptV=document.getElementById('rp-textpadtop-val'); if(ptV)ptV.textContent=(n.textPadTop||0)+'px';
  const plS=document.getElementById('rp-textpadleft-slider'); if(plS)plS.value=n.textPadLeft||0;
  const plV=document.getElementById('rp-textpadleft-val'); if(plV)plV.textContent=(n.textPadLeft||0)+'px';
  document.getElementById('rp-icon-bg-toggle').classList.toggle('on', !n.iconBg);
  document.getElementById('rp-bw-slider').value=n.borderWidth||1.5;
  document.getElementById('rp-bw-val').textContent=(n.borderWidth||1.5)+'px';
  const bgOpSlider=document.getElementById('rp-bg-opacity-slider');
  const bgOpVal=document.getElementById('rp-bg-opacity-val');
  if(bgOpSlider && bgOpVal){
    const bgOp = n.bgOpacity === undefined ? 1 : Number(n.bgOpacity);
    bgOpSlider.value = bgOp;
    bgOpVal.textContent = Math.round(bgOp*100)+'%';
  }

  // bg swatches
  document.querySelectorAll('#rp-bg-swatches .rpanel-swatch').forEach(s=>{
    s.classList.toggle('on', s.dataset.bg===(n.bgColor||'none'));
  });
  // border swatches
  document.querySelectorAll('#rp-border-swatches .rpanel-swatch').forEach(s=>{
    s.classList.toggle('on', s.dataset.border===(n.borderColor||'none'));
  });
  // text swatches
  document.querySelectorAll('#rp-text-swatches .rpanel-swatch').forEach(s=>{
    s.classList.toggle('on', s.dataset.tc===(n.textColor||'#1a1a18'));
  });

  renderActionsList(n);
}

function renderActionsList(node) {
  const list = document.getElementById('rp-actions-list');
  list.innerHTML='';
  (node.actions||[]).forEach((act,i)=>{
    const icons={url:'<i class="ti ti-link"></i>',folder:'<i class="ti ti-folder"></i>',card:'<i class="ti ti-square-rounded"></i>',wormhole:'<i class="ti ti-portal"></i>'};
    const div=document.createElement('div');
    div.className='rpanel-action';
    div.innerHTML=`<span style="margin-right:6px;color:var(--text3);">${icons[act.type]||''}</span>
      <div><div class="rpanel-action-label">${act.type==='url'?'Abrir link externo':act.type==='folder'?'Abrir pasta':act.type==='wormhole'?'Wormhole / #Projeto':'Abrir card'}</div>
      <div class="rpanel-action-val">${act.dest}</div></div>
      <button class="rpanel-action-remove" data-i="${i}"><i class="ti ti-x"></i></button>`;
    div.querySelector('.rpanel-action-remove').onclick=(ev)=>{ ev.stopPropagation(); node.actions.splice(i,1); renderActionsList(node); saveHist(); draw(); triggerSave(); };
    div.onclick=()=>runAction(act);
    list.appendChild(div);
  });
}

// ─── HISTORY ─────────────────────────────────────────────────────
function saveHist() {
  const state={nodes:JSON.parse(JSON.stringify(nodes)),connections:JSON.parse(JSON.stringify(connections)),camera:{...camera}};
  history=history.slice(0,histIdx+1); history.push(state);
  if(history.length>MAX_HIST) history.shift(); else histIdx++;
}

function undo() {
  if(histIdx<=0) return;
  histIdx--;
  const s=history[histIdx];
  nodes=JSON.parse(JSON.stringify(s.nodes)); connections=JSON.parse(JSON.stringify(s.connections)); camera={...s.camera};
  selectNodeObj(null); draw(); triggerSave();
}

function redo() {
  if(histIdx>=history.length-1) return;
  histIdx++;
  const s=history[histIdx];
  nodes=JSON.parse(JSON.stringify(s.nodes)); connections=JSON.parse(JSON.stringify(s.connections)); camera={...s.camera};
  selectNodeObj(null); draw(); triggerSave();
}

// ─── CONTEXT MENU ────────────────────────────────────────────────
function showCtxMenu(x,y,node) {
  const m=document.getElementById('ctx-menu');
  m.style.left=x+'px'; m.style.top=y+'px';
  m.classList.add('show');
  document.getElementById('ctx-open-folder').style.display=node.type==='folder'?'flex':'none';
}

function hideContextMenu() { document.getElementById('ctx-menu').classList.remove('show'); }

document.getElementById('ctx-open-folder').onclick=()=>{ if(selectedNode&&selectedNode.type==='folder') openFolder(selectedNode); hideContextMenu(); };
document.getElementById('ctx-edit').onclick=()=>{ if(selectedNode) startInlineEdit(selectedNode,null); hideContextMenu(); };
document.getElementById('ctx-add-sub').onclick=()=>{
  if(selectedNode){const sub=createNode(selectedNode.x+20,selectedNode.y+selectedNode.height+40,'card');nodes.push(sub);connections.push({id:`c${connIdCtr++}`,from:selectedNode.id,to:sub.id,style:settings.defaultConnStyle,width:2,color:'default',opacity:1});saveHist();draw();triggerSave();}
  hideContextMenu();
};
document.getElementById('ctx-minimize').onclick=()=>{ if(selectedNode) selectedNode.minimized=!selectedNode.minimized; saveHist(); draw(); triggerSave(); hideContextMenu(); };
document.getElementById('ctx-duplicate').onclick=()=>{ duplicateNode(); hideContextMenu(); };
document.getElementById('ctx-delete').onclick=()=>{ deleteSelected(); hideContextMenu(); };

// ── NOVOS HANDLERS DO MENU DE CONTEXTO ──
document.getElementById('ctx-lock').onclick=()=>{ if(selectedNode) selectedNode.locked=!selectedNode.locked; saveHist(); draw(); triggerSave(); hideContextMenu(); };
document.getElementById('ctx-add-button').onclick=()=>{ showModal('modal-action'); hideContextMenu(); };
document.getElementById('ctx-add-icon').onclick=()=>{ if(selectedNode){document.getElementById('rp-emoji-btn').click();} hideContextMenu(); };
document.getElementById('ctx-add-image').onclick=()=>{ if(selectedNode){document.getElementById('rp-image-btn').click();} hideContextMenu(); };
document.getElementById('ctx-add-text').onclick=()=>{ 
  if(selectedNode){selectedNode.note=(selectedNode.note||'')+'\nNovo texto';saveHist();draw();triggerSave();} 
  hideContextMenu(); 
};
document.getElementById('ctx-add-note').onclick=()=>{ 
  if(selectedNode){const note=createNode(selectedNode.x+20,selectedNode.y+selectedNode.height+20,'note');note.parentId=selectedNode.id;selectedNode.children=selectedNode.children||[];selectedNode.children.push(note.id);nodes.push(note);saveHist();draw();triggerSave();} 
  hideContextMenu(); 
};
document.getElementById('ctx-add-card').onclick=()=>{ 
  if(selectedNode){const card=createNode(selectedNode.x+40,selectedNode.y+40,'card');card.parentId=selectedNode.id;card.width=selectedNode.width-80;card.height=80;selectedNode.children=selectedNode.children||[];selectedNode.children.push(card.id);nodes.push(card);saveHist();draw();triggerSave();} 
  hideContextMenu(); 
};
document.getElementById('ctx-convert-type').onclick=()=>{ 
  if(selectedNode){
    const types=['card','folder','note'];
    const cur=types.indexOf(selectedNode.type);
    selectedNode.type=types[(cur+1)%types.length];
    selectedNode.bgColor=BG_COLORS[selectedNode.type]||'none';
    selectedNode.borderColor=BORDER_COLORS[selectedNode.type]||'none';
    selectedNode.emoji=EMOJIS_DEFAULT[selectedNode.type]||'';
    saveHist();draw();triggerSave();
  } 
  hideContextMenu(); 
};
document.getElementById('ctx-layer-front').onclick=()=>{ if(selectedNode){selectedNode.zIndex=(selectedNode.zIndex||0)+1;nodes.sort((a,b)=>(a.zIndex||0)-(b.zIndex||0));saveHist();draw();triggerSave();} hideContextMenu(); };
document.getElementById('ctx-layer-back').onclick=()=>{ if(selectedNode){selectedNode.zIndex=(selectedNode.zIndex||0)-1;nodes.sort((a,b)=>(a.zIndex||0)-(b.zIndex||0));saveHist();draw();triggerSave();} hideContextMenu(); };
document.getElementById('ctx-style').onclick=()=>{ showModal('modal-styles'); hideContextMenu(); };
document.getElementById('ctx-shape').onclick=()=>{ showModal('modal-shapes'); hideContextMenu(); };
document.getElementById('ctx-animation').onclick=()=>{ if(selectedNode){selectedNode.animatedBorder=!selectedNode.animatedBorder;saveHist();draw();triggerSave();} hideContextMenu(); };
document.getElementById('ctx-behavior').onclick=()=>{ alert('Editor de comportamento em desenvolvimento'); hideContextMenu(); };
document.getElementById('ctx-links').onclick=()=>{ showModal('modal-wormhole'); hideContextMenu(); };

document.addEventListener('click',e=>{ if(!e.target.closest('#ctx-menu')&&!e.target.closest('#cvs')) hideContextMenu(); });

// ─── FOLDER NAV ──────────────────────────────────────────────────
function openFolder(node) {
  workspaces[currentLevel]={nodes:[...nodes],connections:[...connections],camera:{...camera}};
  navStack.push({level:currentLevel,title:node.title});
  currentLevel=node.id;
  if(!workspaces[node.id]) workspaces[node.id]={nodes:[],connections:[],camera:{x:0,y:0,zoom:1}};
  const w=workspaces[node.id];
  nodes=w.nodes||[]; connections=w.connections||[]; camera=w.camera||{x:0,y:0,zoom:1};
  selectNodeObj(null); saveHist(); draw(); triggerSave();
  updateBreadcrumb();
}

function updateBreadcrumb() {
  const bc=document.getElementById('breadcrumb');
  bc.innerHTML='';
  const home=document.createElement('div');
  home.className='breadcrumb-item';
  home.innerHTML='<svg class="breadcrumb-home" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2L2 9h2v9h5v-5h2v5h5V9h2L10 2z"/></svg>';
  home.onclick=()=>{ while(navStack.length) goBack(); };
  bc.appendChild(home);
  navStack.forEach((item,i)=>{
    const sep=document.createElement('span'); sep.className='breadcrumb-sep'; sep.textContent='›'; bc.appendChild(sep);
    const chip=document.createElement('div'); chip.className='breadcrumb-item';
    const c=document.createElement('span'); c.className='breadcrumb-chip'; c.textContent=item.title; chip.appendChild(c);
    chip.onclick=()=>{ const steps=navStack.length-i-1; for(let j=0;j<steps;j++) goBack(); };
    bc.appendChild(chip);
  });
  if(currentLevel!=='root'&&navStack.length>0) {
    const sep=document.createElement('span'); sep.className='breadcrumb-sep'; sep.textContent='›'; bc.appendChild(sep);
    const chip=document.createElement('div'); chip.className='breadcrumb-item';
    const c=document.createElement('span'); c.className='breadcrumb-chip active'; c.textContent=navStack[navStack.length-1]?.title||'Pasta';
    chip.appendChild(c); bc.appendChild(chip);
  }
}

function goBack() {
  if(navStack.length===0) return;
  workspaces[currentLevel]={nodes:[...nodes],connections:[...connections],camera:{...camera}};
  const prev=navStack.pop();
  currentLevel=prev.level;
  const w=workspaces[currentLevel];
  nodes=w.nodes||[]; connections=w.connections||[]; camera=w.camera||{x:0,y:0,zoom:1};
  selectNodeObj(null); saveHist(); draw(); triggerSave(); updateBreadcrumb();
}

// ─── SETTINGS ────────────────────────────────────────────────────
function applySettings() {
  document.body.className=settings.theme==='dark'?'theme-dark':'';
  document.querySelectorAll('.theme-opt').forEach(o=>o.classList.toggle('on',o.dataset.theme===settings.theme));
  ['grid','shadows','auto-minimize','arrows','highlight-conn','autosave','restore'].forEach(k=>{
    const el=document.getElementById('toggle-'+k);
    if(el) el.classList.toggle('on', settings[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??settings[k]??true);
  });
  const dcsel=document.getElementById('default-conn-style');
  if(dcsel) dcsel.value=settings.defaultConnStyle||'curved';
}

// ─── ACTIONS ─────────────────────────────────────────────────────
function deleteSelected() {
  if(selectedNode) {
    nodes=nodes.filter(n=>n.id!==selectedNode.id);
    connections=connections.filter(c=>c.from!==selectedNode.id&&c.to!==selectedNode.id);
    selectNodeObj(null); saveHist(); draw(); triggerSave();
  } else if(selectedConn) {
    connections=connections.filter(c=>c.id!==selectedConn.id);
    selectConnObj(null); saveHist(); draw(); triggerSave();
  }
}

function duplicateNode() {
  if(!selectedNode) return;
  const clone=JSON.parse(JSON.stringify(selectedNode));
  clone.id=`n${nodeIdCtr++}`; clone.x+=30; clone.y+=30;
  nodes.push(clone); selectNodeObj(clone); saveHist(); draw(); triggerSave();
}

function fitAllNodes() {
  if(nodes.length===0) return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  nodes.forEach(n=>{ minX=Math.min(minX,n.x); minY=Math.min(minY,n.y); maxX=Math.max(maxX,n.x+n.width); maxY=Math.max(maxY,n.y+n.height); });
  const pw=W-40, ph=H-80;
  const zoom=Math.min(pw/(maxX-minX+80),ph/(maxY-minY+80),1.5);
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  camera.zoom=zoom; camera.x=W/2-cx*zoom; camera.y=H/2-cy*zoom;
  draw();
}

// ─── EMOJI PICKER ────────────────────────────────────────────────
const emojis=['✨','🎯','💡','🚀','📝','📊','📁','🔍','⚙️','💻','📱','🎨','🎭','🎪','🎬','📷','📚','📖','💰','📈','📉','🗃️','📋','📌','⚡','🌟','🔮','🎲','🏆','🎁','🌈','🔥','💎','🛡️','⚔️','🌍','🏔️','🌊','🎵','🎶','🔔','📞','✉️','🖥️','⌨️','🖱️','🔑','🗝️','🔒','💡','🧩','🔧','🛠️','⚗️','🧪','🧬','🏗️','🏢'];

function openEmojiPicker(targetEl) {
  const picker=document.getElementById('emoji-picker');
  const grid=document.getElementById('emoji-grid');
  grid.innerHTML='';
  emojis.forEach(em=>{
    const it=document.createElement('div'); it.className='emoji-item'; it.textContent=em;
    it.onclick=()=>{
      if(selectedNode){ selectedNode.emoji=em; updatePanel(); saveHist(); draw(); triggerSave(); }
      picker.classList.remove('show');
    };
    grid.appendChild(it);
  });
  const rect=targetEl.getBoundingClientRect();
  picker.style.left=rect.left+'px'; picker.style.top=(rect.bottom+4)+'px';
  picker.classList.add('show');
}

document.addEventListener('click',e=>{
  if(!e.target.closest('#emoji-picker')&&!e.target.closest('#rp-icon-change-btn')&&!e.target.closest('#rp-icon-preview'))
    document.getElementById('emoji-picker').classList.remove('show');
});

// ─── TOOLBAR & UI EVENTS ─────────────────────────────────────────
document.querySelectorAll('.sidebar-tool').forEach(btn=>{
  btn.addEventListener('click',()=>{
    mode=btn.dataset.mode;
    document.querySelectorAll('.sidebar-tool').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    if(mode==='select') cvs.style.cursor='default';
    else if(mode==='hand') cvs.style.cursor='grab';
    else cvs.style.cursor='crosshair';
  });
});

document.getElementById('btn-undo').onclick=undo;
document.getElementById('btn-redo').onclick=redo;
document.getElementById('btn-dark').onclick=()=>{
  settings.theme=settings.theme==='dark'?'light':'dark';
  applySettings(); draw(); triggerSave();
};
document.getElementById('btn-search-top').onclick=()=>{ const sb=document.getElementById('search-bar'); sb.classList.toggle('show'); if(sb.classList.contains('show')) document.getElementById('search-inp').focus(); };
document.getElementById('btn-settings').onclick=()=>{ document.getElementById('settings-modal').classList.add('show'); document.getElementById('overlay').classList.add('show'); };
document.getElementById('btn-projects').onclick=()=>{ showDashboard(); };
document.getElementById('sm-close').onclick=()=>{ document.getElementById('settings-modal').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); };

document.getElementById('btn-new').onclick=()=>{
  mode='card';
  document.querySelectorAll('.sidebar-tool').forEach(b=>b.classList.remove('on'));
  document.getElementById('tool-card').classList.add('on');
  cvs.style.cursor='copy';
};

// Zoom controls
document.getElementById('btn-zoom-in').onclick=()=>{ camera.zoom=Math.min(4,camera.zoom*1.2); draw(); };
document.getElementById('btn-zoom-out').onclick=()=>{ camera.zoom=Math.max(0.1,camera.zoom/1.2); draw(); };
document.getElementById('btn-fit').onclick=fitAllNodes;
document.getElementById('btn-export').onclick=()=>{
  document.getElementById('settings-modal').classList.add('show');
  document.getElementById('overlay').classList.add('show');
  document.querySelectorAll('.sm-tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.sm-section').forEach(s=>s.classList.remove('on'));
  document.querySelector('.sm-tab[data-stab="export"]').classList.add('on');
  document.querySelector('.sm-section[data-ssec="export"]').classList.add('on');
};

// Bottom bar
document.getElementById('bb-delete').onclick=deleteSelected;
document.getElementById('bb-copy').onclick=duplicateNode;
document.getElementById('bb-minimize').onclick=()=>{ if(selectedNode){ selectedNode.minimized=!selectedNode.minimized; saveHist(); draw(); triggerSave(); } };
document.getElementById('bb-lock').onclick=()=>{ if(selectedNode){selectedNode.locked=!selectedNode.locked; saveHist(); draw();} };
document.getElementById('bb-up').onclick=()=>{ if(selectedNode){nodes=nodes.filter(n=>n.id!==selectedNode.id).concat(selectedNode); draw();} };

// Right panel events
document.querySelectorAll('.rpanel-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.rpanel-tab').forEach(t=>t.classList.remove('on'));
    document.querySelectorAll('.rpanel-tab-content').forEach(c=>c.style.display='none');
    tab.classList.add('on');
    document.getElementById('tab-'+tab.dataset.tab).style.display='block';
  });
});

document.getElementById('rp-title').addEventListener('input',e=>{
  if(selectedNode){selectedNode.title=e.target.value; draw(); triggerSave();}
});
document.getElementById('rp-note').addEventListener('input',e=>{
  if(selectedNode){selectedNode.note=e.target.value; draw(); triggerSave();}
});
document.getElementById('rp-type-select').addEventListener('change',e=>{
  if(selectedNode){selectedNode.type=e.target.value; updatePanel(); saveHist(); draw(); triggerSave();}
});
document.getElementById('rp-icon-preview').addEventListener('click',e=>openEmojiPicker(e.target));
document.getElementById('rp-icon-change-btn').addEventListener('click',e=>openEmojiPicker(e.target));

['width','height','iconsize','iconx','icony','textsize','notesize'].forEach(prop=>{
  const slider=document.getElementById(`rp-${prop}-slider`);
  const val=document.getElementById(`rp-${prop}-val`);
  slider.addEventListener('input',()=>{
    if(!selectedNode) return;
    if(prop==='width') selectedNode.width=+slider.value;
    else if(prop==='height') selectedNode.height=+slider.value;
    else if(prop==='iconsize') selectedNode.iconSize=+slider.value;
    else if(prop==='iconx') selectedNode.iconX=+slider.value;
    else if(prop==='icony') selectedNode.iconY=+slider.value;
    else if(prop==='textsize') selectedNode.textSize=+slider.value;
    else if(prop==='notesize') selectedNode.noteSize=+slider.value;
    val.textContent=slider.value+'px';
    draw(); triggerSave();
  });
});

document.getElementById('rp-bw-slider').addEventListener('input',e=>{
  if(selectedNode){selectedNode.borderWidth=+e.target.value; document.getElementById('rp-bw-val').textContent=e.target.value+'px'; draw(); triggerSave();}
});

document.getElementById('rp-bold-btn').onclick=()=>{ if(selectedNode){selectedNode.textBold = selectedNode.textBold===false; updatePanel(); draw(); triggerSave();} };
document.getElementById('rp-italic-btn').onclick=()=>{ if(selectedNode){selectedNode.textItalic = !selectedNode.textItalic; updatePanel(); draw(); triggerSave();} };
document.getElementById('rp-underline-btn').onclick=()=>{ if(selectedNode){selectedNode.textUnderline = !selectedNode.textUnderline; updatePanel(); draw(); triggerSave();} };
// Alinhamento L/C/R
['left','center','right'].forEach(a=>{
  document.getElementById('rp-align-'+a+'-btn')?.addEventListener('click',()=>{
    if(!selectedNode)return;
    selectedNode.textAlign=a;
    ['left','center','right'].forEach(x=>document.getElementById('rp-align-'+x+'-btn')?.classList.remove('on'));
    document.getElementById('rp-align-'+a+'-btn').classList.add('on');
    saveHist();draw();triggerSave();
  });
});
// Auto / Manual
function setTextMode(manual){
  document.getElementById('rp-text-auto-btn')?.classList.toggle('on',!manual);
  document.getElementById('rp-text-manual-btn')?.classList.toggle('on',manual);
  const mc=document.getElementById('rp-text-manual-controls');
  const ai=document.getElementById('rp-text-auto-info');
  if(mc)mc.style.display=manual?'block':'none';
  if(ai)ai.style.display=manual?'none':'block';
  if(selectedNode){selectedNode.textManual=manual;saveHist();draw();triggerSave();}
}
document.getElementById('rp-text-auto-btn')?.addEventListener('click',()=>setTextMode(false));
document.getElementById('rp-text-manual-btn')?.addEventListener('click',()=>setTextMode(true));
// Sliders manuais
document.getElementById('rp-textpadtop-slider')?.addEventListener('input',e=>{
  if(!selectedNode)return; selectedNode.textPadTop=+e.target.value;
  document.getElementById('rp-textpadtop-val').textContent=e.target.value+'px'; draw();triggerSave();
});
document.getElementById('rp-textpadtop-slider')?.addEventListener('change',()=>saveHist());
document.getElementById('rp-textpadleft-slider')?.addEventListener('input',e=>{
  if(!selectedNode)return; selectedNode.textPadLeft=+e.target.value;
  document.getElementById('rp-textpadleft-val').textContent=e.target.value+'px'; draw();triggerSave();
});
document.getElementById('rp-textpadleft-slider')?.addEventListener('change',()=>saveHist());
document.getElementById('rp-icon-bg-toggle').onclick=()=>{ if(selectedNode){selectedNode.iconBg = !selectedNode.iconBg; updatePanel(); draw(); triggerSave();} };
document.getElementById('rp-image-btn').onclick=()=>document.getElementById('image-file').click();
document.getElementById('rp-remove-image-btn').onclick=()=>{ if(selectedNode){selectedNode.imageUrl=null; selectedNode.imgObj=null; draw(); triggerSave();} };
document.getElementById('image-file').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f || !selectedNode) return;
  const r=new FileReader();
  r.onload=ev=>{ selectedNode.imageUrl=ev.target.result; loadNodeImage(selectedNode); saveHist(); draw(); triggerSave(); };
  r.readAsDataURL(f);
  e.target.value='';
});

const rpBgOpacitySlider = document.getElementById('rp-bg-opacity-slider');
if(rpBgOpacitySlider){
  rpBgOpacitySlider.addEventListener('input',()=>{
    if(!selectedNode) return;
    selectedNode.bgOpacity = Number(rpBgOpacitySlider.value);
    const v=document.getElementById('rp-bg-opacity-val');
    if(v) v.textContent = Math.round(selectedNode.bgOpacity*100)+'%';
    draw(); triggerSave();
  });
  rpBgOpacitySlider.addEventListener('change',()=>{ if(selectedNode && typeof saveHist==='function') saveHist(); });
}

document.querySelectorAll('#rp-bg-swatches .rpanel-swatch').forEach(s=>{
  s.addEventListener('click',()=>{
    if(!selectedNode) return;
    selectedNode.bgColor=s.dataset.bg||'none';
    if(selectedNode.bgOpacity === undefined) selectedNode.bgOpacity = 1;
    document.querySelectorAll('#rp-bg-swatches .rpanel-swatch').forEach(x=>x.classList.remove('on')); s.classList.add('on');
    saveHist(); draw(); triggerSave();
  });
});
document.querySelectorAll('#rp-border-swatches .rpanel-swatch').forEach(s=>{
  s.addEventListener('click',()=>{
    if(!selectedNode) return;
    selectedNode.borderColor=s.dataset.border||'none';
    document.querySelectorAll('#rp-border-swatches .rpanel-swatch').forEach(x=>x.classList.remove('on')); s.classList.add('on');
    saveHist(); draw(); triggerSave();
  });
});
document.querySelectorAll('#rp-text-swatches .rpanel-swatch').forEach(s=>{
  s.addEventListener('click',()=>{
    if(!selectedNode) return;
    selectedNode.textColor=s.dataset.tc||'#1a1a18';
    document.querySelectorAll('#rp-text-swatches .rpanel-swatch').forEach(x=>x.classList.remove('on')); s.classList.add('on');
    saveHist(); draw(); triggerSave();
  });
});

// Actions modal
document.getElementById('rp-add-action-btn').onclick=()=>{
  if(!selectedNode) return;
  document.getElementById('action-dest').value='';
  document.getElementById('modal-action').classList.add('show');
  document.getElementById('overlay').classList.add('show');
};
document.getElementById('action-cancel').onclick=()=>{ document.getElementById('modal-action').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); };
document.getElementById('action-ok').onclick=()=>{
  if(!selectedNode) return;
  const type=document.getElementById('action-type').value;
  const dest=document.getElementById('action-dest').value.trim();
  if(!dest) return;
  selectedNode.actions.push({type,dest});
  renderActionsList(selectedNode); saveHist(); draw(); triggerSave();
  document.getElementById('modal-action').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
};

// ── FUNÇÕES AUXILIARES DE MODAIS ──
function showModal(modalId) {
  document.getElementById(modalId).classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}

// ── MODAL DE FORMAS ──
document.querySelectorAll('.shape-option').forEach(opt=>{
  opt.onclick=()=>{
    if(!selectedNode) return;
    selectedNode.shapeType=opt.dataset.shape;
    selectedNode.shape=opt.dataset.shape; // compatibilidade
    saveHist(); draw(); triggerSave();
    hideModal('modal-shapes');
  };
});
document.getElementById('shapes-cancel').onclick=()=>{ hideModal('modal-shapes'); };

// ── MODAL DE ESTILOS ──
document.querySelectorAll('.style-option').forEach(opt=>{
  opt.onclick=()=>{
    if(!selectedNode) return;
    const style=opt.dataset.style;
    selectedNode.stylePreset=style;
    // Aplicar preset de estilo
    applyStylePreset(selectedNode, style);
    saveHist(); draw(); triggerSave();
    hideModal('modal-styles');
  };
});
document.getElementById('styles-cancel').onclick=()=>{ hideModal('modal-styles'); };

function applyStylePreset(node, preset) {
  switch(preset) {
    case 'clean':
      node.bgColor='#ffffff'; node.borderColor='#e5e7eb'; node.borderWidth=1; node.opacity=1; node.glow=0;
      break;
    case 'minimal':
      node.bgColor='#f9fafb'; node.borderColor='#d1d5db'; node.borderWidth=1; node.shadowIntensity=0.5;
      break;
    case 'neon':
      node.bgColor='#1a1a1a'; node.borderColor='#00ffff'; node.borderWidth=2; node.glow=10; node.glowColor='#00ffff';
      break;
    case 'futuristic':
      node.gradient={from:'#667eea',to:'#764ba2',angle:135}; node.borderColor='#764ba2'; node.borderWidth=2;
      break;
    case 'glassmorphism':
      node.bgColor='rgba(255,255,255,0.1)'; node.blur=10; node.borderColor='rgba(255,255,255,0.2)'; node.borderWidth=1;
      break;
    case 'darktech':
      node.bgColor='#1a1a1a'; node.borderColor='#333'; node.shadowIntensity=2;
      break;
    case '3d':
      node.bgColor='#e6e6e6'; node.borderColor='transparent'; node.shadowIntensity=3;
      break;
    case 'soft':
      node.bgColor='#ffffff'; node.borderColor='#e5e7eb'; node.shadowIntensity=2;
      break;
    case 'cyberpunk':
      node.bgColor='#000'; node.borderColor='#ff00de'; node.glow=15; node.glowColor='#ff00de';
      break;
    case 'terminal':
      node.bgColor='#0d1117'; node.borderColor='#30a14e'; node.borderWidth=1; node.glow=5; node.glowColor='#30a14e';
      break;
    case 'material':
      node.bgColor='#ffffff'; node.borderColor='transparent'; node.borderWidth=0; node.shadowIntensity=2;
      break;
    case 'outline':
      node.bgColor='none'; node.borderColor=cssVar('--border2'); node.borderWidth=2; node.glow=0;
      break;
  }
}

// ── MODAL DE WORMHOLES ──
document.getElementById('wormhole-cancel').onclick=()=>{ hideModal('modal-wormhole'); };
document.getElementById('wormhole-ok').onclick=()=>{
  if(!selectedNode) return;
  const type=document.getElementById('wormhole-type').value;
  const target=document.getElementById('wormhole-target').value.trim();
  const label=document.getElementById('wormhole-label').value.trim();
  if(!target||!label) return;
  selectedNode.wormholes=selectedNode.wormholes||[];
  selectedNode.wormholes.push({type,target,label});
  saveHist(); draw(); triggerSave();
  hideModal('modal-wormhole');
};

// ── MODAL DE PROJETOS ──
document.getElementById('new-project-btn').onclick=()=>{
  const name=prompt('Nome do novo projeto:');
  if(!name||!name.trim()) return;
  const id='project_'+Date.now();
  workspaces[id]={nodes:[],connections:[],camera:{x:0,y:0,zoom:1},name:name.trim()};
  updateProjectsList();
  triggerSave();
};
document.getElementById('projects-close').onclick=()=>{ hideModal('modal-projects'); };

function updateProjectsList() {
  const list=document.getElementById('projects-list');
  list.innerHTML='';
  Object.keys(workspaces).forEach(key=>{
    const w=workspaces[key];
    const div=document.createElement('div');
    div.style.cssText='padding:10px;border:1px solid var(--border);border-radius:6px;margin-bottom:8px;cursor:pointer;';
    div.innerHTML=`<div style="font-weight:500;">${w.name||key}</div><div style="font-size:11px;color:var(--text3);">${(w.nodes||[]).length} cards</div>`;
    div.onclick=()=>{
      workspaces[currentLevel]={nodes:[...nodes],connections:[...connections],camera:{...camera}};
      currentLevel=key;
      const ws=workspaces[key];
      nodes=ws.nodes||[]; connections=ws.connections||[]; camera=ws.camera||{x:0,y:0,zoom:1};
      selectNodeObj(null); saveHist(); draw(); triggerSave(); updateBreadcrumb();
      hideModal('modal-projects');
    };
    list.appendChild(div);
  });
}

// Conn panel events
document.getElementById('rp-conn-style').addEventListener('change',e=>{
  if(selectedConn){selectedConn.style=e.target.value; draw(); triggerSave();}
});
document.getElementById('rp-conn-width').addEventListener('input',e=>{
  if(selectedConn){selectedConn.width=+e.target.value; document.getElementById('rp-conn-width-val').textContent=e.target.value+'px'; draw(); triggerSave();}
});
document.getElementById('rp-conn-opacity').addEventListener('input',e=>{
  if(selectedConn){selectedConn.opacity=+e.target.value; document.getElementById('rp-conn-opacity-val').textContent=Math.round(e.target.value*100)+'%'; draw(); triggerSave();}
});
document.getElementById('rp-conn-curve').addEventListener('input',e=>{
  if(selectedConn){selectedConn.curve=+e.target.value; document.getElementById('rp-conn-curve-val').textContent=e.target.value; draw(); triggerSave();}
});
document.querySelectorAll('.cdot').forEach(d=>{
  d.addEventListener('click',()=>{
    if(selectedConn){selectedConn.color=d.dataset.cc; document.querySelectorAll('.cdot').forEach(x=>x.classList.remove('on')); d.classList.add('on'); draw(); triggerSave();}
  });
});
document.getElementById('rp-delete-conn-btn').onclick=()=>{ deleteSelected(); };

// Settings modal tabs
document.querySelectorAll('.sm-tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.sm-tab').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.sm-section').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');
    document.querySelector(`.sm-section[data-ssec="${t.dataset.stab}"]`).classList.add('on');
  });
});

// Toggles in settings
function wireToggle(id, key) {
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener('click',()=>{
    settings[key]=!settings[key];
    el.classList.toggle('on',settings[key]);
    applySettings(); draw(); triggerSave();
  });
}
wireToggle('toggle-grid','showGrid');
wireToggle('toggle-shadows','showShadows');
wireToggle('toggle-auto-minimize','autoMinimize');
wireToggle('toggle-arrows','showArrows');
wireToggle('toggle-highlight-conn','highlightConn');
wireToggle('toggle-autosave','autoSave');
wireToggle('toggle-restore','autoRestore');

document.querySelectorAll('.theme-opt').forEach(o=>{
  o.addEventListener('click',()=>{settings.theme=o.dataset.theme; applySettings(); draw(); triggerSave();});
});

document.getElementById('default-conn-style').addEventListener('change',e=>{
  settings.defaultConnStyle=e.target.value; triggerSave();
});

document.getElementById('clear-save-btn').onclick=()=>{ if(confirm('Limpar dados?')){localStorage.removeItem('myspace-v2'); alert('Limpo!');} };

document.getElementById('btn-export-json').onclick=()=>{
  workspaces[currentLevel]={nodes:[...nodes],connections:[...connections],camera:{...camera}};
  const d=JSON.stringify({workspaces,currentLevel,navStack,settings},null,2);
  const a=document.createElement('a'); a.href='data:application/json,'+encodeURIComponent(d); a.download='myspace.json'; a.click();
};
document.getElementById('btn-import-json').onclick=()=>document.getElementById('import-file').click();
document.getElementById('import-file').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=ev=>{
    try{const d=JSON.parse(ev.target.result); if(d.workspaces){workspaces=d.workspaces;currentLevel=d.currentLevel||'root';navStack=d.navStack||[];settings={...settings,...(d.settings||{})};const w=workspaces[currentLevel]||workspaces.root;nodes=w.nodes||[];connections=w.connections||[];camera=w.camera||{x:0,y:0,zoom:1};updateBreadcrumb();applySettings();}else{nodes=d.nodes||[];connections=d.connections||[];camera=d.camera||{x:0,y:0,zoom:1};}hydrateImages();saveHist();draw();triggerSave();}catch(err){alert('Arquivo inválido');}
  }; r.readAsText(f);
});

// Search
let searchRes=[], searchIdx=0;
document.getElementById('search-inp').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q){searchRes=[];draw();return;}
  searchRes=nodes.filter(n=>n.title.toLowerCase().includes(q)||n.note.toLowerCase().includes(q));
  searchIdx=0;
  if(searchRes.length>0){selectNodeObj(searchRes[0]);camera.x=W/2-searchRes[0].x*camera.zoom;camera.y=H/2-searchRes[0].y*camera.zoom;draw();}
});
document.getElementById('search-next').onclick=()=>{ if(!searchRes.length)return; searchIdx=(searchIdx+1)%searchRes.length; const n=searchRes[searchIdx];selectNodeObj(n);camera.x=W/2-n.x*camera.zoom;camera.y=H/2-n.y*camera.zoom;draw(); };
document.getElementById('search-prev').onclick=()=>{ if(!searchRes.length)return; searchIdx=(searchIdx-1+searchRes.length)%searchRes.length;const n=searchRes[searchIdx];selectNodeObj(n);camera.x=W/2-n.x*camera.zoom;camera.y=H/2-n.y*camera.zoom;draw(); };
document.getElementById('search-close').onclick=()=>{ document.getElementById('search-bar').classList.remove('show'); searchRes=[]; draw(); };

// Keyboard
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
  if(e.ctrlKey||e.metaKey) {
    if(e.key==='z'){e.preventDefault();undo();}
    if(e.key==='y'||e.key==='Z'){e.preventDefault();redo();}
    if(e.key==='d'){e.preventDefault();duplicateNode();}
    if(e.key==='f'){e.preventDefault();document.getElementById('btn-search-top').click();}
  }
  if(e.key==='Delete'||e.key==='Backspace') deleteSelected();
  if(e.key==='Escape'){selectNodeObj(null);selectConnObj(null);commitInlineEdit();mode='select';document.querySelectorAll('.sidebar-tool').forEach(b=>b.classList.remove('on'));document.getElementById('tool-select').classList.add('on');cvs.style.cursor='default';draw();}
  if(e.key==='v'&&!e.ctrlKey){document.getElementById('tool-select').click();}
  if(e.key==='c'&&!e.ctrlKey){document.getElementById('tool-card').click();}
  if(e.key==='f'&&!e.ctrlKey){document.getElementById('tool-folder').click();}
  if(e.key==='n'&&!e.ctrlKey){document.getElementById('tool-note').click();}
  if(e.key==='l'&&!e.ctrlKey){document.getElementById('tool-connect').click();}
  if(e.key==='h'&&!e.ctrlKey){document.getElementById('tool-hand').click();}
  if(e.key==='i'&&!e.ctrlKey){document.getElementById('tool-image').click();}

  // ── Redimensionar com teclado (card selecionado + não editando) ──
  if(selectedNode && !selectedNode.locked && !inlineEditing) {
    if(e.key==='=' || e.key==='+') {
      e.preventDefault();
      selectedNode.width += 20; selectedNode.height += 20;
      saveHist(); draw(); triggerSave(); updatePanel();
    }
    if(e.key==='-' || e.key==='_') {
      e.preventDefault();
      selectedNode.width  = Math.max(selectedNode.type==='icon'?24:80, selectedNode.width  - 20);
      selectedNode.height = Math.max(selectedNode.type==='icon'?24:50, selectedNode.height - 20);
      saveHist(); draw(); triggerSave(); updatePanel();
    }
    if(e.shiftKey && (e.key==='+' || e.key==='=')) {
      e.preventDefault();
      selectedNode.iconSize = Math.min(200, (selectedNode.iconSize||28) + 4);
      saveHist(); draw(); triggerSave(); updatePanel();
    }
    if(e.shiftKey && e.key==='-') {
      e.preventDefault();
      selectedNode.iconSize = Math.max(10, (selectedNode.iconSize||28) - 4);
      saveHist(); draw(); triggerSave(); updatePanel();
    }
  }
  if(e.key==='w'&&!e.ctrlKey){document.getElementById('tool-wormhole').click();}
});

// ══════════════════════════════════════════════════════════════
// ── DASHBOARD DE PROJETOS ────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function showDashboard() {
  document.getElementById('project-dashboard').style.display = 'block';
  document.getElementById('topbar').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('canvas-wrap').style.display = 'none';
  document.getElementById('right-panel').style.display = 'none';
  document.getElementById('bottom-bar').style.display = 'none';
  document.getElementById('status-bar').style.display = 'none';
  renderDashboardProjects();
}

function hideDashboard() {
  document.getElementById('project-dashboard').style.display = 'none';
  document.getElementById('topbar').style.display = 'flex';
  document.getElementById('sidebar').style.display = 'flex';
  document.getElementById('canvas-wrap').style.display = 'block';
  document.getElementById('right-panel').style.display = 'block';
  document.getElementById('bottom-bar').style.display = 'flex';
  document.getElementById('status-bar').style.display = 'block';
}

function escapeHtml(txt) {
  return String(txt ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function renderDashboardProjects() {
  const grid = document.getElementById('dash-projects-grid');
  if(!grid) return;
  
  grid.innerHTML = '';
  
  Object.keys(workspaces).forEach(key => {
    const ws = workspaces[key];
    const name = ws.name || (key === 'root' ? 'Início' : key);
    const nodeCount = (ws.nodes || []).length;
    const connCount = (ws.connections || []).length;
    const icon = key === 'root' ? '🏠' : '📁';
    
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.projectId = key;
    card.innerHTML = `
      <div class="project-card-header">
        <div class="project-card-icon">${icon}</div>
        <button class="project-card-menu" title="Opções do projeto"><i class="ti ti-dots-vertical"></i></button>
      </div>
      <div class="project-card-name">${escapeHtml(name)}</div>
      <div class="project-card-meta">
        <div class="project-card-stat"><i class="ti ti-layout-cards"></i>${nodeCount}</div>
        <div class="project-card-stat"><i class="ti ti-line"></i>${connCount}</div>
      </div>
    `;
    
    card.onclick = (e) => {
      const menuBtn = e.target.closest('.project-card-menu');
      if(menuBtn) { e.stopPropagation(); showProjectMenu(key, menuBtn); return; }
      openProjectFromDashboard(key);
    };
    
    grid.appendChild(card);
  });
}

function persistCurrentWorkspaceState() {
  const old = workspaces[currentLevel] || {};
  workspaces[currentLevel] = { ...old, nodes:[...nodes], connections:[...connections], camera:{...camera} };
}

function showProjectMenu(projectId, anchor) {
  const menu = document.getElementById('project-card-menu-popover');
  if(!menu) return;
  const isRoot = projectId === 'root';
  menu.innerHTML = `
    <div class="project-menu-item" data-action="open"><i class="ti ti-folder-open"></i><span>Abrir / editar</span></div>
    <div class="project-menu-item" data-action="rename"><i class="ti ti-edit"></i><span>Renomear</span></div>
    <div class="project-menu-item danger ${isRoot ? 'disabled' : ''}" data-action="delete"><i class="ti ti-trash"></i><span>Excluir</span></div>
  `;
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.min(r.left, window.innerWidth - 190) + 'px';
  menu.style.top = (r.bottom + 6) + 'px';
  menu.classList.add('show');
  menu.onclick = (ev) => {
    const item = ev.target.closest('.project-menu-item');
    if(!item || item.classList.contains('disabled')) return;
    const action = item.dataset.action;
    hideProjectMenu();
    if(action === 'open') openProjectFromDashboard(projectId);
    if(action === 'rename') renameDashboardProject(projectId);
    if(action === 'delete') deleteDashboardProject(projectId);
  };
}

function hideProjectMenu() {
  const menu = document.getElementById('project-card-menu-popover');
  if(menu) menu.classList.remove('show');
}

document.addEventListener('click', e => {
  if(!e.target.closest('#project-card-menu-popover') && !e.target.closest('.project-card-menu')) hideProjectMenu();
});

function renameDashboardProject(projectId) {
  const ws = workspaces[projectId];
  if(!ws) return;
  const currentName = ws.name || (projectId === 'root' ? 'Início' : projectId);
  const newName = prompt('Novo nome do projeto:', currentName);
  if(!newName || !newName.trim()) return;
  ws.name = newName.trim();
  renderDashboardProjects();
  updateBreadcrumb();
  triggerSave();
}

function deleteDashboardProject(projectId) {
  if(projectId === 'root') { alert('O projeto inicial não pode ser excluído.'); return; }
  const ws = workspaces[projectId];
  if(!ws) return;
  const name = ws.name || projectId;
  if(!confirm(`Excluir o projeto "${name}"? Essa ação não pode ser desfeita.`)) return;
  delete workspaces[projectId];
  if(currentLevel === projectId) {
    currentLevel = 'root';
    navStack = [];
    const root = workspaces.root || {nodes:[], connections:[], camera:{x:0,y:0,zoom:1}, name:'Início'};
    workspaces.root = root;
    nodes = root.nodes || [];
    connections = root.connections || [];
    camera = root.camera || {x:0,y:0,zoom:1};
    selectNodeObj(null);
    draw();
  }
  renderDashboardProjects();
  updateBreadcrumb();
  triggerSave();
}

function openProjectFromDashboard(projectId) {
  navigateToProject(projectId);
  hideDashboard();
}

function createNewProject() {
  const name = prompt('Nome do novo projeto:');
  if(!name || !name.trim()) return;
  
  const id = 'project_' + Date.now();
  workspaces[id] = {
    nodes: [],
    connections: [],
    camera: {x:0, y:0, zoom:1},
    name: name.trim()
  };
  
  renderDashboardProjects();
  triggerSave();
}

// Event handlers do dashboard
document.getElementById('dash-new-project').onclick = createNewProject;
document.getElementById('dash-settings').onclick = () => {
  hideDashboard();
  document.getElementById('btn-settings').click();
};
