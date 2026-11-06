import {db,money,esc,msg,session} from './common.js';
const $=id=>document.getElementById(id);
let products=[];
async function guard(){const u=await session();let ok=false;if(u){const {data}=await db.from('admins').select('user_id').eq('user_id',u.id).maybeSingle();ok=!!data;}$('gate').classList.toggle('hidden',ok);$('dashboard').classList.toggle('hidden',!ok);if(u&&!ok)msg('บัญชีนี้ไม่มีสิทธิ์หลังร้าน',true);if(ok){$('who').textContent=u.email;await refresh();}}
$('login').onclick=async()=>{const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)msg(error.message,true);else{msg('');await guard();
setInterval(()=>{if(!document.hidden&&document.getElementById('dashboard')&&!document.getElementById('dashboard').classList.contains('hidden'))refresh();},30000);}};
$('logout').onclick=async()=>{await db.auth.signOut();location.reload();};
async function refresh(){const {data,error}=await db.from('products').select('id,name,image_url');if(error)return msg('โหลดข้อมูลสินค้าไม่สำเร็จ: '+error.message,true);products=data||[];await loadOrders();}
let activeOrderTab='pending';
const orderStages=['pending','confirmed','shipped','completed','cancelled'];
const stageLabels={pending:'คำสั่งซื้อใหม่',confirmed:'แพ็คแล้วรอส่ง',shipped:'กำลังจัดส่ง',completed:'จัดส่งเสร็จแล้ว',cancelled:'ยกเลิกแล้ว'};
let currentOrders=[];
function orderImage(item){const variant=orderVariants.find(v=>v.id===item.variant_id);const product=products.find(p=>p.id===item.product_id);return variant?.image_url||product?.image_url||'';}
let orderVariants=[];
function renderOrders(){
 const orders=currentOrders.filter(o=>o.status===activeOrderTab);
 document.querySelectorAll('[data-order-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.orderTab===activeOrderTab);b.setAttribute('aria-pressed',String(b.dataset.orderTab===activeOrderTab));});
 orderStages.forEach(s=>{const el=document.querySelector(`[data-order-count="${s}"]`);if(el)el.textContent=currentOrders.filter(o=>o.status===s).length;});
 $('orders').innerHTML=orders.map(o=>`<article class="order-card"><div class="order-card-head"><div><strong>ออเดอร์ #${esc(o.id)}</strong><small>${o.created_at?new Date(o.created_at).toLocaleString('th-TH'):''}</small></div><div><span class="order-stage">${stageLabels[o.status]||esc(o.status)}</span><b class="order-total">฿${money(o.total_price)}</b></div></div><div class="order-recipient"><b>ผู้รับ: ${esc(o.customer_name)}</b><div>โทร: ${esc(o.customer_phone)}</div><div>ที่อยู่: ${esc(o.customer_address)}</div></div><div class="packing-title">วิธีชำระเงิน: ${o.payment_method==='cod'?'เก็บเงินปลายทาง':'QR SCB'} • สถานะ: ${esc(o.payment_status||'pending')} ${o.slip_signed_url?`<a href="${esc(o.slip_signed_url)}" target="_blank" rel="noopener">เปิดดูสลิปที่ลูกค้าส่ง</a>`:o.payment_slip_url?'<small>มีไฟล์สลิป แต่ยังเปิดดูไม่ได้</small>':''}</div><div class="packing-title">รายการสินค้าที่ต้องแพ็ค (${(o.order_items||[]).reduce((n,i)=>n+Number(i.quantity||0),0)} ชิ้น)</div><div class="packing-items">${(o.order_items||[]).map(i=>{const img=orderImage(i);return `<div class="packing-item"><div class="packing-thumb">${img?`<img src="${esc(img)}" alt="รูปสินค้าที่สั่ง" loading="lazy" onerror="this.style.display='none';this.parentElement.textContent='ไม่มีรูป'">`:'ไม่มีรูป'}</div><div class="packing-info"><strong>${esc(i.product_name)}</strong>${i.variant_label?`<small>${esc(i.variant_label)}</small>`:''}<small>ราคาต่อชิ้น ฿${money(i.unit_price)}</small></div><b class="packing-qty">× ${Number(i.quantity)||0}</b></div>`;}).join('')}</div><div class="order-actions">${o.status==='pending'?`<button type="button" data-advance="${o.id}" data-next="confirmed">✓ แพ็คแล้ว / รอส่ง</button>`:''}${o.status==='confirmed'?`<button type="button" data-advance="${o.id}" data-next="shipped">🚚 ส่งให้ขนส่งแล้ว</button>`:''}${o.status==='shipped'?`<button type="button" data-advance="${o.id}" data-next="completed">✓ ยืนยันจัดส่งเสร็จ</button>`:''}${!['completed','cancelled'].includes(o.status)?`<button type="button" class="secondary" data-cancel-order="${o.id}">ยกเลิกออเดอร์</button>`:''}<button type="button" class="secondary" data-print="${o.id}">พิมพ์ใบปะหน้าร้าน</button></div></article>`).join('')||'<div class="order-empty">ไม่มีออเดอร์ในหมวดนี้</div>';
}
async function loadOrders(){
 const {data,error}=await db.from('orders').select('id,customer_name,customer_phone,customer_address,total_price,status,created_at,payment_method,payment_status,payment_slip_url,order_items(product_id,variant_id,variant_label,quantity,unit_price,product_name)').order('created_at',{ascending:false}).limit(200);
 if(error)return msg('โหลดออเดอร์ไม่สำเร็จ: '+error.message,true);
 currentOrders=data||[];window.currentOrders=currentOrders;
 for(const order of currentOrders){if(order.payment_slip_url){const signed=await db.storage.from('payment-slips').createSignedUrl(order.payment_slip_url,3600);if(!signed.error)order.slip_signed_url=signed.data.signedUrl;}}
 renderOrders();
}
document.addEventListener('click',e=>{const tab=e.target.closest('[data-order-tab]');if(tab){activeOrderTab=tab.dataset.orderTab;renderOrders();}});
document.addEventListener('click',async e=>{
 const advance=e.target.closest('[data-advance]'),cancel=e.target.closest('[data-cancel-order]');if(!advance&&!cancel)return;
 const btn=advance||cancel,id=btn.dataset.advance||btn.dataset.cancelOrder;
 const order=currentOrders.find(o=>String(o.id)===String(id));if(!order)return;
 if(cancel){if(order.status==='cancelled'||order.status==='completed')return;
   if(!confirm(`ยกเลิกออเดอร์ #${id} และคืนสต็อกทั้งหมด?`))return;
   btn.disabled=true;try{const {error}=await db.rpc('cancel_order_and_restock',{p_order_id:Number(id)});if(error)throw error;msg('ยกเลิกออเดอร์และคืนสต็อกแล้ว');await refresh();}catch(err){msg('ยกเลิกไม่สำเร็จ: '+err.message,true);}finally{btn.disabled=false;}return;
 }
 const next=advance.dataset.next;
 if(!({pending:'confirmed',confirmed:'shipped',shipped:'completed'}[order.status]===next))return msg('สถานะไม่ถูกต้อง กรุณาโหลดใหม่',true);
 if(!confirm(`ยืนยันเปลี่ยนออเดอร์ #${id} เป็น “${stageLabels[next]}” ?`))return;
 btn.disabled=true;try{const {data,error}=await db.from('orders').update({status:next}).eq('id',id).eq('status',order.status).select('id');if(error)throw error;if(!data?.length)throw new Error('สถานะถูกเปลี่ยนจากอุปกรณ์อื่น กรุณารีเฟรช');msg('อัปเดตสถานะแล้ว');activeOrderTab=next;await loadOrders();}catch(err){msg('เปลี่ยนสถานะไม่สำเร็จ: '+err.message,true);}finally{btn.disabled=false;}
});
document.addEventListener('click',e=>{let id=e.target.dataset.print;if(!id)return;let o=window.currentOrders.find(x=>String(x.id)===id);if(!o)return;let w=window.open('','_blank');if(!w)return msg('โปรดอนุญาต pop-up เพื่อพิมพ์',true);w.document.write(`<html><head><meta charset="utf-8"><title>ใบปะหน้า #${o.id}</title><style>@page{size:100mm 150mm;margin:7mm}body{font-family:Arial,sans-serif;font-size:14px}h2{color:#be185d}hr{border:1px solid #ddd}</style></head><body><h2>PINK SHOPPING</h2><p>ผู้ส่ง: Pink Shopping (กรอกข้อมูลผู้ส่งจริงก่อนจัดส่ง)</p><hr><b>ผู้รับ: ${esc(o.customer_name)}</b><p>โทร: ${esc(o.customer_phone)}</p><p style="white-space:pre-wrap">${esc(o.customer_address)}</p><hr><p>คำสั่งซื้อ #${o.id}</p><p>${o.order_items.map(i=>esc(i.product_name)+' × '+i.quantity).join('<br>')}</p><p>ยอดรวม ฿${money(o.total_price)}</p><p>ไม่ใช่ใบปะหน้าขนส่งอย่างเป็นทางการ</p></body></html>`);w.document.close();w.focus();w.print();});

await guard();
setInterval(()=>{if(!document.hidden&&document.getElementById('dashboard')&&!document.getElementById('dashboard').classList.contains('hidden'))refresh();},30000);
