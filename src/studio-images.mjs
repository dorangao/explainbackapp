import {performance} from 'node:perf_hooks';
import {RequestError} from './request-error.mjs';
import {createTrace} from './trace.mjs';
import {validConcept} from './meta.mjs';
import {IMAGE_DATA_URL,MAX_IMAGE_CHARS} from './lesson-author.mjs';
import {validateLesson} from '../public/lesson-schema.mjs';
import {validateShowScript} from './lessons.mjs';
import {illustrationPrompt} from './lesson-show.mjs';
import {coverPrompt,coverPromptVersion,coverLesson} from './lesson-covers.mjs';
// The two image routes of a Lesson Studio session. Each receives the action handler's
// context: the session `s`, request `body`, the signed-in `tester`, the budget bucket and
// limit, the session lock, `save`, `json`, `quotaExceeded`, shared services and the
// configured model calls. Each counts as one request on the session budget.
const startTrace=async(ctx,call)=>{const trace=ctx.traceEnabled?createTrace(ctx.redacted,{initial:await ctx.state.readTrace(ctx.body.sessionId),onChange:rows=>ctx.state.writeTrace(ctx.body.sessionId,rows,ctx.lock)}):null;return {trace,call:trace?.start(call)};};
const spend=async ctx=>{if(ctx.s.attempts>=8||!await ctx.state.consumeTurn(ctx.bucket,ctx.limit)){const failure=ctx.quotaExceeded();failure.attemptsRemaining=8-ctx.s.attempts;throw failure;}ctx.s.attempts++;await ctx.save();};
const stillOwned=async(ctx,call)=>{if(!await ctx.access.active(ctx.tester.id)){call?.finish('discarded');await ctx.state.remove(ctx.body.sessionId);throw new RequestError(401,'Sign in to tester access.');}if(!await ctx.state.get(ctx.body.sessionId))throw new RequestError(409,'Session was reset; response discarded.');};
const failWith=(ctx,call,error,message)=>{call?.finish(error instanceof RequestError?'discarded':'failed or rejected');if(error instanceof RequestError)throw error;const failure=new RequestError(502,message);failure.attemptsRemaining=8-ctx.s.attempts;throw failure;};
const usage=u=>u?{input:u.input_tokens??null,output:u.output_tokens??null}:null;
// SAM 3.1 locates the one thing the creator names in their sketch or photo and returns
// pixel boxes; it never sees the lesson.
export async function detectInImage(ctx){
  const {body,s}=ctx;
  if(!ctx.segmentCall)throw new RequestError(503,'The segmentation model is not configured.');
  const concept=typeof body.concept==='string'?body.concept.trim():'';
  if(!validConcept(concept)||typeof body.image!=='string'||body.image.length>MAX_IMAGE_CHARS||!IMAGE_DATA_URL.test(body.image))throw new RequestError(400,'Name one thing in a few words and attach an image.');
  await spend(ctx);
  const {trace,call}=await startTrace(ctx,{provider:'meta',model:'sam-3.1',input:concept,instructions:'segmentation'});
  try{
    await trace?.flush();
    const startedAt=performance.now();
    const found=await ctx.segmentCall({image:body.image,concept,timeoutMs:30_000,...(call?{onTrace:call.event}:{})});
    await stillOwned(ctx,call);
    call?.finish(found.boxes.length?'accepted':'empty');try{await trace?.flush();}catch{}
    await ctx.save(trace?.read());
    ctx.json(200,{concept,boxes:found.boxes.slice(0,32),width:found.width,height:found.height,model:found.model,elapsedMs:Math.round(performance.now()-startedAt),usage:usage(found.usage),llm:s.llm,attemptsRemaining:8-s.attempts});
  }catch(error){failWith(ctx,call,error,'The image could not be analysed. Retry explicitly.');}
  finally{try{await trace?.flush();}catch{}}
}
// A library cover for a reviewed lesson, drawn by Muse Image from the lesson's title and
// introduction with the prompt scripts/lesson-covers.mjs uses. The result is kept in the
// app's state as a creator-drawn override that every visitor's library reads over the
// shipped manifest; the override it replaces is removed from the store when held there.
export async function drawCover(ctx){
  const {body,s}=ctx;
  if(!ctx.imageCall)throw new RequestError(503,'The image model is not configured.');
  const lessonId=typeof body.lessonId==='string'&&/^[a-z0-9-]{1,80}$/.test(body.lessonId)?body.lessonId:null;
  const lesson=lessonId?coverLesson(lessonId):null;
  if(!lesson)throw new RequestError(400,'Name a reviewed lesson to draw a cover for.');
  const prompt=coverPrompt(lesson);
  await spend(ctx);
  const {trace,call}=await startTrace(ctx,{provider:'meta',model:'muse-image-1.0',input:prompt,instructions:'image generation'});
  try{
    await trace?.flush();
    const startedAt=performance.now();
    const image=await ctx.imageCall({prompt,timeoutMs:ctx.imageBudgetMs(0),...(call?{onTrace:call.event}:{})});
    await stillOwned(ctx,call);
    const src=await ctx.storeImage(image,ctx.owner);
    const previous=(await ctx.state.getCovers())[lessonId]??null;
    const record={src,model:image.model,createdAt:new Date().toISOString().slice(0,10),promptVersion:coverPromptVersion,owner:ctx.owner};
    await ctx.state.putCover(lessonId,record);
    if(previous?.src&&previous.src!==src&&ctx.imageStore&&!previous.src.startsWith('data:')){try{await ctx.imageStore.remove([previous.src]);}catch{/* A stale file is harmless. */}}
    call?.finish('accepted');try{await trace?.flush();}catch{}
    await ctx.save(trace?.read());
    ctx.json(200,{lessonId,cover:src,model:image.model,createdAt:record.createdAt,promptVersion:coverPromptVersion,prompt,elapsedMs:Math.round(performance.now()-startedAt),usage:usage(image.usage),llm:s.llm,attemptsRemaining:8-s.attempts});
  }catch(error){failWith(ctx,call,error,'The cover could not be drawn. Retry explicitly.');}
  finally{try{await trace?.flush();}catch{}}
}
// One illustration from Muse Image for a slide of the current show, or a redrawn cover.
// The prompt is built here from the checked script, never sent by the browser.
export async function illustrateSlide(ctx){
  const {body,s}=ctx;
  if(!ctx.imageCall)throw new RequestError(503,'The image model is not configured.');
  let prompt,slide=null;
  try{const lesson=validateLesson(body.lesson),script=validateShowScript(body.show,lesson);if(!script)throw new Error();slide=body.slide===undefined?null:body.slide;prompt=illustrationPrompt(script,slide,body.direction??'');}
  catch{throw new RequestError(400,'Send the checked lesson, its show script and a slide to illustrate.');}
  await spend(ctx);
  const {trace,call}=await startTrace(ctx,{provider:'meta',model:'muse-image-1.0',input:prompt,instructions:'image generation'});
  try{
    await trace?.flush();
    const startedAt=performance.now();
    const image=await ctx.imageCall({prompt,timeoutMs:ctx.imageBudgetMs(0),...(call?{onTrace:call.event}:{})});
    await stillOwned(ctx,call);
    const url=await ctx.storeImage(image,ctx.owner);
    call?.finish('accepted');try{await trace?.flush();}catch{}
    await ctx.save(trace?.read());
    ctx.json(200,{image:url,model:image.model,slide,prompt,elapsedMs:Math.round(performance.now()-startedAt),usage:usage(image.usage),llm:s.llm,attemptsRemaining:8-s.attempts});
  }catch(error){failWith(ctx,call,error,'The illustration could not be drawn. Retry explicitly.');}
  finally{try{await trace?.flush();}catch{}}
}
