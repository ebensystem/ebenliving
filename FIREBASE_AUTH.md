# Firebase Authentication — ebenLiving

O site separa contas de clientes e anunciantes. Ambos os fluxos usam Firebase Authentication com e-mail e senha.

## Clientes

- `/cadastro/` cria uma conta de cliente.
- `/login/` é a entrada para consultar estadias e continuar solicitações.

## Anunciantes

- `/anuncie/` cria um espaço de anunciante e abre o painel em `/admin/`.
- Quem já tem conta de cliente pode ativar o espaço de anunciante nessa mesma página.
- `/admin-login/` é a entrada de anunciantes existentes.
- As regras do Firestore permitem que cada anunciante gerencie apenas imóveis e reservas ligados à própria conta.

## Administração geral

A conta `suporte@ebensystem.com.br` pode administrar todos os anúncios depois de confirmar o endereço no Firebase Authentication. O painel geral não é concedido por um campo editável pelo navegador; somente uma custom claim `admin: true` também concede esse nível de acesso.

## Configuração do Firebase

1. Em [Authentication](https://console.firebase.google.com/u/0/project/ebenliving-52a3e/authentication/users?hl=pt-br), habilite **E-mail/senha**.
2. Em **Configurações → Domínios autorizados**, confirme `ebenliving.com.br`.
3. Siga [FIREBASE.md](FIREBASE.md) para criar o Firestore em `southamerica-east1` e publicar `firestore.rules`.

O Firestore guarda anúncios, bloqueios de datas, solicitações, perfis e favoritos. O checkout registra solicitações e disponibilidade; a integração de pagamentos será feita quando as credenciais estiverem disponíveis.
