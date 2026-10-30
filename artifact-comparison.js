/* Existing ink is the only motif geometry used here. Photos are never repainted. */
(function (global) {
  'use strict';
  const paths = new Map();
  function makeCanvas(w,h) { const c=document.createElement('canvas');c.width=w;c.height=h;return c; }
  function pathFor(pattern) {
    const old=paths.get(pattern.sourceNumber);
    if(old?.ink===pattern.ink)return old.path;
    const path=new Path2D(pattern.ink);paths.set(pattern.sourceNumber,{ink:pattern.ink,path});return path;
  }
  function affine(from,to) {
    const [p0,p1,p2]=from,[q0,q1,q2]=to;
    const x1=p1[0]-p0[0],y1=p1[1]-p0[1],x2=p2[0]-p0[0],y2=p2[1]-p0[1],det=x1*y2-x2*y1;
    if(Math.abs(det)<1e-8)return null;
    const u1=q1[0]-q0[0],v1=q1[1]-q0[1],u2=q2[0]-q0[0],v2=q2[1]-q0[1];
    const a=(u1*y2-u2*y1)/det,c=(u2*x1-u1*x2)/det,b=(v1*y2-v2*y1)/det,d=(v2*x1-v1*x2)/det;
    return [a,b,c,d,q0[0]-a*p0[0]-c*p0[1],q0[1]-b*p0[0]-d*p0[1]];
  }
  function triangle(g,path,from,to) {
    const matrix=affine(from,to);if(!matrix)return;
    g.save();g.beginPath();g.moveTo(...to[0]);g.lineTo(...to[1]);g.lineTo(...to[2]);g.closePath();g.clip();g.transform(...matrix);g.fill(path);g.restore();
  }
  function layerFor(pattern,image,color) {
    const mark=pattern.artifact.comparison,iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
    const ratio=Math.min(1,1600/Math.max(iw,ih)),w=Math.round(iw*ratio),h=Math.round(ih*ratio),c=makeCanvas(w,h),g=c.getContext('2d',{willReadFrequently:true});
    const path=pathFor(pattern),bounds=mark.inkClip||mark.inkBounds;g.fillStyle=color;
    if(mark.mesh){
      const m=mark.mesh;
      for(let y=0;y<m.ys.length-1;y++)for(let x=0;x<m.xs.length-1;x++){
        const f=[[m.xs[x],m.ys[y]],[m.xs[x+1],m.ys[y]],[m.xs[x+1],m.ys[y+1]],[m.xs[x],m.ys[y+1]]];
        const t=[m.points[y][x],m.points[y][x+1],m.points[y+1][x+1],m.points[y+1][x]].map(([a,b])=>[a*w/100,b*h/100]);
        triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);
      }
    }else if(mark.quad){
      const [x,y,bw,bh]=bounds,f=[[x,y],[x+bw,y],[x+bw,y+bh],[x,y+bh]],t=mark.quad.map(([a,b])=>[a*w/100,b*h/100]);
      triangle(g,path,[f[0],f[1],f[2]],[t[0],t[1],t[2]]);triangle(g,path,[f[0],f[2],f[3]],[t[0],t[2],t[3]]);
    }else if(mark.box){
      const b=mark.inkBounds,[x,y,bw,bh]=mark.box,sx=bw*w/100/(b[2]-b[0]),sy=bh*h/100/(b[3]-b[1]);
      g.save();g.setTransform(sx,0,0,sy,x*w/100-b[0]*sx,y*h/100-b[1]*sy);g.fill(path);g.restore();
    }
    // Never lay new ink outside the original object or across white reconstruction.
    g.globalCompositeOperation='destination-in';g.drawImage(image,0,0,w,h);g.globalCompositeOperation='source-over';
    if(mark.omitRestoration){
      const source=makeCanvas(w,h),s=source.getContext('2d',{willReadFrequently:true});s.drawImage(image,0,0,w,h);
      const raw=s.getImageData(0,0,w,h).data,pixels=g.getImageData(0,0,w,h);
      for(let i=0;i<raw.length;i+=4){const hi=Math.max(raw[i],raw[i+1],raw[i+2]),lo=Math.min(raw[i],raw[i+1],raw[i+2]);if(lo>166&&hi-lo<48)pixels.data[i+3]=0;}
      g.putImageData(pixels,0,0);
    }
    return c;
  }
  function brackets(g,box,color) {
    const [x,y,w,h]=box,leg=Math.max(8,Math.min(w,h)*.18);g.save();g.strokeStyle=color;g.lineWidth=2.5;g.globalAlpha=.8;
    for(const [a,b,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x+w,y+h,-1,-1],[x,y+h,1,-1]]){g.beginPath();g.moveTo(a+sx*leg,b);g.lineTo(a,b);g.lineTo(a,b+sy*leg);g.stroke();}g.restore();
  }
  function render(canvas,pattern,image) {
    const mark=pattern.artifact.comparison;if(!mark)throw Error('Missing comparison');
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,portrait=iw/ih<.85;
    if(!iw||!ih)throw Error('Source image is not loaded');
    canvas.width=portrait?1000:1200;canvas.height=portrait?1100:800;
    const g=canvas.getContext('2d'),areaW=portrait?710:850,areaH=canvas.height-60,s=Math.min(areaW/iw,areaH/ih),ix=20+(areaW-iw*s)/2,iy=30+(areaH-ih*s)/2;
    const color=['rubbing','drawing'].includes(pattern.artifact.kind)?'#008d84':'#6ee7cf';
    g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(image,ix,iy,iw*s,ih*s);
    if(mark.mode!=='reference'){
      const layer=layerFor(pattern,image,color);g.save();g.globalAlpha=mark.mode==='registered'?.83:.75;g.drawImage(layer,ix,iy,iw*s,ih*s);g.restore();
    }else if(mark.region){
      const [x,y,w,h]=mark.region;brackets(g,[ix+x*iw*s/100,iy+y*ih*s/100,w*iw*s/100,h*ih*s/100],color);
    }
    const bx=portrait?750:900,by=portrait?290:230,bw=220,bh=240,b=mark.inkBounds;
    const scale=Math.min(bw/(b[2]-b[0]),bh/(b[3]-b[1]));
    g.save();g.translate(bx+(bw-(b[2]-b[0])*scale)/2-b[0]*scale,by+(bh-(b[3]-b[1])*scale)/2-b[1]*scale);g.scale(scale,scale);g.fillStyle=color;g.fill(pathFor(pattern));g.restore();
    g.textAlign='center';g.fillStyle='#c1af83';g.font='34px Huiwen,serif';
    g.fillText(mark.mode==='reference'?'形态参考':'同一纹样',bx+bw/2,by-28,bw+35);
    if(mark.mode==='schematic'){g.font='28px Huiwen,serif';g.fillStyle='#918364';g.fillText('叠印示意',bx+bw/2,by+bh+45,bw+35);}
    canvas.dataset.comparisonMode=mark.mode;
    return {mode:mark.mode,sourceSize:[iw,ih],outputSize:[canvas.width,canvas.height]};
  }
  global.MotifComparison={render};
})(typeof window==='undefined'?globalThis:window);
