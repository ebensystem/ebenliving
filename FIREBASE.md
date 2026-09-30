# Firebase EbenLiving

Esta plataforma usa a configuração pública obtida pelo Firebase CLI do aplicativo existente:

- Projeto: `ebenliving-52a3e` (EbenLiving).
- Aplicativo no console: `Plataforma-EbenLiveng`.
- App ID: `1:498935725170:web:a8620cee7605a933ba56eb`.
- Console: https://console.firebase.google.com/project/ebenliving-52a3e/settings/general

Todas as páginas carregam `js/firebase.js`, que inicializa o SDK modular via CDN oficial. Abra a plataforma por HTTP com Live Server ou `node serve.mjs`; não use `file://`.

O arquivo `.firebaserc` seleciona o projeto e `firebase.json` prepara o Hosting para o site existente. Nenhuma publicação foi feita nesta etapa. Para publicar, execute `firebase deploy --only hosting --project ebenliving-52a3e`. A publicação substitui o conteúdo atual desse site.

## Escopo da integração

O vínculo e a inicialização do SDK estão configurados. Inicializar o SDK não migra os dados locais: imóveis, favoritos e solicitações ainda usam o armazenamento do navegador, e login/cadastro continuam demonstrativos. Authentication, banco de dados, regras de acesso e reservas transacionais precisam de implementação própria antes de uso real. Analytics não é ativado automaticamente.

Referência: https://firebase.google.com/docs/web/setup
