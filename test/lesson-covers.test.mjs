import test from 'node:test';import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {lessonCovers} from '../public/lesson-covers.mjs';
import {galleryLessons} from '../public/gallery-lessons.mjs';
import {evaluationLessons} from '../public/evaluation-lessons.mjs';
import {brandFiles} from '../src/static.mjs';
import {coverPrompt,coverTargets,coverModule} from '../scripts/lesson-covers.mjs';

test('every recorded cover names a real lesson, an existing file the build copies, and its model and date',()=>{
 const ids=new Set([...galleryLessons.map(l=>l.id),...evaluationLessons.map(l=>l.id)]);
 for(const [id,cover] of Object.entries(lessonCovers)){
  assert.ok(ids.has(id),`${id} is not a lesson`);
  assert.match(cover.src,new RegExp(`^/gallery/covers/${id}\\.webp$`));
  assert.ok(existsSync(new URL(`../public${cover.src}`,import.meta.url)),`${cover.src} is missing`);
  assert.equal(brandFiles.get(cover.src),'image/webp');
  assert.match(cover.model,/^muse-image/);
  assert.match(cover.createdAt,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(cover.promptVersion,'cover-v1');
 }
});

test('the cover prompt keeps the illustration style, the title and intro, and stays under the image limit',()=>{
 const [item]=coverTargets({ids:['explainback']});
 const prompt=coverPrompt(item.lesson);
 assert.match(prompt,/calm, flat, editorial illustration/);
 assert.match(prompt,/Subject: How ExplainBack makes a lesson\./);
 assert.ok(prompt.length<=1000);
 assert.equal(coverTargets({evaluation:true}).length,evaluationLessons.length);
 assert.throws(()=>coverTargets({ids:['nope']}),/Unknown lesson ids/);
 const module=coverModule({b:{src:'/gallery/covers/b.webp',model:'muse-image-1.0',createdAt:'2026-10-31',promptVersion:'cover-v1'},a:{src:'/gallery/covers/a.webp',model:'muse-image-1.0',createdAt:'2026-10-31',promptVersion:'cover-v1'}});
 assert.ok(module.indexOf('"a"')<module.indexOf('"b"'),'entries are sorted by id');
 assert.match(module,/export function lessonCover\(id\)/);
});
