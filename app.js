(() => {
  'use strict';
  const canvas = document.querySelector('#field'), ctx = canvas.getContext('2d');
  const root = document.querySelector('#experience'), detail = document.querySelector('#detail');
  const nameEl = document.querySelector('#pattern-name'), periodEl = document.querySelector('#pattern-period');
  const descriptionEl = document.querySelector('#pattern-description');
  const artifactEl = document.querySelector('#pattern-artifact'), artifactImage = document.querySelector('#artifact-image');
  const flowEl = document.querySelector('#flow-state'), hintEl = document.querySelector('#interaction-hint');
  const announcement = document.querySelector('#selection-announcement');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const gold = '#c5ae72', sprites = new Map(), hitMasks = new Map(), pointers = new Map();
  const world = { width: 2800, height: 1900 };
  const camera = { x: 0, y: 0, zoom: 1 };
  let patterns = [], nodes = [], screenNodes = [], selected = null, hover = null;
  let width = innerWidth, height = innerHeight, dpr = 1, clock = 0, lastFrame = 0, lastTrace = 0;
  let drag = null, pinch = null, dirty = true, raf = 0, ready = false, texture = null, focusedIndex = -1;
  let seed = 47219;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wrap = (v, span) => ((v + span / 2) % span + span) % span - span / 2;
  const fit = () => width < 700 ? Math.max(.6, Math.min(width / 1150, height / 860)) : Math.min(width / 1440, height / 860);
  const paused = () => selected !== null || pointers.size > 0 || reducedMotion.matches;

  function resize() {
    width = root.clientWidth; height = root.clientHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    dirty = true; updateDetail();
  }

  function makeNodes() {
    // Irregular, evenly distributed anchors avoid very large voids without
    // turning the field into a grid. A few companions create looser clusters.
    world.width = 2688; world.height = 1940;
    const ordered = [...patterns.filter(p => p.isNew), ...patterns.filter(p => !p.isNew)];
    let bag = [], bagIndex = 0;
    const nextPattern = () => {
      if (bagIndex >= bag.length) {
        bag = [...ordered];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        bagIndex = 0;
      }
      return bag[bagIndex++];
    };
    const main = [];
    const distance = (a, b) => {
      const dx = Math.min(Math.abs(a.x - b.x), world.width - Math.abs(a.x - b.x));
      const dy = Math.min(Math.abs(a.y - b.y), world.height - Math.abs(a.y - b.y));
      return Math.hypot(dx, dy);
    };
    for (let i = 0; i < 145; i++) {
      let best = i === 0 ? {x:-175,y:-90} : i === 1 ? {x:205,y:125} : null, bestDistance = -1;
      if (!best) for (let k = 0; k < 65; k++) {
        const point = {x:(random()-.5)*world.width,y:(random()-.5)*world.height};
        const nearest = Math.min(...main.map(n=>distance(point,n)));
        if (nearest > bestDistance) { best = point; bestDistance = nearest; }
      }
      const pattern = i < 2 ? patterns.find(p=>p.sourceNumber===(i===0?2005:2007)) || nextPattern() : nextPattern();
      main.push({...best,id:i,pattern,size:(pattern.motifRole==='hunting'?143:90)+random()*31,
        phase:random()*Math.PI*2,turn:(random()-.5)*.24,opacity:.7+random()*.27,depth:1,primary:true});
    }
    const companions = [];
    for (let i=0;i<12;i++) {
      const anchor=main[2+Math.floor(random()*(main.length-2))],angle=random()*Math.PI*2,spacing=65+random()*35;
      companions.push({id:145+i,pattern:nextPattern(),x:wrap(anchor.x+Math.cos(angle)*spacing,world.width),
        y:wrap(anchor.y+Math.sin(angle)*spacing,world.height),size:78+random()*28,phase:random()*Math.PI*2,
        turn:(random()-.5)*.24,opacity:.5+random()*.27,depth:1,primary:true});
    }
    const ambient = Array.from({length:70},(_,i)=>({id:157+i,pattern:nextPattern(),x:(random()-.5)*world.width,
      y:(random()-.5)*world.height,size:28+random()*42,depth:.45+random()*.3,phase:random()*Math.PI*2,
      turn:(random()-.5)*.28,opacity:.12+random()*.2,primary:false}));
    nodes=[...ambient,...main,...companions];
  }

  function normalizePath(path) {
    return new Path2D(path);
  }

  function buildSprite(pattern) {
    const c = document.createElement('canvas'); c.width = c.height = 320;
    const g = c.getContext('2d'); g.translate(16, 16); g.scale(2.72, 2.72);
    const path = normalizePath(pattern.ink);
    g.fillStyle = gold; g.strokeStyle = gold; g.lineJoin = 'round'; g.lineCap = 'round';
    g.fill(path, 'nonzero');
    if (texture) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      const w = texture.naturalWidth, h = texture.naturalHeight;
      g.drawImage(texture, w * .11, h * .11, w * .78, h * .78, 0, 0, 320, 320);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = gold; g.fillRect(0, 0, 320, 320);
      g.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  function prepareSprites() {
    for (const pattern of patterns) {
      const sprite = buildSprite(pattern);
      sprites.set(pattern.sourceNumber, sprite);
      const pixels = sprite.getContext('2d').getImageData(0, 0, 320, 320).data;
      const mask = new Uint8Array(320 * 320);
      for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3];
      hitMasks.set(pattern.sourceNumber, mask);
    }
  }

  function project(node) {
    const scale = fit() * camera.zoom;
    const x = wrap(node.x + clock * (node.primary?11:7) + Math.sin(clock*.13+node.phase)*14 - camera.x*node.depth, world.width);
    const y = wrap(node.y + Math.cos(clock*.11+node.phase)*16 - camera.y*node.depth, world.height);
    return { node, x: width / 2 + x * scale, y: height / 2 + 24 + y * scale,
      size: node.size * scale, angle: node.turn + Math.sin(clock * .15 + node.phase) * .018 };
  }

  function drawSprite(item) {
    const n = item.node, sprite = sprites.get(n.pattern.sourceNumber);
    if (!sprite) return;
    ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.angle);
    ctx.globalAlpha = n.opacity * (selected && selected !== n ? .5 : 1);
    if (selected === n || hover === n) { ctx.filter = 'brightness(1.4)'; ctx.shadowColor = 'rgba(218,192,121,.35)'; ctx.shadowBlur = selected === n ? 15 : 7; }
    ctx.drawImage(sprite, -item.size / 2, -item.size / 2, item.size, item.size);
    ctx.restore();
  }

  function drawFocus(item) {
    const r = item.size * .63, l = Math.max(8, r * .16);
    ctx.save(); ctx.strokeStyle = 'rgba(216,191,123,.68)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const x = item.x + sx * r, y = item.y + sy * r;
      ctx.moveTo(x - sx * l, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * l);
    }
    ctx.stroke(); ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    screenNodes = [];
    const spanX = world.width * fit() * camera.zoom, spanY = world.height * fit() * camera.zoom;
    for (const node of nodes) {
      const item = project(node);
      const firstX = Math.ceil((-item.size - item.x) / spanX), lastX = Math.floor((width + item.size - item.x) / spanX);
      const firstY = Math.ceil((-item.size - item.y) / spanY), lastY = Math.floor((height + item.size - item.y) / spanY);
      for (let x = firstX; x <= lastX; x++) for (let y = firstY; y <= lastY; y++) {
        screenNodes.push({ ...item, x: item.x + x * spanX, y: item.y + y * spanY });
      }
    }
    for (const item of screenNodes) drawSprite(item);
    const chosen = screenNodes.find(n => n.node === selected);
    if (chosen) drawFocus(chosen);
    if (selected) updateDetail(chosen);
  }

  function frame(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0; lastFrame = now;
    if (ready && !paused()) { clock += dt; dirty = true; }
    if (ready && dirty) { draw(); dirty = false; }
    if (now - lastTrace > 350) { canvas.dataset.phase = clock.toFixed(3); lastTrace = now; }
    raf = requestAnimationFrame(frame);
  }

  function hitAt(x, y, tolerance = 5) {
    const options = screenNodes.filter(s => Math.hypot(s.x - x, s.y - y) < Math.max(s.size * .75 + tolerance, 19));
    options.sort((a, b) => Math.hypot(a.x-x,a.y-y)/a.size - Math.hypot(b.x-x,b.y-y)/b.size);
    for (const item of options) {
      const dx = x - item.x, dy = y - item.y, cos = Math.cos(item.angle), sin = Math.sin(item.angle);
      const px = 160 + (dx * cos + dy * sin) * 320 / item.size;
      const py = 160 + (-dx * sin + dy * cos) * 320 / item.size;
      const radius = tolerance * 320 / item.size, mask = hitMasks.get(item.node.pattern.sourceNumber);
      for (let yy = Math.max(0, Math.floor(py - radius)); yy <= Math.min(319, py + radius); yy += 2) {
        for (let xx = Math.max(0, Math.floor(px - radius)); xx <= Math.min(319, px + radius); xx += 2) {
          if (mask[yy * 320 + xx] > 32) return item.node;
        }
      }
    }
    return null;
  }

  function updateState() {
    const stopped = selected !== null;
    root.dataset.flow = stopped ? 'paused' : 'moving'; canvas.dataset.selected = selected ? String(selected.pattern.sourceNumber) : '';
    flowEl.textContent = stopped ? '已停驻' : reducedMotion.matches ? '静态浏览' : '缓缓流动';
    hintEl.innerHTML = stopped ? '点击空白处 <span>·</span> 继续漫游' : '拖动浏览 <span>·</span> 点击纹饰停驻';
    if (selected) {
      const p = selected.pattern, displayPeriod = p.displayPeriod || p.period;
      nameEl.textContent = p.name; periodEl.textContent = displayPeriod;
      descriptionEl.textContent = p.description || '';
      descriptionEl.hidden = !p.description;
      const artifact = p.artifact;
      artifactEl.hidden = !artifact;
      detail.classList.toggle('has-artifact', !!artifact);
      if (artifact) {
        artifactImage.src = artifact.src; artifactImage.alt = artifact.alt;
        artifactEl.dataset.shape = artifact.shape || 'portrait';
      } else { artifactImage.removeAttribute('src'); artifactImage.alt = ''; }
      detail.hidden = false; updateDetail();
      announcement.textContent = p.name + '，' + displayPeriod + '。' + (p.description || '') + '所有纹饰已暂停。';
    } else { detail.hidden = true; announcement.textContent = '已取消选中，继续漫游。'; }
    dirty = true;
  }

  function updateDetail(item) {
    if (!selected || detail.hidden) return;
    item ||= project(selected);
    const boxWidth = detail.offsetWidth, boxHeight = detail.offsetHeight;
    let x = item.x + item.size * .75 + 12, y = item.y - boxHeight * .4;
    if (x + boxWidth > width - 25) x = item.x - item.size * .75 - boxWidth - 12;
    if (width < 700) { x = (width - boxWidth) / 2; y = height - boxHeight - 82; }
    detail.style.left = clamp(x, 20, Math.max(20, width - boxWidth - 20)) + 'px';
    detail.style.top = clamp(y, 110, Math.max(110, height - boxHeight - 75)) + 'px';
  }

  function select(node) { selected = selected === node ? null : node; hover = null; updateState(); }
  function cancel() { selected = null; updateState(); }

  canvas.addEventListener('pointerdown', e => {
    if (!ready || (e.pointerType === 'mouse' && e.button !== 0)) return;
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (pointers.size === 1) drag = { x:e.clientX, y:e.clientY, cameraX:camera.x, cameraY:camera.y, moved:false, pinched:false };
    else if (pointers.size === 2) {
      const [a,b] = [...pointers.values()]; pinch = { distance:Math.hypot(a.x-b.x,a.y-b.y), zoom:camera.zoom };
      if (drag) drag.pinched = true;
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if (pinch && pointers.size === 2) { const [a,b]=[...pointers.values()]; camera.zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,.55,1.9); dirty=true; return; }
      if (!drag || drag.pinched) return;
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if (Math.hypot(dx,dy)>5) drag.moved=true;
      if (drag.moved) {
        camera.x=drag.cameraX-dx/(fit()*camera.zoom); camera.y=drag.cameraY-dy/(fit()*camera.zoom);
        canvas.classList.add('is-dragging'); hover=null; dirty=true;
      }
    } else {
      const node=hitAt(e.clientX,e.clientY); if (node!==hover) {hover=node;dirty=true;}
      canvas.classList.toggle('over-pattern',!!node);
    }
  });
  function endPointer(e, cancelled=false) {
    if (!pointers.has(e.pointerId)) return;
    const shouldClick=!cancelled && drag && !drag.moved && !drag.pinched && pointers.size===1;
    pointers.delete(e.pointerId);
    if (shouldClick) { const hit=hitAt(e.clientX,e.clientY,e.pointerType==='touch'?9:5); hit ? select(hit) : cancel(); }
    if (!pointers.size) {drag=null;pinch=null;canvas.classList.remove('is-dragging');}
    dirty=true;
  }
  canvas.addEventListener('pointerup',e=>endPointer(e));
  canvas.addEventListener('pointercancel',e=>endPointer(e,true));
  canvas.addEventListener('lostpointercapture',e=>endPointer(e,true));
  canvas.addEventListener('pointerleave',()=>{if(!pointers.size){hover=null;dirty=true;canvas.classList.remove('over-pattern');}});
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const old=camera.zoom, next=clamp(old*Math.exp(-e.deltaY*.0011),.55,1.9);
    const px=(e.clientX-width/2)/fit(),py=(e.clientY-height/2-24)/fit();
    camera.x+=px/old-px/next; camera.y+=py/old-py/next; camera.zoom=next;dirty=true;
  },{passive:false});
  document.querySelector('#close-detail').addEventListener('click',()=>{cancel();canvas.focus({preventScroll:true});});
  document.querySelector('#reset-view').addEventListener('click',()=>{camera.x=0;camera.y=0;camera.zoom=1;clock=0;cancel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')cancel();});
  canvas.addEventListener('keydown',e=>{
    if (!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Enter',' '].includes(e.key)) return;
    e.preventDefault();
    if(e.key==='Enter'||e.key===' '){if(selected)cancel();else{const first=screenNodes.find(s=>s.node.primary);if(first)select(first.node);}return;}
    const visible=screenNodes.filter(s=>s.node.primary).sort((a,b)=>a.x-b.x||a.y-b.y);
    if(!visible.length)return; focusedIndex=(focusedIndex+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+visible.length)%visible.length;
    selected=visible[focusedIndex].node;updateState();
  });
  reducedMotion.addEventListener('change',()=>{dirty=true;updateState();});
  document.addEventListener('visibilitychange',()=>{lastFrame=0;});
  new ResizeObserver(resize).observe(root);
  document.querySelector('#retry').addEventListener('click',()=>location.reload());
  artifactImage.addEventListener('load',()=>{if(selected)updateDetail();});

  async function start() {
    try {
      const [response, image] = await Promise.all([
        fetch('patterns.json?v=continuous-20261022-1').then(r=>{if(!r.ok)throw Error('patterns');return r.json();}),
        new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='assets/ink-pigment.png';})
      ]);
      patterns=response; texture=image; makeNodes(); prepareSprites(); resize();
      ready=true; document.querySelector('#loading').hidden=true;
      const requested = Number(new URLSearchParams(location.search).get('motif'));
      const sample = nodes.find(n => n.primary && n.pattern.sourceNumber === requested);
      if (sample) { camera.x = sample.x; camera.y = sample.y; selected = sample; }
      updateState();
      raf=requestAnimationFrame(frame);
    } catch(error) {document.querySelector('#loading').hidden=true;document.querySelector('#error').hidden=false;console.error('纹饰加载失败',error);}
  }
  start();
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);pointers.clear();});
})();
