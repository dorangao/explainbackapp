import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSuctionLab} from '../public/suction-view.mjs';
import {suctionScenario} from '../public/suction.mjs';
class El {
 constructor(){this.dataset={};this.children=[];this.events={};this.options=[{},{}];this.classList={add(){},toggle(){}};this.nextElementSibling=null;}
 setAttribute(k,v){this[k]=v;}
 addEventListener(k,f){this.events[k]=f;}
 append(...e){this.children.push(...e);}
 prepend(...e){this.children.unshift(...e);}
 before(){}
 replaceChildren(...e){this.children=e;}
}
function fixture(){
const root=new El(),els=new Map();
root.querySelector=selector=>{if(!els.has(selector))els.set(selector,new El());return els.get(selector);};
root.querySelector('.suction-controls').nextElementSibling=new El();

const previous=globalThis.document;globalThis.document={createElement:()=>new El()};
 const lab=mountSuctionLab(root);return {lab,root,restore:()=>{globalThis.document=previous;}};
}
test('new Muse visual choice overrides local exploration; incidental renders preserve it',()=>{
 const {lab,root,restore}=fixture();try{
 const scenario=suctionScenario();
 const s={sessionId:'s',problem:{id:'suction',formula:scenario.id},graph:{focus:'orientation',scenario},evidenceRecords:[],claim:{kind:'all-angle-grip'},history:[]};
const options={session:s,language:'en',visible:true,preview:false,locked:false,primaryReference:false,focus:'orientation'};
lab.set(options);
assert.equal(root.dataset.focus,'orientation');
const nav=root.querySelector('[data-el="body"]').children[0];
nav.children.find(b=>b.dataset.focus==='leakage').events.click();
assert.equal(root.dataset.focus,'leakage');
lab.set(options);
assert.equal(root.dataset.focus,'leakage','incidental rendering should preserve local visual selection');
s.history.push({action:'reveal_graph',visualFocus:'orientation'});
lab.set({...options,session:s});
assert.equal(root.dataset.focus,'orientation','new reveal_graph decision should show the requested angle view');

 }finally{restore();}
});

test('background playback settles without animation frames, and stop cancels cleanly',async()=>{
 const {lab,root,restore}=fixture(),saved={};
 for(const key of ['requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','matchMedia','performance'])saved[key]=globalThis[key];
 // This start value rounds the old elapsed-time fallback to 0.9999999999999999.
 globalThis.performance={now:()=>719.185185138};
 let fallback;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 globalThis.setTimeout=fn=>{fallback=fn;return 1;};globalThis.clearTimeout=()=>{};globalThis.matchMedia=()=>({matches:false});
 try{
  lab.set({session:{problem:{id:'suction'},history:[]},language:'en',visible:true,preview:false,locked:true,primaryReference:true,focus:'orientation'});
  const play=lab.play(new AbortController().signal,'tilt');fallback();assert.equal(await play,true);assert.equal(root.dataset.focus,'orientation');
  const stopped=lab.play(new AbortController().signal,'pressure');lab.stop();assert.equal(await stopped,false);
  const controller=new AbortController(),aborted=lab.play(controller.signal,'leakage');controller.abort();assert.equal(await aborted,false);
 }finally{Object.assign(globalThis,saved);restore();}
});
