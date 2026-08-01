import { useState } from 'react'
import { CAT_COLORS, CAT_LABEL, CAT_ICON, daysLeft, dDayStyle } from '../App'
import Icon from '../styles/Icon'

const TAG_BASE = { fontSize: 12, fontWeight: 700, lineHeight: 1, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }

function CatBadge({ cat }) {
  const c = CAT_COLORS[cat] || {}
  return (
    <span style={{ ...TAG_BASE, background: c.bg, border: `1px solid ${c.border}`, color: c.text, gap: 4 }}>
      <Icon name={CAT_ICON[cat] || 'apps'} size={13} color={c.text} />{CAT_LABEL[cat] || cat}
    </span>
  )
}

function DeadlinePill({ deadline }) {
  const d = daysLeft(deadline)
  if (d === null) return <span style={{ ...TAG_BASE, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748B' }}>상시 접수</span>
  if (d <= 0) return <span style={{ ...TAG_BASE, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#94A3B8' }}>마감됨</span>
  const s = dDayStyle(d)
  return <span style={{ ...TAG_BASE, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>D-{d}</span>
}

export default function PolicyCardMini({ policy, favIds, onToggleFav, onGoDetail }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isFav = favIds?.has?.(policy.id) ?? false

  const handleShare = (e) => {
    e.stopPropagation()
    const url = `${window.location.origin}${window.location.pathname}?policy=${policy.id}`
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const d = daysLeft(policy.deadline)
  const support = policy.supportFull || policy.benefit || policy.description

  return (
    <div
      onClick={() => setExpanded(o => !o)}
      style={{
        background: 'white', borderRadius: 16, border: '1.5px solid #E2E8F0',
        padding: '14px 16px', cursor: 'pointer', position: 'relative',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        width: 240, maxWidth: '80vw', height: '100%',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '' }}
    >
      <button onClick={handleShare} title="링크 복사"
        style={{ position: 'absolute', top: 9, right: 38, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = '#6b7280'}
        onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
      ><Icon name="share" size={16} color="currentColor" /></button>
      {onToggleFav && (
        <button onClick={(e) => { e.stopPropagation(); onToggleFav(policy.id) }}
          style={{ position: 'absolute', top: 9, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#f59e0b' : '#d1d5db', padding: 4, display: 'flex', alignItems: 'center' }}
        ><Icon name="bookmark" filled={isFav} size={18} color="currentColor" /></button>
      )}
      {copied && <div style={{ position: 'absolute', top: 38, right: 6, background: '#1f2937', color: 'white', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>URL 복사 완료</div>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <CatBadge cat={policy.cat} /><DeadlinePill deadline={policy.deadline} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', lineHeight: 1.4, marginBottom: 4, paddingRight: 56 }}>{policy.title}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1 }}>{policy.org} · {policy.target}</span>
        <Icon name="chevron_right" size={14} color="#d1d5db" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {support && (
            <div style={{
              fontSize: 12, color: '#4b5563', lineHeight: 1.6,
              display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden',
            }}>{support}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#9ca3af' }}>신청 기한</span>
            <span style={{ color: '#374151', fontWeight: 700 }}>{policy.deadline === '상시' ? '상시 접수' : `${policy.deadline}${d != null && d > 0 ? ` (D-${d})` : ''}`}</span>
          </div>
          {policy.amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#9ca3af' }}>지원 금액</span>
              <span style={{ color: '#374151', fontWeight: 700 }}>최대 {policy.amount.toLocaleString()}만원</span>
            </div>
          )}
        </div>
      )}

      <button onClick={e => { e.stopPropagation(); onGoDetail?.(policy) }}
        style={{ fontSize: 12, color: '#9ca3af', marginTop: 'auto', background: 'none', border: 'none', cursor: onGoDetail ? 'pointer' : 'default', textAlign: 'left', padding: 0, paddingTop: 12 }}
      >자세히 보기 →</button>
    </div>
  )
}
