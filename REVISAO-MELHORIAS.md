# Revisão estética e funcional — ebenLiving

Data: 04/10/2026. Escopo: as nove páginas do produto, oito cópias em diretórios, CSS compartilhado, autenticação, reservas, gestão, fotos e regras locais do Firestore.

Método: inspeção do código e execução das quatro suítes existentes em runtime Node disponível nas ferramentas. Não havia navegador conectado: layout renderizado, responsividade real e fluxos autenticados no Firebase não foram validados. As observações visuais abaixo são recomendações baseadas no HTML/CSS, não resultados de screenshots. A revisão original abaixo registra o diagnóstico. As correções aplicadas posteriormente estão no registro de implementação a seguir.


## Implementação — 04/10/2026

Aplicado no código local:
- Retorno do login/cadastro ao checkout e preservação da modalidade e mês do aluguel.
- Ativação visível da conta de anunciante e autenticação na página do imóvel.
- Recuperação de senha, mostrar/ocultar senha, estado de envio e retomada após falha parcial do cadastro.
- Catálogo aberto por padrão; limpeza preserva modalidade; busca pode ser recuperada ao voltar do anúncio.
- Rotas locais com e sem barra final, incluindo Anuncie.
- Contato por e-mail nas solicitações e acesso ao contato na tabela do anunciante.
- Confirmação de sucesso após persistência para status, favoritos, visibilidade e bloqueios.
- Favoritos exigem login, evitando prometer persistência ao visitante sem conta.
- Carregamento e falhas explícitos; tratamento de erros nos listeners; estado inválido não fica marcado como pronto.
- Filtros de reservas; seleção pelo calendário; acesso a todas as fotos; título, descrição e canonical atualizados por imóvel no navegador.
- Condições e cancelamento como campo do anúncio, preenchido pelo anunciante e exibido nos detalhes.
- Revalidação de preço e modalidade antes de registrar interesse em aluguel mensal/anual.
- Legibilidade, tamanho dos controles, formulário móvel, navegação de Anuncie, tema escuro e botão de tema sem sobreposição fixa.
- Texto de apresentação de Anuncie, título do painel e indicação de recebimentos por competência.
- Script scripts/sync-pages.mjs para gerar as oito cópias em diretórios a partir dos HTMLs da raiz. Editar o arquivo da raiz e executar o script antes de publicar.
- Regras locais reforçadas para formato/ordem de datas, capacidade, contato, modalidade e identificador de bloqueio. Ainda exigem validação no emulador e publicação.

Validação executada: quatro suítes existentes aprovadas (26 casos em core), nova suíte de autenticação aprovada, sintaxe dos scripts verificada e 10 URLs locais respondendo HTTP 200.

Ainda pendente, sem alegação de conclusão:
- Conferência visual renderizada e teste de login/upload/reserva com contas de teste: não há navegador conectado nesta sessão.
- Teste das regras no emulador e publicação no Firebase; nenhuma alteração foi implantada remotamente.
- Reserva validada integralmente no servidor (cálculo autoritativo e garantia de todos os bloqueios), expiração automática de pendências e notificações: exigem implementação/configuração de backend. O reforço das regras locais não substitui essa operação.
- Prazo de expiração, regras comerciais de cancelamento, documentos de privacidade/condições e canal institucional de suporte precisam de definições do responsável pelo serviço; não foram inventados.
- Paginação e mudança de consultas devem acompanhar o desenho do backend e os índices do catálogo.
- Nova arte de logo/ícones, consolidação completa dos três CSS e reformulação integral do painel ficam como evolução visual. As tabelas atuais receberam legibilidade e rolagem móvel, não conversão para cartões.
- Metadados por imóvel atualizados no cliente não garantem preview em robôs de compartilhamento; renderização no servidor permanece pendente.

## Diagnóstico original — prioridade 1

1. **Login perde a reserva em andamento.** Em `js/auth.js:18`, `form.dataset.redirect` tem precedência sobre o parâmetro `redirect`. Como login e cadastro fixam `/reservas`, o cliente encaminhado pelo checkout não retorna à solicitação. Os links entre login e cadastro também descartam o contexto. Priorizar o destino validado da URL e preservá-lo entre as telas.
2. **Ativação de anunciante fica invisível.** Em `anuncie/index.html`, o botão está dentro de `#hostUpgrade[hidden]`; `js/auth.js` remove o ocultamento do botão, mas não do contêiner. Para cliente já conectado, o formulário desaparece e a ação de ativar continua invisível. Alternar o contêiner inteiro.
3. **Aluguel mensal/anual não encaminha visitante ao login.** `imovel.html` e `imovel/index.html` não incluem `js/auth.js`, que intercepta `#homeBookingForm`. O visitante consegue preencher o formulário, mas a persistência recusa a solicitação sem conta, com erro genérico. Carregar autenticação nessa tela e preservar imóvel, contrato e entrada no retorno.
4. **Explorar, Favoritos e Limpar filtros deixam o catálogo oculto.** Os links apontam para `/#imoveis` ou `/?favorites=1#imoveis`, mas catálogo e busca começam com `hidden`. A inicialização de `living.js` só chama `choosePlan` quando existe `plan=flex` ou `plan=home`. Abrir uma modalidade ou apresentar uma escolha explícita ao seguir esses links; limpar filtros deve manter a modalidade e os resultados visíveis.
5. **Rotas locais não reproduzem os links do site.** `serve.mjs` não resolve diretórios para `index.html`, portanto `/login/`, `/admin/`, `/anuncie/` etc. chegam a `readFile` como diretórios e retornam 404. `/anuncie` também não está no mapa. Padronizar URLs e resolver corretamente diretórios, preservando parâmetros. Confirmar comportamento separadamente no hosting.
6. **Promessa de contato sem canal implementado.** O checkout diz que o anunciante entrará em contato, mas a solicitação guarda nome/apelido e UID, sem telefone/e-mail ou mensageria. As regras de `users` só permitem leitura pelo próprio usuário. Definir um canal real de atendimento e mostrar ao cliente como acompanhar a resposta.
7. **Confirmação visual antes da gravação terminar.** `changeStatus`, favoritos, visibilidade e bloqueios mostram sucesso logo após `save`, sem aguardar `EbenLastPersist`. Em falha de rede, pode haver mensagem de sucesso seguida de reversão. Seguir o padrão já utilizado no checkout: estado de envio, confirmação após persistência e erro recuperável.

## Revisão por página

| Página | Melhorias funcionais | Melhorias estéticas e de experiência |
|---|---|---|
| Início | Resolver abertura do catálogo pelos links; manter filtros na volta do imóvel; diferenciar ausência de anúncios de ausência de resultados; definir persistência de favoritos para visitantes. | Tornar busca e modalidades mais evidentes; reduzir quantidade de ações no cabeçalho; uniformizar ícones; melhorar legibilidade dos preços e informações secundárias. |
| Imóvel | Incluir autenticação no Home; mostrar carregamento antes de declarar imóvel indisponível; permitir selecionar datas pelo calendário; preservar a busca no botão de voltar. | Exibir contador e ação “Ver todas as fotos”; esclarecer regras, localização aproximada e condições; considerar resumo da reserva mais acessível no celular. |
| Checkout | Corrigir retorno do login; implementar canal de contato; apresentar política de cancelamento e condições específicas do anúncio; separar erro de carregamento de imóvel inexistente. | Destacar total e próxima etapa; reduzir texto genérico; indicar claramente que se trata de solicitação e que pagamento não ocorre nessa tela. |
| Minhas reservas | Filtrar próximas, anteriores e canceladas; definir condições de cancelamento; disponibilizar contato e histórico de mudanças de status. | Organizar cartões por período e status; distinguir mensal/anual de temporada; incluir próximos passos nas solicitações pendentes. |
| Login do cliente | Corrigir redirect; oferecer recuperação de senha, hoje ausente; manter contexto ao criar conta. | Mostrar/ocultar senha, estado “Entrando…” e mensagens junto aos campos; manter identidade de conta clara. |
| Cadastro | Preservar destino; tratar falha parcial entre criação da conta e gravação do perfil; orientar sobre senha e dados utilizados. | Exibir requisitos de senha de modo simples; melhorar feedback de preenchimento; padronizar navegação de retorno. |
| Anuncie | Corrigir `#hostUpgrade`; tratar conta existente com caminho claro para login; adicionar navegação móvel — `.nav` é escondida até 900 px e esta tela não tem botão de menu. | Explicar etapas de publicação, benefícios e condições do serviço antes do cadastro; tornar ativação de conta existente evidente; rever espaçamento e largura do formulário em tela. |
| Login do anunciante | Recuperar senha; orientar cliente que precisa ativar perfil; evitar percursos confusos entre login e acesso restrito. | Reutilizar os componentes do login do cliente, com títulos e ações específicos para anunciante. |
| Painel do anunciante | Aguardar persistência nas ações; permitir revisão de pagamentos e entradas/saídas; diferenciar recebimentos por competência de recebimentos por data efetiva; “Ver minha vitrine” hoje abre catálogo geral. | Reduzir altura do título inicial; priorizar pendências e operação; adaptar tabelas para cartões no celular; dividir cadastro de imóvel em etapas ou grupos menores. |

## Aparência compartilhada

- **Tipografia:** há informações em 8–11 px, inclusive tabelas, legendas e metadados. Aumentar os textos necessários à decisão; reservar tamanhos pequenos para informação realmente auxiliar.
- **Formulários móveis:** inputs usam 14 px no breakpoint móvel. Considerar 16 px para leitura e evitar zoom automático em navegadores móveis que adotam esse comportamento.
- **Tema escuro:** revisar `.nav.show-mobile`, `.calendar-cell.disabled`, `.info-box`, `.icon-button` e `.hero-badge strong`. Existem fundos claros, gradiente claro ou cores fixas que não recebem substituições completas. Validar contraste renderizado antes de aprovar.
- **Marca:** a logo é uma imagem grande recortada por offsets negativos e invertida por filtro no tema escuro. Preferir arquivos próprios para fundo claro/escuro, sem recorte artificial.
- **Ícones:** misturam emoji e caracteres como casa, seta e coração. Unificar estilo e proporções em um conjunto consistente.
- **Botão de tema no celular:** fica fixo no canto inferior; conferir sobreposição com avisos e botões de ação, ou transferir para o menu.
- **Estados:** padronizar carregamento, erro, vazio, envio e sucesso. Imóvel e checkout podem mostrar indisponibilidade antes da primeira resposta do banco.
- **Navegação e rodapé:** padronizar cabeçalhos, acesso à conta e links de ajuda, contato, privacidade e condições do serviço.

## Integridade funcional e manutenção

- **Validação de reserva no servidor:** as regras locais verificam alguns tipos, mas não exigem coerência de datas, capacidade ou total com o anúncio, nem exigem todos os bloqueios correspondentes à reserva. As validações do JavaScript podem ser contornadas por clientes próprios. Fortalecer a operação de reserva no servidor e testar concorrência e escrita parcial em ambiente isolado. Não foi verificado se estas regras estão publicadas.
- **Bloqueios pendentes:** solicitações pendentes ocupam datas sem expiração automática identificada. Definir prazo de resposta/expiração para não imobilizar anúncios indefinidamente.
- **Sincronização:** os listeners `onSnapshot` não têm callbacks de erro. Mostrar quando a atualização em tempo real falhar e oferecer recuperação.
- **Carga de dados:** cada visitante lê todos os imóveis e todos os bloqueios, além de escutar essas coleções. Planejar consultas por modalidade/período e paginação conforme o catálogo crescer.
- **Duplicação:** as oito páginas `.html` são idênticas às respectivas cópias `pasta/index.html`. Centralizar geração para evitar divergências em futuras alterações.
- **CSS:** três folhas sobrepõem estilos dos mesmos componentes. Consolidar tokens e regras por componente depois das correções funcionais.
- **SEO de imóveis:** título e canonical são genéricos para todos os IDs. Planejar metadados por anúncio e preview de compartilhamento. Não tratar isso como já validado em indexadores.
- **Gestão existente sem integração:** `js/portfolio.js` contém funções de vencimento, atraso e ocupação, mas não é carregado pelo painel atual. Avaliar reaproveitamento, com validação, antes de implementar outra versão.

## Testes executados

- `tests/reservations.cjs`: passou.
- `tests/management.cjs`: passou.
- `tests/photos.cjs`: passou.
- `tests/core.test.cjs`: passou nos cinco primeiros casos e interrompeu no sexto. O teste exige rejeitar 366 noites; `validateDates` aceita até 366. Definir requisito por modalidade e alinhar teste e implementação, preservando contratos anuais que atravessam ano bissexto. Os casos posteriores não foram executados por esta suíte.

Esses testes usam simulações e regras locais; não comprovam login real, autorização publicada, upload remoto ou reserva ponta a ponta.

## Ordem recomendada

1. Corrigir rotas, redirects, ativação de anunciante, autenticação do Home e abertura do catálogo.
2. Garantir integridade de reservas, contato, persistência e tratamento de falhas.
3. Ajustar leitura, tema escuro, formulários e navegação móvel.
4. Refinar galeria, painel, filtros e conteúdo de conversão.
5. Validar em navegador: larguras de 360, 390, 768 e 1440 px; tema claro/escuro; teclado; visitante/cliente/anunciante; rede lenta e falha de gravação. Usar contas e anúncios de teste, evitando alterar reservas reais.

## Continuação — 05/10/2026

- Prazo escolhido pelo responsável: 48 horas. Rotina pronta em functions/, com transação e liberação seletiva de bloqueios.
- 15 testes de regras/integração passaram no emulador, incluindo concorrência; 5 testes unitários da expiração passaram. Suítes existentes também passaram.
- Regras publicadas no Firebase ebenliving-52a3e em 05/10/2026 (ruleset 3a5dee62-2000-4c0b-99e1-7f2df1ffe62d).
- Implantação da função aguardando ativação do faturamento pelo responsável. A interface não promete expiração automática enquanto automaticExpirationEnabled estiver false.
- Validação visual em navegador segue pendente: a ferramenta retorna zero navegadores conectados. Não foi declarada aprovação visual.
- Instruções de teste, publicação e ativação em BACKEND.md.
