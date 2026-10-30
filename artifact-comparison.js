/* Source photos stay intact. Gold centerlines are interpretive guides, not archaeological reconstructions. */
(function (global) {
  'use strict';
  const cache=new Map();
  function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function geometry(pattern){
    const annotation=pattern.artifact.comparison.annotation;
    if(!annotation?.paths?.length)throw Error('Missing source centerlines');
    const key=pattern.ink+'|'+annotation.paths.join(' '),old=cache.get(pattern.sourceNumber);
    if(old?.key===key)return old;
    const result={key,ink:new Path2D(pattern.ink),line:new Path2D(annotation.paths.join(' '))};cache.set(pattern.sourceNumber,result);return result;
  }
  function impression(pattern,shape,w,h,texture){
    const c=makeCanvas(w*2,h*2),g=c.getContext('2d'),b=pattern.artifact.comparison.inkBounds;
    const pad=8,scale=Math.min((c.width-pad*2)/(b[2]-b[0]),(c.height-pad*2)/(b[3]-b[1]));
    const paint=()=>{g.save();g.translate((c.width-(b[2]-b[0])*scale)/2-b[0]*scale,(c.height-(b[3]-b[1])*scale)/2-b[1]*scale);g.scale(scale,scale);g.fillStyle='#c5ae72';g.fill(shape);g.restore();};
    paint();
    if(texture){
      g.globalCompositeOperation='destination-in';g.drawImage(texture,0,0,texture.naturalWidth||texture.width,texture.naturalHeight||texture.height,0,0,c.width,c.height);
      g.globalCompositeOperation='destination-over';g.globalAlpha=.18;paint();g.globalAlpha=1;g.globalCompositeOperation='source-over';
    }
    return c;
  }
  function render(canvas,pattern,image,texture){
    const mark=pattern.artifact.comparison,annotation=mark?.annotation;if(!annotation)throw Error('Missing comparison lines');
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!iw||!ih)throw Error('Source image is not loaded');
    const portrait=iw/ih<.85;canvas.width=portrait?1000:1200;canvas.height=portrait?1100:800;
    const g=canvas.getContext('2d'),areaW=portrait?710:850,areaH=canvas.height-60,s=Math.min(areaW/iw,areaH/ih),ix=20+(areaW-iw*s)/2,iy=30+(areaH-ih*s)/2;
    const bx=portrait?750:900,by=portrait?290:230,bw=220,bh=240,color='#ffe08b';
    const shape=geometry(pattern),sx=iw*s/100,sy=ih*s/100,weight=(annotation.strokeWidth||3.1)/Math.sqrt(sx*sy);
    g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(image,ix,iy,iw*s,ih*s);
    g.save();g.translate(ix,iy);g.scale(sx,sy);g.lineCap='round';g.lineJoin='round';
    // A restrained brown edge keeps one clear gold line visible on pale clay.
    g.strokeStyle='#573d20';g.globalAlpha=.55;g.lineWidth=weight*1.75;g.stroke(shape.line);
    g.strokeStyle=color;g.shadowColor='#e7ad38';g.shadowBlur=6;g.globalAlpha=.35;g.lineWidth=weight;g.stroke(shape.line);
    g.shadowBlur=0;g.globalAlpha=.97;g.lineWidth=weight;g.stroke(shape.line);g.restore();
    const [ax,ay]=annotation.anchor,start=[ix+ax*sx,iy+ay*sy],end=[bx-24,by-105];
    g.save();g.strokeStyle=color;g.lineWidth=1.6;g.globalAlpha=.8;g.beginPath();g.moveTo(...start);g.lineTo(...end);g.stroke();
    g.globalAlpha=1;g.fillStyle=color;g.shadowColor='#e7ad38';g.shadowBlur=5;g.beginPath();g.arc(...start,4,0,Math.PI*2);g.fill();g.shadowBlur=0;
    g.textAlign='left';g.fillStyle='#e6d39f';g.font='27px Huiwen,serif';g.fillText('纹饰位置',end[0]+10,end[1]-15,bw+20);g.restore();
    g.drawImage(impression(pattern,shape.ink,bw,bh,texture),bx,by,bw,bh);
    g.textAlign='center';g.fillStyle='#c1af83';g.font='34px Huiwen,serif';g.fillText('纹样提炼',bx+bw/2,by-28,bw+35);
    if(mark.sourceLabel){g.font='24px Huiwen,serif';g.fillStyle='#918364';g.fillText(mark.sourceLabel,bx+bw/2,by+bh+45,bw+35);}
    canvas.dataset.comparisonMode='schematic';
    return {mode:'schematic',sourceSize:[iw,ih],outputSize:[canvas.width,canvas.height],sourceLines:annotation.paths.length,leader:{start,end},texturedReference:!!texture};
  }
  global.MotifComparison={render};
})(typeof window==='undefined'?globalThis:window);
