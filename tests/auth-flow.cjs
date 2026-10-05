const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8').replace(/import[\s\S]*?from '[^']+';/g, '');
function setup(search, host = false) {
  let observer;
  const links = [{ href: '/cadastro/' }];
  const upgrade = { hidden: true };
  const form = {
    dataset: { redirect: '/reservas', authMode: 'register', ...(host ? { accountType: 'host' } : {}) },
    elements: { password: { after() {} } },
    addEventListener() {}
  };
  const ctx = {
    URL, URLSearchParams, console, app: {}, window: {},
    getAuth: () => ({}), getFirestore: () => ({}),
    onAuthStateChanged: (_auth, fn) => { observer = fn; },
    getDoc: async () => ({ data: () => ({ accountType: 'customer' }) }), doc() {},
    location: { search, pathname: '/anuncie/', replace() { throw Error('Unexpected redirect'); } },
    document: {
      querySelector: selector => selector === '#authForm' ? form : selector === '#hostUpgrade' ? upgrade : null,
      querySelectorAll: selector => selector === 'a[href="/login/"], a[href="/cadastro/"]' ? links : [],
      getElementById: () => null,
      createElement: () => ({ setAttribute() {}, addEventListener() {} }),
      addEventListener() {}
    }
  };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return { ctx, form, upgrade, links, observer };
}
module.exports = (async () => {
  const flow = setup('?redirect=' + encodeURIComponent('checkout?property=casa&checkIn=2030-01-01'));
  assert.equal(vm.runInContext('destination', flow.ctx), '/checkout?property=casa&checkIn=2030-01-01');
  assert(flow.links[0].href.includes('redirect='), 'cadastro deve preservar o retorno');
  const invalid = setup('?redirect=https://example.com');
  assert.equal(vm.runInContext('destination', invalid.ctx), '/reservas');
  const host = setup('', true);
  await host.observer({ email: 'cliente@example.com', getIdTokenResult: async () => ({ claims: {} }) });
  assert.equal(host.form.hidden, true);
  assert.equal(host.upgrade.hidden, false, 'mostrar o contêiner da ativação');
  console.log('PASS: retorno ao checkout, contexto do cadastro, destino externo rejeitado e ativação visível.');
})();
