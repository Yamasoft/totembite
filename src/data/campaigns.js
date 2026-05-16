/**
 * Campanhas especiais da Farmavet.
 *
 * TODO (admin): substituir por GET /api/campaigns?active=true
 * quando o painel admin tiver suporte a campanhas.
 *
 * Estrutura de cada campanha:
 *   id            — identificador único
 *   active        — true/false (ligar/desligar sem apagar)
 *   title         — título principal exibido no card
 *   subtitle      — descrição curta
 *   buttonLabel   — texto do botão de ação
 *   targetCategory — categoria que o botão abre ('produtos' | 'banho_tosa' | 'clinica' | 'comunidade')
 *   accent        — cor de destaque hex opcional (padrão: azul Farmavet)
 *   startDate     — 'YYYY-MM-DD' — início da exibição (inclusive)
 *   endDate       — 'YYYY-MM-DD' — fim da exibição (inclusive)
 */
export const campaigns = [
  {
    id: 'banho-tosa-premium',
    active: true,
    title: 'Banho e tosa premium',
    subtitle: 'Cuidado completo com acabamento profissional.',
    buttonLabel: 'Agendar',
    targetCategory: 'banho_tosa',
    accent: '#0c2461',
    image: '/images/banners/campanha-banho-tosa-premium.png',
    startDate: '2026-05-01',
    endDate: '2026-12-31',
  },
  // Para ativar uma campanha, copie a estrutura abaixo, ajuste os campos e remova os comentários:
  // {
  //   id: 'semana-banho-tosa',
  //   active: true,
  //   title: 'Semana do Banho e Tosa',
  //   subtitle: 'Condições especiais para cães e gatos',
  //   buttonLabel: 'Ver ofertas',
  //   targetCategory: 'banho_tosa',   // 'produtos' | 'banho_tosa' | 'clinica' | 'comunidade'
  //   accent: '#1565c0',              // cor hex opcional — padrão: azul Farmavet
  //   startDate: '2026-05-13',        // YYYY-MM-DD
  //   endDate: '2026-05-20',          // YYYY-MM-DD (inclusive)
  // },
];
