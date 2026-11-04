import {spawn} from 'node:child_process';
import net from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
// An actual isolated Redis process; only the transport is adapted to the REST
// command-array contract. No production scripts are interpreted or mocked here.
export async function startRedis(binary){
 const dir=await mkdtemp(path.join(os.tmpdir(),'explainback-redis-')),socket=path.join(dir,'redis.sock');
 const child=spawn(binary,['--port','0','--unixsocket',socket,'--save','','--appendonly','no','--loglevel','warning'],{stdio:'ignore'});
 let launchError;child.on('error',e=>launchError=e);
 const parse=(b,at=0)=>{const end=b.indexOf('\r\n',at);if(end<0)return null;const kind=String.fromCharCode(b[at]),line=b.toString('utf8',at+1,end),next=end+2;
  if(kind==='+')return [line,next];if(kind==='-')throw new Error(line);if(kind===':')return [Number(line),next];
  if(kind==='$'){const n=Number(line);if(n<0)return [null,next];return b.length>=next+n+2?[b.toString('utf8',next,next+n),next+n+2]:null;}
  if(kind==='*'){const n=Number(line);if(n<0)return [null,next];const values=[];let offset=next;for(let i=0;i<n;i++){const item=parse(b,offset);if(!item)return null;values.push(item[0]);offset=item[1];}return [values,offset];}
  throw new Error('Invalid Redis response');};
 const command=args=>new Promise((resolve,reject)=>{const connection=net.createConnection(socket),parts=[`*${args.length}\r\n`];let bytes=Buffer.alloc(0);for(const arg of args){const v=String(arg);parts.push(`$${Buffer.byteLength(v)}\r\n${v}\r\n`);}connection.on('connect',()=>connection.write(parts.join('')));connection.on('error',reject);connection.on('end',()=>reject(new Error('Redis connection closed')));connection.setTimeout(10000,()=>{connection.destroy();reject(new Error('Redis test timeout'));});connection.on('data',chunk=>{bytes=Buffer.concat([bytes,chunk]);try{const result=parse(bytes);if(result){connection.end();resolve(result[0]);}}catch(e){connection.destroy();reject(e);}});});
 let ready=false;for(let i=0;i<100;i++){if(launchError)throw launchError;try{await command(['PING']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,20));}}
 if(!ready){child.kill();throw new Error('Redis did not start');}
 return {command,async close(){try{await command(['SHUTDOWN','NOSAVE']);}catch{}child.kill();await rm(dir,{recursive:true,force:true});}};
}
