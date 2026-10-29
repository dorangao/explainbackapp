import {motionAt,motionSummary,physicsAt,physicsSummary} from './motion.mjs';
const NS='http://www.w3.org/2000/svg';
const node=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
export function drawMotionGraph(container,graph,language,time=0,metric='velocity'){
 const zh=language==='zh',labels=zh?{velocity:'速度 (m/s)',acceleration:'加速度 (m/s²)',distance:'路程 (m)',force:'所需力 (kN)',powerKw:'轮端功率 (kW)',jerk:'加加速度 (m/s³)'}:{velocity:'Velocity (m/s)',acceleration:'Acceleration (m/s²)',distance:'Distance (m)',force:'Required force (kN)',powerKw:'Wheel power (kW)',jerk:'Jerk (m/s³)'};
 if(!Object.hasOwn(labels,metric))throw new Error('Unknown motion view.');
 const svg=node('svg',{viewBox:'0 0 640 480',role:'img','aria-label':graph?`${labels[metric]}; ${zh?'假想模型 A 与 B 随时间的变化':'Hypothetical profiles A and B over time'}`:(zh?'先预测，核验后再显示曲线。':'Predict first; curves appear after the check.')});
 if(!graph){svg.append(node('text',{x:320,y:210,'text-anchor':'middle',fill:'#68776c','font-size':19},zh?'先预测，再查看运动。':'Predict before exploring the motion.'));container.replaceChildren(svg);return;}
 const s=graph.scenario,t=Math.max(0,Math.min(s.T,time)),summary=motionSummary(s);
 const left=66,right=612,top=42,bottom=295;
 const pa=physicsSummary(s,'uniform'),pb=physicsSummary(s,s.profileB);
 const limit=metric==='force'?pa.tractionForce/1000:metric==='powerKw'?s.powerKw:null;
 const max=metric==='velocity'?s.V:metric==='acceleration'?2*s.V/s.T:metric==='distance'?Math.max(summary.distanceA,summary.distanceB):metric==='force'?Math.max(pa.peakForce/1000,pb.peakForce/1000,limit):metric==='powerKw'?Math.max(pa.peakPowerKw,pb.peakPowerKw,limit):Math.max(pa.peakJerk,pb.peakJerk);
 const min=metric==='jerk'&&s.profileB!=='rising'?-max:0;
 const px=x=>left+x/s.T*(right-left),py=y=>bottom-(y-min*1.08)/((max-min)*1.08)*(bottom-top);
 const value=(profile,x)=>physicsAt(s,profile,x)[metric]/(metric==='force'?1000:1);
 svg.append(node('text',{x:left,y:22,fill:'#20332f','font-size':15},labels[metric]));
 for(let i=0;i<=4;i++){
  const x=s.T*i/4,y=min+(max-min)*i/4;
  svg.append(node('line',{x1:px(x),y1:top,x2:px(x),y2:bottom,stroke:'#dce1d5'}),node('text',{x:px(x),y:bottom+22,'text-anchor':'middle',fill:'#68776c','font-size':12},Number(x.toFixed(2))),node('line',{x1:left,y1:py(y),x2:right,y2:py(y),stroke:'#dce1d5'}),node('text',{x:left-8,y:py(y)+4,'text-anchor':'end',fill:'#68776c','font-size':12},Number(y.toFixed(2))));
 }
 svg.append(node('text',{x:right,y:bottom+43,'text-anchor':'end',fill:'#68776c','font-size':13},zh?'时间 t (s)':'Time t (s)'));
 if(limit!==null){
  svg.append(node('line',{x1:left,y1:py(limit),x2:right,y2:py(limit),stroke:'#8c352b','stroke-dasharray':'2 4'}),node('text',{x:right-4,y:py(limit)-7,'text-anchor':'end',fill:'#8c352b','font-size':11},zh?'所选理想上限':'Selected ideal limit'));
 }
 for(const [profile,color,dash]of [['uniform','#116d60',''],[s.profileB,'#a35c32','7 5']]){
  const path=Array.from({length:101},(_,i)=>{const x=s.T*i/100;return `${i?'L':'M'}${px(x).toFixed(3)},${py(value(profile,x)).toFixed(3)}`;}).join(' ');
  svg.append(node('path',{d:path,fill:'none',stroke:color,'stroke-width':3,'stroke-dasharray':dash}),node('circle',{cx:px(t),cy:py(value(profile,t)),r:5,fill:color}));
 }
 svg.append(node('line',{x1:px(t),y1:top,x2:px(t),y2:bottom,stroke:'#68776c','stroke-dasharray':'3 5'}));
 svg.append(node('text',{x:left,y:370,fill:'#68776c','font-size':13},zh?'从起点出发的位置（由速度积分计算）':'Position from the start (integrated velocity)'));
 const scale=(right-left-36)/Math.max(summary.distanceA,summary.distanceB);
 for(const [label,profile,color,y]of [['A','uniform','#116d60',405],['B',s.profileB,'#a35c32',452]]){
  const x=left+motionAt(s,profile,t).distance*scale;
  svg.append(node('line',{x1:left,y1:y+8,x2:right,y2:y+8,stroke:'#c4cec2'}),node('text',{x:28,y:y+7,fill:color,'font-size':16},label),node('rect',{x,y:y-10,width:28,height:14,rx:3,fill:color}),node('circle',{cx:x+6,cy:y+6,r:4,fill:'#20332f'}),node('circle',{cx:x+23,cy:y+6,r:4,fill:'#20332f'}));
 }
 container.replaceChildren(svg);
}
