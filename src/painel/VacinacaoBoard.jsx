import { useState, useCallback } from 'react'
import { AgendaGrid } from './AgendaGrid'

/* ─── Mock data ─────────────────────────────────────────────── */
const VETS_INICIAL = ['Dra. Ana', 'Dr. Paulo', 'Dra. Sofia']

// Hoje — mix de status, 3 vets
const MOCK_DIA_0 = [
  { id: 'vac-01', horario: '08:00', profissional: 'Dra. Ana',   pet: { nome: 'Thor',    especie: 'Cão',  raca: 'Labrador'    }, responsavel: { nome: 'Carlos Silva',     fone: '(61) 99333-0001' }, servico: 'Antirrábica',       status: 'em_atendimento' },
  { id: 'vac-02', horario: '08:00', profissional: 'Dr. Paulo',  pet: { nome: 'Mel',     especie: 'Cão',  raca: 'Golden'      }, responsavel: { nome: 'Juliana Lima',     fone: '(61) 99333-0002' }, servico: 'V10 (décupla)',      status: 'em_atendimento' },
  { id: 'vac-03', horario: '08:00', profissional: 'Dra. Sofia', pet: { nome: 'Luna',    especie: 'Gato', raca: 'SRD'         }, responsavel: { nome: 'Mariana Costa',    fone: '(61) 99333-0003' }, servico: 'Tríplice Felina',   status: 'em_atendimento' },
  { id: 'vac-04', horario: '08:30', profissional: 'Dra. Ana',   pet: { nome: 'Bob',     especie: 'Cão',  raca: 'Poodle'      }, responsavel: { nome: 'Rafael Souza',     fone: '(61) 99333-0004' }, servico: 'Gripe Canina',      status: 'aguardando' },
  { id: 'vac-05', horario: '08:30', profissional: 'Dr. Paulo',  pet: { nome: 'Nina',    especie: 'Cão',  raca: 'Beagle'      }, responsavel: { nome: 'Bruno Ferreira',   fone: '(61) 99333-0005' }, servico: 'Bordetella',        status: 'aguardando' },
  { id: 'vac-06', horario: '08:30', profissional: 'Dra. Sofia', pet: { nome: 'Mia',     especie: 'Gato', raca: 'Persa'       }, responsavel: { nome: 'Júlio César',      fone: '(61) 99333-0006' }, servico: 'Tríplice Felina',   status: 'aguardando' },
  { id: 'vac-07', horario: '09:00', profissional: 'Dra. Ana',   pet: { nome: 'Max',     especie: 'Cão',  raca: 'SRD'         }, responsavel: { nome: 'Ana Paula',        fone: '(61) 99333-0007' }, servico: 'V8 (óctupla)',       status: 'agendado' },
  { id: 'vac-08', horario: '09:00', profissional: 'Dr. Paulo',  pet: { nome: 'Lola',    especie: 'Cão',  raca: 'Shih Tzu'    }, responsavel: { nome: 'Roberto Santos',   fone: '(61) 99333-0008' }, servico: 'Antirrábica',       status: 'agendado' },
  { id: 'vac-09', horario: '09:00', profissional: 'Dra. Sofia', pet: { nome: 'Simba',   especie: 'Gato', raca: 'Siamês'      }, responsavel: { nome: 'Vanessa Lima',     fone: '(61) 99333-0009' }, servico: 'Leucemia Felina',   status: 'agendado' },
  { id: 'vac-10', horario: '09:30', profissional: 'Dra. Ana',   pet: { nome: 'Apolo',   especie: 'Cão',  raca: 'Labrador'    }, responsavel: { nome: 'Fernanda Alves',   fone: '(61) 99333-0010' }, servico: 'Giárdia',           status: 'agendado' },
  { id: 'vac-11', horario: '09:30', profissional: 'Dr. Paulo',  pet: { nome: 'Zoe',     especie: 'Cão',  raca: 'Bulldog'     }, responsavel: { nome: 'Patrícia Oliveira',fone: '(61) 99333-0011' }, servico: 'V10 (décupla)',      status: 'agendado' },
  { id: 'vac-12', horario: '09:30', profissional: 'Dra. Sofia', pet: { nome: 'Billie',  especie: 'Gato', raca: 'Angorá'      }, responsavel: { nome: 'Diego Araújo',     fone: '(61) 99333-0012' }, servico: 'Antirrábica',       status: 'agendado' },
  { id: 'vac-13', horario: '10:00', profissional: 'Dra. Ana',   pet: { nome: 'Rex',     especie: 'Cão',  raca: 'Pastor Al.'  }, responsavel: { nome: 'Lucas Mendes',     fone: '(61) 99333-0013' }, servico: 'Leishmaniose',      status: 'agendado' },
  { id: 'vac-14', horario: '10:00', profissional: 'Dr. Paulo',  pet: { nome: 'Charlie', especie: 'Cão',  raca: 'Dachshund'   }, responsavel: { nome: 'Beatriz Amaral',   fone: '(61) 99333-0014' }, servico: 'Gripe Canina',      status: 'agendado' },
  { id: 'vac-15', horario: '10:00', profissional: 'Dra. Sofia', pet: { nome: 'Chanel',  especie: 'Gato', raca: 'Ragdoll'     }, responsavel: { nome: 'Hugo Alves',       fone: '(61) 99333-0015' }, servico: 'Tríplice Felina',   status: 'agendado' },
]

// Ontem — todos concluídos
const MOCK_DIA_M1 = [
  { id: 'vacy-01', horario: '08:00', profissional: 'Dra. Ana',   pet: { nome: 'Bidu',    especie: 'Cão',  raca: 'SRD'      }, responsavel: { nome: 'Tiago Neves',    fone: '(61) 99333-1001' }, servico: 'Antirrábica',     status: 'concluido' },
  { id: 'vacy-02', horario: '08:00', profissional: 'Dr. Paulo',  pet: { nome: 'Fifi',    especie: 'Gato', raca: 'Persa'    }, responsavel: { nome: 'Cláudia Ribeiro',fone: '(61) 99333-1002' }, servico: 'Tríplice Felina', status: 'concluido' },
  { id: 'vacy-03', horario: '08:30', profissional: 'Dra. Sofia', pet: { nome: 'Brutus',  especie: 'Cão',  raca: 'Boxer'    }, responsavel: { nome: 'Pedro Antunes',  fone: '(61) 99333-1003' }, servico: 'V8 (óctupla)',    status: 'concluido' },
  { id: 'vacy-04', horario: '09:00', profissional: 'Dra. Ana',   pet: { nome: 'Docinho', especie: 'Cão',  raca: 'Maltês'   }, responsavel: { nome: 'Silvio Mendes',  fone: '(61) 99333-1004' }, servico: 'Bordetella',      status: 'concluido' },
  { id: 'vacy-05', horario: '09:00', profissional: 'Dr. Paulo',  pet: { nome: 'Fofo',    especie: 'Gato', raca: 'SRD'      }, responsavel: { nome: 'Maria das Dores',fone: '(61) 99333-1005' }, servico: 'Leucemia Felina', status: 'concluido' },
  { id: 'vacy-06', horario: '09:30', profissional: 'Dra. Sofia', pet: { nome: 'Trovão',  especie: 'Cão',  raca: 'Dálmata'  }, responsavel: { nome: 'André Campos',   fone: '(61) 99333-1006' }, servico: 'V10 (décupla)',   status: 'concluido' },
  { id: 'vacy-07', horario: '10:00', profissional: 'Dra. Ana',   pet: { nome: 'Kira',    especie: 'Cão',  raca: 'Cocker'   }, responsavel: { nome: 'Flávia Torres',  fone: '(61) 99333-1007' }, servico: 'Antirrábica',     status: 'concluido' },
  { id: 'vacy-08', horario: '10:00', profissional: 'Dr. Paulo',  pet: { nome: 'Bolinha', especie: 'Cão',  raca: 'SRD'      }, responsavel: { nome: 'Renato Lima',    fone: '(61) 99333-1008' }, servico: 'Giárdia',         status: 'concluido' },
  { id: 'vacy-09', horario: '10:30', profissional: 'Dra. Sofia', pet: { nome: 'Mel',     especie: 'Gato', raca: 'Angorá'   }, responsavel: { nome: 'Carla Ramos',    fone: '(61) 99333-1009' }, servico: 'Antirrábica',     status: 'concluido' },
]

// Amanhã — todos agendados
const MOCK_DIA_P1 = [
  { id: 'vact-01', horario: '08:00', profissional: 'Dra. Ana',   pet: { nome: 'Pipoca',   especie: 'Cão',  raca: 'Poodle'   }, responsavel: { nome: 'Sandra Melo',   fone: '(61) 99333-2001' }, servico: 'Antirrábica',     status: 'agendado' },
  { id: 'vact-02', horario: '08:00', profissional: 'Dr. Paulo',  pet: { nome: 'Dudu',     especie: 'Cão',  raca: 'Maltês'   }, responsavel: { nome: 'Paulo Freitas', fone: '(61) 99333-2002' }, servico: 'V8 (óctupla)',    status: 'agendado' },
  { id: 'vact-03', horario: '08:00', profissional: 'Dra. Sofia', pet: { nome: 'Nino',     especie: 'Gato', raca: 'Siamês'   }, responsavel: { nome: 'Giovanna Paz',  fone: '(61) 99333-2003' }, servico: 'Tríplice Felina', status: 'agendado' },
  { id: 'vact-04', horario: '08:30', profissional: 'Dra. Ana',   pet: { nome: 'Belinha',  especie: 'Cão',  raca: 'SRD'      }, responsavel: { nome: 'Rodrigo Matos', fone: '(61) 99333-2004' }, servico: 'Bordetella',      status: 'agendado' },
  { id: 'vact-05', horario: '09:00', profissional: 'Dr. Paulo',  pet: { nome: 'Bóris',    especie: 'Cão',  raca: 'Husky'    }, responsavel: { nome: 'Eduardo Costa', fone: '(61) 99333-2005' }, servico: 'V10 (décupla)',   status: 'agendado' },
  { id: 'vact-06', horario: '09:00', profissional: 'Dra. Sofia', pet: { nome: 'Princesa', especie: 'Gato', raca: 'Persa'    }, responsavel: { nome: 'Camila Xavier', fone: '(61) 99333-2006' }, servico: 'Leucemia Felina', status: 'agendado' },
  { id: 'vact-07', horario: '09:30', profissional: 'Dra. Ana',   pet: { nome: 'Spike',    especie: 'Cão',  raca: 'Beagle'   }, responsavel: { nome: 'Nelson Borges', fone: '(61) 99333-2007' }, servico: 'Giárdia',         status: 'agendado' },
  { id: 'vact-08', horario: '10:00', profissional: 'Dr. Paulo',  pet: { nome: 'Paçoca',   especie: 'Cão',  raca: 'SRD'      }, responsavel: { nome: 'Raquel Dias',   fone: '(61) 99333-2008' }, servico: 'Antirrábica',     status: 'agendado' },
  { id: 'vact-09', horario: '10:30', profissional: 'Dra. Sofia', pet: { nome: 'Bigode',   especie: 'Gato', raca: 'Angorá'   }, responsavel: { nome: 'Saulo Pinto',   fone: '(61) 99333-2009' }, servico: 'Tríplice Felina', status: 'agendado' },
]

// Além de amanhã — poucos agendados
const MOCK_DIA_P2 = [
  { id: 'vacf-01', horario: '09:00', profissional: 'Dra. Ana',   pet: { nome: 'Bola',   especie: 'Cão',  raca: 'SRD'    }, responsavel: { nome: 'Márcio Silva',  fone: '(61) 99333-3001' }, servico: 'Antirrábica',     status: 'agendado' },
  { id: 'vacf-02', horario: '09:30', profissional: 'Dr. Paulo',  pet: { nome: 'Chico',  especie: 'Cão',  raca: 'Cocker' }, responsavel: { nome: 'Taísa Corrêa',  fone: '(61) 99333-3002' }, servico: 'V8 (óctupla)',    status: 'agendado' },
  { id: 'vacf-03', horario: '10:00', profissional: 'Dra. Sofia', pet: { nome: 'Nena',   especie: 'Gato', raca: 'SRD'    }, responsavel: { nome: 'Jorge Peixoto', fone: '(61) 99333-3003' }, servico: 'Tríplice Felina', status: 'agendado' },
]

function getMockVacinacao(offset) {
  if (offset <= -2) return []
  if (offset === -1) return MOCK_DIA_M1
  if (offset === 0)  return MOCK_DIA_0
  if (offset === 1)  return MOCK_DIA_P1
  return MOCK_DIA_P2
}

/* ─── EXPORT ────────────────────────────────────────────────── */
export function VacinacaoBoard({ diaOffset }) {
  const [vets, setVets]                 = useState(VETS_INICIAL)
  const [agendamentos, setAgendamentos] = useState(() => getMockVacinacao(diaOffset))

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
    const candidatos = ['Dr. Henrique', 'Dra. Patrícia', 'Dr. Leandro', 'Dra. Bruna']
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
      titulo="Agenda - Vacinação"
      diaOffset={diaOffset}
      labelProfissional="Veterinário"
      labelServico="Vacina"
    />
  )
}
