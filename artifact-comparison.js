/* The same pattern.ink is used in roaming, the reference and the translucent overlay. */
(function(global){
 'use strict';
 const paths=new Map();
 function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function pathFor(p){const old=paths.get(p.sourceNumber);if(old?.ink===p.ink)return old.path;const path=new Path2D(p.ink);paths.set(p.sourceNumber,{ink:p.ink,path});return path;}
 function affine(from,to){const[p,q,r]=from,[u,v,w]=to,x=q[0]-p[0],y=q[1]-p[1],xx=r[0]-p[0],yy=r[1]-p[1],det=x*yy-xx*y;if(Math.abs(det)<1e-8)return null;const a=((v[0]-u[0])*yy-(w[0]-u[0])*y)/det,c=((w[0]-u[0])*x-(v[0]-u[0])*xx)/det,b=((v[1]-u[1])*yy-(w[1]-u[1])*y)/det,d=((w[1]-u[1])*x-(v[1]-u[1])*xx)/det;return[a,b,c,d,u[0]-a*p[0]-c*p[1],u[1]-b*p[0]-d*p[1]];}
 function triangle(g,path,from,to){const m=affine(from,to);if(!m)return;g.save();g.beginPath();g.moveTo(...to[0]);g.lineTo(...to[1]);g.lineTo(...to[2]);g.closePath();g.clip();g.transform(...m);g.fill(path);g.restore();}
 function grain(g,c,texture,paint){if(!texture)return;g.globalCompositeOperation='destination-in';g.drawImage(texture,0,0,texture.naturalWidth||texture.width,texture.naturalHeight||texture.height,0,0,c.width,c.height);g.globalCompositeOperation='destination-over';g.globalAlpha=.28;paint();g.globalAlpha=1;g.globalCompositeOperation='source-over';}
 function layerFor(p,image,texture){
  const m=p.artifact.comparison,iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,s=1600/Math.max(iw,ih),w=Math.round(iw*s),h=Math.round(ih*s),c=makeCanvas(w,h),g=c.getContext('2d',{willReadFrequently:true}),path=pathFor(p),b=m.inkBounds;
  const paint=()=>{g.fillStyle=m.overlayColor||'#ffe08b';
   if(m.mesh){const a=m.mesh;for(let y=0;y<a.ys.length-1;y++)for(let x=0;x<a.xs.length-1;x++){const f=[[a.xs[x],a.ys[y]],[a.xs[x+1],a.ys[y]],[a.xs[x+1],a.ys[y+1]],[a.xs[x],a.ys[y+1]]],t=[a.points[y][x],a.points[y][x+1],a.points[y+1][x+1],a.points[y+1][x]].map(([x,y])=>[x*w/100,y*h/100]);triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);}}
   else if(m.quad){const[x,y,bw,bh]=m.inkClip||[b[0],b[1],b[2]-b[0],b[3]-b[1]],f=[[x,y],[x+bw,y],[x+bw,y+bh],[x,y+bh]],t=m.quad.map(([x,y])=>[x*w/100,y*h/100]);triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);}
   else if(m.box){const[x,y,bw,bh]=m.box,sx=bw*w/100/(b[2]-b[0]),sy=bh*h/100/(b[3]-b[1]);g.save();g.setTransform(sx,0,0,sy,x*w/100-b[0]*sx,y*h/100-b[1]*sy);g.fill(path);g.restore();}
  };paint();grain(g,c,texture,paint);g.globalCompositeOperation='destination-in';g.drawImage(image,0,0,w,h);g.globalCompositeOperation='source-over';
  if(m.omitRestoration){const raw=makeCanvas(w,h),r=raw.getContext('2d',{willReadFrequently:true});r.drawImage(image,0,0,w,h);const src=r.getImageData(0,0,w,h).data,pix=g.getImageData(0,0,w,h);for(let i=0;i<src.length;i+=4){const hi=Math.max(src[i],src[i+1],src[i+2]),lo=Math.min(src[i],src[i+1],src[i+2]);if(lo>166&&hi-lo<48)pix.data[i+3]=0;}g.putImageData(pix,0,0);}
  return c;
 }
 function impression(p,w,h,texture){const c=makeCanvas(w*2,h*2),g=c.getContext('2d'),b=p.artifact.comparison.inkBounds,s=Math.min((c.width-24)/(b[2]-b[0]),(c.height-24)/(b[3]-b[1]));const paint=()=>{g.save();g.translate((c.width-(b[2]-b[0])*s)/2-b[0]*s,(c.height-(b[3]-b[1])*s)/2-b[1]*s);g.scale(s,s);g.fillStyle='#c5ae72';g.fill(pathFor(p));g.restore();};paint();grain(g,c,texture,paint);return c;}
 function anchorFor(layer,m){const[x,y,w,h]=m.box||m.region||[35,35,30,30],tx=(x+w*.88)*layer.width/100,ty=(y+h*.3)*layer.height/100,a=layer.getContext('2d').getImageData(0,0,layer.width,layer.height).data;let best=[tx,ty],distance=Infinity,pixels=0;for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){if(a[(y*layer.width+x)*4+3]<90)continue;pixels++;const d=(x-tx)**2+(y-ty)**2;if(d<distance){distance=d;best=[x,y];}}return{point:best,pixels};}
 function render(canvas,p,image,texture){
  const m=p.artifact.comparison,iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!iw||!ih||!m)throw Error('Missing source or comparison');const portrait=iw/ih<.85;canvas.width=portrait?1000:1200;canvas.height=portrait?1100:800;const g=canvas.getContext('2d'),areaW=portrait?710:850,areaH=canvas.height-60,s=Math.min(areaW/iw,areaH/ih),ix=20+(areaW-iw*s)/2,iy=30+(areaH-ih*s)/2,bx=portrait?750:900,by=portrait?290:230,bw=220,bh=240;
  g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(image,ix,iy,iw*s,ih*s);const layer=layerFor(p,image,texture),anchor=anchorFor(layer,m);g.save();g.globalAlpha=.18;g.shadowColor='#edb54c';g.shadowBlur=5;g.drawImage(layer,ix,iy,iw*s,ih*s);g.shadowBlur=0;g.globalAlpha=m.overlayOpacity??.68;g.drawImage(layer,ix,iy,iw*s,ih*s);g.restore();
  const start=[ix+anchor.point[0]/layer.width*iw*s,iy+anchor.point[1]/layer.height*ih*s],end=[bx-24,by-105];g.save();g.strokeStyle='#ffe08b';g.lineWidth=1.4;g.globalAlpha=.75;g.beginPath();g.moveTo(...start);g.lineTo(...end);g.stroke();g.globalAlpha=1;g.fillStyle='#ffe08b';g.beginPath();g.arc(...start,3.5,0,Math.PI*2);g.fill();g.fillStyle='#e6d39f';g.font='27px Huiwen,serif';g.fillText('纹饰位置',end[0]+10,end[1]-15,bw+20);g.restore();
  g.drawImage(impression(p,bw,bh,texture),bx,by,bw,bh);g.textAlign='center';g.fillStyle='#c1af83';g.font='34px Huiwen,serif';g.fillText(m.referenceLabel||'同一纹样',bx+bw/2,by-28,bw+35);g.font='23px Huiwen,serif';g.fillStyle='#918364';g.fillText(m.label||'纹样叠印示意',bx+bw/2,by+bh+42,bw+35);if(m.sourceLabel){g.font='21px Huiwen,serif';g.fillText(m.sourceLabel,bx+bw/2,by+bh+76,bw+35);}
  canvas.dataset.comparisonMode=m.mode;return{mode:m.mode,sharedInk:true,overlayOpacity:m.overlayOpacity??.68,overlayPixels:anchor.pixels,sourceSize:[iw,ih],outputSize:[canvas.width,canvas.height]};
 }
 global.MotifComparison={render};
})(typeof window==='undefined'?globalThis:window);
