import { useState, useCallback } from 'react'
import { AgendaGrid } from './AgendaGrid'

/* ─── Mock data ─────────────────────────────────────────────── */
const VETS_INICIAL = ['Dr. Carlos', 'Dra. Fernanda', 'Dr. Márcio']

// Hoje — mix de status, 3 vets
const MOCK_DIA_0 = [
  { id: 'cl-01', horario: '08:00', profissional: 'Dr. Carlos',    pet: { nome: 'Thor',     especie: 'Cão',  raca: 'Labrador'       }, responsavel: { nome: 'Carlos Silva',    fone: '(61) 99111-0001' }, servico: 'Consulta geral',         status: 'em_atendimento' },
  { id: 'cl-02', horario: '08:00', profissional: 'Dra. Fernanda', pet: { nome: 'Mia',      especie: 'Gato', raca: 'SRD'            }, responsavel: { nome: 'Juliana Lima',    fone: '(61) 99111-0002' }, servico: 'Vacinação',              status: 'em_atendimento' },
  { id: 'cl-03', horario: '08:00', profissional: 'Dr. Márcio',    pet: { nome: 'Balu',     especie: 'Cão',  raca: 'Akita'          }, responsavel: { nome: 'Sandro Freitas',  fone: '(61) 99111-0003' }, servico: 'Ortopedia',              status: 'em_atendimento' },
  { id: 'cl-04', horario: '08:30', profissional: 'Dr. Carlos',    pet: { nome: 'Rex',      especie: 'Cão',  raca: 'Pastor Alemão'  }, responsavel: { nome: 'Mariana Costa',   fone: '(61) 99111-0004' }, servico: 'Retorno',                status: 'aguardando' },
  { id: 'cl-05', horario: '08:30', profissional: 'Dra. Fernanda', pet: { nome: 'Lua',      especie: 'Gato', raca: 'Persa'          }, responsavel: { nome: 'Rafael Souza',    fone: '(61) 99111-0005' }, servico: 'Dermatologia',           status: 'aguardando' },
  { id: 'cl-06', horario: '08:30', profissional: 'Dr. Márcio',    pet: { nome: 'Hulk',     especie: 'Cão',  raca: 'Rottweiler'     }, responsavel: { nome: 'Wagner Neves',    fone: '(61) 99111-0006' }, servico: 'Cirurgia — avaliação',   status: 'aguardando' },
  { id: 'cl-07', horario: '09:00', profissional: 'Dr. Carlos',    pet: { nome: 'Bolinha',  especie: 'Cão',  raca: 'Poodle'         }, responsavel: { nome: 'Ana Paula',       fone: '(61) 99111-0007' }, servico: 'Consulta geral',         status: 'agendado' },
  { id: 'cl-08', horario: '09:00', profissional: 'Dra. Fernanda', pet: { nome: 'Simba',    especie: 'Cão',  raca: 'Golden'         }, responsavel: { nome: 'Fernanda Alves',  fone: '(61) 99111-0008' }, servico: 'Vacinação',              status: 'agendado' },
  { id: 'cl-09', horario: '09:00', profissional: 'Dr. Márcio',    pet: { nome: 'Atena',    especie: 'Cão',  raca: 'Dogue de Bord.  '}, responsavel: { nome: 'Cristina Paes',  fone: '(61) 99111-0009' }, servico: 'Cardiologia',            status: 'agendado' },
  { id: 'cl-10', horario: '09:30', profissional: 'Dr. Carlos',    pet: { nome: 'Nina',     especie: 'Cão',  raca: 'SRD'            }, responsavel: { nome: 'Lucas Mendes',    fone: '(61) 99111-0010' }, servico: 'Limpeza dental',         status: 'agendado' },
  { id: 'cl-11', horario: '09:30', profissional: 'Dra. Fernanda', pet: { nome: 'Lili',     especie: 'Gato', raca: 'Angorá'         }, responsavel: { nome: 'Beatriz Amaral',  fone: '(61) 99111-0011' }, servico: 'Oftalmologia',           status: 'agendado' },
  { id: 'cl-12', horario: '10:00', profissional: 'Dr. Márcio',    pet: { nome: 'Bravo',    especie: 'Cão',  raca: 'Husky'          }, responsavel: { nome: 'Emerson Dias',    fone: '(61) 99111-0012' }, servico: 'Neurologia',             status: 'agendado' },
  { id: 'cl-13', horario: '10:00', profissional: 'Dr. Carlos',    pet: { nome: 'Pipoca',   especie: 'Cão',  raca: 'SRD'            }, responsavel: { nome: 'Hugo Alves',      fone: '(61) 99111-0013' }, servico: 'Consulta geral',         status: 'agendado' },
  { id: 'cl-14', horario: '10:30', profissional: 'Dra. Fernanda', pet: { nome: 'Chanel',   especie: 'Gato', raca: 'Ragdoll'        }, responsavel: { nome: 'Soraya Melo',     fone: '(61) 99111-0014' }, servico: 'Dermatologia',           status: 'agendado' },
]

// Ontem — todos concluídos
const MOCK_DIA_M1 = [
  { id: 'cly-01', horario: '08:00', profissional: 'Dr. Carlos',    pet: { nome: 'Zeus',     especie: 'Cão',  raca: 'Dobermann'    }, responsavel: { nome: 'Adriano Melo',    fone: '(61) 99111-1001' }, servico: 'Consulta geral',   status: 'concluido' },
  { id: 'cly-02', horario: '08:00', profissional: 'Dra. Fernanda', pet: { nome: 'Mel',      especie: 'Gato', raca: 'Ragdoll'      }, responsavel: { nome: 'Débora Santos',   fone: '(61) 99111-1002' }, servico: 'Vacinação',        status: 'concluido' },
  { id: 'cly-03', horario: '08:00', profissional: 'Dr. Márcio',    pet: { nome: 'Roque',    especie: 'Cão',  raca: 'Fila Bras.'   }, responsavel: { nome: 'Gilson Carmo',    fone: '(61) 99111-1003' }, servico: 'Ortopedia',        status: 'concluido' },
  { id: 'cly-04', horario: '08:30', profissional: 'Dr. Carlos',    pet: { nome: 'Bento',    especie: 'Cão',  raca: 'Beagle'       }, responsavel: { nome: 'Hélio Rocha',     fone: '(61) 99111-1004' }, servico: 'Retorno',          status: 'concluido' },
  { id: 'cly-05', horario: '09:00', profissional: 'Dra. Fernanda', pet: { nome: 'Lola',     especie: 'Cão',  raca: 'Shih Tzu'     }, responsavel: { nome: 'Nathália Lima',   fone: '(61) 99111-1005' }, servico: 'Limpeza dental',   status: 'concluido' },
  { id: 'cly-06', horario: '09:00', profissional: 'Dr. Márcio',    pet: { nome: 'Maximus',  especie: 'Cão',  raca: 'Mastiff'      }, responsavel: { nome: 'Isaías Porto',    fone: '(61) 99111-1006' }, servico: 'Cardiologia',      status: 'concluido' },
  { id: 'cly-07', horario: '09:30', profissional: 'Dr. Carlos',    pet: { nome: 'Caju',     especie: 'Cão',  raca: 'SRD'          }, responsavel: { nome: 'Osvaldo Prado',   fone: '(61) 99111-1007' }, servico: 'Consulta geral',   status: 'concluido' },
  { id: 'cly-08', horario: '10:00', profissional: 'Dra. Fernanda', pet: { nome: 'Perola',   especie: 'Gato', raca: 'Persa'        }, responsavel: { nome: 'Vera Cavalcanti', fone: '(61) 99111-1008' }, servico: 'Vacinação',        status: 'concluido' },
  { id: 'cly-09', horario: '10:30', profissional: 'Dr. Márcio',    pet: { nome: 'Tobias',   especie: 'Cão',  raca: 'SRD'          }, responsavel: { nome: 'Jeovah Queiroz',  fone: '(61) 99111-1009' }, servico: 'Neurologia',       status: 'concluido' },
]

// Amanhã — todos agendados
const MOCK_DIA_P1 = [
  { id: 'clt-01', horario: '08:00', profissional: 'Dr. Carlos',    pet: { nome: 'Brutus',    especie: 'Cão',  raca: 'Dogue Alemão' }, responsavel: { nome: 'Felipe Neto',    fone: '(61) 99111-2001' }, servico: 'Consulta geral',  status: 'agendado' },
  { id: 'clt-02', horario: '08:00', profissional: 'Dra. Fernanda', pet: { nome: 'Serena',    especie: 'Gato', raca: 'Siamês'       }, responsavel: { nome: 'Isaura Fontes',  fone: '(61) 99111-2002' }, servico: 'Dermatologia',    status: 'agendado' },
  { id: 'clt-03', horario: '08:00', profissional: 'Dr. Márcio',    pet: { nome: 'Goku',      especie: 'Cão',  raca: 'Shiba Inu'    }, responsavel: { nome: 'Jair Quevedo',   fone: '(61) 99111-2003' }, servico: 'Ortopedia',       status: 'agendado' },
  { id: 'clt-04', horario: '08:30', profissional: 'Dr. Carlos',    pet: { nome: 'Fofinho',   especie: 'Cão',  raca: 'Poodle'       }, responsavel: { nome: 'Júnior Assis',   fone: '(61) 99111-2004' }, servico: 'Retorno',         status: 'agendado' },
  { id: 'clt-05', horario: '09:00', profissional: 'Dra. Fernanda', pet: { nome: 'Bigodinho', especie: 'Gato', raca: 'Maine Coon'   }, responsavel: { nome: 'Larissa Cruz',   fone: '(61) 99111-2005' }, servico: 'Oftalmologia',    status: 'agendado' },
  { id: 'clt-06', horario: '09:00', profissional: 'Dr. Márcio',    pet: { nome: 'Imperador', especie: 'Cão',  raca: 'São Bernardo' }, responsavel: { nome: 'Kelvin Barros',  fone: '(61) 99111-2006' }, servico: 'Cardiologia',     status: 'agendado' },
  { id: 'clt-07', horario: '09:30', profissional: 'Dr. Carlos',    pet: { nome: 'Romeu',     especie: 'Cão',  raca: 'Golden'       }, responsavel: { nome: 'Mário Drummond', fone: '(61) 99111-2007' }, servico: 'Limpeza dental',  status: 'agendado' },
  { id: 'clt-08', horario: '10:00', profissional: 'Dra. Fernanda', pet: { nome: 'Julieta',   especie: 'Cão',  raca: 'Labrador'     }, responsavel: { nome: 'Norma Barbosa',  fone: '(61) 99111-2008' }, servico: 'Vacinação',       status: 'agendado' },
  { id: 'clt-09', horario: '10:30', profissional: 'Dr. Márcio',    pet: { nome: 'Estrela',   especie: 'Gato', raca: 'SRD'          }, responsavel: { nome: 'Olavo Brito',    fone: '(61) 99111-2009' }, servico: 'Neurologia',      status: 'agendado' },
]

// Além de amanhã — poucos agendados
const MOCK_DIA_P2 = [
  { id: 'clf-01', horario: '09:00', profissional: 'Dr. Carlos',    pet: { nome: 'Léo',    especie: 'Cão',  raca: 'Labrador' }, responsavel: { nome: 'Plínio Sá',      fone: '(61) 99111-3001' }, servico: 'Consulta geral', status: 'agendado' },
  { id: 'clf-02', horario: '09:30', profissional: 'Dra. Fernanda', pet: { nome: 'Duque',  especie: 'Cão',  raca: 'Cocker'   }, responsavel: { nome: 'Quênia Moraes',  fone: '(61) 99111-3002' }, servico: 'Retorno',        status: 'agendado' },
  { id: 'clf-03', horario: '10:00', profissional: 'Dr. Márcio',    pet: { nome: 'Marque', especie: 'Cão',  raca: 'Spitz'    }, responsavel: { nome: 'Ronaldo Pires',  fone: '(61) 99111-3003' }, servico: 'Ortopedia',      status: 'agendado' },
]

function getMockClinica(offset) {
  if (offset <= -2) return []
  if (offset === -1) return MOCK_DIA_M1
  if (offset === 0)  return MOCK_DIA_0
  if (offset === 1)  return MOCK_DIA_P1
  return MOCK_DIA_P2
}

/* ─── EXPORT ────────────────────────────────────────────────── */
export function ClinicaBoard({ diaOffset }) {
  const [vets, setVets]                 = useState(VETS_INICIAL)
  const [agendamentos, setAgendamentos] = useState(() => getMockClinica(diaOffset))

  const mudarStatus = useCallback((id) => {
    const ciclo = {
      agendado:       'aguardando',
      aguardando:     'em_atendimento',
      em_atendimento: 'concluido',
      concluido:      'concluido',
    }
    setAgendamentos(prev =>
      prev.map(a => a.id !== id ? a : { ...a, status: ciclo[a.status] })
    )
  }, [])

  const adicionarVet = useCallback(() => {
    const candidatos = ['Dra. Juliana', 'Dr. Rafael', 'Dra. Camila', 'Dr. Paulo']
    const existentes = new Set(vets)
    const proximo = candidatos.find(c => !existentes.has(c))
    if (proximo) setVets(prev => [...prev, proximo])
  }, [vets])

  return (
    <AgendaGrid
      profissionais={vets}
      agendamentos={agendamentos}
      onMudarStatus={mudarStatus}
      onAddProfissional={adicionarVet}
      labelAdicionar="+ Veterinário"
      visual="tv"
      titulo="Agenda - Clínica Veterinária"
      diaOffset={diaOffset}
      labelProfissional="Veterinário"
      labelServico="Consulta / Serviço"
    />
  )
}
