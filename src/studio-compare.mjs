import {performance} from 'node:perf_hooks';
import {RequestError} from './request-error.mjs';
import {createTrace} from './trace.mjs';
import {lessonAuthorRequest,authorPromptVersion} from './lesson-author.mjs';
import {lessonJudgeRequest,readLessonJudge,judgeVersionFor} from './eval/judge.mjs';
import {scoreOpenReply} from './eval/studio.mjs';
// The compare route of a Lesson Studio session: the creator's question goes to both Muse
// text models at once, each reply is checked by the same validator and open-question
// scorer the evaluation uses, and the rubric judge scores the ready lessons. It receives
// the action handler's context like the image routes do. Each model call is one request
// on the session budget: two drafts, then up to two judge scores. The judge is the tester
// role (Spark) unless the body names the other compared model's id.
const usage=u=>u?{input:u.input_tokens??null,output:u.output_tokens??null}:null;
const hasBudget=async ctx=>ctx.s.attempts<8&&await ctx.state.consumeTurn(ctx.bucket,ctx.limit);
export async function compareDrafts(ctx){
  const {body,s}=ctx;
  const [first,second]=ctx.models;
  if(!first?.configured||!second?.configured||first.id===second.id)throw new RequestError(503,'Comparing needs two different configured Muse models.');
  if(body.judge!==undefined&&typeof body.judge!=='boolean'&&typeof body.judge!=='string')throw new RequestError(400,'Invalid judge flag.');
  const judgeTarget=typeof body.judge==='string'?ctx.models.find(m=>m.id===body.judge):ctx.judge;
  if(typeof body.judge==='string'&&!judgeTarget)throw new RequestError(400,'The judge must be one of the two compared models.');
  // Grounded: the judge may search the web and scores factual currency too (judge v2).
  if(body.grounded!==undefined&&typeof body.grounded!=='boolean')throw new RequestError(400,'Invalid grounded flag.');
  const grounded=body.grounded===true;
  let args;try{args=lessonAuthorRequest({topic:body.topic,creation:'generated'},'compose');}catch{throw new RequestError(400,'Use a short topic under 600 characters.');}
  const topic=body.topic.trim(),wantJudge=body.judge!==false;
  // Both drafts are charged up front so a half-finished comparison cannot run on credit.
  if(s.attempts>6||!await ctx.state.consumeTurn(ctx.bucket,ctx.limit)){const failure=ctx.quotaExceeded();failure.attemptsRemaining=8-s.attempts;throw failure;}
  if(!await ctx.state.consumeTurn(ctx.bucket,ctx.limit)){const failure=ctx.quotaExceeded();failure.attemptsRemaining=8-s.attempts;throw failure;}
  s.attempts+=2;await ctx.save();
  const trace=ctx.traceEnabled?createTrace(ctx.redacted,{initial:await ctx.state.readTrace(body.sessionId),onChange:rows=>ctx.state.writeTrace(body.sessionId,rows,ctx.lock)}):null;
  const startedAt=performance.now();
  const draft=async target=>{
    const call=trace?.start({provider:target.provider,model:target.model,input:args.input,instructions:args.instructions});
    const began=performance.now();
    const reply={model:target.model,llm:target.id,status:'failed',lesson:null,kind:null,checks:{},automatedPass:false,judge:null,elapsedMs:0,usage:null};
    try{
      await trace?.flush();
      const raw=await ctx.invoke(target,{...args,promptCacheKey:'explainback-compose',reasoningSummary:'auto',...(call?{onTrace:call.event}:{})});
      reply.elapsedMs=Math.round(performance.now()-began);reply.usage=usage(raw.usage);reply.model=raw.model??target.model;
      const score=scoreOpenReply(raw);
      reply.checks=score.checks;reply.automatedPass=score.automatedPass;
      if(!score.contractValid){reply.status='rejected';reply.reason=score.reason;call?.finish('failed or rejected');return reply;}
      reply.status=score.status;reply.message=score.response.message;reply.lesson=score.response.lesson;reply.kind=score.kind??null;reply.response=score.response;
      call?.finish(reply.status==='ready'?'accepted':'declined');
    }catch(error){
      reply.elapsedMs=Math.round(performance.now()-began);
      if(error instanceof RequestError)throw error;
      call?.finish('failed or rejected');reply.reason='The model did not answer in time.';
    }
    return reply;
  };
  try{
    const replies=await Promise.all([draft(first),draft(second)]);
    if(!await ctx.access.active(ctx.tester.id)){await ctx.state.remove(body.sessionId);throw new RequestError(401,'Sign in to tester access.');}
    // The judge scores each ready lesson while the budget allows. Its scores are one
    // model's view of the wording, kept apart from the checks above, and it scores its
    // own draft as well as the other model's.
    const judgeOne=async reply=>{
      if(!wantJudge||reply.status!=='ready'||!judgeTarget?.configured)return;
      if(!await hasBudget(ctx)){reply.judge={failure:'budget',reason:'No request left for the judge.'};return;}
      s.attempts++;
      const item={topic,language:/[㐀-鿿]/.test(topic)?'zh':'en',category:reply.kind};
      const request=lessonJudgeRequest(item,reply.response,{grounded});
      const call=trace?.start({provider:judgeTarget.provider,model:judgeTarget.model,input:request.input,instructions:request.instructions});
      try{
        await trace?.flush();
        const raw=await ctx.invoke(judgeTarget,{...request,promptCacheKey:'explainback-judge',...(call?{onTrace:call.event}:{})});
        reply.judge={...readLessonJudge(raw,{grounded}),model:raw.model??judgeTarget.model,version:judgeVersionFor(grounded)};call?.finish('accepted');
      }catch(error){
        if(error instanceof RequestError)throw error;
        call?.finish('failed or rejected');reply.judge={failure:'judge-failed',reason:String(error?.message??'').slice(0,120)};
      }
    };
    await Promise.all(replies.map(judgeOne));
    try{await trace?.flush();}catch{}
    await ctx.save(trace?.read());
    for(const reply of replies)delete reply.response;
    ctx.json(200,{question:topic,promptVersion:authorPromptVersion,judgeVersion:judgeVersionFor(grounded),grounded:wantJudge&&grounded,judge:wantJudge?judgeTarget?.model??null:null,replies,model:`${first.model} · ${second.model}`,elapsedMs:Math.round(performance.now()-startedAt),usage:null,llm:s.llm,attemptsRemaining:8-s.attempts});
  }catch(error){
    if(error instanceof RequestError)throw error;
    const failure=new RequestError(502,'The comparison could not be completed. Retry explicitly.');failure.attemptsRemaining=8-s.attempts;throw failure;
  }finally{try{await trace?.flush();}catch{}}
}
