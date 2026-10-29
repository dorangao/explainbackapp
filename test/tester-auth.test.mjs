import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTesterAuth} from '../src/tester-auth.mjs';
const credentials={username:'tester',password:'fixture-password-only'};
const cookie=r=>r.cookie.split(';')[0];
test('tester credentials fail closed and wrong passwords never create a session',()=>{
 for(const options of [{},{username:'tester',password:''},{...credentials,password:'short'}]){
  const auth=createTesterAuth(options);assert.equal(auth.configured,false);assert.throws(()=>auth.login(credentials),e=>e.status===503);assert.equal(auth.authenticate(''),null);
 }
 const auth=createTesterAuth(credentials);assert.throws(()=>auth.login({...credentials,password:'incorrect'}),e=>e.status===401);
 for(const body of [null,{}, {username:[],password:credentials.password},{...credentials,password:'x'.repeat(513)}])assert.throws(()=>auth.login(body),e=>e.status===401);
});
test('opaque login cookies expire, rotate, revoke, and never contain credentials',()=>{
 let now=1000;const removed=[];const auth=createTesterAuth({...credentials,now:()=>now,onRevoke:id=>removed.push(id)});
 const first=auth.login(credentials);assert.match(first.cookie,/HttpOnly; SameSite=Strict/);assert.doesNotMatch(first.cookie,/=tester(?:;|$)|fixture/);
 assert.equal(auth.authenticate(cookie(first)).id,first.id);
 assert.equal(auth.authenticate(cookie(first)+'x'),null);
 const second=auth.login(credentials,cookie(first));assert.equal(auth.authenticate(cookie(first)),null);assert.ok(removed.includes(first.id));
 now+=8*60*60_000;assert.equal(auth.authenticate(cookie(second)),null);assert.ok(removed.includes(second.id));
 const third=auth.login(credentials);auth.revoke(cookie(third));assert.equal(auth.authenticate(cookie(third)),null);assert.equal(auth.active(third.id),false);
});
test('failed login attempts are bounded and the window recovers',()=>{
 let now=1;const auth=createTesterAuth({...credentials,now:()=>now});
 for(let i=0;i<5;i++)assert.throws(()=>auth.login({...credentials,password:'bad'}),e=>e.status===401);
 assert.throws(()=>auth.login(credentials),e=>e.status===429);now+=60001;assert.ok(auth.login(credentials).id);
});
test('tester sessions are bounded without revoking unrelated active logins',()=>{
 const auth=createTesterAuth(credentials);const sessions=Array.from({length:20},()=>auth.login(credentials));
 assert.throws(()=>auth.login(credentials),e=>e.status===429);
 const rotated=auth.login(credentials,cookie(sessions[0]));assert.ok(auth.active(rotated.id));assert.ok(auth.active(sessions[1].id));
});
