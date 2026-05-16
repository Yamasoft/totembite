import { useMemo, useState, useEffect, Fragment } from 'react'

const HORARIOS = (() => {
  const s = []
  for (let h = 8; h < 18; h++) {
    s.push(`${String(h).padStart(2, '0')}:00`)
    s.push(`${String(h).padStart(2, '0')}:30`)
  }
  return s
})()

const STATUS_LABEL = {
  agendado: 'Agendado',
  aguardando: 'Aguardando',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluido',
  livre: 'Horario livre',
}

const STATUS_PRIO = ['aguardando', 'em_atendimento', 'agendado', 'concluido']

function calcDominante(slots) {
  for (const s of STATUS_PRIO) {
    if (slots.some(sl => sl.status === s)) return s
  }
  return 'livre'
}

function StatusBadge({ status, onClick }) {
  return onClick
    ? (
      <button className={`ag-badge ag-${status}`} onClick={onClick} type="button">
        {STATUS_LABEL[status]}
      </button>
    ) : (
      <span className={`ag-badge ag-badge-static ag-${status}`}>
        {STATUS_LABEL[status]}
      </span>
    )
}

function SlotCard({ slot, onMudar }) {
  return (
    <div className="ag-slot">
      <div className="ag-slot-top">
        <span className="ag-slot-especie">{slot.pet.especie === 'Gato' ? '🐱' : '🐶'}</span>
        <span className="ag-slot-nome">{slot.pet.nome}</span>
      </div>
      {slot.servico && <div className="ag-slot-servico">{slot.servico}</div>}
      <div className="ag-slot-tutor">{slot.responsavel.nome}</div>
      <StatusBadge status={slot.status} onClick={onMudar} />
    </div>
  )
}

function KpiItem({ label, value, variant }) {
  return (
    <div className="ag-kpi-item">
      <span className="ag-kpi-label">{label}</span>
      <span className={`ag-kpi-num${variant ? ` ag-kpi-${variant}` : ''}`}>{value}</span>
    </div>
  )
}

function formatPainelDate(diaOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + diaOffset)
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function buildTvRows(profissionais, agendamentos) {
  const bySlot = new Map()

  for (const item of agendamentos) {
    const key = `${item.horario}__${item.profissional}`
    if (!bySlot.has(key)) bySlot.set(key, [])
    bySlot.get(key).push(item)
  }

  return HORARIOS.flatMap(horario =>
    profissionais.flatMap(profissional => {
      const slots = bySlot.get(`${horario}__${profissional}`) || []

      if (slots.length) {
        return slots.map(slot => ({
          key: slot.id,
          horario,
          profissional,
          slot,
          status: slot.status,
        }))
      }

      return [{
        key: `livre-${horario}-${profissional}`,
        horario,
        profissional,
        slot: null,
        status: 'livre',
      }]
    })
  )
}

function AgendaTvTable({
  profissionais,
  agendamentos,
  onMudarStatus,
  titulo,
  diaOffset,
  labelProfissional = 'Profissional',
  labelServico = 'Serviço',
}) {
  const clock = useClock()
  const rows = useMemo(
    () => buildTvRows(profissionais, agendamentos),
    [profissionais, agendamentos]
  )

  const kpi = useMemo(() => ({
    atendendo: agendamentos.filter(a => a.status === 'em_atendimento').length,
    aguardando: agendamentos.filter(a => a.status === 'aguardando').length,
    agendados: agendamentos.filter(a => a.status === 'agendado').length,
    concluidos: agendamentos.filter(a => a.status === 'concluido').length,
    livres: rows.filter(r => r.status === 'livre').length,
    profissionais: profissionais.length,
  }), [agendamentos, profissionais.length, rows])

  return (
    <div className="ag-outer ag-tv">
      <section className="ag-tv-panel">
        <header className="ag-tv-top">
          <strong className="ag-tv-title">{titulo}</strong>
          <span className="ag-tv-date">▦ {formatPainelDate(diaOffset)}</span>
          <time className="ag-tv-clock">{clock}</time>
        </header>

        <div className="ag-tv-table-wrap">
          <table className="ag-tv-table">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Pet</th>
                <th>{labelServico}</th>
                <th>Tutor</th>
                <th>{labelProfissional}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  className={`${index % 2 ? 'ag-tv-alt ' : ''}ag-tv-row-${row.status}`}
                >
                  <td className="ag-tv-hour">
                    <span className="ag-tv-hour-pill">{row.horario}</span>
                  </td>
                  <td className="ag-tv-pet">
                    {row.slot
                      ? `${row.slot.pet.especie === 'Gato' ? '🐱' : '🐶'} ${row.slot.pet.nome}`
                      : <span className="ag-tv-empty">-</span>
                    }
                  </td>
                  <td>{row.slot ? row.slot.servico : <span className="ag-tv-empty">-</span>}</td>
                  <td>{row.slot ? row.slot.responsavel.nome : <span className="ag-tv-empty">-</span>}</td>
                  <td className="ag-tv-pro">{row.profissional}</td>
                  <td className="ag-tv-status">
                    <StatusBadge
                      status={row.status}
                      onClick={row.slot ? () => onMudarStatus(row.slot.id) : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="ag-kpi-bar ag-tv-kpis">
        <KpiItem label="Atendendo"      value={kpi.atendendo}   variant="atend" />
        <KpiItem label="Aguardando"     value={kpi.aguardando}  variant="agrd"  />
        <KpiItem label="Agendados"      value={kpi.agendados}   variant="agnd"  />
        <KpiItem label="Concluídos"     value={kpi.concluidos}  variant="conc"  />
        <KpiItem label="Horários livres" value={kpi.livres}     variant="livre" />
        <KpiItem label="Profissionais"  value={kpi.profissionais} variant="prof" />
        <div className="ag-kpi-brand">🐾 Farmavet</div>
      </footer>
    </div>
  )
}

export function AgendaGrid({
  profissionais,
  agendamentos,
  onMudarStatus,
  onAddProfissional,
  labelAdicionar = '+ Profissional',
  visual = 'grid',
  titulo = 'Agenda',
  diaOffset = 0,
  labelProfissional = 'Profissional',
  labelServico = 'Serviço',
}) {
  const nCols = profissionais.length

  const kpi = useMemo(() => ({
    atendendo: agendamentos.filter(a => a.status === 'em_atendimento').length,
    aguardando: agendamentos.filter(a => a.status === 'aguardando').length,
    agendados: agendamentos.filter(a => a.status === 'agendado').length,
    concluidos: agendamentos.filter(a => a.status === 'concluido').length,
    livres: Math.max(0, HORARIOS.length * nCols - agendamentos.length),
  }), [agendamentos, nCols])

  if (visual === 'tv') {
    return (
      <AgendaTvTable
        profissionais={profissionais}
        agendamentos={agendamentos}
        onMudarStatus={onMudarStatus}
        titulo={titulo}
        diaOffset={diaOffset}
        labelProfissional={labelProfissional}
        labelServico={labelServico}
      />
    )
  }

  const gridCols = `80px repeat(${nCols}, 1fr) 148px 44px`

  return (
    <div className="ag-outer">
      <div className="ag-scroll">
        <div className="ag-grid" style={{ gridTemplateColumns: gridCols }}>
          <div className="ag-head ag-hora-head">Horário</div>
          {profissionais.map(p => (
            <div key={p} className="ag-head ag-prof-head">{p}</div>
          ))}
          <div className="ag-head ag-status-head">Status</div>
          <div className="ag-head ag-add-head">
            {onAddProfissional && (
              <button
                className="ag-btn-add"
                onClick={onAddProfissional}
                title={labelAdicionar}
                type="button"
              >+</button>
            )}
          </div>

          {HORARIOS.map((hora, ri) => {
            const slotsHora = agendamentos.filter(a => a.horario === hora)
            const dom = calcDominante(slotsHora)
            const alt = ri % 2 === 1

            return (
              <Fragment key={hora}>
                <div className={`ag-cell ag-hora-cell${alt ? ' ag-alt' : ''}`}>
                  {hora}
                </div>

                {profissionais.map(prof => {
                  const slot = slotsHora.find(a => a.profissional === prof)
                  return (
                    <div
                      key={prof}
                      className={`ag-cell ag-slot-cell${!slot ? ' ag-cell-livre' : ''}${alt ? ' ag-alt' : ''}`}
                    >
                      {slot
                        ? <SlotCard slot={slot} onMudar={() => onMudarStatus(slot.id)} />
                        : <span className="ag-dash">-</span>
                      }
                    </div>
                  )
                })}

                <div className={`ag-cell ag-status-cell${alt ? ' ag-alt' : ''}`}>
                  <StatusBadge status={dom} />
                </div>

                <div className={`ag-cell ag-add-col${alt ? ' ag-alt' : ''}`} />
              </Fragment>
            )
          })}
        </div>
      </div>

      <footer className="ag-kpi-bar">
        <KpiItem label="Em atendimento" value={kpi.atendendo}  variant="atend" />
        <div className="ag-kpi-sep" />
        <KpiItem label="Aguardando"     value={kpi.aguardando} variant="agrd"  />
        <div className="ag-kpi-sep" />
        <KpiItem label="Agendados"      value={kpi.agendados}  />
        <div className="ag-kpi-sep" />
        <KpiItem label="Concluidos"     value={kpi.concluidos} variant="conc"  />
        <div className="ag-kpi-sep" />
        <KpiItem label="Horarios livres" value={kpi.livres}    variant="livre" />
        <div className="ag-kpi-brand">🐾 Farmavet</div>
      </footer>
    </div>
  )
}
