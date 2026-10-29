import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {evaluate} from '../public/formula-catalog.mjs';
import {drawGraph} from '../public/function-plot.mjs';

test('catalog calculations reject invalid numbers before producing plot values',()=>{
 assert.throws(()=>evaluate('crossing-primary',Infinity),/finite/i);
 assert.throws(()=>evaluate('crossing-primary',NaN),/finite/i);
 assert.throws(()=>evaluate('crossing-primary','1'),/finite/i);
 assert.throws(()=>evaluate('constructor',1),/formula/i);
 for(const [formula,x,expected] of [['crossing-transfer',3,2],['nonzero-primary',0,1],['ends-transfer',0,1]])assert.equal(evaluate(formula,x),expected);
});
test('independent graphs have unique clipping, a bounded path and bilingual accessible text',()=>{
 const dom=new JSDOM('<div id="a"></div><div id="b"></div>');
 const previous=globalThis.document;globalThis.document=dom.window.document;
 try{
  const graph={formula:'crossing-primary',expression:'x / (x²+1)',leftLimit:0,rightLimit:0,crossings:[0],asymptotes:[0],range:[-1,1]};
  const a=document.querySelector('#a'),b=document.querySelector('#b');
  drawGraph(a,graph,'en');drawGraph(b,graph,'zh');
  const first=a.querySelector('clipPath').id,second=b.querySelector('clipPath').id;
  assert.notEqual(first,second);
  assert.match(a.querySelector('path').getAttribute('clip-path'),new RegExp(first));
  assert.doesNotMatch(a.querySelector('path').getAttribute('d'),/NaN|Infinity/);
  assert.match(b.querySelector('svg').getAttribute('aria-label'),/交点/);
  drawGraph(a,null,'zh');assert.match(a.textContent,/先讲出/);
  assert.throws(()=>drawGraph(b,{...graph,range:[1,1]},'en'),/range/i);
  assert.throws(()=>drawGraph(b,{...graph,range:[-Number.MAX_VALUE,Number.MAX_VALUE]},'en'),/range/i);
  assert.throws(()=>drawGraph(b,{...graph,crossings:[NaN]},'en'),/finite/i);
  assert.throws(()=>drawGraph(b,graph,'en',Number.MAX_VALUE),/finite/i);
 }finally{globalThis.document=previous;dom.window.close();}
});
