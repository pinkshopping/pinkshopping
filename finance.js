
import {db,money,esc,msg,session} from './common.js';

const $ = id => document.getElementById(id);
let orders = [];

async function guard(){
  const u = await session();
  let ok = false;

  if(u){
    const {data,error} = await db
      .from('admins')
      .select('user_id')
      .eq('user_id',u.id)
      .maybeSingle();

    if(error) msg(error.message,true);
    ok = !!data;
  }

  $('gate').classList.toggle('hidden',ok);
  $('dashboard').classList.toggle('hidden',!ok);

  if(u && !ok) msg('บัญชีนี้ไม่มีสิทธิ์หลังร้าน',true);

  if(ok){
    $('who').textContent = u.email;
    await refresh();
  }
}

$('login').onclick = async()=>{
  const {error} = await db.auth.signInWithPassword({
    email:$('email').value.trim(),
    password:$('password').value
  });

  if(error){
    msg(error.message,true);
  }else{
    msg('');
    await guard();
  }
};

$('logout').onclick = async()=>{
  await db.auth.signOut();
  location.reload();
};

$('period').onchange = render;
$('reload').onclick = refresh;

function inPeriod(o){
  const d = new Date(o.created_at);

  if(Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const period = $('period').value;

  if(period === 'all') return true;

  if(period === 'today'){
    return d.toDateString() === now.toDateString();
  }

  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth();
}

const baht = n => '฿' + money(n);

function render(){
  const a = orders.filter(inPeriod);

  const sum = xs => xs.reduce(
    (s,o) => s + Number(o.total_price || 0),
    0
  );

  $('orders-count').textContent =
    a.length.toLocaleString('th-TH');

  $('active-total').textContent = baht(
    sum(a.filter(o => o.status !== 'cancelled'))
  );

  $('completed-total').textContent = baht(
    sum(a.filter(o => o.status === 'completed'))
  );

  $('cancelled-total').textContent = baht(
    sum(a.filter(o => o.status === 'cancelled'))
  );

  const labels = {
    pending:'คำสั่งซื้อใหม่',
    confirmed:'แพ็คแล้ว',
    shipped:'กำลังจัดส่ง',
    completed:'จัดส่งเสร็จ',
    cancelled:'ยกเลิก'
  };

  $('recent').innerHTML = a.slice(0,30).map(o => `
    <tr>
      <td>#${esc(o.id)}</td>
      <td>${esc(new Date(o.created_at).toLocaleDateString('th-TH'))}</td>
      <td>${esc(labels[o.status] || o.status)}</td>
      <td>${baht(o.total_price)}</td>
    </tr>
  `).join('') || `
    <tr>
      <td colspan="4">ไม่มีรายการในช่วงเวลานี้</td>
    </tr>
  `;
}

async function refresh(){
  msg('กำลังโหลดข้อมูล...');

  const all = [];
  let from = 0;

  while(true){
    const {data,error} = await db
      .from('orders')
      .select('id,total_price,status,created_at')
      .order('created_at',{ascending:false})
      .range(from,from+499);

    if(error){
      msg('โหลดข้อมูลไม่สำเร็จ: '+error.message,true);
      return;
    }

    all.push(...(data || []));

    if(!data || data.length < 500) break;

    from += 500;

    if(from >= 10000){
      msg('แสดงข้อมูลได้สูงสุด 10,000 ออเดอร์ กรุณาตรวจสอบรายงานเพิ่มเติม',true);
      break;
    }
  }

  orders = all;
  render();

  if(from < 10000){
    msg('อัปเดตข้อมูลแล้ว');
  }
}

await guard();
