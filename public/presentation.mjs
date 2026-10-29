// Display policy only: never changes evidence, provider calls, or physics.
export function demoPresentation(stage,language='en',suction=false){
 const zh=language==='zh';
 const groups=suction?[['claim','confirm','prediction'],['pressure','ceiling','tilt','leakage'],['revision','design-review'],['transfer','complete']]:[['claim','confirm','prediction'],['evidence','acceleration','flip','landing'],['revision'],['transfer','complete']];
 const current=Math.max(0,groups.findIndex(g=>g.includes(stage)));
 const labels=zh?['提出说法','检验','改进','迁移']:['Claim','Test','Improve','Transfer'];
 const focus=suction?({pressure:'pressure',ceiling:'ceiling',tilt:'orientation',leakage:'leakage',revision:'orientation','design-review':'design',transfer:'design',complete:'design'}[stage]??'orientation'):null;
 return {current,labels,focus,journeyFocus:stage==='acceleration'?0:stage==='landing'?2:1};
}
export function defaultSuctionFocus(session){
 if(session?.graph?.focus)return session.graph.focus;
 if(session?.designProposal)return 'design';
 return {'stationary-pressure':'pressure','leakage-power':'leakage','all-angle-grip':'orientation'}[session?.claim?.kind]??'orientation';
}
