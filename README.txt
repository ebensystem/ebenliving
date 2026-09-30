EBENLIVING — UM PRODUTO EBENSYSTEM

COMO ABRIR
Use um servidor local para que as páginas compartilhem o mesmo armazenamento.
- VS Code: abra index.html com a extensão Live Server.
- Com Node.js instalado: execute node serve.mjs e abra http://127.0.0.1:8765.
Abrir diretamente com file:// não garante armazenamento compartilhado entre páginas em todos os navegadores.

FUNCIONALIDADES
- Busca por destino, datas, hóspedes, diária e comodidades; ordenação.
- Favoritos locais, galeria ampliada e compartilhamento do link.
- Calendário mensal e preço total com limpeza por estadia.
- Solicitações locais, acompanhamento e cancelamento em reservas.html.
- Painel com cadastro, edição, pausa de anúncios, bloqueios e gestão de reservas.
- Indicadores calculados por mês de entrada e exportação CSV de todas as reservas.

ARQUIVOS
index.html: vitrine e busca
imovel.html: detalhes, calendário e simulação de preço
checkout.html: revisão e solicitação demonstrativa
reservas.html: solicitações neste navegador
admin.html: painel local do anfitrião
login.html / cadastro.html: perfil de demonstração da sessão, sem autenticação
js/data.js: acomodações iniciais de exemplo
js/core.js: regras puras e validação
js/living.js: interface e persistência
css/style.css / css/brand.css / css/living.css: base, identidade e componentes
assets/ebenliving-logo.png: logo original fornecido
COMPARATIVO-MERCADO.md: referências, melhorias e limites

DADOS E LIMITES
Os dados ficam no localStorage, chave ebenliving:v1, por navegador e origem.
Não são enviados para um servidor. Fotos usam URLs externas; fontes usam Google Fonts.
Não há autenticação, controle de acesso, pagamentos ou reservas reais. Use dados fictícios.
O painel e Minhas estadias mostram todos os registros deste navegador.
Solicitações pendentes e confirmadas ocupam datas; canceladas liberam as datas, exceto bloqueios manuais.
A entrada ocupa diária; a saída não. A limpeza é cobrada uma vez no valor simulado.
Pausar um imóvel retira-o da busca e impede novas solicitações; mantém as anteriores.
Solicitações guardam o valor original mesmo após edição da diária.
A releitura antes da gravação reduz conflitos locais, mas não substitui transações de backend.

TESTES
node tests/core.test.cjs — 25 verificações de regras.
Abra /tests/browser.html no servidor local — 34 verificações de integração.
Execute os testes em perfil isolado: eles usam dados fictícios temporários e restauram o estado ao finalizar. Não os rode junto de edições reais em outra aba.
Resultados e capturas de revisão estão em tests/.

PRODUÇÃO
Conectar autenticação, autorização, banco de dados, reservas transacionais, gateway, webhooks, políticas comerciais e privacidade antes de aceitar hóspedes reais.
