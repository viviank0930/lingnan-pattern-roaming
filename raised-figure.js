/* The original dancer, with its raised arm mirrored to the opposite side. */
(() => {
  'use strict';

  const sourceNumber = 2011;
  const source = 'assets/artifacts/taogu-raised-arms.webp';
  const silhouette = 'M219 406 C253 376 245 311 258 270 C281 212 492 214 608 235 C684 248 756 257 764 277 C781 302 766 370 779 400 Q797 421 770 445 C740 520 720 632 711 733 C693 826 703 932 720 1025 C729 1121 780 1215 767 1285 C733 1342 646 1364 522 1369 C389 1378 262 1346 207 1301 C185 1282 194 1240 211 1194 C236 1105 258 1032 268 942 C281 842 288 734 279 651 C276 557 249 483 234 449 Q213 421 219 406 Z';
  // Register the resting drawing over the supplied photograph.
  const [originX, originY, scaleX, scaleY] = [169, 454, 6.35, 7.6];
  const inset = 16 / 2.72, extent = 320 / 2.72;
  const renderBounds = [originX-inset*scaleX, originY-inset*scaleY, extent*scaleX, extent*scaleY];
  const base = window.FigureDance;
  const render = (seconds, texture, color) => base.render(seconds, texture, color, true);
  const pattern = {
    sourceNumber,
    name: '人形舞蹈纹（双手上举）',
    period: '新石器时代晚期',
    isNew: true,
    artifact: { src: source, alt: '用户提供的双手上举人形舞蹈纹陶鼓形器照片', shape: 'portrait', comparison: true, silhouette },
    sourceMark: { source, sourceSize: [1000, 1498], kind: 'figure-lines', anchor: [51, 46] },
  };
  window.RaisedFigureDance = { sourceNumber, renderBounds, duration: base.duration, render, pattern };
})();
