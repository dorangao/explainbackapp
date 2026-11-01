import {RequestError} from './request-error.mjs';
import {publicCover} from './lesson-covers.mjs';
import {buildSavedLesson,attachImages,lessonSummary,publicLesson,validLessonId,MAX_SAVED_PER_OWNER,MAX_SHARED_LISTED} from './lessons.mjs';
import {recordImageUrls} from './blob.mjs';
// Saved and shared lessons. The server registers the public shared routes before its
// sign-in gate and the creator routes after it; both share its reply and tracking helpers.
export function registerSharedRoutes(app,{state,reply,tracked}){
  // Creator-drawn library covers for reviewed lessons, public like the gallery; never who drew them.
  app.get('/api/covers', tracked(async (req,res) => reply(res,200,{covers:Object.fromEntries(Object.entries(await state.getCovers()).map(([id,c])=>[id,publicCover(c)]))})));
  // Shared lessons open without signing in, like the gallery. Ids are unguessable.
  app.get('/api/shared', tracked(async (req,res) => reply(res,200,{lessons:(await state.listSharedLessons(MAX_SHARED_LISTED)).map(lessonSummary)})));
  app.get('/api/shared/:id', tracked(async (req,res) => {
    const record=validLessonId(req.params.id)?await state.getLesson(req.params.id):null;
    if(!record||record.shared!==true)return reply(res,404,{error:'This shared lesson is not available.'});
    reply(res,200,publicLesson(record));
  }));
}
export function registerLessonRoutes(app,{state,access,imageStore,ownerOf,reply,tracked,requireOrigin,parseBody}){
  app.get('/api/lessons', tracked(async (req,res) => reply(res,200,{lessons:(await state.listLessons(ownerOf(res.locals.tester))).map(lessonSummary),limit:MAX_SAVED_PER_OWNER})));
  app.get('/api/lessons/:id', tracked(async (req,res) => {
    const record=validLessonId(req.params.id)?await state.getLesson(req.params.id):null;
    if(!record||record.owner!==ownerOf(res.locals.tester))return reply(res,404,{error:'Saved lesson not found.'});
    reply(res,200,publicLesson(record));
  }));
  app.post(['/api/lessons','/api/lessons/share','/api/lessons/delete'], requireOrigin, parseBody, tracked(async (req,res) => {
    const owner=ownerOf(res.locals.tester),body=req.body;
    if(!await access.active(res.locals.tester.id))return reply(res,401,{error:'Sign in to tester access.',code:'TESTER_REQUIRED'});
    const own=async()=>{const record=validLessonId(body.id)?await state.getLesson(body.id):null;if(!record||record.owner!==owner)throw new RequestError(404,'Saved lesson not found.');return record;};
    if(req.path==='/api/lessons/delete'){const record=await own();await state.deleteLesson(owner,body.id);await imageStore?.remove(recordImageUrls(record));return reply(res,200,{deleted:true,id:body.id});}
    if(req.path==='/api/lessons/share'){
      if(typeof body.shared!=='boolean')throw new RequestError(400,'Use a boolean shared flag.');
      const record={...await own(),shared:body.shared,updatedAt:Date.now()};
      if(!await state.putLesson(record,MAX_SAVED_PER_OWNER))throw new RequestError(409,'Could not update this lesson.');
      return reply(res,200,lessonSummary(record));
    }
    const previous=body.id!==undefined?await own():null;
    let record;try{record=buildSavedLesson(body,{owner,previous});}catch{throw new RequestError(400,'Save a valid bilingual lesson, with optional show script, tryout report and grades.');}
    // Images: kept when already stored under this creator, uploaded from data URLs when
    // Blob storage exists, dropped otherwise. Uploads happen before the cap check, so a
    // refused save removes what it uploaded.
    let stale;try{stale=await attachImages(record,body,{store:imageStore,owner,previous});}catch{throw new RequestError(400,'Images must be the show cover, slide illustrations or the source sketch, each under 1.5 MB.');}
    if(!await state.putLesson(record,MAX_SAVED_PER_OWNER)){await imageStore?.remove(recordImageUrls(record).filter(url=>!recordImageUrls(previous).includes(url)));throw new RequestError(409,`You can keep up to ${MAX_SAVED_PER_OWNER} saved lessons. Delete one to save another.`);}
    await imageStore?.remove(stale);
    reply(res,200,lessonSummary(record));
  }));
}
