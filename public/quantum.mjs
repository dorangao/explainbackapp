// Small ideal state-vector simulator. Basis order is |q0 q1>, q0 leftmost.
// Complex amplitudes [real, imaginary]; at most two qubits, no hardware/noise model.
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],scale=(a,k)=>[a[0]*k,a[1]*k];
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const H=[[[Math.SQRT1_2,0],[Math.SQRT1_2,0]],[[Math.SQRT1_2,0],[-Math.SQRT1_2,0]]];
export const quantumLessons=['qubit','interference','entanglement','search'];
function validateState(state){
 if(!Array.isArray(state)||![2,4].includes(state.length)||state.some(a=>!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)))throw new Error('Invalid quantum state.');
 if(Math.abs(state.reduce((s,[r,i])=>s+r*r+i*i,0)-1)>1e-9)throw new Error('Quantum state must be normalized.');
}
export function quantumProbabilities(state){validateState(state);return state.map(([r,i])=>r*r+i*i);}
function gate(state,q,matrix){
 const mask=1<<(Math.log2(state.length)-1-q),out=state.map(()=>[0,0]);
 for(let i=0;i<state.length;i++)if(!(i&mask)){out[i]=add(mul(matrix[0][0],state[i]),mul(matrix[0][1],state[i|mask]));out[i|mask]=add(mul(matrix[1][0],state[i]),mul(matrix[1][1],state[i|mask]));}return out;
}
export function quantumCircuit(config={}){
 if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['lesson','phase','basis','target'].includes(k)))throw new Error('Invalid circuit settings.');
 const {lesson='qubit',phase=Math.PI,basis='Z',target=3}=config;
 if(!quantumLessons.includes(lesson)||![0,Math.PI/2,Math.PI].includes(phase)||!['Z','X'].includes(basis)||!Number.isInteger(target)||target<0||target>3)throw new Error('Choose an allowed circuit.');
 const n= ['entanglement','search'].includes(lesson)?2:1,labels=Array.from({length:2**n},(_,i)=>i.toString(2).padStart(n,'0'));
 let state=labels.map((_,i)=>[i===0?1:0,0]);const frames=[];
 const record=(gate,targets,reference=null)=>frames.push({gate,targets,state:state.map(a=>[...a]),probabilities:quantumProbabilities(state),reference});
 record('prepare',[]);
 if(lesson==='qubit'){state=gate(state,0,H);record('H',[0]);}
 if(lesson==='interference'){
  state=gate(state,0,H);record('H',[0]);
  state=gate(state,0,[[[1,0],[0,0]],[[0,0],[Math.cos(phase),Math.sin(phase)]]]);record('P',[0]);
  state=gate(state,0,H);record('H',[0]);
 }
 if(lesson==='entanglement'){
  state=gate(state,0,H);record('H',[0]);
  state=state.map((_,i)=>state[i&2?i^1:i]);record('CNOT',[0,1],basis==='Z'?[.5,0,0,.5]:null);
  if(basis==='X'){state=gate(gate(state,0,H),1,H);record('H⊗H',[0,1],[.25,.25,.25,.25]);}
 }
 if(lesson==='search'){
  state=gate(gate(state,0,H),1,H);record('H⊗H',[0,1]);
  state=state.map((a,i)=>scale(a,i===target?-1:1));record('oracle',[0,1]);
  const mean=scale(state.reduce(add,[0,0]),1/state.length);state=state.map(a=>add(scale(mean,2),scale(a,-1)));record('diffuser',[0,1]);
 }
 return {config:{lesson,phase,basis,target},n,labels,frames};
}
export function measureQuantum(state,random=Math.random){
 const probabilities=quantumProbabilities(state),r=random();if(!Number.isFinite(r)||r<0||r>=1)throw new Error('Random draw must be in [0,1).');
 let cumulative=0,outcome=probabilities.length-1;
 for(let i=0;i<probabilities.length;i++){cumulative+=probabilities[i];if(r<cumulative){outcome=i;break;}}
 return {outcome,state:state.map((_,i)=>[i===outcome?1:0,0])};
}
export function sampleQuantum(state,shots=256,random=Math.random){
 validateState(state);if(!Number.isInteger(shots)||shots<1||shots>1024)throw new Error('Use 1–1024 shots.');
 const counts=state.map(()=>0);for(let i=0;i<shots;i++)counts[measureQuantum(state,random).outcome]++;return counts;
}
