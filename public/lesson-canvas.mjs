// Declarative canvas data only. Image coordinates are not physical measurements.
const shape=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...keys].sort().join('|');
const fraction=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
export function validateCanvas(value,demo){
 const b=value?.box;
 if(demo?.kind!=='model'||!shape(value,['concept','input','box'])||typeof value.concept!=='string'||!value.concept.trim()||value.concept.length>60||!demo.inputs.some(i=>i.id===value.input)||!shape(b,['x','y','width','height'])||!Object.values(b).every(fraction)||b.width<=0||b.height<=0||b.x+b.width>1.000001||b.y+b.height>1.000001)throw new Error('Invalid canvas binding. Select a region and an existing model control.');
 return {concept:value.concept.trim(),input:value.input,box:{...b}};
}
export function validateDrawing(value){
 if(!shape(value,['points'])||!Array.isArray(value.points)||value.points.length<2||value.points.length>128||value.points.some(p=>!shape(p,['x','y'])||!fraction(p.x)||!fraction(p.y)))throw new Error('Invalid canvas drawing. Use 2–128 points inside the graph.');
 return {points:value.points.map(p=>({x:p.x,y:p.y}))};
}
// The same bounds power the plotted axes and the server's interpretation of a sketch.
export function chartDomain(e){
 const points=Array.from({length:e.steps+1},(_,i)=>e.sample(i/e.steps));
 const min=Math.min(0,...points.flat()),max=Math.max(0,...points.flat()),spread=max===min?1:max-min;
 return {low:min<0?min-spread*.04:0,high:max+spread*.08};
}
export function drawingEvidence(experiment,value){
 if(experiment.kind!=='model')throw new Error('A canvas drawing needs a numeric model.');
 const drawing=validateDrawing(value),{low,high}=chartDomain(experiment);
 return {series:experiment.series[0],unit:experiment.unit,axis:experiment.axis,
  samples:drawing.points.map(p=>({progress:p.x,predicted:low+p.y*(high-low),calculated:experiment.sample(p.x)[0]}))};
}
