import { useState, useRef } from 'react'
import { ClinicaBoard }    from './ClinicaBoard'
import { VacinacaoBoard }  from './VacinacaoBoard'
import { BanhoBoard }      from './BanhoBoard'
import './op.css'

function formatDia(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  if (offset === 0) return 'Hoje'
  if (offset === -1) return 'Ontem'
  if (offset === 1) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function offsetToDateStr(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateStrToOffset(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number)
  const selected = new Date(y, m - 1, day)
  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((selected - today) / 86400000)
}

export function PainelServicos({ onSair }) {
  const [aba, setAba]             = useState('clinica')
  const [diaOffset, setDiaOffset] = useState(0)
  const dateInputRef              = useRef(null)

  function abrirCalendario() {
    const el = dateInputRef.current
    if (!el) return
    try { el.showPicker() } catch { el.click() }
  }

  function renderBoard() {
    if (aba === 'vacinacao') return <VacinacaoBoard key={`vac-${diaOffset}`} diaOffset={diaOffset} />
    if (aba === 'banho')     return <BanhoBoard     key={`bn-${diaOffset}`}  diaOffset={diaOffset} />
    return                          <ClinicaBoard   key={`cl-${diaOffset}`}  diaOffset={diaOffset} />
  }

  return (
    <div className="op-root">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className="op-header">

        {onSair && (
          <button className="op-voltar" onClick={onSair} title="Voltar ao painel">←</button>
        )}

        <span className="op-brand">🐾 Farmavet</span>
        <span className="op-hdiv" />

        <nav className="op-tabs">
          <button
            className={`op-tab${aba === 'clinica'   ? ' ativo' : ''}`}
            onClick={() => setAba('clinica')}
          >
            🏥 Clínica
          </button>
          <button
            className={`op-tab${aba === 'vacinacao' ? ' ativo' : ''}`}
            onClick={() => setAba('vacinacao')}
          >
            💉 Vacinação
          </button>
          <button
            className={`op-tab${aba === 'banho'     ? ' ativo' : ''}`}
            onClick={() => setAba('banho')}
          >
            ✂️ Banho&Tosa
          </button>
        </nav>

        <span className="op-hdiv" />

        <div className="op-dianav" style={{ position: 'relative' }}>
          <button className="op-dianav-btn" onClick={() => setDiaOffset(d => d - 1)}>‹</button>

          <span
            className="op-dianav-label op-dianav-label-cal"
            onClick={abrirCalendario}
            title="Escolher data no calendário"
          >
            {formatDia(diaOffset)} 📅
          </span>

          <input
            ref={dateInputRef}
            type="date"
            value={offsetToDateStr(diaOffset)}
            onChange={e => e.target.value && setDiaOffset(dateStrToOffset(e.target.value))}
            className="op-dianav-date-input"
          />

          <button className="op-dianav-btn" onClick={() => setDiaOffset(d => d + 1)}>›</button>
        </div>

        <span className="op-demo-badge">🧪 Ambiente demonstrativo</span>

      </header>

      {/* ── BOARD ───────────────────────────────────────────────── */}
      {renderBoard()}

    </div>
  )
}
