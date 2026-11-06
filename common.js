import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const money = n => Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const msg = (s, bad=false) => {const el=document.getElementById('message');el.textContent=s;el.style.color=bad?'#b91c1c':'#9d174d'};
export async function session(){return (await db.auth.getUser()).data.user;}
