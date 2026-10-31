import test from 'node:test';import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {illustrationsBlock,withIllustration} from '../scripts/illustrate-slide.mjs';
import {galleryShows} from '../public/gallery-shows.mjs';
import {brandFiles} from '../src/static.mjs';

test('the slide illustrator rewrites one show\'s illustrations block, sorted by slide, and leaves the rest alone',()=>{
 const source=`export const galleryShows=Object.freeze({
 "one": {
  "cover": "/gallery/one-cover.webp",
  "illustrations": {
   "4": "/gallery/one-slide-4.webp"
  },
  "model": "m"
 },
 "two": {
  "illustrations": {
   "1": "/gallery/two-slide-1.webp"
  }
 }
});`;
 const out=withIllustration(source,'one',{"4":"/gallery/one-slide-4.webp","3":"/gallery/one-slide-3.webp"});
 assert.match(out,/"illustrations": \{\n   "3": "\/gallery\/one-slide-3\.webp",\n   "4": "\/gallery\/one-slide-4\.webp"\n  \}/);
 assert.ok(out.includes('"1": "/gallery/two-slide-1.webp"'),'the other show is untouched');
 assert.equal(illustrationsBlock({}),'"illustrations": {\n\n  }');
 assert.throws(()=>withIllustration(source,'three',{}),/not found/);
});

test('every gallery show illustration exists and is copied by the build',()=>{
 for(const [id,entry] of Object.entries(galleryShows)){
  for(const [index,path] of Object.entries(entry.illustrations??{})){
   assert.ok(Number(index)>0&&Number(index)<entry.show.slides.length,`${id}: slide ${index} out of range`);
   assert.ok(existsSync(new URL(`../public${path}`,import.meta.url)),`${id}: ${path} is missing`);
   assert.equal(brandFiles.get(path),'image/webp',`${id}: ${path} not copied by the build`);
  }
 }
});
