import {performance} from 'node:perf_hooks';
import {RequestError} from './request-error.mjs';
import {createTrace} from './trace.mjs';
import {validateLesson} from '../public/lesson-schema.mjs';
import {lessonKind} from './lessons.mjs';
import {lessonJudgeRequest,readLessonJudge,judgeVersionFor} from './eval/judge.mjs';
// Check figures: the rubric judge on one lesson, from the lesson's own page. One request
// on the tester model (Spark). Grounded by default, so the judge may search the web and
// reports the figures it disputed with the pages it read; the lesson is never changed.
export async function judgeLesson(ctx){
  const {body,s}=ctx;
  const target=ctx.judge;
  if(!target?.configured)throw new RequestError(503,'The judge model is not configured.');
  let lesson;try{lesson=validateLesson(body.lesson);}catch{throw new RequestError(400,'Send a valid lesson to check.');}
  const topic=typeof body.topic==='string'&&body.topic.trim()&&body.topic.length<=600?body.topic.trim():lesson.title.en;
  const language=['en','zh'].includes(body.language)?body.language:'en';
  if(body.grounded!==undefined&&typeof body.grounded!=='boolean')throw new RequestError(400,'Invalid grounded flag.');
  const grounded=body.grounded!==false;
  const request=lessonJudgeRequest({topic,language,category:lessonKind(lesson)},{status:'ready',message:{en:'',zh:''},lesson},{grounded});
  if(s.attempts>=8||!await ctx.state.consumeTurn(ctx.bucket,ctx.limit)){const failure=ctx.quotaExceeded();failure.attemptsRemaining=8-s.attempts;throw failure;}
  s.attempts++;await ctx.save();
  const trace=ctx.traceEnabled?createTrace(ctx.redacted,{initial:await ctx.state.readTrace(body.sessionId),onChange:rows=>ctx.state.writeTrace(body.sessionId,rows,ctx.lock)}):null;
  const call=trace?.start({provider:target.provider,model:target.model,input:request.input,instructions:request.instructions});
  try{
    await trace?.flush();
    const startedAt=performance.now();
    const raw=await ctx.invoke(target,{...request,promptCacheKey:'explainback-judge',...(call?{onTrace:call.event}:{})});
    if(!await ctx.access.active(ctx.tester.id)){call?.finish('discarded');await ctx.state.remove(body.sessionId);throw new RequestError(401,'Sign in to tester access.');}
    if(!await ctx.state.get(body.sessionId))throw new RequestError(409,'Session was reset; response discarded.');
    const judge={...readLessonJudge(raw,{grounded}),model:raw.model??target.model,version:judgeVersionFor(grounded)};
    call?.finish('accepted');try{await trace?.flush();}catch{}
    await ctx.save(trace?.read());
    ctx.json(200,{judge,grounded,elapsedMs:Math.round(performance.now()-startedAt),usage:raw.usage?{input:raw.usage.input_tokens??null,output:raw.usage.output_tokens??null}:null,llm:s.llm,attemptsRemaining:8-s.attempts});
  }catch(error){
    call?.finish(error instanceof RequestError?'discarded':'failed or rejected');
    if(error instanceof RequestError)throw error;
    const failure=new RequestError(502,'The figures could not be checked. Retry explicitly.');failure.attemptsRemaining=8-s.attempts;throw failure;
  }finally{try{await trace?.flush();}catch{}}
}
