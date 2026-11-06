import {db,money,esc,msg,session} from './common.js';
let products=[],variants=[],cart={},activeCategory='ทั้งหมด',currentProduct=null,selection={},soldCounts={};const $=id=>document.getElementById(id);
const fields=[['color','ตัวเลือกสินค้า'],['size','ขนาด'],['formula','กลิ่น / สูตร'],['pack','จำนวนต่อแพ็ก']];
const variantsOf=id=>variants.filter(v=>v.product_id===id&&v.active);
const keyOf=(id,vid)=>id+'|'+(vid||'');
async function load(){const {data,error}=await db.from('products').select('id,name,price,stock,image_url,shopee_url').eq('is_active',true).order('created_at',{ascending:false});if(error)return msg(error.message,true);products=data||[];const ids=products.map(p=>p.id);variants=[];if(ids.length){for(let i=0;i<ids.length;i+=100){const r=await db.from('product_variants').select('id,product_id,color,size,formula,pack,price,stock,image_url,active').in('product_id',ids.slice(i,i+100)).eq('active',true).order('created_at',{ascending:true});if(r.error){msg('กรุณาติดตั้ง V6_VARIANTS.sql ก่อน: '+r.error.message,true);return;}variants.push(...(r.data||[]));}}drawCategories();draw();await loadSalesCounts();}
function categoryOf(name){const n=name.toLowerCase();if(/ลิป|lip|ทินต์|tint|แป้ง|คุชชั่น|รองพื้น|บลัช|มาสคาร่า|eyeshadow|powder|cushion|makeup/.test(n))return 'ลิปและเมคอัพ';if(/ครีม|เซรั่ม|โฟม|กันแดด|คลีน|สกิน|โทนเนอร์|โลชั่น|serum|cream|skin|sunscreen/.test(n))return 'สกินแคร์';if(/น้ำหอม|perfume|fragrance|body mist/.test(n))return 'น้ำหอม';if(/แชมพู|ผม|สบู่|shampoo|hair|soap/.test(n))return 'ดูแลผิวและผม';return 'สินค้าอื่น ๆ';}
const categoryIcons={'ลิปและเมคอัพ':'💄','สกินแคร์':'🧴','น้ำหอม':'🌸','ดูแลผิวและผม':'🫧','สินค้าอื่น ๆ':'🎀'};
async function loadSalesCounts(){try{const r=await db.from('order_items').select('product_id,quantity,orders!inner(status)').eq('orders.status','completed').limit(5000);if(r.error)return;const next={};for(const item of r.data||[])next[item.product_id]=(next[item.product_id]||0)+Number(item.quantity||0);soldCounts=next;draw();}catch(e){console.info('Sales counts unavailable',e);}}
function drawCategories(){const cats=['ทั้งหมด',...new Set(products.map(p=>categoryOf(p.name)))];if(!cats.includes(activeCategory))activeCategory='ทั้งหมด';$('category-tiles').innerHTML=cats.filter(c=>c!=='ทั้งหมด').map(c=>`<button type="button" class="category-tile ${c===activeCategory?'selected':''}" data-category="${esc(c)}"><span>${categoryIcons[c]||'🎀'}</span><strong>${esc(c)}</strong><small>${products.filter(p=>categoryOf(p.name)===c).length} รายการ</small></button>`).join('');$('categories').innerHTML=cats.map(c=>`<button type="button" class="category ${c===activeCategory?'active':''}" data-category="${esc(c)}">${c==='ทั้งหมด'?'สินค้าทั้งหมด':esc(c)}</button>`).join('');}
function productCard(p){const vs=variantsOf(p.id),has=vs.length>0,available=has?vs.reduce((n,v)=>n+Number(v.stock),0):Number(p.stock),lowest=has?Math.min(...vs.map(v=>Number(v.price))):Number(p.price);const sold=soldCounts[p.id];return `<article class="product"><div class="product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:'<div class="product-placeholder" aria-hidden="true">🌷</div>'}</div><div class="product-body"><div class="product-category">${esc(categoryOf(p.name))}</div><h3>${esc(p.name)}</h3><p class="price">${has?'<small>เริ่มต้น</small> ':''}฿${money(lowest)}</p><div class="product-meta"><span>${available>0?'พร้อมขาย':'สินค้าหมด'}</span>${Number.isFinite(sold)&&sold>0?`<span>ขายแล้ว ${sold}</span>`:''}</div><p class="stock">คงเหลือ ${available} ชิ้น</p><button data-add="${p.id}" ${available<1?'disabled':''}>${has?'เลือกสี / สูตร':'🛒 เพิ่มลงตะกร้า'}</button>${p.shopee_url?`<a class="shopee-buy" href="${esc(p.shopee_url)}" target="_blank" rel="noopener noreferrer">ซื้อผ่าน Shopee</a>`:''}</div></article>`;}
function draw(){const q=$('search').value.trim().toLowerCase();const shown=products.filter(p=>p.name.toLowerCase().includes(q)&&(activeCategory==='ทั้งหมด'||categoryOf(p.name)===activeCategory));$('product-count').textContent=`${shown.length} รายการ`;$('products').innerHTML=shown.map(productCard).join('')||'<div class="empty-state">ไม่พบสินค้าที่ค้นหา ลองใช้คำค้นอื่นดูนะคะ 🌸</div>';const featured=products.filter(p=>(variantsOf(p.id).length?variantsOf(p.id).some(v=>Number(v.stock)>0):Number(p.stock)>0)).slice(0,4);$('featured-area').hidden=!featured.length;$('featured-products').innerHTML=featured.map(productCard).join('');drawCart();}
function variantLabel(v){return fields.filter(([k])=>v?.[k]).map(([k,l])=>(k==='color'?'ตัวเลือกสินค้า':l)+': '+v[k]).join(' • ');}
function drawCart(){let total=0,count=0;$('cart').innerHTML=Object.entries(cart).map(([key,qty])=>{const [id,vid]=key.split('|'),p=products.find(x=>x.id===id),v=vid?variants.find(x=>x.id===vid):null;if(!p||vid&&!v)return '';const price=v?Number(v.price):Number(p.price);total+=price*qty;count+=qty;return `<div class="cart-item"><div class="cart-thumb">${v?.image_url||p.image_url?`<img src="${esc(v?.image_url||p.image_url)}" alt="">`:'🌷'}</div><div class="cart-info"><strong>${esc(p.name)}</strong>${v?`<small>${esc(variantLabel(v))}</small>`:''}<b>฿${money(price*qty)}</b></div><div class="qty-controls"><button aria-label="ลดจำนวน" data-minus="${esc(key)}">−</button><span>${qty}</span><button aria-label="เพิ่มจำนวน" data-plus="${esc(key)}">+</button></div></div>`;}).join('')||'<div class="cart-empty">🛒<p>ตะกร้ายังว่างอยู่</p><a href="#products-heading">เลือกช้อปสินค้า →</a></div>';$('total').textContent=`฿${money(total)}`;if($('cart-count'))$('cart-count').textContent=count;}
function add(id,vid){const p=products.find(x=>x.id===id),v=vid?variants.find(x=>x.id===vid):null;if(!p||vid&&!v)return;const key=keyOf(id,vid),max=v?v.stock:p.stock;if((cart[key]||0)>=max)return msg('สต็อกตัวเลือกนี้ไม่เพียงพอ',true);cart[key]=(cart[key]||0)+1;drawCart();msg('เพิ่มลงตะกร้าแล้ว');}
function openVariant(id){currentProduct=products.find(p=>p.id===id);const vs=variantsOf(id);selection={};for(const [k] of fields){const vals=[...new Set(vs.map(v=>v[k]).filter(Boolean))];if(vals.length)selection[k]=vals[0];}renderVariant();$('variant-dialog').showModal();}
function renderVariant(){const vs=variantsOf(currentProduct.id);const activeFields=fields.filter(([k])=>vs.some(v=>v[k]));let matched=vs.find(v=>activeFields.every(([k])=>(v[k]||'')===(selection[k]||'')));const options=activeFields.map(([k,label])=>{const vals=[...new Set(vs.map(v=>v[k]).filter(Boolean))];return `<fieldset class="variant-field"><legend>${label}</legend><div class="variant-options">${vals.map(value=>`<button type="button" data-field="${k}" data-value="${esc(value)}" class="variant-option ${selection[k]===value?'selected':''}" aria-pressed="${selection[k]===value}">${esc(value)}</button>`).join('')}</div></fieldset>`;}).join('');$('variant-detail').innerHTML=`<div class="product-category">${esc(categoryOf(currentProduct.name))}</div><h2>${esc(currentProduct.name)}</h2><p class="variant-help">กรุณาเลือกตัวเลือกสินค้าที่ต้องการ</p><div class="variant-preview">${(matched?.image_url||currentProduct.image_url)?`<img src="${esc(matched?.image_url||currentProduct.image_url)}" alt="${esc(currentProduct.name)}">`:''}<div><strong>฿${matched?money(matched.price):'—'}</strong><p>${matched?'เหลือ '+matched.stock+' ชิ้น':'ไม่มีตัวเลือกนี้'}</p></div></div>${options}<button type="button" id="variant-add" ${!matched||matched.stock<1?'disabled':''}>🛒 เพิ่มตัวเลือกนี้ลงตะกร้า</button>`;$('variant-add').onclick=()=>{if(!matched)return;add(currentProduct.id,matched.id);$('variant-dialog').close();};$('variant-detail').querySelectorAll('[data-field]').forEach(b=>b.onclick=()=>{selection[b.dataset.field]=b.dataset.value;renderVariant();});}
document.addEventListener('click',e=>{const addBtn=e.target.closest('[data-add]');if(addBtn){const id=addBtn.dataset.add;if(variantsOf(id).length)openVariant(id);else add(id,null);return;}const plus=e.target.closest('[data-plus]'),minus=e.target.closest('[data-minus]');if(!plus&&!minus)return;const key=(plus||minus).dataset.plus||(plus||minus).dataset.minus,[id,vid]=key.split('|'),p=products.find(x=>x.id===id),v=vid?variants.find(x=>x.id===vid):null;if(!p)return;cart[key]=minus?Math.max(0,(cart[key]||0)-1):Math.min(v?v.stock:p.stock,(cart[key]||0)+1);if(!cart[key])delete cart[key];drawCart();});
$('search').oninput=draw;document.addEventListener('click',e=>{const tile=e.target.closest('.category-tile');if(!tile)return;activeCategory=tile.dataset.category;drawCategories();draw();document.getElementById('products-heading').scrollIntoView({behavior:'smooth'});});$('categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;activeCategory=b.dataset.category;drawCategories();draw();});
// Guest checkout: Supabase anonymous auth gives each shopper a limited session,
// without requiring an email, password, or customer account registration.
// Enable Anonymous Sign-Ins in Supabase Authentication > Providers before deployment.
async function guestSession(){
  const {data:{user},error:getError}=await db.auth.getUser();
  if(user)return user;
  const {data,error}=await db.auth.signInAnonymously();
  if(error)throw new Error('ยังไม่สามารถสั่งซื้อแบบไม่ล็อกอินได้ กรุณาเปิด Anonymous Sign-Ins ใน Supabase: '+error.message);
  return data.user;
}
const checkoutStatus=$('checkout-status');
function checkoutNotice(message,isError=false){
  checkoutStatus.hidden=false;
  checkoutStatus.textContent=message;
  checkoutStatus.style.cssText='display:block;padding:14px;margin:12px 0;border-radius:10px;line-height:1.6;overflow-wrap:anywhere;background:'+(isError?'#fff0f0':'#fff0f7')+';color:'+(isError?'#a31717':'#912054')+';border:1px solid '+(isError?'#e9aaaa':'#efbad5');
  checkoutStatus.scrollIntoView({block:'center',behavior:'auto'});
}
let checkoutPending=false;
function selectedPayment(){return document.querySelector('input[name="payment-method"]:checked')?.value||'scb_qr';}
function syncPaymentUI(){const qr=$('qr-payment');if(qr)qr.hidden=selectedPayment()!=='scb_qr';}
document.querySelectorAll('input[name="payment-method"]').forEach(el=>el.addEventListener('change',syncPaymentUI));syncPaymentUI();
$('checkout').onclick=async()=>{
  if(checkoutPending)return;
  const items=Object.entries(cart).filter(([,q])=>q>0).map(([key,quantity])=>{const [product_id,variant_id]=key.split('|');return {product_id,variant_id:variant_id||null,quantity};});
  if(!items.length)return checkoutNotice('กรุณาเลือกสินค้าใส่ตะกร้าก่อนค่ะ',true);
  const customer=$('customer').value.trim(),phone=$('phone').value.trim(),address=$('address').value.trim();
  if(!customer||!phone||!address)return checkoutNotice('กรุณากรอกชื่อ เบอร์โทร และที่อยู่ให้ครบค่ะ',true);
  if(!/^0[0-9]{8,9}$/.test(phone.replace(/[\s-]/g,'')))return checkoutNotice('กรุณาตรวจสอบเบอร์โทรศัพท์ (ตัวเลข 9–10 หลัก เริ่มด้วย 0)',true);
  const paymentMethod=selectedPayment();
  const slipFile=$('payment-slip')?.files?.[0]||null;
  if(paymentMethod==='scb_qr'&&!slipFile)return checkoutNotice('กรุณาแนบสลิปโอนเงินก่อนยืนยันคำสั่งซื้อค่ะ',true);
  if(slipFile&&slipFile.size>5*1024*1024)return checkoutNotice('ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB ค่ะ',true);
  if(slipFile&&!['image/jpeg','image/png','application/pdf'].includes(slipFile.type))return checkoutNotice('รองรับไฟล์ JPG, PNG หรือ PDF เท่านั้นค่ะ',true);
  checkoutPending=true;$('checkout').disabled=true;$('checkout').textContent='กำลังบันทึกคำสั่งซื้อ…';
  checkoutNotice('กำลังเชื่อมต่อระบบและบันทึกคำสั่งซื้อ กรุณารอสักครู่ อย่ากดซ้ำค่ะ');
  let serverConfirmed=false;
  try{
    // Supabase getUser() can hang in mobile browsers when an old auth session is stale.
    // A bounded wait makes the problem visible without retrying an order submission.
    await Promise.race([guestSession(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('เชื่อมต่อระบบสมาชิกชั่วคราวไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่')),20000))]);
    checkoutNotice('เชื่อมต่อสำเร็จ กำลังบันทึกคำสั่งซื้อ กรุณารอสักครู่ อย่ากดซ้ำค่ะ');
    const {data,error}=await db.rpc('place_order_with_variants',{p_customer:customer,p_phone:phone,p_address:address,p_items:items,p_payment_method:paymentMethod});
    if(error)throw error;
    serverConfirmed=true;
    if(paymentMethod==='scb_qr'&&slipFile){
      const user=(await db.auth.getUser()).data.user;
      if(!user)throw new Error('สร้างออเดอร์แล้ว แต่ไม่พบเซสชันสำหรับแนบสลิป กรุณาติดต่อร้านพร้อมเลขออเดอร์ #'+data);
      const ext=slipFile.type==='image/png'?'png':slipFile.type==='application/pdf'?'pdf':'jpg';
      const slipPath=`${user.id}/${data}/${Date.now()}.${ext}`;
      const upload=await db.storage.from('payment-slips').upload(slipPath,slipFile,{upsert:true,contentType:slipFile.type});
      if(upload.error)throw new Error('สร้างออเดอร์ #'+data+' แล้ว แต่แนบสลิปไม่สำเร็จ: '+upload.error.message+' กรุณาติดต่อร้านพร้อมเลขออเดอร์นี้');
      const submitted=await db.rpc('submit_payment_slip',{p_order_id:Number(data),p_slip_path:slipPath});
      if(submitted.error)throw new Error('สร้างออเดอร์ #'+data+' และอัปโหลดสลิปแล้ว แต่บันทึกการชำระเงินไม่สำเร็จ: '+submitted.error.message+' กรุณาติดต่อร้านพร้อมเลขออเดอร์นี้');
    }
    const receipt={id:String(data),date:new Date().toISOString(),customer,phone,address,paymentMethod,items:Object.entries(cart).filter(([,q])=>q>0).map(([key,quantity])=>{const [id,vid]=key.split('|');const p=products.find(x=>x.id===id);const v=vid?variants.find(x=>x.id===vid):null;return {name:p?.name||'สินค้า',option:v?variantLabel(v):'',quantity,price:Number(v?.price??p?.price??0)};}),status:'รอร้านยืนยัน'};
    try{const history=JSON.parse(localStorage.getItem('pink_guest_orders_v1')||'[]');if(!Array.isArray(history))throw Error('history invalid');history.unshift(receipt);localStorage.setItem('pink_guest_orders_v1',JSON.stringify(history.slice(0,100)));}catch(storageError){console.warn('Local history unavailable',storageError);try{sessionStorage.setItem('pink_guest_latest_order',JSON.stringify(receipt));}catch(_){}}
    cart={};drawCart();
    // If storage is blocked, show the receipt on this page instead of a blank history page.
    checkoutNotice('✓ สั่งซื้อสำเร็จ! เลขคำสั่งซื้อ #'+receipt.id+(paymentMethod==='cod'?' เลือกเก็บเงินปลายทางแล้ว':' ส่งสลิปเรียบร้อย รอร้านตรวจสอบ') );
    const link=document.createElement('a');link.href='my-orders.html?order='+encodeURIComponent(receipt.id);link.textContent='ดูรายละเอียดคำสั่งซื้อของฉัน →';link.style.cssText='display:inline-block;margin-top:10px;background:#d81b73;color:white;padding:12px;border-radius:10px';checkoutStatus.appendChild(document.createElement('br'));checkoutStatus.appendChild(link);
    try{if(localStorage.getItem('pink_guest_orders_v1'))window.location.assign(link.href);}catch(_){}
  }catch(e){console.error('Checkout error',e);checkoutNotice((serverConfirmed?'บันทึกคำสั่งซื้อแล้ว แต่แสดงใบสั่งซื้อไม่สำเร็จ: ':'สั่งซื้อไม่สำเร็จ: ')+(e?.message||String(e)),true);}
  finally{checkoutPending=false;$('checkout').disabled=false;$('checkout').textContent='ยืนยันคำสั่งซื้อ (ไม่ต้องล็อกอิน) →';}
};
await load();
