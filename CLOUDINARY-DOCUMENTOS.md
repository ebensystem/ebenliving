# Envio de documentos Eben Home

## Identidade/CNH (fluxo direto temporário)

A identidade da primeira fase é enviada diretamente do navegador ao Cloudinary, sem Cloud Function e sem plano Blaze. O preset usado pelo site é `ebenliving_documentos`, no ambiente `ztdylmq7`.

Configure o preset como `Unsigned`, pasta `ebenliving/documentos`, `Disallow public ID` ativado e ID aleatório não previsível. Em `Allowed formats`, permita `jpg`, `png` e `pdf` (não deixe somente `svg`). O site limita o arquivo a 5 MB e salva no Firestore o URL e os metadados, sujeitos às regras de acesso.

**Atenção:** o preset informa `type: upload`, então os arquivos ficam acessíveis a qualquer pessoa que obtenha a URL do Cloudinary. As regras do Firestore protegem os metadados, mas não tornam privado o arquivo armazenado no Cloudinary. Não use este fluxo para documentos sensíveis em produção sem aceitar esse risco.

## Contratos assinados

O envio e a abertura dos contratos assinados ainda usam as Cloud Functions existentes, com ativos privados no Cloudinary. Esse fluxo requer backend publicado e, portanto, não fica habilitado pela alteração temporária da identidade.

Para voltar a processar esses contratos por Cloud Functions, configure `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` no Secret Manager e publique as funções conforme a configuração Firebase do projeto. Nunca coloque a API Secret no navegador ou no repositório.
