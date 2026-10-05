'use strict';
(function(root){
  const L=root.Living;
  const planOf=(r,p)=>r.term?'home':r.plan||p?.plan||'flex';
  function contractEnd(start,months){
    const d=new Date(L.timestamp(start)),day=d.getUTCDate();
    d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
    const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
    d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);
  }
  function charges(r){
    const count=r.term==='annual'?12:1,cents=Math.round(r.total*100),monthly=Math.floor(cents/count);
    return Array.from({length:count},(_,i)=>{
      const key=L.addMonths(r.checkIn,i).slice(0,7);
      let dueDate=r.term?null:r.checkIn;
      if(r.term&&Number.isInteger(r.dueDay)&&r.dueDay>=1&&r.dueDay<=31){
        const [y,m]=key.split('-').map(Number),day=Math.min(r.dueDay,new Date(Date.UTC(y,m,0)).getUTCDate());
        dueDate=`${key}-${String(day).padStart(2,'0')}`;
        if(dueDate<r.checkIn)dueDate=r.checkIn;
      }
      return {key,amount:(monthly+(i===count-1?cents-monthly*count:0))/100,dueDate};
    });
  }
  function paymentStatus(r,charge,today=L.today()){
    if(r.payments?.[charge.key])return 'paid';
    if(!charge.dueDate)return 'unset';
    if(charge.dueDate<today)return 'late';
    return charge.dueDate===today?'today':'open';
  }
  function lifecycle(r,today=L.today()){
    if(r.status==='cancelada')return 'cancelled';
    if(r.status==='pendente')return 'pending';
    if(r.occupancy==='out'||r.checkOut<=today)return 'ended';
    if(r.checkIn>today)return 'upcoming';
    return 'active';
  }
  function progress(r,today=L.today()){
    return Math.min(100,Math.max(0,Math.round(L.nights(r.checkIn,today)/L.nights(r.checkIn,r.checkOut)*100)));
  }
  function summary(properties,reservations,month,today=L.today()){
    const confirmed=reservations.filter(r=>r.status==='confirmada');
    const result={expected:0,received:0,open:0,late:0,lateCount:0,unconfigured:0,occupied:0,pending:reservations.filter(r=>r.status==='pendente').length,ending:0,allLate:0};
    result.occupied=new Set(confirmed.filter(r=>lifecycle(r,today)==='active').map(r=>r.propertyId)).size;
    result.ending=confirmed.filter(r=>lifecycle(r,today)==='active'&&L.nights(today,r.checkOut)<=30).length;
    for(const r of confirmed)for(const c of charges(r)){
      const status=paymentStatus(r,c,today);
      if(status==='late')result.allLate+=c.amount;
      if(c.key!==month)continue;
      result.expected+=c.amount;
      if(status==='paid')result.received+=c.amount;else result.open+=c.amount;
      if(status==='late'){result.late+=c.amount;result.lateCount++;}
      if(status==='unset')result.unconfigured++;
    }
    result.available=properties.filter(p=>p.active!==false&&!confirmed.some(r=>r.propertyId===p.id&&lifecycle(r,today)==='active')).length;
    for(const key of ['expected','received','open','late','allLate'])result[key]=Math.round(result[key]*100)/100;
    return result;
  }
  root.EbenPortfolio={planOf,contractEnd,charges,paymentStatus,lifecycle,progress,summary};
})(globalThis);
