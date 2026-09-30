# Firebase Authentication — ebenLiving

O projeto usa Firebase Authentication com e-mail e senha. O checkout e Minhas estadias exigem uma sessão autenticada. O painel aceita a conta exata `suporte@ebensystem.com.br` depois que o e-mail for verificado pelo Firebase.

## Ativar cadastro e login

1. Abra [Authentication no projeto ebenLiving](https://console.firebase.google.com/u/0/project/ebenliving-52a3e/authentication/users?hl=pt-br).
2. Em **Sign-in method / Método de login**, habilite **E-mail/senha** (a opção de link por e-mail não é necessária para este fluxo).
3. Em **Configurações / Domínios autorizados**, confirme que `ebenliving.com.br` está autorizado.
4. Faça o primeiro cadastro em `cadastro.html`. As contas aparecem em **Authentication → Users**.

## Entrar como administrador

Crie ou entre na conta `suporte@ebensystem.com.br` em `/cadastro` ou `/admin-login`. O site envia um link de verificação para esse endereço; depois de confirmar o e-mail, entre novamente em `/admin-login`. As regras do Firestore autorizam apenas esse endereço verificado (além de outras contas com custom claim `admin: true`). Não conceda papéis administrativos com campos editáveis pelo cliente.

## Criar o banco e publicar as regras

Siga o passo a passo de [FIREBASE.md](FIREBASE.md) para criar o Firestore em `southamerica-east1 (São Paulo)` e publicar `firestore.rules`. Sem criar o banco e publicar as regras, o site não consegue sincronizar os dados.

O Firestore guarda anúncios, bloqueios de datas, solicitações, perfis e favoritos. As noites de uma estadia são registradas em `availability` e compartilhadas entre visitantes. As regras `firestore.rules` restringem cada gravação de acordo com a conta.

O checkout registra a solicitação e as datas, mas não cobra nem confirma pagamento. A integração com Mercado Pago será feita depois, quando a conta e as credenciais estiverem disponíveis; chaves privadas devem ficar somente no servidor.
