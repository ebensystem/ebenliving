'use strict';
// Gestão de contratos e recebimentos, restrita aos imóveis da conta.
function rentalCharges(r) {
  if (!r.term) return [{ key: r.checkIn.slice(0,7), amount: r.total }];
  const count = Living.contractMonths(r.term);
  const cents=Math.round(r.total*100),monthly=Math.floor(cents/count);
  return Array.from({length:count},(_,i)=>({key:Living.addMonths(r.checkIn,i).slice(0,7),amount:(monthly+(i===count-1?cents-monthly*count:0))/100}));
}
function renderManagement() {
  const root=document.getElementById('managementRows');if(!root)return;
  const selected=document.getElementById('reportMonth').value;
  const rows=managedReservations().filter(r=>r.status==='confirmada');
  let received=0,due=0;
  root.innerHTML=rows.map(r=>{
    const p=property(r.propertyId),charges=rentalCharges(r),charge=charges.find(c=>c.key===selected);
    if(!p||!charge)return '';
    const paid=r.payments?.[charge.key];if(paid)received+=charge.amount;else due+=charge.amount;
    return `<tr><td>${e(p.title)}${r.plan==='mobile'?`<br><small>${e(useName(r.rentalUse))}</small>`:''}</td><td>${e(r.guest)}${contactLinks(r)}</td><td>${date(r.checkIn)} → ${date(r.checkOut)}</td><td>${money(charge.amount)}</td><td>${paid?'Pago em '+date(paid.date):'Em aberto'}<br><button class="text-button" data-management="payment" data-id="${e(r.id)}" data-month="${charge.key}">${paid?'Reabrir pagamento':'Registrar pagamento'}</button></td><td>${e(({scheduled:'Entrada prevista',in:'Entrada registrada',out:'Saída registrada'})[r.occupancy||'scheduled'])}<br>${r.occupancy!=='out'?`<button class="text-button" data-management="occupancy" data-id="${e(r.id)}">${r.occupancy==='in'?'Registrar saída':'Registrar entrada'}</button>`:''}</td></tr>`;
  }).join('')||'<tr><td colspan="6">Nenhum recebimento previsto neste mês.</td></tr>';
  document.getElementById('receivedTotal').textContent=money(received);
  document.getElementById('dueTotal').textContent=money(due);
}
function newRental() {
  const listings=managedProperties();if(!listings.length){notify('Cadastre um imóvel primeiro.',true);return;}
  dialog('Registrar locação',`<form id="rentalForm"><p class="muted">Cadastre contratos e estadias fechados diretamente com você.</p><div class="field"><label for="rentalProperty">Anúncio</label><select id="rentalProperty" required>${listings.map(p=>`<option value="${e(p.id)}">${e(p.title)}</option>`).join('')}</select></div><div class="field mt"><label for="rentalGuest">Nome completo do solicitante</label><input id="rentalGuest" minlength="2" maxlength="100" required></div><div class="field mt"><label for="rentalContact">E-mail</label><input id="rentalContact" type="email" maxlength="120"></div><div class="field mt"><label for="rentalCpf">CPF do inquilino</label><input id="rentalCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></div>${phoneField('rentalPhone',false)}<div id="rentalUseContainer"></div><div class="field mt"><label for="rentalStart">Entrada / início do contrato</label><input id="rentalStart" type="date" required></div><div class="field mt"><label for="rentalEnd">Devolução / saída (Eben Flex ou Mobile)</label><input id="rentalEnd" type="date"></div><div class="field mt"><label for="rentalTerm">Contrato (Eben Home)</label><select id="rentalTerm"><option value="6months">6 meses</option><option value="1year">1 ano</option><option value="2years">2 anos</option><option value="3years">3 anos</option></select></div><p class="small muted">O valor usa a diária ou aluguel mensal cadastrado no imóvel. A data de entrada pode ser qualquer dia do mês.</p><button class="btn btn-primary mt">Registrar locação</button></form>`);
  const update=()=>{const p=property(document.getElementById('rentalProperty').value),home=p.plan==='home';document.getElementById('rentalUseContainer').innerHTML=mobileUseField(p,'rentalUse');document.getElementById('rentalEnd').parentElement.hidden=home;document.getElementById('rentalEnd').required=!home;document.getElementById('rentalTerm').parentElement.hidden=!home;document.querySelectorAll('#rentalTerm option').forEach(o=>o.disabled=p.terms&&p.terms!=='both'&&p.terms!==o.value);if(home&&p.terms&&p.terms!=='both')document.getElementById('rentalTerm').value=p.terms;};
  document.getElementById('rentalProperty').addEventListener('change',update);update();
  document.getElementById('rentalForm').addEventListener('submit',async event=>{
    event.preventDefault();const p=property(document.getElementById('rentalProperty').value),home=p.plan==='home',from=document.getElementById('rentalStart').value,term=document.getElementById('rentalTerm').value,to=home?Living.addMonths(from,Living.contractMonths(term)):document.getElementById('rentalEnd').value;
    const error=Living.validateDates(from,to,'1900-01-01');if(error){notify(error,true);return;}
    const phone=readPhone('rentalPhone',false);if(phone===null)return;const guest=document.getElementById('rentalGuest').value.trim();if(guest.length<2)return;
    const rentalUse=document.getElementById('rentalUse')?.value;if(!Living.supportsUse(p,rentalUse)){notify('Escolha uma finalidade permitida.',true);return;}
    const item={...(p.plan==='mobile'?{plan:'mobile',rentalUse}:home?{plan:'home'}:{}),id:'EL-'+crypto.randomUUID().slice(0,8).toUpperCase(),propertyId:p.id,propertyOwnerId:p.ownerId||'',userId:window.EbenFirestore.uid,guest,contact:document.getElementById('rentalContact').value.trim(),cpf:document.getElementById('rentalCpf').value.replace(/\\D/g,''),phone,guests:1,checkIn:from,checkOut:to,total:home?Living.quoteHome(p,term).total:Living.quote(p,from,to).total,status:'confirmada',source:'host',occupancy:'scheduled',payments:{},createdAt:new Date().toISOString(),...(home?{term,stage:5}:{})};
    if(!save(s=>{const live=s.properties.find(x=>x.id===p.id);if(!Living.supportsUse(live,rentalUse))return 'O uso permitido mudou. Revise o anúncio.';if(!Living.available(live,s.reservations,from,to))return 'Há uma reserva ou bloqueio neste período.';s.reservations.push(item);} ))return;
    if(await window.EbenLastPersist){document.getElementById('appDialog').close();admin();renderManagement();notify('Locação registrada.');}
  });
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-management]');if(!b)return;
  if(b.dataset.management==='new'){newRental();return;}
  const r=managedReservations().find(x=>x.id===b.dataset.id);if(!r||r.status!=='confirmada')return;
  b.disabled=true;
  const ok=save(s=>{const live=s.reservations.find(x=>x.id===r.id);if(!live||live.status!=='confirmada')return 'Locação indisponível.';
    if(b.dataset.management==='payment'){const key=b.dataset.month;if(!rentalCharges(live).some(c=>c.key===key))return 'Competência inválida.';live.payments||={};if(live.payments[key])delete live.payments[key];else live.payments[key]={date:Living.today()};}
    else {live.occupancy=live.occupancy==='in'?'out':'in';live[live.occupancy==='in'?'actualCheckIn':'actualCheckOut']=Living.today();}
  });
  if(ok&&await window.EbenLastPersist){renderManagement();notify('Registro atualizado.');}b.disabled=false;
});
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('reportMonth')?.addEventListener('change',renderManagement);renderManagement();});
