# Backend: expiração de solicitações

Prazo aprovado: **48 horas**. A função `expirePendingReservations` verifica pendências a cada 15 minutos, em `southamerica-east1`.

## Comportamento

- O prazo usa `DocumentSnapshot.createTime` do Firestore, nunca o relógio/data enviados pelo cliente.
- Inclui pendências existentes: uma pendência com mais de 48 horas será expirada na primeira execução.
- A transação relê a solicitação; reservas confirmadas e canceladas permanecem intactas.
- Cancela com `cancelReason: "expired"`, mantendo o histórico, e remove apenas os bloqueios vinculados ao ID dessa solicitação.
- Bloqueios manuais do imóvel e bloqueios de outras reservas permanecem intactos.
- Execuções repetidas ou simultâneas são idempotentes. Falhas são registradas sem dados de contato; o Scheduler pode repetir a execução.
- O prazo real de liberação pode ser de até 48 horas e 15 minutos, além de eventuais atrasos/falhas do serviço.

## Testar

Requisitos: Node.js 22, Java 21 ou superior, Firebase CLI e pnpm.

```sh
pnpm install --ignore-scripts
pnpm --dir functions install --ignore-scripts
pnpm test
firebase emulators:exec --only firestore --project demo-ebenliving-tests "pnpm test:rules"
```

Os testes usam apenas o projeto `demo-ebenliving-tests` no emulador `127.0.0.1:8085`. Há testes de regras, liberação seletiva de bloqueios e duas transações concorrentes. O emulador antigo 1.19.8 requer locale Java `en_US` para emitir erros de validação corretamente.

## Implantação

```sh
firebase deploy --only firestore:rules --project ebenliving-52a3e
firebase deploy --only functions:ebenliving --project ebenliving-52a3e
```

A implantação da função requer faturamento ativo no Google Cloud/Firebase Blaze. Em 05/10/2026, a tentativa foi bloqueada com `UREQ_PROJECT_BILLING_NOT_OPEN`. A função não está ativa em produção.

Após implantar, verificar a função e o job `firebase-schedule-expirePendingReservations-southamerica-east1` no Cloud Scheduler. Só então alterar `automaticExpirationEnabled` para `true` em `js/living.js` e publicar a interface, para exibir a promessa de expiração ao cliente.

Não usar TTL do Firestore para remover reservas: apagar documentos não libera os bloqueios atomicamente nem preserva o histórico.

## Limites restantes

A criação de reservas ainda usa o cliente e as regras do Firestore. Esta rotina não implementa cálculo autoritativo de preços nem exige todos os bloqueios na criação. Migrar a criação para uma operação transacional de servidor continua sendo uma melhoria separada.
