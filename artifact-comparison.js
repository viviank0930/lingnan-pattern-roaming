/* Photo marks follow source coordinates. The roaming illustration is only drawn in the reference area. */
(function(global){
 'use strict';
 const cache=new Map();
 function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function fingerprint(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
 function pathFor(p){const old=cache.get(p.sourceNumber);if(old?.ink===p.ink)return old.path;const path=new Path2D(p.ink);cache.set(p.sourceNumber,{ink:p.ink,path});return path;}
 function affine(from,to){const[p,q,r]=from,[u,v,w]=to,x=q[0]-p[0],y=q[1]-p[1],xx=r[0]-p[0],yy=r[1]-p[1],det=x*yy-xx*y;if(Math.abs(det)<1e-8)return null;const a=((v[0]-u[0])*yy-(w[0]-u[0])*y)/det,c=((w[0]-u[0])*x-(v[0]-u[0])*xx)/det,b=((v[1]-u[1])*yy-(w[1]-u[1])*y)/det,d=((w[1]-u[1])*x-(v[1]-u[1])*xx)/det;return[a,b,c,d,u[0]-a*p[0]-c*p[1],u[1]-b*p[0]-d*p[1]];}
 function triangle(g,path,from,to){const m=affine(from,to);if(!m)return;g.save();g.beginPath();g.moveTo(...to[0]);g.lineTo(...to[1]);g.lineTo(...to[2]);g.closePath();g.clip();g.transform(...m);g.fill(path);g.restore();}
 function sourceMark(p,image){
  const mark=global.ArtifactSourceTraces?.traces[p.sourceNumber],iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  if(!mark||mark.source!==p.artifact.src||mark.sourceSize[0]!==iw||mark.sourceSize[1]!==ih)throw Error('Source marking does not match its photograph');
  if(mark.kind==='same-source-mask'&&mark.inkFingerprint!==fingerprint(p.ink))throw Error('Original source mask has changed');
  if(mark.kind==='source-lines'&&!mark.paths?.length)throw Error('Missing original groove traces');
  return mark;
 }
 function layerFor(p,image,mark,displayScale){
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,s=1600/Math.max(iw,ih),w=Math.round(iw*s),h=Math.round(ih*s),c=makeCanvas(w,h),g=c.getContext('2d',{willReadFrequently:true});
  if(mark.kind==='source-lines'){
   const sourcePath=new Path2D(mark.paths.join(' ')),weight=mark.strokeWidth/Math.sqrt((iw*displayScale/100)*(ih*displayScale/100));
   g.save();g.scale(w/100,h/100);g.lineCap='round';g.lineJoin='round';g.strokeStyle='#684820';g.globalAlpha=.64;g.lineWidth=weight*1.7;g.stroke(sourcePath);g.strokeStyle='#ffe08b';g.globalAlpha=.94;g.lineWidth=weight;g.stroke(sourcePath);g.restore();
  }else if(mark.kind==='same-source-mask'){
   const m=mark.registration,b=m.inkBounds,path=pathFor(p);g.fillStyle='#ffe08b';
   if(m.mesh){const a=m.mesh;for(let y=0;y<a.ys.length-1;y++)for(let x=0;x<a.xs.length-1;x++){const f=[[a.xs[x],a.ys[y]],[a.xs[x+1],a.ys[y]],[a.xs[x+1],a.ys[y+1]],[a.xs[x],a.ys[y+1]]],t=[a.points[y][x],a.points[y][x+1],a.points[y+1][x+1],a.points[y+1][x]].map(([x,y])=>[x*w/100,y*h/100]);triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);}}
   else if(m.quad){const[x,y,bw,bh]=m.inkClip||[b[0],b[1],b[2]-b[0],b[3]-b[1]],f=[[x,y],[x+bw,y],[x+bw,y+bh],[x,y+bh]],t=m.quad.map(([x,y])=>[x*w/100,y*h/100]);triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);}
   else if(m.box){const[x,y,bw,bh]=m.box,sx=bw*w/100/(b[2]-b[0]),sy=bh*h/100/(b[3]-b[1]);g.save();g.setTransform(sx,0,0,sy,x*w/100-b[0]*sx,y*h/100-b[1]*sy);g.globalAlpha=.72;g.fill(path);g.restore();}
  }else throw Error('Unsupported source marking');
  g.globalCompositeOperation='destination-in';g.drawImage(image,0,0,w,h);g.globalCompositeOperation='source-over';
  if(mark.omitRestoration){const raw=makeCanvas(w,h),r=raw.getContext('2d',{willReadFrequently:true});r.drawImage(image,0,0,w,h);const src=r.getImageData(0,0,w,h).data,pix=g.getImageData(0,0,w,h);for(let i=0;i<src.length;i+=4){const hi=Math.max(src[i],src[i+1],src[i+2]),lo=Math.min(src[i],src[i+1],src[i+2]);if(lo>180&&hi-lo<28)pix.data[i+3]=0;}g.putImageData(pix,0,0);}
  return c;
 }
 function impression(p,w,h,texture){const c=makeCanvas(w*2,h*2),g=c.getContext('2d'),b=p.artifact.comparison.inkBounds,s=Math.min((c.width-24)/(b[2]-b[0]),(c.height-24)/(b[3]-b[1]));const paint=()=>{g.save();g.translate((c.width-(b[2]-b[0])*s)/2-b[0]*s,(c.height-(b[3]-b[1])*s)/2-b[1]*s);g.scale(s,s);g.fillStyle='#c5ae72';g.fill(pathFor(p));g.restore();};paint();if(texture){g.globalCompositeOperation='destination-in';g.drawImage(texture,0,0,texture.naturalWidth||texture.width,texture.naturalHeight||texture.height,0,0,c.width,c.height);g.globalCompositeOperation='destination-over';g.globalAlpha=.28;paint();g.globalAlpha=1;g.globalCompositeOperation='source-over';}return c;}
 function anchorFor(layer,mark){const tx=mark.anchor[0]*layer.width/100,ty=mark.anchor[1]*layer.height/100,a=layer.getContext('2d').getImageData(0,0,layer.width,layer.height).data;let best=[tx,ty],distance=Infinity,pixels=0;for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){const i=(y*layer.width+x)*4;if(a[i+3]<100||a[i]<200)continue;pixels++;const d=(x-tx)**2+(y-ty)**2;if(d<distance){distance=d;best=[x,y];}}return{point:best,pixels};}
 function render(canvas,p,image,texture){
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,mark=sourceMark(p,image),portrait=iw/ih<.85;canvas.width=portrait?1000:1200;canvas.height=portrait?1100:800;const g=canvas.getContext('2d'),areaW=portrait?710:850,areaH=canvas.height-60,s=Math.min(areaW/iw,areaH/ih),ix=20+(areaW-iw*s)/2,iy=30+(areaH-ih*s)/2,bx=portrait?750:900,by=portrait?290:230,bw=220,bh=240;
  g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(image,ix,iy,iw*s,ih*s);const layer=layerFor(p,image,mark,s),anchor=anchorFor(layer,mark);g.save();g.shadowColor='#e9ac3e';g.shadowBlur=4;g.drawImage(layer,ix,iy,iw*s,ih*s);g.restore();
  const start=[ix+anchor.point[0]/layer.width*iw*s,iy+anchor.point[1]/layer.height*ih*s],end=[bx-24,by-105];g.save();g.strokeStyle='#ffe08b';g.lineWidth=1.4;g.globalAlpha=.75;g.beginPath();g.moveTo(...start);g.lineTo(...end);g.stroke();g.globalAlpha=1;g.fillStyle='#ffe08b';g.beginPath();g.arc(...start,3.5,0,Math.PI*2);g.fill();g.fillStyle='#e6d39f';g.font='27px Huiwen,serif';g.fillText('纹饰位置',end[0]+10,end[1]-15,bw+20);g.restore();
  g.drawImage(impression(p,bw,bh,texture),bx,by,bw,bh);g.textAlign='center';g.fillStyle='#c1af83';g.font='34px Huiwen,serif';g.fillText(p.sourceNumber===11?'文献纹样':p.sourceNumber===1?'文献单元':'纹样提炼',bx+bw/2,by-28,bw+35);
  const label=p.artifact.comparison.sourceLabel;if(label){g.font='23px Huiwen,serif';g.fillStyle='#918364';g.fillText(label,bx+bw/2,by+bh+42,bw+35);}
  canvas.dataset.comparisonMode=mark.kind;return{mode:mark.kind,sourceBound:true,overlayPixels:anchor.pixels,sourceSize:[iw,ih],outputSize:[canvas.width,canvas.height],sourcePathCount:mark.paths?.length||0};
 }
 global.MotifComparison={render};
})(typeof window==='undefined'?globalThis:window);
