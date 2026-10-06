# Eben Mobile

Modalidade para carros e motorhomes, com aluguel por diária e período definido por retirada/devolução.

- No painel, escolha Eben Mobile e cadastre o veículo com fotos, lugares, diária, limpeza, características e condições.
- Finalidades: temporada/viagens, dirigir em aplicativos ou ambas. O solicitante escolhe uma das finalidades permitidas.
- A busca permite filtrar tipo de veículo e finalidade. O total usa a diferença entre as datas multiplicada pela diária, mais a limpeza uma vez. A data de devolução não ocupa diária.
- A solicitação guarda a modalidade e a finalidade, além do e-mail e telefone/WhatsApp. O proprietário pode usar links de e-mail, ligação e WhatsApp.
- Painel, agenda, recebimentos e exportação são filtrados por modalidade. Locação registrada manualmente também permite escolher a finalidade.
- O proprietário informa as condições de retirada, devolução, quilometragem e uso em aplicativos. A plataforma registra uma solicitação; não realiza análise automática de documentos ou elegibilidade em aplicativos.
- A modalidade usa os mesmos bloqueios e controles de acesso das outras. A expiração automática de 48 horas continua aguardando ativação do Blaze.

Testes: tests/mobile.cjs, tests/contacts-dashboard.cjs e cenário Mobile em tests/firestore.test.cjs.
