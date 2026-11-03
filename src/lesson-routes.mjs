import {judgeError,judgeOwner} from './judge-access.mjs';
import {RequestError} from './request-error.mjs';
import {publicCover} from './lesson-covers.mjs';
import {buildSavedLesson,attachImages,lessonSummary,publicLesson,sharedLesson,validLessonId,MAX_SAVED_PER_OWNER,MAX_SHARED_LISTED} from './lessons.mjs';
import {recordImageUrls} from './blob.mjs';
// Saved and shared lessons. The server registers the public shared routes before its
// sign-in gate and the creator routes after it; both share its reply and tracking helpers.
export function registerSharedRoutes(app,{state,reply,tracked,ownerOf,isAdmin=()=>false}){
  // The signed-in creator's own entries carry mine:true; the owner itself is never sent.
  const mine=(res,record)=>Boolean(res.locals.tester&&ownerOf&&record.owner===ownerOf(res.locals.tester));
  const withMine=(res,record,shape)=>({...shape,...(mine(res,record)?{mine:true}:{}),...(isAdmin(res.locals.tester)?{canManage:true}:{})});
  // Creator-drawn library covers for reviewed lessons, public like the gallery; never who drew them.
  app.get('/api/covers', tracked(async (req,res) => reply(res,200,{covers:Object.fromEntries(Object.entries(await state.getCovers()).map(([id,c])=>[id,publicCover(c)]))})));
  // Shared lessons open without signing in, like the gallery. Ids are unguessable.
  app.get('/api/shared', tracked(async (req,res) => {
    const cursor=req.query.cursor??'0';
    if(typeof cursor!=='string'||!/^(0|[1-9]\d{0,8})$/.test(cursor))throw new RequestError(400,'Use a valid shared lesson cursor.');
    const offset=Number(cursor), page=await state.listSharedPage(MAX_SHARED_LISTED,offset);
    reply(res,200,{lessons:page.lessons.map(r=>withMine(res,r,lessonSummary(r))),cursor:page.hasMore?String(offset+MAX_SHARED_LISTED):null});
  }));
  app.get('/api/shared/:id', tracked(async (req,res) => {
    const record=validLessonId(req.params.id)?await state.getLesson(req.params.id):null;
    if(!record||record.shared!==true)return reply(res,404,{error:'This shared lesson is not available.'});
    reply(res,200,withMine(res,record,sharedLesson(record)));
  }));
}
export function registerLessonRoutes(app,{state,access,imageStore,ownerOf,isAdmin=()=>false,beforeWrite=async()=>{},reply,tracked,requireOrigin,parseBody}){
  const permissions=(tester,record)=>({...lessonSummary(record),...(record.owner===ownerOf(tester)?{mine:true}:{}),...(isAdmin(tester)?{canManage:true}:{})});
  app.get('/api/lessons', tracked(async (req,res) => {
    const tester=res.locals.tester;
    if(!isAdmin(tester))return reply(res,200,{lessons:(await state.listLessons(ownerOf(tester))).map(lessonSummary),limit:MAX_SAVED_PER_OWNER});
    const cursor=req.query.cursor??'0';
    if(typeof cursor!=='string'||!/^\d{1,20}$/.test(cursor)||BigInt(cursor)>18446744073709551615n)throw new RequestError(400,'Use a valid lesson cursor.');
    const page=await state.listAllLessons(cursor);
    reply(res,200,{lessons:page.lessons.map(r=>permissions(tester,r)),limit:null,scope:'all',cursor:page.cursor});
  }));
  app.get('/api/lessons/:id', tracked(async (req,res) => {
    const record=validLessonId(req.params.id)?await state.getLesson(req.params.id):null;
    if(!record||(!isAdmin(res.locals.tester)&&record.owner!==ownerOf(res.locals.tester)))return reply(res,404,{error:'Saved lesson not found.'});
    reply(res,200,{...publicLesson(record),...permissions(res.locals.tester,record)});
  }));
  app.post(['/api/lessons','/api/lessons/share','/api/lessons/delete'], requireOrigin, parseBody, tracked(async (req,res) => {
    const owner=ownerOf(res.locals.tester),body=req.body;
    if(!await access.active(res.locals.tester.id))return reply(res,401,{error:'Sign in to tester access.',code:'TESTER_REQUIRED'});
    const editable=async({ownerOnly=false}={})=>{const record=validLessonId(body.id)?await state.getLesson(body.id):null;if(!record||(record.owner!==owner&&(ownerOnly||!isAdmin(res.locals.tester))))throw new RequestError(404,'Saved lesson not found.');return record;};
    if(req.path==='/api/lessons/delete'){const record=await editable();if(!await state.deleteLesson(record.owner,body.id,record))throw new RequestError(409,'This lesson changed or was deleted. Reopen it before deleting.');await imageStore?.remove(recordImageUrls(record));return reply(res,200,{deleted:true,id:body.id});}
    await beforeWrite(res.locals.tester);
    if(req.path==='/api/lessons/share'){
      if(typeof body.shared!=='boolean')throw new RequestError(400,'Use a boolean shared flag.');
      const previous=await editable({ownerOnly:true});
      const record={...previous,shared:body.shared,updatedAt:Date.now()};
      if(!await state.putLesson(record,MAX_SAVED_PER_OWNER,previous))throw new RequestError(409,'Could not update this lesson.');
      return reply(res,200,lessonSummary(record));
    }
    const previous=body.id!==undefined?await editable():null;
    const recordOwner=previous?.owner??owner,adminEdit=recordOwner!==owner;
    let record;try{record=buildSavedLesson(body,{owner:recordOwner,previous});}catch{throw new RequestError(400,'Save a valid bilingual lesson, with optional show script, tryout report and grades.');}
    // An administrator's save is not a review by the original creator.
    if(adminEdit)record.reviewedAt=null;
    // Images: kept when already stored under this creator, uploaded from data URLs when
    // Blob storage exists, dropped otherwise. Uploads happen before the cap check, so a
    // refused save removes what it uploaded.
    const uploaded=[];
    let stale;try{stale=await attachImages(record,body,{store:imageStore,owner:recordOwner,previous,uploaded});}catch{await imageStore?.remove(uploaded);throw new RequestError(400,'Images must be the show cover, slide illustrations or the source sketch, each under 1.5 MB.');}
    if(!await state.putLesson(record,MAX_SAVED_PER_OWNER,previous)){
      await imageStore?.remove(uploaded);
      if(!previous&&judgeOwner(recordOwner))throw judgeError('JUDGE_SAVED_LIMIT');
      throw new RequestError(409,previous?'This lesson changed or was deleted while saving. Your draft is still available; reopen the saved lesson before updating it.':`You can keep up to ${MAX_SAVED_PER_OWNER} saved lessons. Delete one to save another.`);
    }
    await imageStore?.remove(stale);
    reply(res,200,{...permissions(res.locals.tester,record),illustrations:record.illustrations??{}});
  }));
}
