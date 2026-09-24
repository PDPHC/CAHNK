import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origins = new Set(["https://pdphc.github.io", "http://localhost:8080"]);
export async function handleRequest(req) {
  const origin = req.headers.get("origin");
  const headers = {"Access-Control-Allow-Origin": origins.has(origin) ? origin : "https://pdphc.github.io", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json; charset=utf-8", "Vary":"Origin"};
  const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers});
  if(req.method === "OPTIONS") return new Response("ok", {headers});
  if(req.method !== "POST") return json({error:"Method not allowed"},405);
  if(origin && !origins.has(origin)) return json({error:"Forbidden origin"},403);
  const authorization = req.headers.get("Authorization") || "";
  if(!/^Bearer\s+\S+$/i.test(authorization)) return json({error:"Unauthorized"},401);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const pub = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default || Deno.env.get("SUPABASE_ANON_KEY");
    const sec = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url || !pub || !sec) return json({error:"Server auth keys unavailable"},500);
    const caller = createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
    const {data:{user},error:authError} = await caller.auth.getUser(authorization.replace(/^Bearer\s+/i,""));
    if(authError || !user) return json({error:"Unauthorized"},401);
    const {data:profile,error:profileError} = await caller.from("profiles").select("role").eq("id",user.id).single();
    if(profileError || profile?.role !== "admin") return json({error:"เฉพาะ Admin เท่านั้นที่ลบบัญชีได้"},403);
    let body;try{body=await req.json()}catch(_){return json({error:"Invalid JSON"},400)}
    const id = body?.user_id;
    if(typeof id!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({error:"Invalid user ID"},400);
    if(id.toLowerCase()===user.id.toLowerCase()) return json({error:"ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่"},400);
    const admin = createClient(url,sec,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error} = await admin.auth.admin.deleteUser(id);
    if(error) return json({error:"ลบบัญชีไม่สำเร็จ บัญชีอาจไม่มีอยู่หรือมีข้อมูลที่ระบบยังลบไม่ได้"},400);
    return json({ok:true});
  } catch (_) { return json({error:"ระบบไม่สามารถลบบัญชีได้ในขณะนี้ กรุณาลองใหม่"},500); }
}
Deno.serve(handleRequest);
