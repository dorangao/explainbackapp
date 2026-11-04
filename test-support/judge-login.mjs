// Exercise the accessible text check through the real public challenge boundary.
export async function judgeBody(gate,client='unknown'){
 const c=await gate.challenge('text',client);
 return {judge:true,challengeId:c.id,answer:String(c.left+c.right)};
}
export async function httpJudgeBody(post){
 const response=await post('/api/judge-challenge',{kind:'text'}),c=await response.json();
 if(response.status!==200)throw new Error('Synthetic judge check unavailable: '+JSON.stringify(c));
 return {judge:true,challengeId:c.id,answer:String(c.left+c.right)};
}
