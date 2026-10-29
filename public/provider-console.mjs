export function mountProviderConsole(root,post,{prefix='trace'}={}){
 root.innerHTML='<summary id="trace-title"></summary><p id="trace-note" class="fine"></p><div class="journey-buttons"><button type="button" class="example" id="trace-refresh"></button><button type="button" class="example" id="trace-clear"></button></div><p id="trace-status" role="status"></p><div id="trace-records"></div>';
 for(const element of root.querySelectorAll('[id]'))element.id=element.id.replace(/^trace/,prefix);
 const q=id=>root.querySelector('#'+id.replace(/^trace/,prefix));let enabled=false,sessionId=null,zh=false,version=0,followLatest=false,lastFollowed=0,records=[];
 function summary(){const last=records.at(-1),status=last?({pending:zh?'等待中':'pending',accepted:zh?'已接受':'accepted',discarded:zh?'已丢弃':'discarded','failed or rejected':zh?'未通过':'failed or rejected'}[last.outcome]??last.outcome):'';q('trace-title').textContent=(zh?'模型调用':'Provider activity')+(last?` · ${last.model} · ${records.length} · ${status}`:(zh?' · 尚无请求':' · no requests yet'));}
 async function refresh(clear=false){
  if(!enabled||!sessionId||document.hidden)return;const token=++version,id=sessionId;
  q('trace-status').textContent=zh?'读取记录…':'Reading trace…';
  try{const data=await post('/api/trace',{sessionId:id,...(clear?{clear:true}:{})});if(token!==version||id!==sessionId)return;
   records=data.records;summary();
   const openRows=new Set([...q('trace-records').querySelectorAll('details[open]')].map(d=>d.dataset.sequence));
   q('trace-records').replaceChildren(...data.records.map(row=>{
    const detail=document.createElement('details'),title=document.createElement('summary');
    detail.dataset.sequence=String(row.sequence);detail.open=openRows.has(String(row.sequence))||(followLatest&&row===data.records.at(-1));
    const outcomes=zh?{pending:'等待中',accepted:'已接受',discarded:'已丢弃','failed or rejected':'失败或未通过验证'}:{};
    title.textContent=`#${row.sequence} · ${row.provider??"model"} / ${row.model??""} · ${row.startedAt} · ${row.durationMs} ms · HTTP ${row.httpStatus??'—'} · ${outcomes[row.outcome]??row.outcome}${row.reason?` · ${row.reason}`:''}`;detail.append(title);
    for(const[label,value]of [[row.requestSent?(zh?'发送给模型的请求（已过滤）':'Request sent to provider (filtered)'):(zh?'准备的上下文（尚未发送）':'Prepared context (not sent)'),row.request],[zh?'模型响应（已过滤）':'Provider response (filtered)',row.response??{error:row.error??(zh?'尚无响应':'No response yet')}],...(row.lifecycle?.length?[[zh?'模型切换事件':'Model switch events',row.lifecycle]]:[])] ){
     const h=document.createElement('h4'),pre=document.createElement('pre');h.textContent=label;pre.textContent=JSON.stringify(value,null,2);detail.append(h,pre);
    }return detail;
   }));q('trace-status').textContent=zh?`${data.records.length} 条记录 · 最多保留 12 次尝试`:`${data.records.length} records · up to 12 attempts retained`;
   const latest=q('trace-records').lastElementChild;if(followLatest&&latest&&Number(latest.dataset.sequence)!==lastFollowed){lastFollowed=Number(latest.dataset.sequence);root.scrollTop+=latest.getBoundingClientRect().top-root.getBoundingClientRect().top-12;}
  }catch{if(token===version)q('trace-status').textContent=zh?'记录不可用；会话可能已重置或过期。':'Trace unavailable; session may have reset or expired.';}
 }
 const onRefresh=()=>refresh(),onClear=()=>refresh(true),onToggle=()=>{if(root.open)refresh();};
 q('trace-refresh').addEventListener('click',onRefresh);q('trace-clear').addEventListener('click',onClear);root.addEventListener('toggle',onToggle);
 return {refresh,destroy(){enabled=false;sessionId=null;version++;root.removeEventListener('toggle',onToggle);q('trace-refresh').removeEventListener('click',onRefresh);q('trace-clear').removeEventListener('click',onClear);},set({enabled:active,sessionId:id,language,followLatest:follow=false}){
  zh=language==='zh';enabled=active;followLatest=follow;root.hidden=!active;
  summary();
  q('trace-note').textContent=zh?'EXPLAINBACK_TRACE=1 已启用。服务端临时保留本会话的请求正文、工具响应、用量与耗时；不显示密钥、请求头、私有推理或原始错误正文。正文可能含核验答案，所以此会话计为开发演示。长记录会截断。重置会删除记录；会话开始 30 分钟后过期。':'EXPLAINBACK_TRACE=1 is enabled. This session’s request bodies, tool responses, usage and timing are held temporarily on the server. Keys, headers, private reasoning and raw error bodies are omitted. Context can include checked answers, so this session is a developer demo. Long records are truncated. Reset deletes the records; they expire 30 minutes after session creation.';
  q('trace-refresh').textContent=zh?'刷新记录':'Refresh trace';q('trace-clear').textContent=zh?'清除记录':'Clear trace';
  for(const c of [q('trace-refresh'),q('trace-clear')])c.disabled=!id;
  if(id!==sessionId||!enabled){version++;sessionId=id;lastFollowed=0;records=[];summary();q('trace-records').replaceChildren();q('trace-status').textContent=zh?'开始会话后，模型调用记录将显示在这里。':'Start a session to inspect provider calls here.';}
 }};
}
