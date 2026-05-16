import { useState } from 'react'
import { ClinicaBoard } from './ClinicaBoard'
import { BanhoBoard } from './BanhoBoard'
import './board.css'

export function ServicosPanel({ onSair }) {
  const [tela, setTela] = useState(null)

  if (tela === 'clinica') return <ClinicaBoard onVoltar={() => setTela(null)} />
  if (tela === 'banho')   return <BanhoBoard   onVoltar={() => setTela(null)} />

  return (
    <div className="sp-root">
      <header className="sp-header">
        <div className="sp-brand">
          <span className="sp-brand-logo">🐾</span>
          <span>Farmavet — Central de Serviços</span>
        </div>
        {onSair && (
          <button className="sp-back" onClick={onSair}>← Painel</button>
        )}
      </header>

      <div className="sp-body">
        <button className="sp-card sp-clinica" onClick={() => setTela('clinica')}>
          <span className="sp-card-icon">🏥</span>
          <strong>Clínica Veterinária</strong>
          <span>Consultas, exames e procedimentos</span>
          <span className="sp-card-cta">Abrir painel →</span>
        </button>

        <button className="sp-card sp-banho" onClick={() => setTela('banho')}>
          <span className="sp-card-icon">✂️</span>
          <strong>Banho & Tosa</strong>
          <span>Higiene, estética e cuidados</span>
          <span className="sp-card-cta">Abrir painel →</span>
        </button>
      </div>
    </div>
  )
}
