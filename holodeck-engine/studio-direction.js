// Face positions inspected against the 30 approved stills; normalized image coordinates.
// Scene 14 reverses the men's seats. These anchors are not face recognition.
const faceRows = [
 [.21,.28,.49,.32,.79,.30],[.23,.28,.48,.31,.78,.28],[.25,.38,.49,.39,.77,.38],
 [.20,.30,.49,.31,.78,.28],[.22,.32,.49,.34,.81,.31],[.22,.29,.48,.32,.77,.31],
 [.21,.30,.50,.30,.77,.27],[.22,.27,.51,.29,.77,.28],[.23,.30,.48,.32,.77,.32],
 [.25,.34,.48,.35,.78,.32],[.23,.32,.50,.33,.77,.33],[.23,.28,.51,.30,.79,.28],
 [.22,.29,.48,.29,.80,.29],[.79,.27,.48,.31,.24,.27],[.23,.34,.48,.35,.78,.32],
 [.21,.29,.47,.32,.78,.29],[.22,.30,.52,.33,.80,.32],[.23,.29,.51,.31,.79,.30],
 [.20,.32,.49,.33,.75,.29],[.22,.28,.49,.31,.78,.26],[.22,.32,.48,.34,.76,.31],
 [.25,.32,.48,.35,.74,.30],[.23,.29,.53,.33,.78,.29],[.21,.31,.50,.33,.79,.30],
 [.22,.29,.49,.31,.76,.29],[.22,.27,.50,.28,.80,.27],[.22,.35,.47,.35,.76,.34],
 [.19,.27,.46,.32,.79,.28],[.22,.34,.51,.36,.80,.34],[.22,.30,.50,.30,.80,.32]
];
export function anchorsFor(asset) {
 const index=Number(asset?.replace('scene-',''))-1, r=faceRows[index];
 return r?{bene:[r[0],r[1]],madeleine:[r[2],r[3]],john:[r[4],r[5]]}:{};
}
export function directionFor(scene) {
 const mood=scene?.mood||'ruhe';
 return {
  ruhe:{from:'scale(1)',to:'scale(1.018)',origin:'50% 36%',duration:38},
  business:{from:'scale(1.005)',to:'scale(1.045)',origin:'53% 38%',duration:25},
  feier:{from:'scale(1.028) translateX(-.6%)',to:'scale(1.028) translateX(.6%)',origin:'50% 40%',duration:22},
  flirt:{from:'scale(1.018)',to:'scale(1.05)',origin:'49% 34%',duration:32},
  konflikt:{from:'scale(1.04) translateX(.5%)',to:'scale(1.04) translateX(-.5%)',origin:'50% 35%',duration:29},
  erkenntnis:{from:'scale(1.04)',to:'scale(1.005)',origin:'50% 36%',duration:30}
 }[mood] || directionFor({mood:'ruhe'});
}
export function safeMediaURL(base, value) {
 if(typeof value!=='string'||!value||/[\\?#]/.test(value)||value.split('/').includes('..'))return null;
 try {const url=new URL(value,base), root=new URL(base);return url.origin===root.origin&&url.pathname.startsWith(root.pathname)?url.href:null;}catch{return null;}
}
