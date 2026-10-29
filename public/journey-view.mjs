import {mountRollVehicle,thrusterCaption} from './roll-view.mjs';
import {poweredJourneyAt as journeyAt} from './powered-journey.mjs';
const NS='http://www.w3.org/2000/svg';
const svg=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
const fmt=n=>Number(n.toFixed(3));
const groups=[
 [['vx','Horizontal speed (m/s)','水平速度 (m/s)',1],['driveForce','Drive force (kN)','驱动力 (kN)',1000]],
 [['torque','Roll torque (kN·m)','横滚力矩 (kN·m)',1000],['angle','Roll angle (rad)','横滚角度 (rad)',1],['omega','Roll rate (rad/s)','横滚角速度 (rad/s)',1]],
 [['thrust','Upward thrust (kN)','向上推力 (kN)',1000],['contactForce','Ground support (kN)','地面支持力 (kN)',1000],['weight','Weight (kN)','重力 (kN)',1000],['ay','Net vertical acceleration (m/s²)','净竖直加速度 (m/s²)',1],['y','Vertical displacement (m)','竖直位移 (m)',1],['vy','Vertical speed (m/s)','竖直速度 (m/s)',1]],
];
export function mountJourney(root){
 root.innerHTML='<div class="section-heading"><h2 id="journey-title"></h2><span class="small-label" id="journey-tag"></span></div><p id="journey-context" class="fine"></p><div class="journey-phases"></div><div class="journey-layout"><div class="journey-player"><div id="journey-scene"></div><p id="journey-scene-note" class="fine"></p><p id="journey-boundary" class="journey-boundary"></p><p id="journey-thrusters" class="fine"></p><div class="journey-buttons"><button type="button" id="journey-play" class="example" aria-pressed="false"></button><button type="button" id="journey-restart" class="example"></button><label><span id="journey-speed-label"></span><select id="journey-speed"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25" selected>0.25×</option><option value="0.1">0.1×</option></select></label></div><label class="scrubber"><span id="journey-time-label"></span><input id="journey-time" type="range" min="0" step="0.0001" value="0"><output id="journey-readout"></output></label></div><div class="journey-plots"></div></div><p id="journey-limits" class="fine"></p>';
 const q=id=>root.querySelector('#'+id),play=q('journey-play'),time=q('journey-time');
 const modelDetails=document.createElement('details'),modelSummary=document.createElement('summary');modelDetails.className='journey-model-details';modelDetails.append(modelSummary,q('journey-context'),q('journey-limits'));root.append(modelDetails);
 let scenario=null,key='',zh=false,t=0,frame=null,last=0,blocked=false,locked=false,preview=false,rangeEnd=null,leftBoundary=false,car,cursors=[],phaseButtons=[],sceneWidth=900,plotWidth=900,observedWidth=0,playResolve=null,guided=false;
 const selectors=groups.map((options,i)=>{
  const wrap=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select'),plot=document.createElement('div');
  const output=document.createElement('output');output.className='journey-metric-value';select.id=`journey-metric-${i}`;label.append(select,output);wrap.append(label,plot);root.querySelector('.journey-plots').append(wrap);
  options.forEach(o=>select.add(new Option(o[1],o[0])));select.addEventListener('change',()=>{buildPlots();update();});return {select,plot,output};
 });
 const stop=(completed=false)=>{const resolve=playResolve;playResolve=null;guided=false;if(frame!==null)cancelAnimationFrame(frame);frame=null;last=0;play.setAttribute('aria-pressed','false');play.textContent=zh?'播放全程':'Play journey';for(const c of [play,time,q('journey-restart'),q('journey-speed'),...phaseButtons])c.disabled=blocked||locked||preview;resolve?.(completed);};
 function buildScene(){
  sceneWidth=Math.max(280,q('journey-scene').clientWidth||root.clientWidth||300);
  const drawing=svg('svg',{viewBox:`0 0 ${sceneWidth} 205`,role:'img','aria-label':zh?'地面加速、动力起飞、侧向横滚与动力着陆的连续示意图':'Continuous schematic of ground acceleration, powered lift, sideways roll and powered landing'});
  drawing.append(svg('rect',{x:20,y:150,width:sceneWidth-40,height:55,fill:'#e9e1d1'}),svg('line',{x1:20,y1:150,x2:sceneWidth-20,y2:150,stroke:'#9baaa1','stroke-dasharray':'6 5'}));
  car=mountRollVehicle(drawing);q('journey-scene').replaceChildren(drawing);
 }
 function buildPlots(){
  cursors=[];if(!scenario)return;
  plotWidth=Math.max(280,selectors.find(({plot})=>plot.clientWidth>0)?.plot.clientWidth||root.clientWidth||300);
  const s=scenario,px=t=>62+t/s.end*(plotWidth-82);
  selectors.forEach(({select,plot},i)=>{
   const metric=groups[i].find(o=>o[0]===select.value),[name,,,scale]=metric;
   const intervals=[[0,s.launch,'#176f64'],[s.launch,s.rollStart,'#367f9b'],[s.rollStart,s.landing,'#a45c31'],[s.landing,s.touchdown,'#367f9b'],[s.touchdown,s.end,'#176f64']];
   const series=intervals.map(([a,b,color],phase)=>({color,points:Array.from({length:101},(_,j)=>{
    const x=a+(b-a)*j/100;
    // One-sided samples keep ideal thrust switches out of line interpolation.
    const sample=j===100&&phase<4?Math.max(a,x-1e-10):x;
    const p=journeyAt(s,sample);return [x,p[name]===null?null:p[name]/scale];
   })}));
   const values=series.flatMap(l=>l.points.filter(p=>p[1]!==null).map(p=>p[1])),lo=Math.min(0,...values),hi=Math.max(1e-5,...values),span=hi-lo;
   const py=v=>127-(v-lo)/span*92;
   const g=svg('svg',{viewBox:`0 0 ${plotWidth} 163`,role:'img','aria-label':metric[zh?2:1]});
   intervals.forEach(([a,b,color])=>g.append(svg('rect',{x:px(a),y:25,width:px(b)-px(a),height:105,fill:color,opacity:.07})));
   for(let j=0;j<=2;j++){const v=lo+span*j/2;g.append(svg('line',{x1:62,x2:plotWidth-20,y1:py(v),y2:py(v),stroke:'#d5ddd5'}),svg('text',{x:55,y:py(v)+4,'text-anchor':'end',fill:'#5d6c67','font-size':12},fmt(v)));}
   for(const line of series){let path='',drawing=false;for(const[x,v]of line.points){if(v===null){drawing=false;continue;}path+=`${drawing?'L':'M'}${px(x)},${py(v)} `;drawing=true;}g.append(svg('path',{d:path,fill:'none',stroke:line.color,'stroke-width':2}));}
   for(const x of [0,s.launch,s.rollStart,s.landing,s.touchdown,s.end])g.append(svg('line',{x1:px(x),x2:px(x),y1:25,y2:130,stroke:'#8e9e94','stroke-dasharray':'3 4'}));
   // End label on its own row prevents short contact intervals overlapping.
   for(const x of [0,s.launch,s.landing])g.append(svg('text',{x:px(x),y:147,'text-anchor':'middle',fill:'#5d6c67','font-size':12},`${fmt(x)} s`));
   g.append(svg('text',{x:plotWidth-20,y:161,'text-anchor':'end',fill:'#5d6c67','font-size':12},`${zh?'结束':'End'} ${fmt(s.end)} s`));
   const cursor=svg('line',{y1:22,y2:132,stroke:'#233f34','stroke-width':2});g.append(cursor);cursors.push(cursor);plot.replaceChildren(g);
  });
 }
 function update(){
  if(!scenario)return;const s=scenario,p=journeyAt(s,leftBoundary?Math.max(0,t-1e-10):t),end=journeyAt(s,s.end);
  time.value=t;const apex=9.80665*s.burn**2;
  const x=45+p.x/end.x*(sceneWidth-90),y=131-p.y/apex*80;
  const jets=p.jets;
  car.set({x,y,angle:p.angle,jets,time:t,scale:.8});
  q('journey-thrusters').hidden=false;
  q('journey-thrusters').textContent=(p.phase==='lift'||p.phase==='landing')
   ?(zh?`向下排气 → 向上反作用力：总推力 ${fmt(p.thrust/1000)} kN，重力 ${fmt(p.weight/1000)} kN。每个喷口 ${fmt(jets.forceEach/1000)} kN。`:`Downward exhaust → upward reaction: total thrust ${fmt(p.thrust/1000)} kN, weight ${fmt(p.weight/1000)} kN. Each nozzle ${fmt(jets.forceEach/1000)} kN.`)
   :p.phase==='roll'?thrusterCaption(jets,zh?'zh':'en')+(zh?'。两股喷流合力为零，力矩改变横滚；重力改变竖直速度。':'. Opposed jets change roll with zero net force; gravity changes vertical speed.')
   :(zh?'喷流关闭；地面支持力平衡重力。':'Jets off; ground support balances weight.');
  selectors.forEach(({select,output},i)=>{const metric=groups[i].find(m=>m[0]===select.value),value=p[metric[0]];output.textContent=value===null?'—':String(fmt(value/metric[3]));});
  cursors.forEach(c=>{const x=62+t/s.end*(plotWidth-82);c.setAttribute('x1',x);c.setAttribute('x2',x);});
  const phases=['acceleration','lift','roll','landing','ground'],index=phases.indexOf(p.phase);
  phaseButtons.forEach((b,i)=>b.setAttribute('aria-current',i===index?'step':'false'));
  const labels=zh?[
   '地面加速：轮胎驱动力提高水平速度；支持力平衡重力。',
   '动力起飞：向上推力 2mg，减去重力 mg，净加速度为 g。竖直速度从零连续增加。',
   '空中横滚：水平漂移来自惯性，无水平推力或阻力。相反喷流只产生横滚力矩；质心按抛体运动。',
   '着陆点火：车身已回正。向上推力 2mg 制动下降，把竖直速度降至零后接地。',
   '回到地面：理想精确时序使接地竖直速度为零；支持力接替推力。水平速度仍保持，未模拟水平刹车。'
  ]:[
   'Ground acceleration: tire force increases forward speed; support balances weight.',
   'Powered lift: upward thrust 2mg minus weight mg gives net acceleration g. Vertical speed rises continuously from zero.',
   'Airborne roll: forward drift is inertia, with no horizontal thrust or drag. Opposed jets supply roll torque; the center of mass follows a ballistic arc.',
   'Landing burn: the car is upright again. Upward thrust 2mg brakes descent to zero vertical speed before touchdown.',
   'On the ground: exact ideal timing gives zero vertical impact speed; support replaces thrust. Forward speed continues; horizontal braking is not modeled.'
  ];
  q('journey-boundary').textContent=labels[index];
  q('journey-readout').textContent=`t=${fmt(t)} s · x=${fmt(p.x)} m · y=${fmt(p.y)} m · vx=${fmt(p.vx)} m/s · vy=${fmt(p.vy)} m/s`;

 }
 function startPlayback(end=scenario?.end){
  rangeEnd=end;
  if(!scenario||blocked||root.hidden)return false;if(t>=scenario.end)t=0;
  play.textContent=zh?'暂停':'Pause';play.setAttribute('aria-pressed','true');
  const tick=now=>{if(root.hidden||blocked){stop();return;}if(!last)last=now;t=Math.min(rangeEnd,t+(now-last)/1000*Number(q('journey-speed').value));last=now;leftBoundary=guided&&t===rangeEnd&&rangeEnd<scenario.end;update();if(t>=rangeEnd){stop(true);return;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return true;
 }
 play.addEventListener('click',()=>{if(guided||locked||preview)return;leftBoundary=false;if(frame!==null){stop();return;}startPlayback();});
 function playRange({signal,from=0,to=scenario?.end,rate=.5}){
  stop();if(signal.aborted||!scenario||blocked||preview||root.hidden)return Promise.resolve(false);
  if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to>scenario.end||from>=to||![1,.5,.25,.1].includes(rate))return Promise.resolve(false);
  t=from;leftBoundary=false;time.value=t;q('journey-speed').value=String(rate);update();guided=true;
  for(const c of [play,time,q('journey-restart'),q('journey-speed'),...phaseButtons])c.disabled=true;
  return new Promise(resolve=>{const cancel=()=>stop();signal.addEventListener('abort',cancel,{once:true});playResolve=completed=>{signal.removeEventListener('abort',cancel);resolve(completed);};if(!startPlayback(to))stop();});
 }
 const playThrough=({signal})=>playRange({signal});
 q('journey-restart').addEventListener('click',()=>{stop();leftBoundary=false;t=0;update();});
 time.addEventListener('input',()=>{stop();leftBoundary=false;t=Number(time.value);update();});
 const onVisibility=()=>{if(document.hidden)stop();};
 document.addEventListener('visibilitychange',onVisibility);
 const observer=new ResizeObserver(()=>{const width=root.clientWidth;if(width&&width!==observedWidth&&scenario&&!root.hidden){observedWidth=width;buildScene();buildPlots();update();}});observer.observe(root);
 return {stop,destroy(){stop();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);},playThrough,playRange,set({scenario:next,visible,language,busy=false,locked:lock=false,preview:initial=false}){
  zh=language==='zh';modelSummary.textContent=zh?'参数与模型边界':'Inputs & model boundaries';blocked=busy;locked=lock;preview=initial;root.dataset.preview=String(preview);root.hidden=!visible;if(!visible||busy)stop();
  // A parent workspace can be revealed after set() returns. ResizeObserver may
  // not emit if its final size equals the previous session's size.
  if(visible)requestAnimationFrame(()=>{if(scenario&&!root.hidden&&root.clientWidth&&selectors.find(({plot})=>plot.clientWidth>0)?.plot.clientWidth!==plotWidth){observedWidth=root.clientWidth;buildScene();buildPlots();update();}});
  for(const c of [play,time,q('journey-restart'),q('journey-speed'),...phaseButtons])c.disabled=busy||locked||preview;
  if(!next){stop();scenario=null;key='';t=0;leftBoundary=false;time.value=0;observedWidth=0;return;}const nextKey=JSON.stringify(next),changed=key!==nextKey,languageChanged=root.dataset.language!==language;root.dataset.language=language;
  if(changed||languageChanged){stop();key=nextKey;scenario=next;if(changed){t=0;leftBoundary=false;}time.max=next.end;observedWidth=0;
   q('journey-title').textContent=zh?'从加速到着陆，一条时间线。':'One timeline, from acceleration to landing.';
   q('journey-scene-note').textContent=zh?'蓝色：排气；橙色：反作用力。绕车身前后轴侧向横滚。位置与车身为示意投影，不按比例。':'Blue: exhaust. Orange: reaction force. Sideways roll about the front-to-back axis. Position and vehicle are schematic, not to scale.';
   q('journey-tag').textContent=zh?'动力起飞与着陆':'POWERED TAKEOFF & LANDING';
   q('journey-context').textContent=zh?`m=${next.motion.massKg} kg，目标 ${next.motion.speedLabel}；地面加速 ${next.launch} s；起飞点火 ${next.burn} s、自由飞行横滚 ${next.flight.airtime} s、着陆点火 ${next.burn} s；接地后滑行 0.5 s。各图共用时间轴。`:`m=${next.motion.massKg} kg, target ${next.motion.speedLabel}; ${next.launch} s ground acceleration; ${next.burn} s lift burn, ${next.flight.airtime} s free-flight roll, ${next.burn} s landing burn; 0.5 s ground coast. Graphs share time.`;
   q('journey-restart').textContent=zh?'回到起点':'Restart';q('journey-speed-label').textContent=zh?'播放速度':'Playback speed';q('journey-time-label').textContent=zh?'全程时间（点击阶段可跳转）':'Journey time (select a phase to jump)';
   q('journey-limits').textContent=zh?'模型边界：地面规定加速 → 直立恒推力起飞 → 无合力喷流的抛体横滚 → 直立恒推力着陆。升降推力与横滚力偶分开控制，质量和惯量恒定，无空气阻力。精确点火时序与瞬时推力切换是理想假设，不代表舒适或可行。未模拟燃料、执行器能力、车身离地间隙、悬架或乘员载荷。下方原有着陆实验仍是独立的“接触制停”基线，不是这段动力着陆；它的制停时间与脉冲设置不控制此动画。此处仅横滚力矩与基线相同。':'Model boundaries: prescribed ground acceleration → upright constant-thrust lift → ballistic roll with zero-net-force jets → upright constant-thrust landing. Lift/landing thrust and roll couples are separate controls; mass/inertia are fixed, with no drag. Exact burn timing and instantaneous thrust switches are ideal assumptions, not evidence of comfort or feasibility. Fuel, actuator capability, body clearance, suspension and occupant loads are unmodeled. The original landing experiment remains a separate contact-stopping baseline, not this powered landing; its stopping time/pulse settings do not control this animation. Only roll torque is shared with that baseline.';
   const phaseNames=zh?['1 · 地面加速','2 · 点火起飞','3 · 空中横滚','4 · 点火着陆','5 · 接地滑行']:['1 · Ground acceleration','2 · Lift burn','3 · Airborne roll','4 · Landing burn','5 · Ground coast'];phaseButtons=phaseNames.map((label,i)=>{const b=document.createElement('button');b.type='button';b.className='example';b.textContent=label;b.disabled=busy||locked||preview;b.addEventListener('click',()=>{stop();leftBoundary=false;t=[0,next.launch,next.rollStart,next.landing,next.touchdown][i];update();});return b;});root.querySelector('.journey-phases').replaceChildren(...phaseButtons);
   selectors.forEach(({select},i)=>{select.setAttribute('aria-label',zh?`同步图 ${i+1}`:`Synchronized graph ${i+1}`);for(const o of select.options)o.textContent=groups[i].find(m=>m[0]===o.value)[zh?2:1];});
   buildScene();buildPlots();update();
  }
 }};
}
