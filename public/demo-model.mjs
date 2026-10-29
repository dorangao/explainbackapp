// A bounded arithmetic language. Generated text is never JavaScript.
const funcs={sin:1,cos:1,exp:1,log:1,sqrt:1,abs:1,min:2,max:2};
const constants={pi:Math.PI,e:Math.E};
const numeric=n=>{if(!Number.isFinite(n)||Math.abs(n)>1e9)throw new Error('Non-finite or oversized model value.');return n;};
export function compileExpression(source,names=[]){
 if(typeof source!=='string'||!source.trim()||source.length>180)throw new Error('Expression length.');
 const tokens=[];let rest=source;
 while(rest.trim()){
  const match=/^\s*(?:(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z][a-z0-9_]{0,15})|([+*/^(),-]))/i.exec(rest);
  if(!match)throw new Error('Invalid arithmetic token.');tokens.push(match[1]?numeric(Number(match[1])):match[2]??match[3]);rest=rest.slice(match[0].length);if(tokens.length>80)throw new Error('Too many tokens.');
 }
 let at=0;const allowed=new Set(names);
 function parse(min=0,depth=0){
  if(depth>16)throw new Error('Expression too deep.');const token=tokens[at++];let node;
  if(typeof token==='number')node={number:token};
  else if(token==='+'||token==='-')node={op:token==='-'?'neg':'pos',args:[parse(25,depth+1)]};
  else if(token==='('){node=parse(0,depth+1);if(tokens[at++]!==')')throw new Error('Missing parenthesis.');}
  else if(Object.hasOwn(funcs,token)){
   if(tokens[at++]!=='(')throw new Error('Function needs parentheses.');const args=[parse(0,depth+1)];
   while(tokens[at]===','){at++;args.push(parse(0,depth+1));if(args.length>2)throw new Error('Too many arguments.');}
   if(tokens[at++]!==')'||args.length!==funcs[token])throw new Error('Function arity.');node={op:token,args};
  }else if(Object.hasOwn(constants,token))node={number:constants[token]};
  else if(allowed.has(token))node={name:token};else throw new Error('Unknown variable.');
  while(at<tokens.length){const op=tokens[at],precedence={'+':10,'-':10,'*':20,'/':20,'^':30},power=Object.hasOwn(precedence,op)?precedence[op]:undefined;if(power===undefined||power<min)break;at++;node={op,args:[node,parse(op==='^'?power:power+1,depth+1)]};}
  return node;
 }
 const ast=parse();if(at!==tokens.length)throw new Error('Unexpected arithmetic content.');return ast;
}
export function evaluateExpression(ast,values){
 if(Object.hasOwn(ast,'number'))return ast.number;if(ast.name){if(!Object.hasOwn(values,ast.name))throw new Error('Missing variable.');return numeric(values[ast.name]);}
 const [a,b]=ast.args.map(n=>evaluateExpression(n,values));
 const n=ast.op==='+'?a+b:ast.op==='-'?a-b:ast.op==='*'?a*b:ast.op==='/'?a/b:ast.op==='^'?a**b:ast.op==='neg'?-a:ast.op==='pos'?a:Math[ast.op](a,...(b===undefined?[]:[b]));return numeric(n);
}
export function expressionBounds(ast,values){
 if(Object.hasOwn(ast,'number'))return [ast.number,ast.number];if(ast.name){const r=values[ast.name];if(!r)throw new Error('Missing bounds.');return r;}
 const [a,b]=ast.args.map(n=>expressionBounds(n,values));let r;
 const endpoints=fn=>[fn(a[0],b[0]),fn(a[0],b[1]),fn(a[1],b[0]),fn(a[1],b[1])];
 switch(ast.op){
  case '+':r=[a[0]+b[0],a[1]+b[1]];break;
  case '-':r=[a[0]-b[1],a[1]-b[0]];break;
  case '*':r=endpoints((x,y)=>x*y);break;
  case '/':if(b[0]<=0&&b[1]>=0)throw new Error('Possible division by zero.');r=endpoints((x,y)=>x/y);break;
  case '^':{
   if(a[0]<=0){
    if(b[0]!==b[1]||!Number.isInteger(b[0])||Math.abs(b[0])>12||(a[0]<=0&&a[1]>=0&&b[0]<0))throw new Error('Power needs a valid bounded domain.');
    r=endpoints((x,y)=>x**y);if(a[0]<=0&&a[1]>=0&&b[0]>0)r.push(0);
   }else r=endpoints((x,y)=>x**y);break;
  }
  case 'neg':r=[-a[1],-a[0]];break;case 'pos':r=a;break;
  case 'sin':case 'cos':r=[-1,1];break;
  case 'exp':r=a.map(Math.exp);break;
  case 'log':if(a[0]<=0)throw new Error('Log requires positive domain.');r=a.map(Math.log);break;
  case 'sqrt':if(a[0]<0)throw new Error('Square root needs a non-negative domain.');r=a.map(Math.sqrt);break;
  case 'abs':r=a[0]<=0&&a[1]>=0?[0,Math.max(-a[0],a[1])]:a.map(Math.abs);break;
  case 'min':r=[Math.min(a[0],b[0]),Math.min(a[1],b[1])];break;
  case 'max':r=[Math.max(a[0],b[0]),Math.max(a[1],b[1])];break;
  default:throw new Error('Unknown operation.');
 }
 r.forEach(numeric);return [Math.min(...r),Math.max(...r)];
}

const shape=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...keys].sort().join('|');
const text=(s,max)=>typeof s==='string'&&s.trim()&&s.length<=max;
const bi=(o,max)=>shape(o,['en','zh'])&&Object.values(o).every(s=>text(s,max));
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e6;
const identifier=s=>typeof s==='string'&&/^[a-z][a-z0-9_]{0,15}$/.test(s)&&!['x','constructor','prototype',...Object.keys(funcs),...Object.keys(constants)].includes(s);
function range(axis){return finite(axis.min)&&finite(axis.max)&&axis.max>axis.min;}
export function validInputValue(input,value){return finite(value)&&value>=input.min&&value<=input.max&&Math.abs((value-input.min)/input.step-Math.round((value-input.min)/input.step))<1e-6;}
export function validateDemo(demo){
 const base=['kind','title','claim','assumptions'];
 // Specific messages: authors and evaluation reports learn which field broke the contract.
 if(!demo||typeof demo!=='object')throw new Error('Describe the model in both languages.');
 for(const [key,max] of [['title',80],['claim',180],['assumptions',700]])if(!bi(demo[key],max))throw new Error(`demo ${key} needs both languages, each 1–${max} characters.`);
 if(demo.kind==='process'){
  if(!shape(demo,[...base,'stages','transfer'])||!Array.isArray(demo.stages)||demo.stages.length<3||demo.stages.length>6)throw new Error('Use 3–6 process stages.');
  demo.stages.forEach((s,i)=>{if(!shape(s,['title','detail'])||!bi(s.title,80)||!bi(s.detail,240))throw new Error(`stage ${i+1} needs a bilingual title (1–80) and detail (1–240).`);});
  const t=demo.transfer;if(!shape(t,['question','choices','answer','rationale']))throw new Error('Invalid authored question.');
  if(!bi(t.question,200))throw new Error('transfer question needs both languages, each 1–200 characters.');
  if(!bi(t.rationale,240))throw new Error('transfer rationale needs both languages, each 1–240 characters.');
  if(!Array.isArray(t.choices)||t.choices.length!==3||t.choices.some(c=>!bi(c,120))||!Number.isInteger(t.answer)||t.answer<0||t.answer>2)throw new Error('transfer needs exactly 3 bilingual choices (1–120) and an answer index 0–2.');
  return structuredClone(demo);
 }
 if(demo.kind!=='model'||!shape(demo,[...base,'inputs','axis','outputs','transfer'])||!Array.isArray(demo.inputs)||demo.inputs.length<1||demo.inputs.length>4||!Array.isArray(demo.outputs)||demo.outputs.length<1||demo.outputs.length>3)throw new Error('Invalid generated model.');
 const names=new Set(),bounds=Object.create(null);
 for(const v of demo.inputs){
  if(!shape(v,['id','label','unit','min','max','step','value'])||!identifier(v.id)||names.has(v.id))throw new Error('Invalid parameter.');
  if(!bi(v.label,60)||!text(v.unit,24))throw new Error(`input ${v.id} needs a bilingual label (1–60) and a unit (1–24).`);
  if(!range(v)||!finite(v.step)||v.step<=0||(v.max-v.min)/v.step>1000||Math.abs((v.max-v.min)/v.step-Math.round((v.max-v.min)/v.step))>1e-6||!validInputValue(v,v.value))throw new Error(`input ${v.id} has an invalid range, step or default.`);
  names.add(v.id);bounds[v.id]=[v.min,v.max];
 }
 if(!shape(demo.axis,['label','unit','min','max'])||!bi(demo.axis.label,60)||!text(demo.axis.unit,24)||!range(demo.axis))throw new Error('Invalid independent axis.');
 bounds.x=[demo.axis.min,demo.axis.max];names.add('x');
 for(const o of demo.outputs){
  if(!shape(o,['id','label','unit','expression'])||!identifier(o.id)||names.has(o.id))throw new Error('Invalid output.');
  if(!bi(o.label,60)||!text(o.unit,24))throw new Error(`output ${o.id} needs a bilingual label (1–60) and a unit (1–24).`);
  bounds[o.id]=expressionBounds(compileExpression(o.expression,[...names]),bounds);names.add(o.id);
 }
 const t=demo.transfer;
 if(!shape(t,['question','values','at','output'])||!bi(t.question,200)||!Array.isArray(t.values)||t.values.length!==demo.inputs.length||new Set(t.values.map(v=>v.id)).size!==demo.inputs.length||t.values.some(v=>!shape(v,['id','value'])||!demo.inputs.some(p=>p.id===v.id&&validInputValue(p,v.value)))||!finite(t.at)||t.at<demo.axis.min||t.at>demo.axis.max||!demo.outputs.some(o=>o.id===t.output)||!t.values.some(v=>v.value!==demo.inputs.find(p=>p.id===v.id).value))throw new Error('Transfer needs a changed valid input case.');
 return structuredClone(demo);
}
const bilingual={type:'object',properties:{en:{type:'string'},zh:{type:'string'}},required:['en','zh'],additionalProperties:false};
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str={type:'string'},num={type:'number'};
const common={title:bilingual,claim:bilingual,assumptions:bilingual};
export const demoSchema={anyOf:[
 obj({kind:{type:'string',enum:['model']},...common,inputs:{type:'array',items:obj({id:str,label:bilingual,unit:str,min:num,max:num,step:num,value:num})},axis:obj({label:bilingual,unit:str,min:num,max:num}),outputs:{type:'array',items:obj({id:str,label:bilingual,unit:str,expression:str})},transfer:obj({question:bilingual,values:{type:'array',items:obj({id:str,value:num})},at:num,output:str})}),
 obj({kind:{type:'string',enum:['process']},...common,stages:{type:'array',items:obj({title:bilingual,detail:bilingual})},transfer:obj({question:bilingual,choices:{type:'array',items:bilingual},answer:{type:'integer'},rationale:bilingual})})
]};

export const formatDemoNumber=n=>n===0?'0':Math.abs(n)<.01||Math.abs(n)>=1e5?n.toExponential(3):String(Number(n.toPrecision(5)));
