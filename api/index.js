import {createCloudHandler,unavailable} from '../src/cloud.mjs';
let handler;
// Express dispatch is callback based. Keep the serverless invocation alive until
// the response is finished (including asynchronous provider and Redis work).
export function dispatchToResponse(app,req,res){
 return new Promise((resolve,reject)=>{
  const done=async()=>{
   res.off('finish',done);res.off('close',done);
   // Tasks can start further async middleware before they settle. Drain until idle.
   while(res.explainPendingTasks?.size)await Promise.allSettled([...res.explainPendingTasks]);
   resolve();
  };
  res.once('finish',done);res.once('close',done);
  try{app(req,res);}catch(error){res.off('finish',done);res.off('close',done);reject(error);}
 });
}
export default async function(req,res){
 try{handler??=createCloudHandler();}catch{return unavailable(res);}
 return dispatchToResponse(handler,req,res);
}
