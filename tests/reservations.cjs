const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const core=fs.readFileSync(root+'/js/core.js','utf8');
const living=fs.readFileSync(root+'/js/living.js','utf8');
const nodes={},calls=[];
const context={URL,URLSearchParams,console,setTimeout,clearTimeout,
 document:{getElementById:id=>nodes[id]||null,addEventListener(){},querySelectorAll:()=>[]},
 location:{search:'',replace:value=>calls.push(value)},
 localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{setItem(){}},
 window:{addEventListener(){},EbenFirestore:{uid:'customer',isReady:true}}
};
vm.createContext(context);vm.runInContext(core,context);vm.runInContext(living,context);
const L=context.Living;
const p={id:'p',title:'Casa',city:'Cidade',state:'RS',price:100,guests:2,bedrooms:1,bathrooms:1,images:['https://example.com/a.jpg'],amenities:[],unavailable:[],plan:'flex',active:true};
const r={id:'r',propertyId:'p',userId:'customer',guest:'Cliente',guests:1,total:200,checkIn:'2099-01-01',checkOut:'2099-01-03',status:'pendente'};
assert.equal(L.ownReservation([r],'customer','p',r.checkIn,r.checkOut),r);
assert.equal(L.ownReservation([r],'other','p',r.checkIn,r.checkOut),undefined);
assert.equal(L.ownReservation([{...r,status:'cancelada'}],'customer','p',r.checkIn,r.checkOut),undefined);
assert(L.removalError(p,[r]));
assert.equal(L.removalError(p,[{...r,status:'cancelada'}]),'');
assert.equal(L.removalError(p,[{...r,checkOut:'2020-01-03'}]),'');
assert.equal(L.search([{...p,plan:'home',guests:1}],[],{plan:'home',guests:8}).length,1);
assert.equal(L.search([{...p,deletedAt:'2026-10-02'}],[],{plan:'flex'}).length,0);
context.reservationSent('r');assert.equal(calls.pop(),'/reservas?solicitacao=r');
const next={version:1,revision:1,properties:[p],reservations:[r],favorites:[]};
context.next=next;context.calls=calls;
vm.runInContext('home=admin=trips=()=>{};detail=()=>calls.push("detail");checkout=()=>calls.push("checkout");updateQuote=()=>calls.push("quote");persistPending=true;',context);
context.window.EbenLivingSetCloudState(next);assert.equal(calls.length,0,'a confirmação do servidor não pode recriar o checkout durante o envio');
vm.runInContext('persistPending=false;',context);nodes.bookingForm={};nodes.checkoutForm={};
context.window.EbenLivingSetCloudState(next);assert.deepEqual(calls,['quote'],'sincronização preserva formulários em preenchimento');
for(const file of ['reservas.html','reservas/index.html'])assert(fs.readFileSync(root+'/'+file,'utf8').includes('id="reservationNotice"'));
console.log('PASS: própria reserva, conflito de terceiros, exclusão com histórico, busca mensal, redirecionamento e sincronização durante envio.');
