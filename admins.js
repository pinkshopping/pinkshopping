import {db,esc,msg,session} from './common.js';
const $=id=>document.getElementById(id);
let currentUser=null;
async function guard(){
  const u=await session(); currentUser=u;
  let ok=false;
  if(u){const {data,error}=await db.from('admins').select('user_id').eq('user_id',u.id).maybeSingle();ok=!error&&!!data;}
  $('gate').classList.toggle('hidden',ok);
  $('dashboard').classList.toggle('hidden',!ok);
  if(u&&!ok)msg('บัญชีนี้ไม่มีสิทธิ์หลังร้าน',true);
  if(ok){$('who').textContent=u.email;await loadAdmins();}
}
$('login').onclick=async()=>{
 const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 if(error)msg(error.message,true);else{msg('');await guard();}
};
$('logout').onclick=async()=>{await db.auth.signOut();location.reload();};
async function loadAdmins(){
 const {data,error}=await db.rpc('admin_list_accounts');
 if(error){$('admin-list').textContent='ยังโหลดรายชื่อไม่ได้: '+error.message;return;}
 const rows=data||[];
 $('admin-list').innerHTML='<table class="stock-table"><thead><tr><th>อีเมล</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>'+rows.map(a=>
 `<tr><td>${esc(a.email||'ไม่ระบุอีเมล')}</td><td>${a.user_id===currentUser.id?'บัญชีของคุณ':'แอดมิน'}</td><td>${a.user_id===currentUser.id?'<span class="muted">ไม่สามารถลบตัวเอง</span>':`<button type="button" class="secondary" data-remove-admin="${esc(a.user_id)}" data-email="${esc(a.email)}">ถอนสิทธิ์</button>`}</td></tr>`).join('')+'</tbody></table>';
}
$('reload-admins').onclick=loadAdmins;
$('add-admin-form').onsubmit=async e=>{
 e.preventDefault();
 const email=$('new-admin-email').value.trim().toLowerCase();
 if(!email)return;
 if(!confirm('ให้บัญชี '+email+' มีสิทธิ์จัดการหลังร้านทั้งหมด รวมถึงเพิ่มและถอนสิทธิ์แอดมิน ใช่หรือไม่?'))return;
 const {error}=await db.rpc('admin_add_by_email',{p_email:email});
 if(error)return msg('เพิ่มแอดมินไม่สำเร็จ: '+error.message,true);
 $('new-admin-email').value='';msg('เพิ่มแอดมินเรียบร้อย');await loadAdmins();
};
$('admin-list').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-remove-admin]');if(!btn)return;
 if(!confirm('ถอนสิทธิ์หลังร้านของ '+btn.dataset.email+' ใช่หรือไม่?'))return;
 const {error}=await db.rpc('admin_remove_account',{p_user_id:btn.dataset.removeAdmin});
 if(error)return msg('ถอนสิทธิ์ไม่สำเร็จ: '+error.message,true);
 msg('ถอนสิทธิ์หลังร้านแล้ว (ไม่ได้ลบบัญชีเข้าสู่ระบบ)');await loadAdmins();
});
await guard();
