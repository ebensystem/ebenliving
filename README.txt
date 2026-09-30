EBENLIVING — UM PRODUTO EBENSYSTEM

COMO ABRIR
Use um servidor local para que as páginas e o Firebase funcionem corretamente.
- VS Code: abra index.html com a extensão Live Server.
- Com Node.js: execute node serve.mjs e abra http://127.0.0.1:8765.
Não abra as páginas diretamente com file://.

FUNCIONALIDADES
- Busca por destino, modalidade, datas, hóspedes, preço e comodidades.
- Cadastro e login de clientes via Firebase Authentication.
- Cadastro compartilhado de acomodações, estadias e bloqueios via Cloud Firestore.
- Área de administrador protegida pela permissão Firebase admin: true.
- Pagamentos ainda não estão integrados.

ARQUIVOS PRINCIPAIS
index.html: vitrine e busca
imovel.html: detalhes e calendário
checkout.html: revisão e solicitação de estadia
reservas.html: estadias da conta conectada
admin.html: painel administrativo
login.html / cadastro.html: autenticação de clientes
admin-login.html: login da administração
js/firebase.js: inicialização do aplicativo Firebase
js/auth.js: cadastro, login e controle de sessão
js/firestore.js: leitura/gravação compartilhada e sincronização
firestore.rules: regras de acesso do banco
FIREBASE.md: criação do banco, ativação e publicação das regras

CONFIGURAÇÃO FIREBASE
Antes de usar a autenticação e a sincronização:
1. Ative E-mail/senha no Firebase Authentication.
2. Crie o Cloud Firestore no projeto ebenliving-52a3e.
3. Publique firestore.rules pelo Firebase CLI.
4. Autorize a conta administradora com a custom claim admin: true.
Os passos completos estão em FIREBASE.md e FIREBASE_AUTH.md.

As acomodações são públicas para leitura. Reservas ficam ligadas ao UID do cliente e o painel pode acessá-las com uma conta autorizada. Dados locais antigos de reservas não são enviados para o banco, pois não têm um dono autenticado verificável.
