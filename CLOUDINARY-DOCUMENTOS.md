# Documentos privados dos contratos Eben Home

Fotos de identidade/CNH e contratos assinados sao enviados pelo backend ao Cloudinary como ativos `authenticated`. O Firestore guarda somente metadados; uma funcao autenticada verifica a parte e gera o acesso temporario ao documento. Nao use o preset publico das fotos dos imoveis para esses arquivos.

Configure os segredos no projeto Firebase antes de implantar as funcoes:

```sh
firebase functions:secrets:set CLOUDINARY_API_KEY --project ebenliving-52a3e
firebase functions:secrets:set CLOUDINARY_API_SECRET --project ebenliving-52a3e
firebase deploy --only firestore:rules,functions:uploadRentalDocument,functions:getRentalDocumentUrl,functions:advanceRentalStage --project ebenliving-52a3e
```

Use a API Key e a API Secret do ambiente Cloudinary `ztdylmq7`. A API Secret deve ficar somente no Secret Manager do Firebase/Google Cloud, nunca no navegador ou no repositorio.

Limite de 5 MB por arquivo. Identidade aceita JPG, PNG ou PDF; contrato aceita PDF. Os assets ficam sob `ebenliving/documentos/` com entrega privada.
