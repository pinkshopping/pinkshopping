import {db,money,esc,msg,session} from './common.js';
const $=id=>document.getElementById(id);let products=[],editingProduct=null;
async function guard(){let u=await session();let ok=false;if(u){const {data}=await db.from('admins').select('user_id').eq('user_id',u.id).maybeSingle();ok=!!data;}$('gate').classList.toggle('hidden',ok);$('dashboard').classList.toggle('hidden',!ok);if(u&&!ok)msg('บัญชีนี้ไม่มีสิทธิ์หลังร้าน',true);if(ok){$('who').textContent=u.email;await refresh();}}
$('login').onclick=async()=>{let {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)msg(error.message,true);else{msg('');await guard();}};
$('logout').onclick=async()=>{await db.auth.signOut();location.reload();};
function clear(){for(let id of ['pid','name','price','stock','image'])$(id).value='';$('active').checked=true;editingProduct=null;$('variant-editor').classList.add('hidden');$('variant-product').textContent='ยังไม่ได้เลือกสินค้า';}$('clear').onclick=clear;
$('save').onclick=async()=>{let p={name:$('name').value.trim(),price:Number($('price').value),stock:Number($('stock').value),image_url:$('image').value.trim()||null,is_active:$('active').checked};if(!p.name||!$('price').value||!$('stock').value||p.price<0||!Number.isInteger(p.stock)||p.stock<0)return msg('กรุณากรอกข้อมูลให้ถูกต้อง',true);let id=$('pid').value;let result=id?await db.from('products').update(p).eq('id',id):await db.from('products').insert(p);if(result.error)return msg(result.error.message,true);msg('บันทึกสินค้าแล้ว');clear();await refresh();};
async function refresh(){let a=await db.from('products').select('*').order('created_at',{ascending:false});if(a.error)return msg(a.error.message,true);products=a.data||[];$('products').innerHTML='<table class="stock-table"><thead><tr><th>รูปสินค้า</th><th>ชื่อสินค้า</th><th>ราคา</th><th>สต็อก</th><th>จัดการ</th></tr></thead><tbody>'+products.map(p=>`<tr><td><div class="stock-thumb">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="stock-no-image" hidden>ไม่มีรูป</span>`:'<span class="stock-no-image">ไม่มีรูป</span>'}</div></td><td class="stock-name">${esc(p.name)}${!p.is_active?'<small>ปิดการขาย</small>':''}</td><td>฿${money(p.price)}</td><td><strong>${Number(p.stock)||0}</strong> ชิ้น</td><td><button type="button" data-edit="${p.id}">แก้ไข</button></td></tr>`).join('')+'</tbody></table>';}
document.addEventListener('click',e=>{let id=e.target.dataset.edit;if(!id)return;let p=products.find(x=>x.id===id);if(!p)return;$('pid').value=p.id;$('name').value=p.name;$('price').value=p.price;$('stock').value=p.stock;$('image').value=p.image_url||'';$('active').checked=p.is_active;editingProduct=p.id;$('variant-product').textContent='กำลังแก้ไขตัวเลือกของ: '+p.name;$('variant-editor').classList.remove('hidden');loadVariants();window.scrollTo(0,0);});
await guard();

// V4: Import snapshot from owner's Shopee export, never auto-sync stock.
let shopeeImportRows=[];
$('preview-shopee').onclick=async()=>{
 const el=$('shopee-import-status');
 try {
  const res=await fetch('./shopee_products.json',{cache:'no-store'});
  if(!res.ok)throw new Error('ไม่พบไฟล์ shopee_products.json');
  const rows=await res.json();
  if(!Array.isArray(rows)||!rows.length||rows.some(p=>!p.shopee_key||!p.name||!p.shopee_url||!Number.isFinite(p.price)||!Number.isInteger(p.stock)))throw new Error('ข้อมูลสินค้าไม่ครบ');
  shopeeImportRows=rows;
  el.textContent=`พร้อมนำเข้า ${rows.length} รายการ (รวมตัวเลือกสินค้า) การนำเข้าจะเพิ่ม/อัปเดตรายการ Shopee ที่มีรหัสตรงกันเท่านั้น และจะไม่ลบสินค้าเดิม สต็อกไม่ซิงก์กับ Shopee อัตโนมัติ`;
  $('import-shopee').disabled=false;
 }catch(e){el.textContent='ตรวจสอบไม่สำเร็จ: '+e.message;$('import-shopee').disabled=true;}
};
$('import-shopee').onclick=async()=>{
 if(!shopeeImportRows.length)return;
 if(!confirm(`นำเข้า/อัปเดต ${shopeeImportRows.length} รายการจากไฟล์ Shopee? ข้อมูลราคาและสต็อกจะเป็นค่าจากวันที่ส่งออกไฟล์ และจะไม่ซิงก์อัตโนมัติ`))return;
 const btn=$('import-shopee'),el=$('shopee-import-status');btn.disabled=true;
 let done=0;
 try{
  const u=await session();if(!u)throw new Error('กรุณาเข้าสู่ระบบแอดมิน');
  const {data:admin,error:ae}=await db.from('admins').select('user_id').eq('user_id',u.id).maybeSingle();
  if(ae||!admin)throw new Error('บัญชีไม่มีสิทธิ์นำเข้าสินค้า');
  for(let i=0;i<shopeeImportRows.length;i+=20){
   const batch=shopeeImportRows.slice(i,i+20).map(({active,...p})=>({...p,is_active:active!==false}));
   const {error}=await db.from('products').upsert(batch,{onConflict:'shopee_key'});
   if(error)throw error;done+=batch.length;el.textContent=`นำเข้าแล้ว ${done}/${shopeeImportRows.length} รายการ`;
  }
  el.textContent=`นำเข้าสำเร็จ ${done} รายการ กรุณาตรวจสอบราคากับสต็อกก่อนเปิดขาย`;
  await refresh();
 }catch(e){el.textContent=`หยุดที่ ${done} รายการ: ${e.message} (แก้ไขแล้วสามารถกดนำเข้าอีกครั้งได้โดยไม่สร้างรายการซ้ำ)`;}
 finally{btn.disabled=false;}
};

// V6 variant management. Variant changes are handled by admin-only database RPCs.
let currentVariants=[];
function clearVariant(){for(const id of ['vid','vcolor','vsize','vformula','vpack','vprice','vstock','vimage'])$(id).value='';}
$('clear-variant').onclick=clearVariant;
async function loadVariants(){if(!editingProduct)return;const {data,error}=await db.from('product_variants').select('*').eq('product_id',editingProduct).order('created_at');if(error)return msg(error.message,true);currentVariants=data||[];$('variant-list').innerHTML='<h3>ตัวเลือกที่มี</h3>'+currentVariants.map(v=>`<p>${esc([v.color,v.size,v.formula,v.pack].filter(Boolean).join(' / '))} — ฿${money(v.price)} — ${v.stock} ชิ้น <button type="button" data-edit-variant="${v.id}">แก้ไข</button> <button type="button" data-disable-variant="${v.id}">${v.active?'ปิดการขาย':'เปิดการขาย'}</button></p>`).join('')||'ยังไม่มีตัวเลือก';}
$('save-variant').onclick=async()=>{if(!editingProduct)return msg('กรุณาเลือกสินค้า',true);const price=$('vprice').value,stock=$('vstock').value;const payload={p_variant_id:$('vid').value||null,p_product_id:editingProduct,p_color:$('vcolor').value.trim(),p_size:$('vsize').value.trim(),p_formula:$('vformula').value.trim(),p_pack:$('vpack').value.trim(),p_price:Number(price),p_stock:Number(stock),p_image_url:$('vimage').value.trim()||null};if(![payload.p_color,payload.p_size,payload.p_formula,payload.p_pack].some(Boolean))return msg('ต้องมีอย่างน้อยหนึ่งตัวเลือก',true);if(!price||!stock||!Number.isFinite(payload.p_price)||payload.p_price<0||!Number.isInteger(payload.p_stock)||payload.p_stock<0)return msg('กรุณากรอกราคาและสต็อกให้ถูกต้อง',true);const row={product_id:editingProduct,color:payload.p_color||null,size:payload.p_size||null,formula:payload.p_formula||null,pack:payload.p_pack||null,price:payload.p_price,stock:payload.p_stock,image_url:payload.p_image_url,active:true};const result=payload.p_variant_id?await db.from('product_variants').update(row).eq('id',payload.p_variant_id):await db.from('product_variants').insert(row);if(result.error)return msg(result.error.message,true);msg('บันทึกตัวเลือกแล้ว');clearVariant();await loadVariants();await refresh();};
document.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-variant]'),toggle=e.target.closest('[data-disable-variant]');if(edit){const v=currentVariants.find(x=>x.id===edit.dataset.editVariant);if(!v)return;$('vid').value=v.id;for(const [field,id] of [['color','vcolor'],['size','vsize'],['formula','vformula'],['pack','vpack'],['price','vprice'],['stock','vstock'],['image_url','vimage']])$(id).value=v[field]??'';window.scrollTo(0,0);}if(toggle){const v=currentVariants.find(x=>x.id===toggle.dataset.disableVariant);if(!v)return;const {error}=await db.from('product_variants').update({active:!v.active}).eq('id',v.id);if(error)return msg(error.message,true);await loadVariants();await refresh();}});
