import type { Match } from '../../../src/lib/domain';
import type { Page } from '@playwright/test';
export async function mockAccount(page: Page) {
  const id='11111111-1111-4111-8111-111111111111';
  const state={
    user:{id,email:'diego@example.test',new_email:undefined as string|undefined,aud:'authenticated',role:'authenticated',created_at:'2026-01-01T10:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'Diego Test'}},
    matches:[] as Match[],password:'CurrentPassword123!',updates:[] as Record<string,string>[],profileReads:0,recoveries:[] as {email:string;redirect:string|null}[],updateError:null as string|null,
  };
  const token=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,email:state.user.email,role:'authenticated',aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url'),'test-signature'].join('.');
  const session=()=>({access_token:token(),refresh_token:'test-refresh-token',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user:state.user});
  await page.route('**/auth/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),body=req.method()==='GET'?null:req.postDataJSON();
    const json=(value:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if(url.pathname.endsWith('/token')) {
      if(body.grant_type==='refresh_token'||url.searchParams.get('grant_type')==='refresh_token')return json(session());
      if(body.email!==state.user.email||body.password!==state.password)return json({code:'invalid_credentials',msg:'Invalid login credentials'},400);
      return json(session());
    }
    if(url.pathname.endsWith('/user')&&req.method()==='GET')return json(state.user);
    if(url.pathname.endsWith('/user')&&req.method()==='PUT'){
      state.updates.push(body);
      if(state.updateError)return json({code:state.updateError,msg:'The email is already in use'},422);
      if(body.email)state.user.new_email=body.email;
      if(body.password)state.password=body.password;
      return json(state.user);
    }
    if(url.pathname.endsWith('/recover')){state.recoveries.push({email:body.email,redirect:url.searchParams.get('redirect_to')});return json({});}
    if(url.pathname.endsWith('/logout'))return json({});
    return json({msg:'Unexpected test endpoint'},400);
  });
  await page.route('**/rest/v1/**',async route=>{
    const url=new URL(route.request().url());let data:unknown=[];
    if(url.pathname.endsWith('/matches'))data=state.matches;
    if(url.pathname.endsWith('/profiles')){state.profileReads++;data=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth_user_id:id,full_name:'Diego Test',preferred_role:'attack',banner_color:'blue',avatar_path:null},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',auth_user_id:'22222222-2222-4222-8222-222222222222',full_name:'Altro Giocatore',preferred_role:'defense',banner_color:'mint',avatar_path:null}];}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  return {state,session,recoveryPath:()=>`/?recovery=1#access_token=${token()}&refresh_token=test-refresh-token&token_type=bearer&expires_in=7200&expires_at=${Math.floor(Date.now()/1000)+7200}&type=recovery`,async login(){await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(state.user.email);await page.getByLabel('Password',{exact:true}).fill(state.password);await page.getByRole('button',{name:'Entra nel club',exact:true}).click();await page.getByRole('heading',{name:'Chi comanda al tavolo?'}).waitFor();}};
}
