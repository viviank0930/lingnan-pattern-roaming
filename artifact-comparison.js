/* Artifact popups show only the photograph and source-aligned location markings. */
(function(global){
 'use strict';
 const cache=new Map(),figureLayouts=new WeakMap();
 function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function fingerprint(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
 function pathFor(p){const old=cache.get(p.sourceNumber);if(old?.ink===p.ink)return old.path;const path=new Path2D(p.ink);cache.set(p.sourceNumber,{ink:p.ink,path});return path;}
 function affine(from,to){const[p,q,r]=from,[u,v,w]=to,x=q[0]-p[0],y=q[1]-p[1],xx=r[0]-p[0],yy=r[1]-p[1],det=x*yy-xx*y;if(Math.abs(det)<1e-8)return null;const a=((v[0]-u[0])*yy-(w[0]-u[0])*y)/det,c=((w[0]-u[0])*x-(v[0]-u[0])*xx)/det,b=((v[1]-u[1])*yy-(w[1]-u[1])*y)/det,d=((w[1]-u[1])*x-(v[1]-u[1])*xx)/det;return[a,b,c,d,u[0]-a*p[0]-c*p[1],u[1]-b*p[0]-d*p[1]];}
 function triangle(g,path,from,to){const m=affine(from,to);if(!m)return;g.save();g.beginPath();g.moveTo(...to[0]);g.lineTo(...to[1]);g.lineTo(...to[2]);g.closePath();g.clip();g.transform(...m);g.fill(path);g.restore();}
 function sourceMark(p,image){
  let mark=p.sourceMark||global.ArtifactSourceTraces?.traces[p.sourceNumber];const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  if(!mark||mark.source!==p.artifact.src||mark.sourceSize[0]!==iw||mark.sourceSize[1]!==ih)throw Error('Source marking does not match its photograph');
  // The clean hunting tracing is shared by the drifting sprite and this photo.
  // Keep its existing source-photo registration; accept only this exact rig ink.
  if(p.sourceNumber===2007&&global.HuntingMotion?.ink===p.ink)mark={...mark,inkFingerprint:fingerprint(p.ink),registration:{...mark.registration,inkBounds:global.HuntingMotion.bounds}};
  if(mark.kind==='same-source-mask'&&mark.inkFingerprint!==fingerprint(p.ink))throw Error('Original source mask has changed');
  if((mark.kind==='source-lines'||mark.kind==='source-fill')&&!mark.paths?.length)throw Error('Missing original groove traces');
  return mark;
 }
 function layerFor(p,image,mark,displayScale){
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,s=1600/Math.max(iw,ih),w=Math.round(iw*s),h=Math.round(ih*s),c=makeCanvas(w,h),g=c.getContext('2d',{willReadFrequently:true});
  if(mark.kind==='figure-lines'){
   const rig=global.RaisedFigureDance,[bx,by,bw,bh]=rig.renderBounds;
   g.drawImage(rig.render(0,null,'#ffe08b'),bx/iw*w,by/ih*h,bw/iw*w,bh/ih*h);
  }else if(mark.kind==='source-fill'){
   // Photo-derived ridge boundaries retain their original source coordinates.
   g.save();g.scale(w/100,h/100);g.fillStyle='#ffe08b';g.globalAlpha=mark.fillOpacity??.62;g.fill(new Path2D(mark.paths.join(' ')));g.restore();
  }else if(mark.kind==='source-lines'){
   const [unitsX,unitsY]=mark.sourceCoordinates||[100,100];
   const sourcePath=new Path2D(mark.paths.join(' ')),weight=mark.strokeWidth/Math.sqrt((iw*displayScale/unitsX)*(ih*displayScale/unitsY));
   g.save();g.scale(w/unitsX,h/unitsY);g.lineCap='round';g.lineJoin='round';g.strokeStyle='#684820';g.globalAlpha=mark.edgeOpacity??.64;g.lineWidth=weight*1.7;g.stroke(sourcePath);g.strokeStyle='#ffe08b';g.globalAlpha=mark.strokeOpacity??.94;g.lineWidth=weight;g.stroke(sourcePath);g.restore();
  }else if(mark.kind==='same-source-mask'){
   const m=mark.registration,b=m.inkBounds,path=pathFor(p);g.save();g.fillStyle='#ffe08b';g.globalAlpha=mark.fillOpacity??1;
   if(mark.highlightRegion){
    g.scale(w/100,h/100);
    g.clip(new Path2D(mark.highlightRegion));
    g.setTransform(1,0,0,1,0,0);
   }
   if(m.parts){const contours=p.ink.match(/[mM][^mM]*/g)||[];for(const part of m.parts){const selected=new Path2D(part.subpaths.map(i=>{if(!contours[i])throw Error('Missing original ink contour');return contours[i];}).join(' '));g.save();const[a,b,c,d,e,f]=part.transform;g.transform(a*w/100,b*h/100,c*w/100,d*h/100,e*w/100,f*h/100);g.fill(selected);g.restore();}}
   else if(m.mesh){const a=m.mesh;for(let y=0;y<a.ys.length-1;y++)for(let x=0;x<a.xs.length-1;x++){const f=[[a.xs[x],a.ys[y]],[a.xs[x+1],a.ys[y]],[a.xs[x+1],a.ys[y+1]],[a.xs[x],a.ys[y+1]]],t=[a.points[y][x],a.points[y][x+1],a.points[y+1][x+1],a.points[y+1][x]].map(([x,y])=>[x*w/100,y*h/100]);triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);}}
   else if(m.quad){const[x,y,bw,bh]=m.inkClip||[b[0],b[1],b[2]-b[0],b[3]-b[1]],f=[[x,y],[x+bw,y],[x+bw,y+bh],[x,y+bh]],t=m.quad.map(([x,y])=>[x*w/100,y*h/100]);triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);}
   else if(m.box){const[x,y,bw,bh]=m.box,sx=bw*w/100/(b[2]-b[0]),sy=bh*h/100/(b[3]-b[1]);g.save();g.setTransform(sx,0,0,sy,x*w/100-b[0]*sx,y*h/100-b[1]*sy);g.globalAlpha=mark.fillOpacity??.72;g.fill(path);g.restore();}
   g.restore();
  }else throw Error('Unsupported source marking');
  g.globalCompositeOperation='destination-in';g.drawImage(image,0,0,w,h);g.globalCompositeOperation='source-over';
  if(mark.omitRestoration||mark.omitDarkCracks){const raw=makeCanvas(w,h),r=raw.getContext('2d',{willReadFrequently:true});r.drawImage(image,0,0,w,h);const src=r.getImageData(0,0,w,h).data,pix=g.getImageData(0,0,w,h);for(let i=0;i<src.length;i+=4){const hi=Math.max(src[i],src[i+1],src[i+2]),lo=Math.min(src[i],src[i+1],src[i+2]);if((mark.omitRestoration&&lo>180&&hi-lo<28)||(mark.omitDarkCracks&&.2126*src[i]+.7152*src[i+1]+.0722*src[i+2]<48))pix.data[i+3]=0;}g.putImageData(pix,0,0);}
  return c;
 }
 function anchorFor(layer,mark){const tx=mark.anchor[0]*layer.width/100,ty=mark.anchor[1]*layer.height/100,a=layer.getContext('2d').getImageData(0,0,layer.width,layer.height).data;let best=[tx,ty],distance=Infinity,pixels=0;for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){const i=(y*layer.width+x)*4;if(a[i+3]<100||a[i]<200)continue;pixels++;const d=(x-tx)**2+(y-ty)**2;if(d<distance){distance=d;best=[x,y];}}return{point:best,pixels};}
 // Original plate captions overlap these cutouts. Coordinates are in the
 // source image so cleanup preserves its size and motif registration.
 const plateCaptions = {
  'composite-7.webp': {
   cut: 'M0 139H36L45 149L51 159L57 168L63 181L66 190H0Z',
   ink: [[28,148,85,176]],
  },
  'composite-9.webp': {
   cut: 'M124 75L146 73L155 105L133 106L125 96Z M140 230H174V242H140Z',
  },
  'composite-10.webp': {
   ink: [[94,103,184,118]],
   cut: 'M91 112Q127 117 155 116L186 112V123H91Z',
  },
  'composite-20.webp': {
   cut: 'M74 17H145V60L120 53L107 47L95 40L86 31Z',
   ink: [[89,26,128,53]],
  },
  'composite-25.webp': {
   cut: 'M0 99V92L36 84L34 94L32 111H0Z M265 155Q283 148 302 148Q313 148 321 136L328 134V168H265Z',
   ink: [[30,77,77,94, 8,14], [282,134,327,160, -1,-14, true]],
  },
  'pottery-doc-41.webp': { paper: [[145,21,83,47], [289,300,27,26]] },
 };
 function coverPrintedInk(g,w,h,boxes){
  const frame=g.getImageData(0,0,w,h);
  const source=frame.data.slice(), damaged=new Uint8Array(w*h);
  for(const [x0,y0,x1,y1,,, paleGold] of boxes){
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const i=(y*w+x)*4,r=source[i],v=source[i+1],b=source[i+2];
    const white=Math.min(r,v,b)>163&&Math.max(r,v,b)-Math.min(r,v,b)<40;
    const gold=paleGold ? r>76&&r>=b-7 : r>128&&r-v>10&&v-b>17&&r-b>45;
    if(!source[i+3]||!(white||gold))continue;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)damaged[(y+dy)*w+x+dx]=1;
   }
  }
  // Where lettering covers the object, sample intact pixels immediately
  // around the lettering. Keep the original silhouette and all other pixels.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const p=y*w+x,i=p*4;
   if(!damaged[p]||!source[i+3])continue;
   const patch=boxes.find(([x0,y0,x1,y1,dx])=>dx!==undefined&&x>=x0-1&&x<=x1&&y>=y0-1&&y<=y1);
   if(patch){
    const xx=x+patch[4],yy=y+patch[5],q=yy*w+xx,j=q*4;
    if(xx>=0&&xx<w&&yy>=0&&yy<h&&source[j+3]>=220&&!damaged[q]){
     frame.data[i]=source[j];frame.data[i+1]=source[j+1];frame.data[i+2]=source[j+2];
     continue;
    }
   }
   let weight=0, r=0, v=0, b=0;
   for(let radius=1;radius<=8&&weight<2;radius++){
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
     if(Math.max(Math.abs(dx),Math.abs(dy))!==radius||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
     const q=(y+dy)*w+x+dx,j=q*4;
     if(damaged[q]||source[j+3]<220)continue;
     const f=1/(dx*dx+dy*dy);
     r+=source[j]*f;v+=source[j+1]*f;b+=source[j+2]*f;weight+=f;
    }
   }
   if(weight){frame.data[i]=r/weight;frame.data[i+1]=v/weight;frame.data[i+2]=b/weight;}
  }
  g.putImageData(frame,0,0);
 }
 function makePhotograph(image,artifact,iw,ih){
  const {silhouette,src}=artifact;
  const captions=plateCaptions[src.split('/').at(-1)];
  if(!silhouette&&!captions)return image;
  const photo=makeCanvas(iw,ih),g=photo.getContext('2d',{willReadFrequently:!!captions?.ink});
  g.save();
  if(silhouette)g.clip(new Path2D(silhouette));
  g.drawImage(image,0,0);
  g.restore();
  if(captions?.cut){
   g.globalCompositeOperation='destination-out';
   g.fill(new Path2D(captions.cut));
   g.globalCompositeOperation='source-over';
  }
  if(captions?.ink)coverPrintedInk(g,iw,ih,captions.ink);
  if(captions?.paper){
   g.fillStyle='#fff';for(const box of captions.paper)g.fillRect(...box);
  }
  return photo;
 }
 function render(canvas,p,image,texture){
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,mark=sourceMark(p,image),portrait=iw/ih<.85;canvas.width=portrait?1000:1200;canvas.height=portrait?1100:800;const g=canvas.getContext('2d'),displayWidth=canvas.parentElement?.clientWidth||canvas.clientWidth||540,labelSize=Math.max(33,Math.ceil(12*canvas.width/displayWidth)),labelWidth=labelSize*4+20,areaW=canvas.width-labelWidth-40,areaH=canvas.height-60,s=Math.min(areaW/iw,areaH/ih),ix=20+(areaW-iw*s)/2,iy=30+(areaH-ih*s)/2,labelY=portrait?185:125;
  const photo=makePhotograph(image,p.artifact,iw,ih);
  g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(photo,ix,iy,iw*s,ih*s);const layer=layerFor(p,photo,mark,s),anchor=anchorFor(layer,mark);g.save();g.shadowColor='#e9ac3e';g.shadowBlur=mark.haloBlur??4;g.drawImage(layer,ix,iy,iw*s,ih*s);g.restore();
  const start=[ix+anchor.point[0]/layer.width*iw*s,iy+anchor.point[1]/layer.height*ih*s],end=[canvas.width-labelWidth-10,labelY];g.save();g.strokeStyle='#ffe08b';g.lineWidth=1.4;g.globalAlpha=.75;g.beginPath();g.moveTo(...start);g.lineTo(...end);g.stroke();g.globalAlpha=1;g.fillStyle='#ffe08b';g.beginPath();g.arc(...start,3.5,0,Math.PI*2);g.fill();g.fillStyle='#e6d39f';g.font=labelSize+'px Huiwen,serif';g.fillText('纹饰位置',end[0]+10,end[1]-15,labelWidth-20);g.restore();
  const raised=p.sourceNumber===global.RaisedFigureDance?.sourceNumber;
  const hunting=p.sourceNumber===2007;
  const rig=raised?global.RaisedFigureDance:hunting?global.HuntingMotion:p.sourceNumber===2005?global.FigureDance:null;
  if(rig){
   const rest=makeCanvas(canvas.width,canvas.height);rest.getContext('2d').drawImage(canvas,0,0);
   figureLayouts.set(canvas,{rest,layer,ix,iy,w:iw*s,h:ih*s,mark,rig,raised,hunting,motionLayer:hunting?makeCanvas(canvas.width,canvas.height):null,photo});
   canvas.dataset.photoOpacity='1';
  }else figureLayouts.delete(canvas);
  canvas.dataset.comparisonMode=mark.kind;return{mode:mark.kind,sourceBound:true,overlayPixels:anchor.pixels,sourceSize:[iw,ih],outputSize:[canvas.width,canvas.height],sourcePathCount:mark.paths?.length||0};
 }
 function figureAt(canvas,clientX,clientY){
  const a=figureLayouts.get(canvas);if(!a)return false;
  const b=canvas.getBoundingClientRect(),s=Math.min(b.width/canvas.width,b.height/canvas.height);
  const x=(clientX-b.left-(b.width-canvas.width*s)/2)/s,y=(clientY-b.top-(b.height-canvas.height*s)/2)/s;
  const px=(x-a.ix)/a.w*100,py=(y-a.iy)/a.h*100;
  if(a.raised)return px>=29&&px<=71&&py>=33&&py<=83;
  if(a.hunting){const[x,y,w,h]=a.mark.registration.box;return px>=x&&px<=x+w&&py>=y&&py<=y+h;}
  return px>=16&&px<=87&&py>=29&&py<=89;
 }
 function figureGuidePosition(canvas){
  const a=figureLayouts.get(canvas);if(!a)return null;
  const b=canvas.getBoundingClientRect(),s=Math.min(b.width/canvas.width,b.height/canvas.height);
  if(!s)return null;
  const [px,py]=a.hunting?[.57,.79]:a.raised?[.55,.49]:[.565,.54];
  return{x:(b.width-canvas.width*s)/2+(a.ix+a.w*px)*s,y:(b.height-canvas.height*s)/2+(a.iy+a.h*py)*s};
 }
 function animateFigure(canvas,seconds,texture,reducedMotion){
  const a=figureLayouts.get(canvas);if(!a)return false;const {rig}=a;
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  const alpha=smooth(seconds/.2)*smooth((rig.duration-seconds)/.2),g=canvas.getContext('2d');
  g.clearRect(0,0,canvas.width,canvas.height);
  const photoOpacity=1-.74*alpha;
  canvas.dataset.photoOpacity=photoOpacity.toFixed(2);
  if(alpha===0){g.drawImage(a.rest,0,0);return true;}
  g.save();g.globalAlpha=photoOpacity;g.drawImage(a.photo,a.ix,a.iy,a.w,a.h);g.restore();
  g.save();g.shadowColor='#e9ac3e';g.shadowBlur=7;
  if(reducedMotion){g.drawImage(a.layer,a.ix,a.iy,a.w,a.h);g.restore();return true;}
  if(alpha<.999){g.globalAlpha=1-alpha;g.drawImage(a.layer,a.ix,a.iy,a.w,a.h);}
  // Registration keeps the three belly circles over the original marked
  // circles (source percentages approximately 51.5/46.5, 53.3, 61.0).
  g.globalAlpha=alpha;
  if(a.raised){
   const [bx,by,bw,bh]=rig.renderBounds,[iw,ih]=a.mark.sourceSize;
   g.drawImage(rig.render(seconds,texture,'#ffe4a0'),a.ix+bx/iw*a.w,a.iy+by/ih*a.h,bw/iw*a.w,bh/ih*a.h);
  }else if(a.hunting){
   const [bx,by,bw,bh]=a.mark.registration.box,[ix0,iy0,ix1,iy1]=a.mark.registration.inkBounds,[rx,ry,rw,rh]=rig.renderBounds;
   const x=a.ix+(bx+(rx-ix0)*bw/(ix1-ix0))/100*a.w,y=a.iy+(by+(ry-iy0)*bh/(iy1-iy0))/100*a.h;
   const m=a.motionLayer.getContext('2d');m.clearRect(0,0,canvas.width,canvas.height);m.drawImage(rig.render(seconds,texture,'#ffe08b'),x,y,rw*bw/(ix1-ix0)/100*a.w,rh*bh/(iy1-iy0)/100*a.h);
   m.globalCompositeOperation='destination-in';m.drawImage(a.photo,a.ix,a.iy,a.w,a.h);m.globalCompositeOperation='source-over';g.drawImage(a.motionLayer,0,0);
  }else{
   const x=a.ix+(-.5-16/2.72*.98)/100*a.w,y=a.iy+(30.5-16/2.72*.56)/100*a.h;
   g.drawImage(rig.render(seconds,texture,'#ffe08b'),x,y,320/2.72*.98/100*a.w,320/2.72*.56/100*a.h);
  }
  g.restore();
  return true;
 }
 global.MotifComparison={render,figureAt,figureGuidePosition,animateFigure};
})(typeof window==='undefined'?globalThis:window);
