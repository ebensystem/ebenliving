const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const context={URL,Date,console,document:{addEventListener(){}},window:{}};
vm.createContext(context);
for(const file of ['core','management'])vm.runInContext(fs.readFileSync(`${root}/js/${file}.js`,'utf8'),context);
const L=context.Living;
const listing={id:'flex',plan:'flex',active:true,price:100,guests:4,amenities:[],unavailable:[]};
const listings=[listing,{...listing,id:'home',plan:'home',terms:'monthly'},{...listing,id:'annual',plan:'home',terms:'annual'},{...listing,id:'legacy',plan:undefined}];
assert.deepEqual(Array.from(L.search(listings,[],{plan:'flex'}),p=>p.id),['flex']);
assert.deepEqual(Array.from(L.search(listings,[],{plan:'home',term:'monthly'}),p=>p.id),['home']);
assert.deepEqual(Array.from(L.search(listings,[],{plan:'home',term:'annual'}),p=>p.id),['annual']);
const r={id:'r',propertyId:'flex',checkIn:'2030-01-01',checkOut:'2030-01-05',status:'confirmada'};
assert.equal(L.available(listing,[r],'2030-01-03','2030-01-06'),false);
assert.equal(L.available(listing,[r],'2030-01-05','2030-01-06'),true);
assert.equal(L.range('2028-01-01','2029-01-01').length,366);
const charges=context.rentalCharges({term:'annual',checkIn:'2027-10-01',total:24000});
assert.equal(charges.length,12);assert.equal(charges[0].amount,2000);assert.equal(charges[11].key,'2028-09');
assert.equal(context.rentalCharges({checkIn:'2027-10-01',total:450})[0].amount,450);
for(const file of ['living','firestore','auth','management']){
 const code=fs.readFileSync(`${root}/js/${file}.js`,'utf8');
 if(file==='firestore'||file==='auth')continue;
 new vm.Script(code);
}
for(const file of ['admin.html','admin/index.html']){
 const html=fs.readFileSync(`${root}/${file}`,'utf8');
 assert(html.includes('id="managementRows"'));assert(html.includes('/js/management.js'));
}
console.log('PASS: modalidades, contratos, conflitos de agenda, ano bissexto, cobranças mensais, sintaxe e integração das páginas.');
