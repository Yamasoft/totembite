import { useState, useCallback } from 'react'
import { AgendaGrid } from './AgendaGrid'

/* ─── Mock data ─────────────────────────────────────────────── */
const PROFS_INICIAL = ['João', 'Ana', 'Pedro']

// Hoje
const MOCK_DIA_0 = [
  { id: 'bn-01', horario: '08:00', profissional: 'João',  pet: { nome: 'Fluffy',   especie: 'Cão',  raca: 'Lhasa Apso' }, responsavel: { nome: 'Carlos Silva',      fone: '(61) 99222-0001' }, servico: 'Banho e Tosa',       status: 'em_atendimento' },
  { id: 'bn-02', horario: '08:00', profissional: 'Ana',   pet: { nome: 'Mel',      especie: 'Cão',  raca: 'SRD'        }, responsavel: { nome: 'Juliana Lima',      fone: '(61) 99222-0002' }, servico: 'Banho',              status: 'em_atendimento' },
  { id: 'bn-03', horario: '08:00', profissional: 'Pedro', pet: { nome: 'Luke',     especie: 'Cão',  raca: 'Beagle'     }, responsavel: { nome: 'Bruno Ferreira',    fone: '(61) 99222-0003' }, servico: 'Tosa',               status: 'em_atendimento' },
  { id: 'bn-04', horario: '08:30', profissional: 'João',  pet: { nome: 'Luna',     especie: 'Cão',  raca: 'Golden'     }, responsavel: { nome: 'Mariana Costa',     fone: '(61) 99222-0004' }, servico: 'Tosa na Máquina',    status: 'aguardando' },
  { id: 'bn-05', horario: '08:30', profissional: 'Ana',   pet: { nome: 'Bob',      especie: 'Cão',  raca: 'Poodle'     }, responsavel: { nome: 'Rafael Souza',      fone: '(61) 99222-0005' }, servico: 'Banho e Tosa',       status: 'aguardando' },
  { id: 'bn-06', horario: '08:30', profissional: 'Pedro', pet: { nome: 'Pandora',  especie: 'Gato', raca: 'Persa'      }, responsavel: { nome: 'Júlio César',       fone: '(61) 99222-0006' }, servico: 'Banho e Tosa',       status: 'em_atendimento' },
  { id: 'bn-07', horario: '09:00', profissional: 'João',  pet: { nome: 'Nina',     especie: 'Cão',  raca: 'SRD'        }, responsavel: { nome: 'Ana Paula',         fone: '(61) 99222-0007' }, servico: 'Banho e Hidratação', status: 'aguardando' },
  { id: 'bn-08', horario: '09:00', profissional: 'Ana',   pet: { nome: 'Tang',     especie: 'Cão',  raca: 'Shih Tzu'   }, responsavel: { nome: 'Roberto Santos',    fone: '(61) 99222-0008' }, servico: 'Banho',              status: 'aguardando' },
  { id: 'bn-09', horario: '09:00', profissional: 'Pedro', pet: { nome: 'Meg',      especie: 'Cão',  raca: 'Cocker'     }, responsavel: { nome: 'Vanessa Lima',      fone: '(61) 99222-0009' }, servico: 'Banho',              status: 'agendado' },
  { id: 'bn-10', horario: '09:30', profissional: 'João',  pet: { nome: 'Apolo',    especie: 'Cão',  raca: 'Labrador'   }, responsavel: { nome: 'Fernanda Alves',    fone: '(61) 99222-0010' }, servico: 'Banho e Tosa',       status: 'agendado' },
  { id: 'bn-11', horario: '09:30', profissional: 'Ana',   pet: { nome: 'Zoe',      especie: 'Cão',  raca: 'Bulldog'    }, responsavel: { nome: 'Patrícia Oliveira', fone: '(61) 99222-0011' }, servico: 'Tosa Higiênica',     status: 'agendado' },
  { id: 'bn-12', horario: '09:30', profissional: 'Pedro', pet: { nome: 'Billy',    especie: 'Cão',  raca: 'SRD'        }, responsavel: { nome: 'Diego Araújo',      fone: '(61) 99222-0012' }, servico: 'Tosa na Máquina',    status: 'agendado' },
  { id: 'bn-13', horario: '10:00', profissional: 'João',  pet: { nome: 'Mia',      especie: 'Gato', raca: 'Siamês'     }, responsavel: { nome: 'Lucas Mendes',      fone: '(61) 99222-0013' }, servico: 'Tosa Higiênica',     status: 'agendado' },
  { id: 'bn-14', horario: '10:00', profissional: 'Ana',   pet: { nome: 'Charlie',  especie: 'Cão',  raca: 'Dachshund'  }, responsavel: { nome: 'Beatriz Amaral',    fone: '(61) 99222-0014' }, servico: 'Banho e Tosa',       status: 'agendado' },
  { id: 'bn-15', horario: '10:00', profissional: 'Pedro', pet: { nome: 'Theo',     especie: 'Cão',  raca: 'Boxer'      }, responsavel: { nome: 'Hugo Alves',        fone: '(61) 99222-0015' }, servico: 'Banho e Tosa',       status: 'agendado' },
]

// Ontem — tudo concluído
const MOCK_DIA_M1 = [
  { id: 'bny-01', horario: '08:00', profissional: 'João',  pet: { nome: 'Max',     especie: 'Cão',  raca: 'Rottweiler' }, responsavel: { nome: 'Tiago Neves',     fone: '(61) 99222-1001' }, servico: 'Banho e Tosa',    status: 'concluido' },
  { id: 'bny-02', horario: '08:00', profissional: 'Ana',   pet: { nome: 'Bela',    especie: 'Cão',  raca: 'Maltês'     }, responsavel: { nome: 'Cláudia Ribeiro', fone: '(61) 99222-1002' }, servico: 'Banho',           status: 'concluido' },
  { id: 'bny-03', horario: '08:30', profissional: 'Pedro', pet: { nome: 'Toby',    especie: 'Cão',  raca: 'Cocker'     }, responsavel: { nome: 'Pedro Antunes',   fone: '(61) 99222-1003' }, servico: 'Tosa',            status: 'concluido' },
  { id: 'bny-04', horario: '08:30', profissional: 'João',  pet: { nome: 'Bruna',   especie: 'Cão',  raca: 'SRD'        }, responsavel: { nome: 'Silvio Mendes',   fone: '(61) 99222-1004' }, servico: 'Tosa Higiênica',  status: 'concluido' },
  { id: 'bny-05', horario: '09:00', profissional: 'Ana',   pet: { nome: 'Pretinha', especie: 'Gato', raca: 'SRD'       }, responsavel: { nome: 'Maria das Dores', fone: '(61) 99222-1005' }, servico: 'Banho',           status: 'concluido' },
  { id: 'bny-06', horario: '09:00', profissional: 'Pedro', pet: { nome: 'Bolt',    especie: 'Cão',  raca: 'Dálmata'    }, responsavel: { nome: 'André Campos',    fone: '(61) 99222-1006' }, servico: 'Banho e Tosa',    status: 'concluido' },
  { id: 'bny-07', horario: '09:30', profissional: 'João',  pet: { nome: 'Kira',    especie: 'Cão',  raca: 'Shih Tzu'   }, responsavel: { nome: 'Flávia Torres',   fone: '(61) 99222-1007' }, servico: 'Banho e Tosa',    status: 'concluido' },
  { id: 'bny-08', horario: '10:00', profissional: 'Ana',   pet: { nome: 'Duke',    especie: 'Cão',  raca: 'Labrador'   }, responsavel: { nome: 'Renato Lima',     fone: '(61) 99222-1008' }, servico: 'Banho',           status: 'concluido' },
  { id: 'bny-09', horario: '10:30', profissional: 'Pedro', pet: { nome: 'Nala',    especie: 'Cão',  raca: 'Golden'     }, responsavel: { nome: 'Carla Ramos',     fone: '(61) 99222-1009' }, servico: 'Tosa na Máquina', status: 'concluido' },
]

// Amanhã — maioria agendado, alguns aguardando
const MOCK_DIA_P1 = [
  { id: 'bnt-01', horario: '08:00', profissional: 'João',  pet: { nome: 'Pipoca',  especie: 'Cão',  raca: 'Poodle'   }, responsavel: { nome: 'Sandra Melo',   fone: '(61) 99222-2001' }, servico: 'Banho e Tosa',    status: 'agendado' },
  { id: 'bnt-02', horario: '08:00', profissional: 'Ana',   pet: { nome: 'Docinho', especie: 'Cão',  raca: 'Maltês'   }, responsavel: { nome: 'Paulo Freitas',  fone: '(61) 99222-2002' }, servico: 'Banho',           status: 'agendado' },
  { id: 'bnt-03', horario: '08:30', profissional: 'Pedro', pet: { nome: 'Trovão',  especie: 'Cão',  raca: 'Boxer'    }, responsavel: { nome: 'Giovanna Paz',  fone: '(61) 99222-2003' }, servico: 'Tosa',            status: 'agendado' },
  { id: 'bnt-04', horario: '09:00', profissional: 'João',  pet: { nome: 'Belinha', especie: 'Cão',  raca: 'SRD'      }, responsavel: { nome: 'Rodrigo Matos', fone: '(61) 99222-2004' }, servico: 'Banho e Hidratação', status: 'agendado' },
  { id: 'bnt-05', horario: '09:00', profissional: 'Ana',   pet: { nome: 'Simba',   especie: 'Gato', raca: 'Siamês'   }, responsavel: { nome: 'Letícia Leal',  fone: '(61) 99222-2005' }, servico: 'Banho',           status: 'agendado' },
  { id: 'bnt-06', horario: '09:30', profissional: 'Pedro', pet: { nome: 'Bóris',   especie: 'Cão',  raca: 'Husky'    }, responsavel: { nome: 'Eduardo Costa', fone: '(61) 99222-2006' }, servico: 'Tosa Higiênica',  status: 'agendado' },
  { id: 'bnt-07', horario: '10:00', profissional: 'João',  pet: { nome: 'Princesa', especie: 'Cão', raca: 'Spitz'    }, responsavel: { nome: 'Camila Xavier', fone: '(61) 99222-2007' }, servico: 'Banho e Tosa',    status: 'agendado' },
  { id: 'bnt-08', horario: '10:00', profissional: 'Ana',   pet: { nome: 'Paçoca',  especie: 'Cão',  raca: 'SRD'      }, responsavel: { nome: 'Nelson Borges', fone: '(61) 99222-2008' }, servico: 'Tosa na Máquina', status: 'agendado' },
  { id: 'bnt-09', horario: '10:30', profissional: 'Pedro', pet: { nome: 'Mel',     especie: 'Gato', raca: 'Persa'    }, responsavel: { nome: 'Raquel Dias',   fone: '(61) 99222-2009' }, servico: 'Banho',           status: 'agendado' },
]

// Depois de amanhã e além — poucos agendados
const MOCK_DIA_P2 = [
  { id: 'bnf-01', horario: '08:30', profissional: 'João',  pet: { nome: 'Spike',   especie: 'Cão',  raca: 'Dachshund' }, responsavel: { nome: 'Márcio Silva',  fone: '(61) 99222-3001' }, servico: 'Banho e Tosa',  status: 'agendado' },
  { id: 'bnf-02', horario: '09:00', profissional: 'Ana',   pet: { nome: 'Bolinha', especie: 'Cão',  raca: 'SRD'       }, responsavel: { nome: 'Taísa Corrêa',  fone: '(61) 99222-3002' }, servico: 'Banho',         status: 'agendado' },
  { id: 'bnf-03', horario: '09:30', profissional: 'Pedro', pet: { nome: 'Freddie', especie: 'Cão',  raca: 'Beagle'    }, responsavel: { nome: 'Jorge Peixoto', fone: '(61) 99222-3003' }, servico: 'Tosa Higiênica', status: 'agendado' },
  { id: 'bnf-04', horario: '10:00', profissional: 'João',  pet: { nome: 'Gorda',   especie: 'Gato', raca: 'Angorá'    }, responsavel: { nome: 'Cíntia Porto',  fone: '(61) 99222-3004' }, servico: 'Banho',         status: 'agendado' },
]

function getMockBanho(offset) {
  if (offset <= -2) return []
  if (offset === -1) return MOCK_DIA_M1
  if (offset === 0)  return MOCK_DIA_0
  if (offset === 1)  return MOCK_DIA_P1
  return MOCK_DIA_P2
}

/* ─── EXPORT ────────────────────────────────────────────────── */
export function BanhoBoard({ diaOffset }) {
  const [profissionais, setProfissionais] = useState(PROFS_INICIAL)
  const [agendamentos, setAgendamentos]   = useState(() => getMockBanho(diaOffset))

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

  const adicionarProfissional = useCallback(() => {
    const candidatos = ['Maria', 'Carlos', 'Fernanda', 'Lucas', 'Beatriz']
    const existentes = new Set(profissionais)
    const proximo = candidatos.find(c => !existentes.has(c))
    if (proximo) setProfissionais(prev => [...prev, proximo])
  }, [profissionais])

  return (
    <AgendaGrid
      profissionais={profissionais}
      agendamentos={agendamentos}
      onMudarStatus={mudarStatus}
      onAddProfissional={adicionarProfissional}
      labelAdicionar="+ Profissional"
      visual="tv"
      titulo="Agenda - Banho e Tosa"
      diaOffset={diaOffset}
    />
  )
}
