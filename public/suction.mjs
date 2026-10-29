// Reduced static teaching model. No measured vehicle data, CFD, fan curve or certification.
export const suctionTitle={en:'Suction & design lab',zh:'吸附与设计实验室'};
export const suctionConstants=Object.freeze({g:9.80665,rho:1.225,Cd:.65,perimeterM:8,efficiency:.6,maxPressurePa:10000});
export const suctionAssumptions={
 en:'Hypothetical sealed cavity and static surfaces. Pressure deficit Δp is below ambient; force ΔpA requires an effective seal. Orientation sweeps are separate static equilibria, not a rotating trajectory. No tipping moments, structural loads, suspension, debris or transient seal behavior. Leakage is a low-pressure incompressible orifice approximation (0–10 kPa); efficiency 0.6 is total electrical-to-air. Power gives an optimistic pressure bound, not an actual fan operating point. No CFD or proof of safety. This surface model does not describe airborne thrust.',
 zh:'假想密封腔与静止表面。Δp 是相对环境的压差；ΔpA 依赖有效密封。角度扫描是一系列独立的静力平衡，不是旋转轨迹。不含倾覆力矩、结构载荷、悬架、杂物或密封瞬态。泄漏采用低压不可压缩孔口近似（0–10 kPa）；0.6 为电能到气流的总效率。功率只给出乐观压差上界，不是实际风机工作点。不是 CFD 或安全证明，也不描述空中推力。',
};
const catalog=new Map();
const idFor=s=>`suction-${s.massKg}-${s.areaM2}-${s.pressurePa}-${s.mu}-${s.gapMm}`;
for(const massKg of [1200,2000,2800])for(const areaM2 of [2,4,6])for(const pressurePa of [3000,6000,9000])for(const mu of [.4,.7,1])for(const gapMm of [2.5,5,10]){
 const s={massKg,areaM2,pressurePa,mu,gapMm};s.id=idFor(s);catalog.set(s.id,s);
}
for(const [variant,settings]of Object.entries({default:{massKg:2,areaM2:.02,pressurePa:2000,mu:.4,gapMm:1},alternate:{massKg:3,areaM2:.03,pressurePa:1500,mu:.5,gapMm:1}}))catalog.set(`suction-transfer-${variant}`,{...settings,id:`suction-transfer-${variant}`});
export function suctionFormula(id){if(!catalog.has(id))throw new Error('Unknown suction scenario.');return structuredClone(catalog.get(id));}
export function suctionScenario(config={},variant=null){
 if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['massKg','areaM2','pressurePa','mu','gapMm'].includes(k))||Object.values(config).some(v=>!Number.isFinite(v)))throw new Error('Invalid suction settings.');
 const s={massKg:2000,areaM2:4,pressurePa:6000,mu:1,gapMm:5,...config};
 if(!catalog.has(idFor(s)))throw new Error('Unsupported suction settings.');
 if(variant!==null&&!['default','alternate'].includes(variant))throw new Error('Unknown robot transfer.');
 return suctionFormula(variant?`suction-transfer-${variant}`:idFor(s));
}
function validate(s){const c=catalog.get(s?.id);if(!c||Object.keys(c).some(k=>c[k]!==s[k]))throw new Error('Changed suction scenario.');}
const range=(n,min,max)=>{if(!Number.isFinite(n)||n<min||n>max)throw new Error('Outside reduced model range.');};
export function orientationAt(s,angleDeg,pressurePa=s.pressurePa){
 validate(s);range(angleDeg,0,180);range(pressurePa,0,suctionConstants.maxPressurePa);
 const weightN=s.massKg*suctionConstants.g,suctionN=pressurePa*s.areaM2,theta=angleDeg*Math.PI/180;
 const normalN=suctionN+weightN*Math.cos(theta),tangentialGravityN=angleDeg===0||angleDeg===180?0:weightN*Math.sin(theta);
 const contactPossible=normalN>=0,frictionCapacityN=contactPossible?s.mu*normalN:0;
 return {angleDeg,weightN,suctionN,normalN,tangentialGravityN,frictionCapacityN,contactPossible,equilibriumPossible:contactPossible&&frictionCapacityN+1e-9>=tangentialGravityN,allAngleForceN:weightN*Math.sqrt(1+1/s.mu**2)};
}
export function leakageAt(s,pressurePa=s.pressurePa,gapMm=s.gapMm,leakageFactor=1){
 validate(s);range(pressurePa,0,suctionConstants.maxPressurePa);range(gapMm,.1,30);range(leakageFactor,.1,1);
 const {Cd,perimeterM,rho,efficiency}=suctionConstants,leakAreaM2=perimeterM*gapMm/1000*leakageFactor;
 const flowM3s=Cd*leakAreaM2*Math.sqrt(2*pressurePa/rho);
 return {pressurePa,gapMm,leakAreaM2,flowM3s,powerKw:pressurePa*flowM3s/efficiency/1000};
}
export function pressureBound(s,powerKw,gapMm=s.gapMm,leakageFactor=1){
 validate(s);range(powerKw,0,100);leakageAt(s,0,gapMm,leakageFactor);
 const {efficiency,Cd,perimeterM,rho}=suctionConstants;
 // May exceed valid pressure range: callers must label out-of-model, never silently clamp a result.
 return (powerKw*1000*efficiency/(Cd*perimeterM*gapMm/1000*leakageFactor)*Math.sqrt(rho/2))**(2/3);
}
export function aeroForce(airSpeedMps,referenceAreaM2=2,coefficient=1){
 range(airSpeedMps,0,100);range(referenceAreaM2,.1,10);range(coefficient,0,5);
 return .5*suctionConstants.rho*airSpeedMps**2*referenceAreaM2*coefficient;
}
export const designCandidateIds=['original','double-power','reduce-leakage','reduce-mass'];
export function designComparison(s){
 validate(s);const budgetKw=30,reserveFraction=.2,worstGapMm=2*s.gapMm;
 const candidates=designCandidateIds.map(id=>{
  const powerKw=id==='double-power'?60:30,leakageFactor=id==='reduce-leakage'?.5:1,massKg=s.massKg*(id==='reduce-mass'?.8:1);
  const pressurePa=pressureBound(s,powerKw,worstGapMm,leakageFactor),withinModel=pressurePa<=suctionConstants.maxPressurePa;
  const worstForceN=pressurePa*s.areaM2,requiredForceN=1.2*massKg*suctionConstants.g,withinBudget=powerKw<=budgetKw;
  return {id,powerKw,leakageFactor,massKg,pressurePa,withinModel,worstForceN,requiredForceN,withinBudget,meetsScreen:withinModel&&withinBudget&&worstForceN>=requiredForceN};
 });
 return {budgetKw,reserveFraction,worstGapMm,candidates,validationStatus:'unvalidated_model_only'};
}
export function robotResult(s){validate(s);const r=orientationAt(s,90);return {minPressurePa:s.massKg*suctionConstants.g/(s.mu*s.areaM2),frictionAtPressureN:s.mu*s.pressurePa*s.areaM2,equilibriumPossible:r.equilibriumPossible,weightN:r.weightN,suctionN:r.suctionN};}
export function suctionSummary(s){return {orientations:[0,90,135,180].map(a=>orientationAt(s,a)),leakage:[.5,1,2].map(f=>leakageAt(s,s.pressurePa,s.gapMm*f)),worstGapPressureBoundPa:pressureBound(s,30,s.gapMm*2)};}
