import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { assertSameOrigin,requestOrigin,RequestError } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { failure,json } from '@/lib/server/http';
export const runtime='nodejs';
export async function POST(request:Request){try{
 assertSameOrigin(request.headers,requestOrigin(request.url));
 const length=Number(request.headers.get('content-length'));
 if(!Number.isFinite(length)||length<=0||length>4_000_000)throw new RequestError('Upload one image smaller than 3 MB.',413);
 const {db,user}=await requireUser();const form=await request.formData();const file=form.get('file');
 if(!(file instanceof File)||file.size>3_000_000||file.size===0)throw new RequestError('Upload a JPG, PNG or WebP smaller than 3 MB.');
 const input=Buffer.from(await file.arrayBuffer());const image=sharp(input,{limitInputPixels:40_000_000});const meta=await image.metadata();
 if(!['jpeg','png','webp'].includes(meta.format||'')||meta.pages&&meta.pages>1)throw new RequestError('Only still JPG, PNG and WebP photographs are supported.');
 const bytes=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
 const path=`${user.id}/${randomUUID()}.webp`;
 const {error}=await db.storage.from('listing-media').upload(path,bytes,{contentType:'image/webp',upsert:false});
 if(error)throw new RequestError('Photo storage is unavailable. Check the storage setup.',503);
 return json({data:{url:db.storage.from('listing-media').getPublicUrl(path).data.publicUrl}});
}catch(e){return failure(e);}}
