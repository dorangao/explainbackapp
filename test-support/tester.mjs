import assert from 'node:assert/strict';
export const testerCredentials={username:'fixture-tester',password:'fixture-tester-password'};
export async function testerCookie(origin){
 const r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(testerCredentials)});
 assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
}
