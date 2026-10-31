import {readFileSync,writeFileSync} from 'node:fs';
import {generateMetaImage} from '../src/meta.mjs';
import {illustrationPrompt} from '../src/lesson-show.mjs';
import {galleryShows} from '../public/gallery-shows.mjs';
// Usage: node --env-file=.env.local scripts/illustrate-slide.mjs --show=ID --slide=N [--direction="..."] [--live] [--force]
//
// Draws one illustration for one slide of a gallery show with Muse Image, using the same
// prompt the Studio uses (the slide's English heading and narration as the scene, the
// show's cover prompt as the setting, an optional creator note), writes
// public/gallery/<id>-slide-<n>.webp and records it in the show's illustrations in
// public/gallery-shows.mjs. The narration is untouched. Without --live nothing is sent.
export function illustrationsBlock(illustrations){
 const keys=Object.keys(illustrations).sort((a,b)=>Number(a)-Number(b));
 return `"illustrations": {\n${keys.map(k=>`   ${JSON.stringify(k)}: ${JSON.stringify(illustrations[k])}`).join(',\n')}\n  }`;
}
export function withIllustration(source,id,illustrations){
 const start=source.indexOf(`\n "${id}": {`);
 if(start<0)throw new Error(`Show ${id} not found in gallery-shows.mjs.`);
 const next=source.indexOf('\n "',start+1);
 const section=source.slice(start,next<0?source.length:next);
 const match=/"illustrations": \{[^}]*\}/.exec(section);
 if(!match)throw new Error(`Show ${id} has no illustrations block.`);
 const updated=section.replace(match[0],illustrationsBlock(illustrations));
 return source.slice(0,start)+updated+(next<0?'':source.slice(next));
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 const args=process.argv.slice(2),option=name=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
 const known=['--show','--slide','--direction','--live','--force'];
 if(args.some(a=>!known.includes(a.split('=')[0])))throw new Error('Options: --show=ID, --slide=N, --direction="...", --live, --force.');
 const id=option('show'),slide=Number(option('slide')),direction=option('direction')??'';
 const entry=galleryShows[id];
 if(!entry)throw new Error(`Unknown show ${id}. Shows: ${Object.keys(galleryShows).join(', ')}.`);
 if(!Number.isInteger(slide)||slide<1||slide>=entry.show.slides.length)throw new Error(`--slide must be 1 to ${entry.show.slides.length-1} (the cover is 0).`);
 const prompt=illustrationPrompt(entry.show,slide,direction);
 const current=entry.illustrations?.[String(slide)];
 console.log(`${id} slide ${slide} (${entry.show.slides[slide].kind}: ${entry.show.slides[slide].heading.en})`);
 console.log(`prompt: ${prompt}`);
 if(current&&!args.includes('--force')){console.log(`Already illustrated at ${current}; add --force to redraw.`);process.exit(0);}
 if(!args.includes('--live')){console.log('Dry run: nothing sent. Add --live to draw (one image request).');process.exit(0);}
 const apiKey=process.env.MODEL_API_KEY?.trim();
 if(!apiKey)throw new Error('MODEL_API_KEY is not set. No calls made.');
 const started=Date.now();
 const image=await generateMetaImage({apiKey,prompt,size:'1536x1024',outputFormat:'webp',timeoutMs:90_000});
 const b64=image.dataUrl.slice(image.dataUrl.indexOf(',')+1);
 const path=`/gallery/${id}-slide-${slide}.webp`;
 writeFileSync(new URL(`../public${path}`,import.meta.url),Buffer.from(b64,'base64'));
 const file=new URL('../public/gallery-shows.mjs',import.meta.url);
 writeFileSync(file,withIllustration(readFileSync(file,'utf8'),id,{...(entry.illustrations??{}),[String(slide)]:path}));
 console.log(`drew ${path} in ${((Date.now()-started)/1000).toFixed(1)} s (${Math.round(Buffer.byteLength(b64,'base64')/1024)} KB) with ${image.model}; gallery-shows.mjs updated.`);
}
