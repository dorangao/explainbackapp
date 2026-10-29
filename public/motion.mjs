// Prescribed 1D motion and ideal necessary force limits, not measured vehicle behavior.
export const gravity=9.80665;
export const motionTitle={en:'Acceleration & force lab',zh:'加速度与力实验室'};
export const motionAssumptions={
 en:'Hypothetical 1D motion from rest, only for 0 ≤ t ≤ T; no measured vehicle data or manufacturer performance specification. Constant total mass, level road, g=9.80665 m/s², all tire normal load available for propulsion: F=ma, N=mg, grip ceiling μmg, wheel P=Fv. No drag, rolling resistance, downforce, thrust, load transfer, motor torque curve, thermal limits, suspension, rotation or landing. Passing these two ideal limits does not establish real feasibility, safety or comfort. Endpoint derivatives are one-sided; start/cruise joins are assessed separately.',
 zh:'假想的一维运动，从静止开始，仅定义于 0 ≤ t ≤ T；并非车辆实测数据或厂商性能规格。总质量恒定、水平路面、g=9.80665 m/s²，所有轮胎的法向载荷均可用于驱动：F=ma、N=mg、抓地上限 μmg、轮端功率 P=Fv。不计空气阻力、滚动阻力、下压力、推力、载荷转移、电机扭矩曲线、热限制、悬架、旋转或着陆。通过这两个理想上限不代表真实可行、安全或舒适。端点导数为单侧值；起步和匀速衔接另行检查。',
};
const scenarios=new Map();
const defaults={massKg:2000,grip:1,powerKw:600};
const scenarioId=(speed,duration,profile,mass,grip,power)=>`motion-${speed}-${duration}-${profile}`+(mass===2000&&grip===1&&power===600?'':`-m${mass}-g${grip}-p${power}`);
for(const speedMph of [30,60,90])for(const duration of [1,2,3,5,8])for(const profileB of ['rising','falling','smooth'])
for(const massKg of [1200,2000,2800])for(const grip of [.6,1,1.5])for(const powerKw of [300,600,1200]){
 const id=scenarioId(speedMph,duration,profileB,massKg,grip,powerKw);
 scenarios.set(id,{id,V:speedMph*.44704,T:duration,profileB,massKg,grip,powerKw,speedLabel:`${speedMph} mph`,context:{en:'Hypothetical sports cars',zh:'假想跑车'}});
}
scenarios.set('motion-transfer-default',{id:'motion-transfer-default',V:10,T:5,profileB:'falling',massKg:100,grip:1,powerKw:5,speedLabel:'36 km/h',context:{en:'Two hypothetical e-bikes with riders',zh:'两辆含骑手的假想电动自行车'}});
scenarios.set('motion-transfer-alternate',{id:'motion-transfer-alternate',V:20,T:4,profileB:'rising',massKg:500,grip:1,powerKw:100,speedLabel:'72 km/h',context:{en:'Two hypothetical test carts',zh:'两辆假想测试车'}});
scenarios.set('motion-transfer-dynamics-default',{id:'motion-transfer-dynamics-default',V:20,T:5,profileB:'smooth',massKg:1500,grip:1,powerKw:300,speedLabel:'72 km/h',context:{en:'Two hypothetical everyday cars',zh:'两辆假想日常用车'}});
scenarios.set('motion-transfer-dynamics-alternate',{id:'motion-transfer-dynamics-alternate',V:10,T:4,profileB:'smooth',massKg:1200,grip:.6,powerKw:150,speedLabel:'36 km/h',context:{en:'Two hypothetical compact cars',zh:'两辆假想小型车'}});
export function motionFormula(id){
 if(!scenarios.has(id))throw new Error('Unknown motion scenario.');
 return structuredClone(scenarios.get(id));
}
export function motionScenario(config={},transferId=null){
 if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['speedMph','duration','profileB','massKg','grip','powerKw'].includes(k)))throw new Error('Invalid motion settings.');
 const {speedMph=60,duration=1,profileB='rising',massKg=defaults.massKg,grip=defaults.grip,powerKw=defaults.powerKw}=config;
 if(![30,60,90].includes(speedMph)||![1,2,3,5,8].includes(duration)||!['rising','falling','smooth'].includes(profileB)||![1200,2000,2800].includes(massKg)||![.6,1,1.5].includes(grip)||![300,600,1200].includes(powerKw))throw new Error('Unsupported motion settings.');
 if(transferId!==null&&!['default','alternate','dynamics-default','dynamics-alternate'].includes(transferId))throw new Error('Unknown transfer.');
 return motionFormula(transferId?`motion-transfer-${transferId}`:scenarioId(speedMph,duration,profileB,massKg,grip,powerKw));
}
export function motionAt(s,profile,t){
 // Do not permit arbitrary user-supplied formula parameters.
 const canonical=motionFormula(s?.id);
 if(['V','T','profileB','massKg','grip','powerKw'].some(k=>canonical[k]!==s[k]))throw new Error('Changed motion scenario.');
 if(!Number.isFinite(t)||t<0||t>s.T||!['uniform','rising','falling','smooth'].includes(profile))throw new Error('Outside the motion domain.');
 const u=t/s.T,V=s.V,T=s.T;
 if(profile==='uniform')return {velocity:V*u,acceleration:V/T,distance:V*T*u*u/2,jerk:0};
 if(profile==='rising')return {velocity:V*u*u,acceleration:2*V*u/T,distance:V*T*u*u*u/3,jerk:2*V/T**2};
 if(profile==='falling')return {velocity:V*(2*u-u*u),acceleration:2*V*(1-u)/T,distance:V*T*(u*u-u*u*u/3),jerk:-2*V/T**2};
 const angle=2*Math.PI*u,sin=u===0||u===1?0:Math.sin(angle),cos=Math.cos(angle);
 return {velocity:V*(u-sin/(2*Math.PI)),acceleration:V/T*(1-cos),distance:V*T*(u*u/2+(cos-1)/(4*Math.PI**2)),jerk:2*Math.PI*V/T**2*sin};
}
export function motionSummary(s){
 const a=motionAt(s,'uniform',s.T),b=motionAt(s,s.profileB,s.T);
 return {averageAcceleration:s.V/s.T,distanceA:a.distance,distanceB:b.distance,distanceDifference:b.distance-a.distance,
  quarterTime:s.T/4,quarterAccelerationA:motionAt(s,'uniform',s.T/4).acceleration,quarterAccelerationB:motionAt(s,s.profileB,s.T/4).acceleration};
}
export function motionExpressions(s){
 return {A:'v_A(t) = V(t/T)',B:s.profileB==='rising'?'v_B(t) = V(t/T)²':s.profileB==='falling'?'v_B(t) = V[2(t/T) − (t/T)²]':'v_B(t) = V[t/T − sin(2πt/T)/(2π)]'};
}

export function physicsAt(s,profile,t){
 const p=motionAt(s,profile,t),force=s.massKg*p.acceleration;
 return {...p,force,powerKw:force*p.velocity/1000,accelerationG:p.acceleration/gravity};
}
export function physicsSummary(s,profile){
 motionAt(s,profile,0); // Validate the canonical settings and requested profile.
 let peakPowerTime=s.T;
 if(profile==='falling')peakPowerTime=s.T*(1-1/Math.sqrt(3));
 if(profile==='smooth'){
  // d(av)/dt=a²+vj. The unique interior maximum lies in (T/2,3T/4).
  // On that interval its derivative is 3aj+v*j' < 0; afterwards |j|/a²
  // increases, so there is no later maximum. Endpoints have zero power.
  let low=s.T/2,high=3*s.T/4;
  for(let i=0;i<60;i++){
   const mid=(low+high)/2,p=motionAt(s,profile,mid);
   if(p.acceleration**2+p.velocity*p.jerk>0)low=mid;else high=mid;
  }
  peakPowerTime=(low+high)/2;
 }
 const peakAcceleration=(profile==='uniform'?1:2)*s.V/s.T;
 const peakForce=s.massKg*peakAcceleration,peakPowerKw=physicsAt(s,profile,peakPowerTime).powerKw;
 const weight=s.massKg*gravity,tractionForce=s.grip*weight;
 const tractionOK=peakForce<=tractionForce+1e-8,powerOK=peakPowerKw<=s.powerKw+1e-8;
 return {weight,tractionForce,peakAcceleration,peakAccelerationG:peakAcceleration/gravity,peakForce,peakPowerKw,peakPowerTime,
  peakJerk:(profile==='uniform'?0:profile==='smooth'?2*Math.PI:2)*s.V/s.T**2,
  endpointJumps:profile!=='smooth',gripRequired:peakAcceleration/gravity,tractionOK,powerOK,withinLimits:tractionOK&&powerOK,
  minimumDuration:s.T*Math.max(peakForce/tractionForce,peakPowerKw/s.powerKw)};
}
