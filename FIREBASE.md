# Firebase setup — ebenLiving

Projeto Firebase: `ebenliving-52a3e`. O site usa o Firebase Authentication, Cloud Firestore e regras de acesso versionadas neste repositório.

## Criar o Firestore no Console

1. Abra [Firestore no projeto ebenLiving](https://console.firebase.google.com/project/ebenliving-52a3e/firestore).
2. Clique em **Criar banco de dados** e escolha a edição **Standard**.
3. Use o banco `(default)` e selecione **Modo de produção**.
4. Para manter os dados no Brasil, escolha `southamerica-east1 (São Paulo)`. A localização é definida na criação; confira antes de confirmar.
5. Conclua a criação. O site só consegue gravar depois que as regras de `firestore.rules` forem publicadas.

O Firebase CLI publica as regras deste projeto:

```powershell
firebase deploy --only firestore:rules --project ebenliving-52a3e
```

Se o CLI pedir autenticação, execute `firebase login` com uma conta que tenha acesso ao projeto. Não selecione **Modo de teste** nem publique regras abertas.

## Ativar autenticação

No [Firebase Authentication](https://console.firebase.google.com/u/0/project/ebenliving-52a3e/authentication/users?hl=pt-br), habilite o provedor **E-mail/senha** em **Método de login** e confirme `ebenliving.com.br` em **Domínios autorizados**.

Cadastro e login criam/validam usuários em Authentication. O nome e e-mail também são copiados para `users/{uid}` no Firestore. O painel autoriza a conta exata `suporte@ebensystem.com.br` depois da verificação do e-mail; outros cadastros não recebem acesso administrativo. Administradores adicionais precisam de custom claims atribuídas via Admin SDK.

## Dados que o site grava

- `properties/{propertyId}`: anúncios, preço, modalidade e bloqueios manuais. Leitura pública; escrita administrativa.
- `reservations/{reservationId}`: estadias, datas, cliente e status. Cliente lê a própria; administrador lê e gerencia todas.
- `availability/{propertyId}_{yyyy-mm-dd}`: bloqueio público de cada noite reservada, para atualizar os calendários entre visitantes.
- `users/{uid}`: perfil básico da conta.
- `users/{uid}/favorites/{propertyId}`: favoritos da conta.

Quando a primeira conta administrativa autorizada entrar e o Firestore não tiver anúncios, o site migra os imóveis locais desse navegador para `properties`. Reservas antigas do armazenamento local não são migradas porque não têm proprietário/UID confiável; cadastros e estadias novos passam a usar as contas Firebase.

O SDK do Firebase é carregado das bibliotecas oficiais via CDN. A configuração pública do app está em `js/firebase.js`; as regras protegem os dados e não devem ser substituídas por regras abertas. Pagamentos ainda não são ativados nesta etapa.
