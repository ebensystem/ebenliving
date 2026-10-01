/* Regras compartilhadas: busca, disponibilidade, preços e armazenamento local. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');
  function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function timestamp(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
    const n = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === value ? n : NaN;
  }
  function nights(a,b) { return (timestamp(b)-timestamp(a))/DAY; }
  function addDays(value,n) { return new Date(timestamp(value)+n*DAY).toISOString().slice(0,10); }
  function addMonths(value,n) { const d=new Date(timestamp(value)); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+n); return d.toISOString().slice(0,10); }
  function range(a,b) { const count=nights(a,b); return Number.isInteger(count)&&count>0&&count<=365 ? Array.from({length:count},(_,i)=>addDays(a,i)) : []; }
  function validateDates(a,b,min=today()) {
    if (!Number.isFinite(timestamp(a)) || !Number.isFinite(timestamp(b))) return 'Escolha datas válidas de entrada e saída.';
    if (a < min) return 'A entrada não pode ser no passado.';
    if (nights(a,b)<=0) return 'A saída precisa ser posterior à entrada.';
    if (nights(a,b)>365) return 'Escolha uma estadia de até 365 noites.';
    return '';
  }
  function blocked(p,reservations,date,ignoreId) {
    const lockedForThisReservation = ignoreId && (p.bookedReservationDates?.[ignoreId] || []).includes(date);
    return p.unavailable.includes(date) || ((p.bookedDates||[]).includes(date) && !lockedForThisReservation) || reservations.some(r=>r.id!==ignoreId && r.propertyId===p.id && r.status!=='cancelada' && r.checkIn<=date && date<r.checkOut);
  }
  function available(p,reservations,a,b) { const days=range(a,b); return p.active!==false && days.length>0 && days.every(d=>!blocked(p,reservations,d)); }
  function quote(p,a,b) { const count=nights(a,b); const subtotal=Math.round(count*p.price*100)/100; const cleaning=Number(p.cleaningFee||0); return {nights:count,subtotal,cleaning,total:Math.round((subtotal+cleaning)*100)/100}; }
  function quoteHome(p,term) { const months=term==="annual"?12:1; return {months,total:Math.round(p.price*months*100)/100}; }
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function search(list,reservations,filters,favorites=[]) {
    let found=list.filter(p=>p.active!==false && (!filters.plan || (p.plan||"flex")===filters.plan) && (!filters.term || filters.plan!=="home" || !p.terms || p.terms==="both" || p.terms===filters.term) && (!filters.destination || normalize(`${p.title} ${p.city} ${p.state}`).includes(normalize(filters.destination))) && p.guests>=Number(filters.guests||1) && (!filters.maxPrice||p.price<=Number(filters.maxPrice)) && (!filters.amenity||p.amenities.includes(filters.amenity)) && (!filters.favorites||favorites.includes(p.id)) && (!filters.checkIn&&!filters.checkOut || !validateDates(filters.checkIn,filters.checkOut)&&available(p,reservations,filters.checkIn,filters.checkOut)));
    const price=p=>filters.checkIn&&filters.checkOut?quote(p,filters.checkIn,filters.checkOut).total:p.price;
    if(filters.sort==='price-asc') found.sort((a,b)=>price(a)-price(b));
    if(filters.sort==='price-desc') found.sort((a,b)=>price(b)-price(a));
    if(filters.sort==='capacity') found.sort((a,b)=>b.guests-a.guests);
    return found;
  }
  function escape(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function safeImage(s) { try {const url=new URL(s);return url.protocol==='https:'?url.href:'';}catch{return '';} }
  function csvCell(value) { let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'; }
  function validProperty(p) { return p&&typeof p.id==='string'&&typeof p.title==='string'&&typeof p.city==='string'&&typeof p.state==='string'&&Number.isFinite(p.price)&&p.price>0&&Number.isInteger(p.guests)&&p.guests>0&&Number.isInteger(p.bedrooms)&&p.bedrooms>0&&Number.isInteger(p.bathrooms)&&p.bathrooms>0&&Array.isArray(p.images)&&p.images.length>0&&p.images.every(s=>safeImage(s))&&Array.isArray(p.amenities)&&p.amenities.every(s=>typeof s==='string')&&Array.isArray(p.unavailable)&&p.unavailable.every(d=>Number.isFinite(timestamp(d)))&&Number.isFinite(p.cleaningFee||0)&&Number(p.cleaningFee||0)>=0&&(!p.plan||["flex","home"].includes(p.plan))&&(!p.terms||["monthly","annual","both"].includes(p.terms)); }
  function validReservation(r) { return r&&typeof r.id==='string'&&typeof r.propertyId==='string'&&typeof r.guest==='string'&&Number.isFinite(timestamp(r.checkIn))&&Number.isFinite(timestamp(r.checkOut))&&nights(r.checkIn,r.checkOut)>0&&Number.isInteger(r.guests)&&r.guests>0&&Number.isFinite(r.total)&&r.total>0&&['pendente','confirmada','cancelada'].includes(r.status); }
  function validState(s) { return s&&s.version===1&&Array.isArray(s.properties)&&s.properties.every(validProperty)&&new Set(s.properties.map(p=>p.id)).size===s.properties.length&&Array.isArray(s.reservations)&&s.reservations.every(r=>validReservation(r)&&s.properties.some(p=>p.id===r.propertyId))&&new Set(s.reservations.map(r=>r.id)).size===s.reservations.length&&Array.isArray(s.favorites)&&s.favorites.every(id=>typeof id==='string')&&Number.isInteger(s.revision)&&s.revision>=0; }
  root.Living={today,timestamp,nights,addDays,addMonths,range,validateDates,blocked,available,quote,quoteHome,search,escape,safeImage,csvCell,validState};
})(globalThis);
