import { useState, useCallback } from 'react'
import './admin.css'

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK = [
  {
    id: 1, status: 'aguardando', tipo: 'clinica',
    horario: '08:30',
    pet: { nome: 'Thor', raca: 'Golden Retriever', especie: 'Cão' },
    responsavel: { nome: 'Roberto Lima', telefone: '(11) 98765-4321' },
    obs: 'Consulta de rotina + vacina antirrábica. Cão muito dócil, sem restrições.',
    veterinario: 'Dr. Carlos',
    prioridade: false,
    corPet: '#FDE68A',
  },
  {
    id: 2, status: 'chegou', tipo: 'banho_tosa',
    horario: '09:00',
    pet: { nome: 'Luna', raca: 'Poodle Toy', especie: 'Cão' },
    responsavel: { nome: 'Ana Paula Souza', telefone: '(11) 97654-3210' },
    obs: 'Tosa higiênica + hidratação. Pelo longo, sem nós graves.',
    previsaoEntrega: '11:30',
    prioridade: false,
    corPet: '#F9A8D4',
  },
  {
    id: 3, status: 'aguardando', tipo: 'clinica',
    horario: '09:30',
    pet: { nome: 'Max', raca: 'Labrador Retriever', especie: 'Cão' },
    responsavel: { nome: 'Marcos Silva', telefone: '(11) 96543-2109' },
    obs: 'Retorno pós-cirurgia. Verificar cicatriz e pontos com atenção.',
    veterinario: 'Dra. Fernanda',
    prioridade: true,
    corPet: '#86EFAC',
  },
  {
    id: 4, status: 'em_atendimento', tipo: 'banho_tosa',
    horario: '09:00',
    pet: { nome: 'Mia', raca: 'Persa Chinchila', especie: 'Gato' },
    responsavel: { nome: 'Carla Mendes', telefone: '(11) 95432-1098' },
    obs: 'Banho especial + perfume floral. Gata nervosa — cuidado ao manipular.',
    previsaoEntrega: '11:00',
    prioridade: false,
    corPet: '#C4B5FD',
  },
  {
    id: 5, status: 'concluido', tipo: 'clinica',
    horario: '08:00',
    pet: { nome: 'Bob', raca: 'Bulldog Inglês', especie: 'Cão' },
    responsavel: { nome: 'Pedro Costa', telefone: '(11) 94321-0987' },
    obs: 'Vacinação anual concluída. V10 + antirrábica aplicadas.',
    veterinario: 'Dr. Carlos',
    prioridade: false,
    corPet: '#FCA5A5',
  },
  {
    id: 6, status: 'aguardando', tipo: 'banho_tosa',
    horario: '10:00',
    pet: { nome: 'Mel', raca: 'Shih Tzu', especie: 'Cão' },
    responsavel: { nome: 'Júlia Santos', telefone: '(11) 93210-9876' },
    obs: 'Tosa completa estilo bebê. Dona prefere franja longa.',
    previsaoEntrega: '12:30',
    prioridade: false,
    corPet: '#FCD34D',
  },
  {
    id: 7, status: 'chegou', tipo: 'clinica',
    horario: '10:30',
    pet: { nome: 'Simba', raca: 'Maine Coon', especie: 'Gato' },
    responsavel: { nome: 'Lucas Ferreira', telefone: '(11) 92109-8765' },
    obs: 'Vômito frequente há 3 dias. Em jejum desde as 22h de ontem. Urgente.',
    veterinario: 'Dra. Fernanda',
    prioridade: true,
    corPet: '#FDE68A',
  },
  {
    id: 8, status: 'concluido', tipo: 'banho_tosa',
    horario: '08:30',
    pet: { nome: 'Pipoca', raca: 'Spitz Alemão', especie: 'Cão' },
    responsavel: { nome: 'Beatriz Lima', telefone: '(11) 91098-7654' },
    obs: 'Banho + tosa completa + corte das unhas.',
    previsaoEntrega: '10:00',
    prioridade: false,
    corPet: '#F0ABFC',
  },
]

// ── Config ────────────────────────────────────────────────────────────────────
const COLUNAS = [
  { id: 'aguardando',     label: 'Aguardando',     emoji: '⏳', cor: '#3B82F6', bg: '#EBF3FF', bgHeader: '#DBEAFE' },
  { id: 'chegou',         label: 'Chegou',         emoji: '🔔', cor: '#B45309', bg: '#FFFBEB', bgHeader: '#FEF3C7' },
  { id: 'em_atendimento', label: 'Em Atendimento', emoji: '🟢', cor: '#047857', bg: '#ECFDF5', bgHeader: '#D1FAE5' },
  { id: 'concluido',      label: 'Concluído',      emoji: '✅', cor: '#6B7280', bg: '#F4F6F9', bgHeader: '#E5E9F0' },
]

const ACAO = {
  aguardando:     { label: '🔔 Confirmar Chegada',   proximo: 'chegou',         cor: '#D97706' },
  chegou:         { label: '▶ Iniciar Atendimento',  proximo: 'em_atendimento', cor: '#059669' },
  em_atendimento: { label: '✓ Finalizar',            proximo: 'concluido',      cor: '#4B5563' },
  concluido:      null,
}

const TIPO = {
  clinica:    { label: '🏥 Clínica',      cor: '#1D4ED8', bg: '#EFF6FF' },
  banho_tosa: { label: '✂️ Banho & Tosa', cor: '#065F46', bg: '#ECFDF5' },
}

function getDia(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const sem  = d.toLocaleDateString('pt-BR', { weekday: 'long' })
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return `${sem.charAt(0).toUpperCase() + sem.slice(1)}, ${data}`
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ card, expandido, onExpandir, onMover, onCancelar, onPrioridade, onDragStart, onDragEnd }) {
  const tipo  = TIPO[card.tipo]
  const acao  = ACAO[card.status]
  const aberto = expandido === card.id
  const feito  = card.status === 'concluido'

  return (
    <div
      className={[
        'sv-card',
        card.tipo,
        card.prioridade ? 'prioritario' : '',
        aberto ? 'expandido' : '',
        feito  ? 'concluido' : '',
      ].filter(Boolean).join(' ')}
      draggable={!feito}
      onDragStart={e => onDragStart(e, card)}
      onDragEnd={onDragEnd}
    >
      {/* ── Topo: Tipo + Toggle + Horário ── */}
      <div className="sv-card-top">
        <span className="sv-badge-tipo" style={{ background: tipo.bg, color: tipo.cor }}>
          {tipo.label}
        </span>

        <div className="sv-card-top-right">
          {card.prioridade && (
            <span className="sv-prioridade-badge">🔴 Urgente</span>
          )}
          <span className="sv-horario">{card.horario}</span>
          <button
            className="sv-btn-toggle"
            onClick={e => { e.stopPropagation(); onExpandir(aberto ? null : card.id) }}
            title={aberto ? 'Fechar detalhes' : 'Ver detalhes'}
          >
            {aberto ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── Pet ── */}
      <div className="sv-pet-row">
        <div className="sv-avatar" style={{ background: card.corPet }}>
          {card.pet.especie === 'Gato' ? '🐱' : '🐶'}
        </div>
        <div className="sv-pet-info">
          <span className="sv-pet-nome">{card.pet.nome}</span>
          <span className="sv-pet-raca">{card.pet.raca}</span>
        </div>
      </div>

      {/* ── Responsável ── */}
      <div className="sv-responsavel">
        <span className="sv-resp-nome">👤 {card.responsavel.nome}</span>
        <a
          href={`tel:${card.responsavel.telefone}`}
          className="sv-telefone"
          onClick={e => e.stopPropagation()}
        >
          📞 {card.responsavel.telefone}
        </a>
      </div>

      {/* ── Obs compacta (só quando fechado) ── */}
      {card.obs && !aberto && (
        <p className="sv-obs-preview">{card.obs}</p>
      )}

      {/* ── Detalhes expandidos ── */}
      {aberto && (
        <div className="sv-detalhes">
          {card.obs && (
            <div className="sv-detalhe-row">
              <span className="sv-detalhe-label">📝 Observações</span>
              <p className="sv-detalhe-valor">{card.obs}</p>
            </div>
          )}
          {card.veterinario && (
            <div className="sv-detalhe-row">
              <span className="sv-detalhe-label">👨‍⚕️ Veterinário</span>
              <p className="sv-detalhe-valor">{card.veterinario}</p>
            </div>
          )}
          {card.previsaoEntrega && (
            <div className="sv-detalhe-row">
              <span className="sv-detalhe-label">🕐 Previsão de entrega</span>
              <p className="sv-detalhe-valor">{card.previsaoEntrega}</p>
            </div>
          )}
          <div className="sv-acoes-extras">
            {!feito && (
              <button
                className="sv-btn-urgente"
                onClick={e => { e.stopPropagation(); onPrioridade(card.id) }}
              >
                {card.prioridade ? '🔕 Remover urgência' : '🔴 Marcar urgente'}
              </button>
            )}
            {!feito && (
              <button
                className="sv-btn-cancelar"
                onClick={e => { e.stopPropagation(); onCancelar(card.id) }}
              >
                ✕ Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Footer: ação primária FULL WIDTH ── */}
      {(acao || (card.tipo === 'banho_tosa' && feito)) && (
        <div className="sv-card-footer">
          {acao ? (
            <button
              className="sv-btn-acao"
              style={{ background: acao.cor }}
              onClick={e => { e.stopPropagation(); onMover(card.id, acao.proximo) }}
            >
              {acao.label}
            </button>
          ) : (
            <button
              className="sv-btn-avisar"
              onClick={e => {
                e.stopPropagation()
                alert(`Responsável ${card.responsavel.nome} será avisado que ${card.pet.nome} está pronto!`)
              }}
            >
              📱 Avisar que está pronto
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Coluna ────────────────────────────────────────────────────────────────────
function Coluna({ col, cards, expandido, onExpandir, onMover, onCancelar, onPrioridade, onDragStart, onDragEnd, onDrop, dragOver, setDragOver }) {
  const sobre = dragOver === col.id

  return (
    <div
      className={`sv-coluna${sobre ? ' drag-over' : ''}`}
      style={{ '--col-cor': col.cor, '--col-bg': col.bg, '--col-bg-header': col.bgHeader }}
      onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}
      onDrop={e => { onDrop(e, col.id); setDragOver(null) }}
    >
      <div className="sv-coluna-header">
        <div className="sv-coluna-titulo">
          <span className="sv-coluna-emoji">{col.emoji}</span>
          <span className="sv-coluna-label">{col.label}</span>
        </div>
        <span className="sv-coluna-count">{cards.length}</span>
      </div>

      <div className="sv-coluna-body">
        {cards.length === 0 ? (
          <div className="sv-coluna-vazia">
            Nenhum<br />agendamento aqui
          </div>
        ) : (
          cards.map(card => (
            <Card
              key={card.id}
              card={card}
              expandido={expandido}
              onExpandir={onExpandir}
              onMover={onMover}
              onCancelar={onCancelar}
              onPrioridade={onPrioridade}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ServicosAdmin({ onSair }) {
  const [agendamentos, setAgendamentos] = useState(MOCK)
  const [filtroTipo, setFiltroTipo]     = useState('todos')
  const [diaOffset, setDiaOffset]       = useState(0)
  const [expandido, setExpandido]       = useState(null)
  const [dragCard, setDragCard]         = useState(null)
  const [dragOver, setDragOver]         = useState(null)

  const ativos = agendamentos.filter(a =>
    a.status !== 'cancelado' &&
    (filtroTipo === 'todos' || a.tipo === filtroTipo)
  )

  function getCards(colId) {
    return ativos
      .filter(a => a.status === colId)
      .sort((a, b) => {
        if (a.prioridade !== b.prioridade) return a.prioridade ? -1 : 1
        return a.horario.localeCompare(b.horario)
      })
  }

  const mover = useCallback((id, novoStatus) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: novoStatus } : a))
    setExpandido(null)
  }, [])

  const cancelar = useCallback((id) => {
    if (!window.confirm('Cancelar este agendamento?')) return
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelado' } : a))
    setExpandido(null)
  }, [])

  const togglePrioridade = useCallback((id) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, prioridade: !a.prioridade } : a))
  }, [])

  const handleDragStart = useCallback((e, card) => {
    setDragCard(card)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragCard(null)
    setDragOver(null)
  }, [])

  const handleDrop = useCallback((e, colId) => {
    e.preventDefault()
    if (dragCard && dragCard.status !== colId) mover(dragCard.id, colId)
  }, [dragCard, mover])

  // KPIs
  const kpi = {
    total:     agendamentos.filter(a => a.status !== 'cancelado').length,
    aguard:    agendamentos.filter(a => a.status === 'aguardando').length,
    chegou:    agendamentos.filter(a => a.status === 'chegou').length,
    atend:     agendamentos.filter(a => a.status === 'em_atendimento').length,
    concluido: agendamentos.filter(a => a.status === 'concluido').length,
    cancelado: agendamentos.filter(a => a.status === 'cancelado').length,
  }

  const labelDia = diaOffset === 0 ? 'Hoje' : diaOffset === 1 ? 'Amanhã' : diaOffset === -1 ? 'Ontem' : null

  return (
    <div className="sv-root">

      {/* ── Header ── */}
      <header className="sv-header">
        <div className="sv-header-brand">
          {onSair && (
            <button className="sv-date-btn" onClick={onSair} title="Voltar ao painel">‹</button>
          )}
          <span className="sv-header-logo">🐾</span>
          <span>Serviços</span>
        </div>

        <div className="sv-header-date">
          <button className="sv-date-btn" onClick={() => setDiaOffset(o => o - 1)}>‹</button>
          <span className="sv-date-label">
            {labelDia ? `${labelDia} — ${getDia(diaOffset)}` : getDia(diaOffset)}
          </span>
          <button className="sv-date-btn" onClick={() => setDiaOffset(o => o + 1)}>›</button>
        </div>

        <div className="sv-header-actions">
          {diaOffset !== 0 && (
            <button className="sv-btn-hoje" onClick={() => setDiaOffset(0)}>Hoje</button>
          )}
          <button className="sv-btn-novo">+ Novo agendamento</button>
        </div>
      </header>

      {/* ── KPIs ── */}
      <div className="sv-kpi-bar">
        <div className="sv-kpi">
          <span className="sv-kpi-num">{kpi.total}</span>
          <span className="sv-kpi-label">Total</span>
        </div>
        <div className="sv-kpi" style={{ '--kpi-cor': '#3B82F6' }}>
          <span className="sv-kpi-num">{kpi.aguard}</span>
          <span className="sv-kpi-label">Aguardando</span>
        </div>
        <div className="sv-kpi" style={{ '--kpi-cor': '#B45309' }}>
          <span className="sv-kpi-num">{kpi.chegou}</span>
          <span className="sv-kpi-label">Chegou</span>
        </div>
        <div className="sv-kpi" style={{ '--kpi-cor': '#047857' }}>
          <span className="sv-kpi-num">{kpi.atend}</span>
          <span className="sv-kpi-label">Atendendo</span>
        </div>
        <div className="sv-kpi" style={{ '--kpi-cor': '#6B7280' }}>
          <span className="sv-kpi-num">{kpi.concluido}</span>
          <span className="sv-kpi-label">Concluídos</span>
        </div>
        {kpi.cancelado > 0 && (
          <div className="sv-kpi" style={{ '--kpi-cor': '#EF4444' }}>
            <span className="sv-kpi-num">{kpi.cancelado}</span>
            <span className="sv-kpi-label">Cancelados</span>
          </div>
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="sv-filtros">
        {[
          { id: 'todos',      label: '🐾 Todos' },
          { id: 'clinica',    label: '🏥 Clínica' },
          { id: 'banho_tosa', label: '✂️ Banho & Tosa' },
        ].map(f => (
          <button
            key={f.id}
            className={`sv-filtro-btn${filtroTipo === f.id ? ' ativo' : ''}`}
            onClick={() => setFiltroTipo(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Kanban ── */}
      <div className="sv-kanban">
        {COLUNAS.map(col => (
          <Coluna
            key={col.id}
            col={col}
            cards={getCards(col.id)}
            expandido={expandido}
            onExpandir={setExpandido}
            onMover={mover}
            onCancelar={cancelar}
            onPrioridade={togglePrioridade}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            dragOver={dragOver}
            setDragOver={setDragOver}
          />
        ))}
      </div>
    </div>
  )
}
