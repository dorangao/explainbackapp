import {demoPresets} from './demo-presets.mjs';
export const demoSettings={motion:{speedMph:60,duration:5,profileB:'smooth',massKg:2000,grip:1,powerKw:600},flight:{massKg:2000,airtime:1.5,radius:.9,separation:1,stopTime:.3,landingProfile:'pulse'}};
export async function runPresetDemo({language,testerAuthenticated,signal,request,show,step,play,checkpoint}){
 const check=()=>{if(signal.aborted)throw new DOMException('Demo stopped.','AbortError');};
 const pause=async stage=>{await checkpoint(stage,signal);check();};
 const expect=(s,phase)=>{if(s.phase!==phase)throw new Error('Unexpected provider step; inspect feedback and continue manually.');};
 if(!testerAuthenticated||!['en','zh'].includes(language))throw new Error('Tester login and a supported language are required.');
 check();step('start');
 let s=await request('/api/session',{problemId:'flight',language,synthetic:true,workflow:'claim-testing',flight:demoSettings.flight});
 check();expect(s,'claim');show(s);
 const submit=async expected=>{
  check();const preset=demoPresets(s,language)[0];if(!preset)throw new Error('No preset for this step.');
  step(s.phase);show(s,preset);await pause(s.phase);check();
  s=await request('/api/turn',{sessionId:s.sessionId,explanation:preset.text,demoPreset:true,...(preset.answer?{answer:preset.answer}:{})});
  // A sent request can advance the server after Stop. Reconcile its result,
  // then cancel future actions. The UI rejects results from replaced sessions.
  show(s);check();expect(s,expected);
 };
 await submit('confirm');
 if(s.claim?.kind!=='rotation-torque')throw new Error('Unexpected claim interpretation; script did not confirm it.');
 step('confirm');await pause('confirm');check();
 s=await request('/api/claim',{sessionId:s.sessionId,claimId:s.claim.id,decision:'confirm',source:'scripted-demo'});
 show(s);check();expect(s,'prediction');
 await submit('revision');
 if(!s.graph)throw new Error('Checked animation is unavailable.');
 step('evidence');await pause('evidence');
 for(const stage of ['acceleration','flip','landing']){
  step(stage);const completed=await play(signal,stage);check();if(!completed)throw new Error('Demo playback was interrupted.');
  await pause(stage);
 }
 await submit('transfer');await submit('complete');
 if(s.report?.outcome!=='assisted')throw new Error('Scripted demo must be recorded as assisted.');
 step('complete');return s;
}
