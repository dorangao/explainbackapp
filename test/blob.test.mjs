import test from 'node:test';import assert from 'node:assert/strict';
import {createBlobStore,decodeImageDataUrl,isBlobUrl,recordImageUrls} from '../src/blob.mjs';
const webp=()=>{const b=Buffer.alloc(32);b.write('RIFF',0,'latin1');b.write('WEBP',8,'latin1');return b;};
const png=()=>Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.alloc(8)]);
const dataUrl=(bytes,type='image/webp')=>`data:${type};base64,${bytes.toString('base64')}`;
// A fake store that records what the SDK would receive and serves blob-shaped URLs.
export function fakeBlob(){
 const puts=[],deleted=[];
 const store=createBlobStore({token:'synthetic-token',random:()=>'r'+String(puts.length+1).padStart(3,'0'),
  putImpl:async(pathname,body,options)=>{puts.push({pathname,bytes:body.length,options});return {url:`https://store.public.blob.vercel-storage.com/${pathname}`};},
  delImpl:async urls=>{deleted.push(...urls);}});
 return {store,puts,deleted};
}
test('data URLs are decoded by their real signature and bounded',()=>{
 assert.equal(decodeImageDataUrl(dataUrl(webp())).format,'webp');
 assert.equal(decodeImageDataUrl(dataUrl(png(),'image/webp')).format,'png');
 assert.throws(()=>decodeImageDataUrl(dataUrl(Buffer.from('not an image'))),/Unsupported/);
 assert.throws(()=>decodeImageDataUrl('https://example.com/a.webp'),/Not an image/);
 assert.throws(()=>decodeImageDataUrl(dataUrl(webp()),8),/too large/);
});
test('the store scopes paths to the owner and only owns its own URLs',async()=>{
 const {store,puts,deleted}=fakeBlob();
 const url=await store.putImage({owner:'code:judges',...decodeImageDataUrl(dataUrl(webp()))});
 assert.match(url,/^https:\/\/store\.public\.blob\.vercel-storage\.com\/images\/[a-f0-9]{24}\/r001\.webp$/);
 assert.equal(puts[0].options.access,'public');assert.equal(puts[0].options.contentType,'image/webp');assert.equal(puts[0].options.addRandomSuffix,false);
 assert.equal(store.owns(url,'code:judges'),true);
 assert.equal(store.owns(url,'code:other'),false);
 assert.equal(store.owns('https://evil.example/images/x.webp','code:judges'),false);
 assert.equal(store.owns(url+'?x=1','code:judges'),false);
 assert.equal(await store.remove([url,'data:image/webp;base64,QUJD',url]),1);assert.deepEqual(deleted,[url]);
 assert.equal(createBlobStore({token:''}),null);
 assert.equal(isBlobUrl('http://store.public.blob.vercel-storage.com/a'),false);
 assert.deepEqual(recordImageUrls({cover:url,sketch:null,illustrations:{1:url+'2',2:'data:x'}}),[url,url+'2']);
});
