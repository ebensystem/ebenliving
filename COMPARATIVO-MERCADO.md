# ebenLiving — revisão do produto

Pesquisa realizada em 29/09/2026. Referências usadas para padrões de usabilidade, sem copiar layouts, textos ou avaliações de terceiros.

| Referência | Recurso observado | Melhoria implementada |
| --- | --- | --- |
| [Airbnb — busca e favoritos](https://www.airbnb.co.uk/help/article/421) | Busca por características da estadia e listas de favoritos | Destino, datas, capacidade, comodidades e favoritos persistidos localmente |
| [Booking.com — busca de acomodações](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties) | Disponibilidade, dados dos hóspedes e ordenação | Filtro por hóspedes, exclusão de períodos ocupados e ordenação por preço/capacidade |
| [Booking.com — filtros e ordenação](https://developers.booking.com/demand/docs/accommodations/filter-sorting) | Combinação de filtros | Destino + período + preço máximo por diária + comodidade |
| [Airbnb — transparência no preço](https://www.airbnb.com/resources/hosting-homes/a/how-search-works-on-airbnb-460) | Consideração do preço total, incluindo taxas | Total da estadia com limpeza na busca com datas, no detalhe e na revisão |
| [Vrbo — calendário do anfitrião](https://help.vrbo.com/articles/How-does-the-calendar-work) | Reservas, bloqueios e conflitos de disponibilidade | Calendário mensal navegável, bloqueio por período, desbloqueio e prevenção de conflitos locais |

## Problemas corrigidos

- Identidade antiga substituída por ebenLiving em todas as páginas.
- Logo fornecido preservado em `assets/ebenliving-logo.png`; o cabeçalho enquadra o conteúdo por CSS, sem modificar o arquivo.
- Datas de busca antes ignoradas agora filtram disponibilidade.
- Calendário fixo substituído por calendário mensal com dias da semana e navegação.
- Total com taxa de limpeza calculado antes de enviar a solicitação.
- Painel com cadastro, edição, pausa e reativação de acomodações.
- Indicadores calculados a partir das solicitações, por mês de entrada. Valor confirmado não representa pagamento recebido.
- Reservas com confirmação, cancelamento, busca, filtro por status e exportação CSV.
- Área “Minhas estadias”, galeria ampliada, compartilhamento e favoritos.
- Formulários e mensagens acessíveis, navegação mobile, redução de movimento e estados vazios.
- Textos digitados escapados antes da renderização, URLs de imagem restritas a HTTPS, CSV protegido contra fórmulas.
- Erros de armazenamento não são apresentados como gravações bem-sucedidas.
- Formulários fictícios de senha, CPF e cartão substituídos por um fluxo claramente demonstrativo, sem coleta desses dados.

## Limites e próximos passos

1. Backend com autenticação, perfis de anfitrião/hóspede e autorização por propriedade. O painel atual é público e local.
2. Banco de dados e bloqueio transacional de inventário. A validação local relê o estado antes de salvar, mas não garante exclusão mútua entre gravações simultâneas de abas nem disponibilidade entre dispositivos.
3. Gateway de pagamento, webhooks idempotentes e reconciliação. Não há cobrança nesta versão.
4. Políticas comerciais, horários de entrada/saída, cancelamento e privacidade antes da operação pública.
5. Upload e processamento de imagens, geolocalização, avaliações verificadas e integração de calendários externos.

Não foram inventadas avaliações, certificações, disponibilidade em tempo real ou promessas de segurança transacional.

## Validação

- 25 testes automatizados das regras em `tests/core.test.cjs`.
- 34 verificações de integração em Chrome headless em `tests/browser.html`.
- Fluxos cobertos: busca, capacidade, favoritos, galeria, preço total, solicitação, conflito, confirmação, indicadores, bloqueios, edição, cadastro, pausa, cancelamento e liberação das datas.
- Verificação de ausência de rolagem horizontal a 375 px nas páginas de vitrine, painel, imóvel, estadias e perfil.
- Capturas desktop e mobile guardadas em `tests/` para revisão visual.
