import {createHash,randomBytes} from 'node:crypto';
// Vercel Blob keeps the image bytes that belong to saved lessons: show covers, slide
// illustrations drawn by Muse Image and the sketch a lesson was created from. Redis keeps
// only the URLs. Without BLOB_READ_WRITE_TOKEN the app behaves as before: images reach the
// browser as data URLs for the session and are not kept when a lesson is saved.
//
// Blobs are public by URL. Every pathname is images/<owner hash>/<random>.<format>, so a
// URL is unguessable, and a save request may only reference images under its own owner
// prefix; the server never trusts a client URL it cannot place.
export const BLOB_HOST_SUFFIX='.public.blob.vercel-storage.com';
export const MAX_IMAGE_BYTES=1_500_000;
const formats={webp:'image/webp',png:'image/png',jpeg:'image/jpeg'};
const ownerHash=owner=>createHash('sha256').update(String(owner)).digest('hex').slice(0,24);
// Decodes a data URL into bytes and checks the real container signature, so a renamed
// or malformed payload is rejected before it is stored.
export function decodeImageDataUrl(value,maxBytes=MAX_IMAGE_BYTES){
 const m=/^data:image\/(webp|png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(typeof value==='string'?value:'');
 if(!m)throw new Error('Not an image data URL.');
 const bytes=Buffer.from(m[2],'base64');
 if(!bytes.length||bytes.length>maxBytes)throw new Error('Image is empty or too large.');
 const format=bytes.length>=12&&bytes.toString('latin1',0,4)==='RIFF'&&bytes.toString('latin1',8,12)==='WEBP'?'webp'
  :bytes.length>=8&&bytes.readUInt32BE(0)===0x89504e47?'png'
  :bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'jpeg':null;
 if(!format)throw new Error('Unsupported image bytes.');
 return {bytes,format,contentType:formats[format]};
}
export const isBlobUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname.endsWith(BLOB_HOST_SUFFIX)&&!u.search&&!u.hash;}catch{return false;}};
// `putImpl`/`delImpl` default to the Vercel SDK; tests inject fakes. Pass `token:null`
// (or leave the environment unset) to get null, which means "not configured".
export function createBlobStore({token=process.env.BLOB_READ_WRITE_TOKEN,putImpl,delImpl,listImpl,random=()=>randomBytes(12).toString('hex')}={}){
 if(typeof token!=='string'||!token.trim())return null;
 const sdk=async()=>await import('@vercel/blob');
 const put=putImpl??(async(pathname,body,options)=>(await sdk()).put(pathname,body,options));
 const del=delImpl??(async urls=>(await sdk()).del(urls));
 const list=listImpl??(async options=>(await sdk()).list(options));
 const prefix=owner=>`images/${ownerHash(owner)}/`;
 return {
  configured:true,
  // True when this URL is a blob that `owner` may reference: our host, their prefix.
  owns(url,owner){
   if(!isBlobUrl(url))return false;
   return new URL(url).pathname.startsWith('/'+prefix(owner));
  },
  // Stores one decoded image for an owner and returns its public URL.
  async putImage({owner,bytes,format,contentType}){
   const pathname=`${prefix(owner)}${random()}.${format}`;
   const result=await put(pathname,bytes,{access:'public',token,contentType,addRandomSuffix:false,cacheControlMaxAge:31536000});
   if(!isBlobUrl(result?.url))throw new Error('Blob storage returned no URL.');
   return result.url;
  },
  // Best effort: a failed delete leaves an orphan, never a failed request.
  async remove(urls){
   const list=[...new Set(urls)].filter(isBlobUrl);
   if(!list.length)return 0;
   try{await del(list);return list.length;}catch{return 0;}
  },
  async list(options){return list({...options,token});},
 };
}
// Every blob URL a saved record references; used when it is deleted or its images change.
export function recordImageUrls(record){
 const urls=[];
 if(record?.cover)urls.push(record.cover);
 if(record?.sketch)urls.push(record.sketch);
 for(const url of Object.values(record?.illustrations??{}))urls.push(url);
 return urls.filter(isBlobUrl);
}
