const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const nodes=Object.fromEntries(['adminWorkspace','newAccommodation','adminPlanHeading','reservationSearch','reservationStatus','calendarProperty','reportMonth','managementRows','receivedTotal','dueTotal'].map(id=>[id,{hidden:true,value:'',textContent:'',innerHTML:''}]));
const buttons=['home','flex'].map(plan=>({dataset:{plan},classList:{toggle(){}},setAttribute(key,value){this[key]=value;}}));
const context={URL,URLSearchParams,console,setTimeout,clearTimeout,
 document:{getElementById:id=>nodes[id]||null,addEventListener(){},querySelectorAll:selector=>selector==='[data-action="admin-plan"]'?buttons:[]},
 location:{search:''},localStorage:{getItem:()=>null},window:{addEventListener(){},EbenFirestore:{uid:'owner',isAdmin:false}}};
vm.createContext(context);
for(const file of ['core','living','management'])vm.runInContext(fs.readFileSync(root+'/js/'+file+'.js','utf8'),context);
const L=context.Living;
for(const [input,expected] of [
 ['(11) 99999-1234','+5511999991234'],['11 3333-4444','+551133334444'],
 ['5511999991234','+5511999991234'],['+1 (202) 555-0123','+12025550123'],
 ['123',''],['javascript:alert(1)',''],['+55+11999991234',''],['','']
])assert.equal(L.normalizePhone(input),expected,input);
const links=context.contactLinks({contact:'cliente@example.com',phone:'(11) 99999-1234'});
assert(links.includes('mailto:cliente%40example.com'));
assert(links.includes('tel:+5511999991234'));
assert(links.includes('https://wa.me/5511999991234'));
assert(links.includes('rel="noopener noreferrer"'));
assert(!context.contactLinks({phone:'javascript:alert(1)'}).includes('href='));
assert(context.contactLinks({contact:'(11) 99999-1234'}).includes('https://wa.me/5511999991234'),'compatibilidade com telefone legado');
assert(context.contactLinks({contact:'cliente@example.com'}).includes('mailto:'));

vm.runInContext(`state.properties=[
 {id:'home',ownerId:'owner',plan:'home',title:'Casa Home'},
 {id:'flex',ownerId:'owner',plan:'flex',title:'Casa Flex'},
 {id:'legacy',ownerId:'owner',title:'Legado Flex'},
 {id:'other',ownerId:'other',plan:'home',title:'Outro anunciante'}
];state.reservations=[
 {id:'h',propertyId:'home',propertyOwnerId:'owner',term:'annual',guest:'Home',checkIn:'2030-01-01',checkOut:'2031-01-01',total:12000,status:'confirmada'},
 {id:'f',propertyId:'flex',propertyOwnerId:'owner',guest:'Flex',checkIn:'2030-01-01',checkOut:'2030-01-03',total:300,status:'confirmada',payments:{'2030-01':{date:'2030-01-01'}}},
 {id:'o',propertyId:'other',propertyOwnerId:'other',term:'monthly',guest:'Outro',checkIn:'2030-01-01',checkOut:'2030-02-01',total:900,status:'confirmada'}
];admin=()=>{};`,context);
assert.equal(context.managedProperties().length,0,'sem escolha não mostra dados misturados');
nodes.reportMonth.value='2030-01';
context.chooseAdminPlan('home');
assert.equal(nodes.adminWorkspace.hidden,false);
assert.equal(buttons[0]['aria-pressed'],'true');
assert.deepEqual(Array.from(context.managedProperties(),p=>p.id),['home']);
assert.deepEqual(Array.from(context.managedReservations(),r=>r.id),['h']);
context.renderManagement();
assert(nodes.managementRows.innerHTML.includes('Casa Home'));
assert(!nodes.managementRows.innerHTML.includes('Casa Flex'));
assert.equal(nodes.dueTotal.textContent,vm.runInContext('money(1000)',context));
context.chooseAdminPlan('flex');
assert.equal(buttons[0]['aria-pressed'],'false');
assert.equal(buttons[1]['aria-pressed'],'true');
assert.deepEqual(Array.from(context.managedProperties(),p=>p.id),['flex','legacy']);
assert.deepEqual(Array.from(context.managedReservations(),r=>r.id),['f']);
context.renderManagement();
assert.equal(nodes.receivedTotal.textContent,vm.runInContext('money(300)',context));
assert.equal(nodes.dueTotal.textContent,vm.runInContext('money(0)',context));
assert(!nodes.managementRows.innerHTML.includes('Casa Home'));
context.chooseAdminPlan('invalid');
assert.deepEqual(Array.from(context.managedReservations(),r=>r.id),['f']);
for(const file of ['admin.html','admin/index.html']){
 const html=fs.readFileSync(root+'/'+file,'utf8');
 assert(html.includes('data-plan="home"'));assert(html.includes('data-plan="flex"'));
 assert(html.includes('id="adminWorkspace" hidden'));
}
console.log('PASS: telefone nacional/internacional, links seguros e legados, escolha de modalidade, isolamento por proprietário e totais por modalidade.');
