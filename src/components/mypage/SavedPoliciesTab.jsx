import { useState, useRef, useEffect, useMemo } from 'react'
import Icon from '../../styles/Icon'

const CAT = {
  job:    { bg: '#E0F2FE', text: '#0369A1', label: '일자리' },
  house:  { bg: '#F0FDF4', text: '#15803D', label: '주거' },
  money:  { bg: '#FFFBEB', text: '#B45309', label: '금융' },
  edu:    { bg: '#F5F3FF', text: '#6D28D9', label: '교육' },
  health: { bg: '#FFF1F2', text: '#BE123C', label: '복지' },
}

const ORDER_KEY = 'yoa:savedOrder'

function loadOrder() {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function persistOrder(ids) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

// 마감기한 정렬 기준값. "상시"/빈 값/파싱 불가는 맨 뒤로 보낸다.
function deadlineRank(deadline) {
  if (!deadline || deadline === '상시') return Infinity
  const t = Date.parse(deadline)
  return Number.isNaN(t) ? Infinity : t
}

function deadlineLabel(deadline) {
  if (!deadline || deadline === '상시') return '상시'
  const t = Date.parse(deadline)
  if (Number.isNaN(t)) return deadline
  const days = Math.ceil((t - Date.now()) / 86400000)
  if (days < 0) return '마감'
  if (days === 0) return 'D-day'
  return `D-${days}`
}
function deadlineColor(deadline) {
  if (!deadline || deadline === '상시') return '#9ca3af'
  const t = Date.parse(deadline)
  if (Number.isNaN(t)) return '#9ca3af'
  const days = Math.ceil((t - Date.now()) / 86400000)
  if (days <= 7) return '#ef4444'
  if (days <= 30) return '#f59e0b'
  return '#9ca3af'
}

export default function SavedPoliciesTab({ policies, favIds, onToggleFav, onGoDetail }) {
  const saved = (policies || []).filter(p => favIds?.has(p.id))
  const [pendingIds, setPendingIds] = useState(new Set())
  const timerRefs = useRef({})

  // 사용자가 드래그로 재배열한 순서(id 배열). 없으면 마감임박순이 기본값.
  const [order, setOrder] = useState(loadOrder)
  const dragIdRef = useRef(null)
  const [dragOverId, setDragOverId] = useState(null)

  const savedIdsKey = saved.map(p => p.id).join(',')

  // 저장 목록이 바뀔 때(새로 저장/취소)마다 순서를 정합화: 없어진 id 제거, 새 id는 마감순 자리에 병합
  useEffect(() => {
    const savedIds = new Set(saved.map(p => p.id))
    const byDeadline = [...saved]
      .sort((a, b) => deadlineRank(a.deadline) - deadlineRank(b.deadline))
      .map(p => p.id)

    setOrder(prev => {
      const kept = (prev ?? []).filter(id => savedIds.has(id))
      const missing = byDeadline.filter(id => !kept.includes(id))
      if (kept.length === 0) return byDeadline
      if (missing.length === 0) return kept
      const merged = [...kept]
      missing.forEach(id => {
        const idx = byDeadline.indexOf(id)
        let insertAt = merged.length
        for (let i = idx - 1; i >= 0; i--) {
          const pos = merged.indexOf(byDeadline[i])
          if (pos !== -1) { insertAt = pos + 1; break }
        }
        merged.splice(insertAt, 0, id)
      })
      return merged
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIdsKey])

  useEffect(() => {
    if (order) persistOrder(order)
  }, [order])

  const sortedSaved = useMemo(() => {
    if (!order) return saved
    const byId = new Map(saved.map(p => [p.id, p]))
    const list = order.map(id => byId.get(id)).filter(Boolean)
    saved.forEach(p => { if (!order.includes(p.id)) list.push(p) })
    return list
  }, [saved, order])

  const resetToDeadlineOrder = () => {
    setOrder([...saved].sort((a, b) => deadlineRank(a.deadline) - deadlineRank(b.deadline)).map(p => p.id))
  }

  const handleDragStart = (id) => { dragIdRef.current = id }
  const handleDragOver = (e, id) => {
    e.preventDefault()
    if (id !== dragOverId) setDragOverId(id)
  }
  const handleDrop = (id) => {
    const draggedId = dragIdRef.current
    dragIdRef.current = null
    setDragOverId(null)
    if (!draggedId || draggedId === id) return
    setOrder(prev => {
      const base = (prev ?? sortedSaved.map(p => p.id)).filter(x => x !== draggedId)
      const targetIdx = base.indexOf(id)
      base.splice(targetIdx, 0, draggedId)
      return base
    })
  }
  const handleDragEnd = () => { dragIdRef.current = null; setDragOverId(null) }

  const handleBookmarkClick = (id) => {
    if (pendingIds.has(id)) {
      // 실행취소: 타이머 취소하고 복원
      clearTimeout(timerRefs.current[id])
      delete timerRefs.current[id]
      setPendingIds(prev => { const n = new Set(prev); n.delete(id); return n })
    } else {
      // 3초 후 실제 삭제
      setPendingIds(prev => new Set([...prev, id]))
      timerRefs.current[id] = setTimeout(() => {
        onToggleFav(id)
        setPendingIds(prev => { const n = new Set(prev); n.delete(id); return n })
        delete timerRefs.current[id]
      }, 3000)
    }
  }

  if (saved.length === 0) {
    return (
      <div style={styles.empty}>
        <Icon name="bookmark" size={40} color="#d1d5db" />
        <div style={styles.emptyTitle}>저장한 정책이 없어요</div>
        <div style={styles.emptyDesc}>
          마음에 드는 정책을 저장하면<br />여기서 한눈에 모아볼 수 있어요.
        </div>
        <div style={styles.emptyActions}>
          <button
            type="button"
            style={styles.actionBtn}
            onClick={() => onNavigate?.('search')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#007FFF'; e.currentTarget.style.color = '#007FFF' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#374151' }}
          >
            <Icon name="search" size={16} color="currentColor" />
            정책 검색하기
          </button>
          <button
            type="button"
            style={styles.actionBtnPrimary}
            onClick={() => onNavigate?.('chatbot')}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Icon name="auto_awesome" size={16} color="#ffffff" />
            AI 챗봇으로 찾기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrap} data-tour="saved-content">
      <div style={styles.header}>
        <span style={styles.title}>
          <Icon name="bookmark" size={16} color="#111827" style={{ marginRight: 6 }} />
          저장한 정책
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={resetToDeadlineOrder}
            style={styles.sortBtn}
            title="마감기한이 임박한 순서로 다시 정렬"
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#007FFF'; e.currentTarget.style.color = '#007FFF' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#6b7280' }}
          >
            <Icon name="event" size={13} color="currentColor" />
            마감임박순
          </button>
          <span style={styles.count}>{saved.length}건</span>
        </div>
      </div>
      <div style={styles.list} data-tour="saved-content">
        {sortedSaved.map((p, idx) => {
          const c = CAT[p.cat] || CAT[p.category] || { bg: '#f3f4f6', text: '#374151', label: '기타' }
          const isPending = pendingIds.has(p.id)
          const isDragOver = dragOverId === p.id

          return (
            <div
              key={p.id}
              draggable
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={(e) => handleDragOver(e, p.id)}
              onDrop={() => handleDrop(p.id)}
              onDragEnd={handleDragEnd}
              style={{
                ...styles.item,
                opacity: isPending ? 0.55 : 1,
                boxShadow: isDragOver ? 'inset 0 0 0 2px #007FFF' : 'none',
                transition: 'opacity 0.2s, box-shadow 0.1s',
              }}
            >
              <div style={styles.itemLeft}>
                <Icon name="drag_indicator" size={16} color="#cbd5e1" style={styles.dragHandle} />
                <span style={styles.rank}>{idx + 1}</span>
                <span style={{ ...styles.badge, backgroundColor: c.bg, color: c.text }}>
                  {c.label}
                </span>
                <span
                  style={{
                    ...styles.itemTitle,
                    cursor: onGoDetail ? 'pointer' : 'default',
                    textDecoration: onGoDetail ? 'underline' : 'none',
                    textDecorationColor: '#cbd5e1',
                    textUnderlineOffset: '2px',
                    textDecorationStyle: isPending ? 'line-through' : 'solid',
                    color: isPending ? '#9ca3af' : '#374151',
                  }}
                  onClick={() => !isPending && onGoDetail?.(p)}
                >
                  {p.title}
                </span>
              </div>

              <div style={styles.actionArea}>
                <span style={{ ...styles.deadline, color: deadlineColor(p.deadline) }}>
                  {deadlineLabel(p.deadline)}
                </span>
                {isPending && (
                  <button
                    type="button"
                    onClick={() => handleBookmarkClick(p.id)}
                    style={styles.undoBtn}
                  >
                    실행취소
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleBookmarkClick(p.id)}
                  title={isPending ? '취소 중 (클릭해서 되돌리기)' : '저장 취소'}
                  style={styles.removeBtn}
                  onMouseEnter={e => !isPending && (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => !isPending && (e.currentTarget.style.color = '#f59e0b')}
                >
                  <Icon
                    name="bookmark"
                    size={18}
                    color={isPending ? '#d1d5db' : '#f59e0b'}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div style={styles.hint}>
        <Icon name="info" size={13} color="#9ca3af" />
        <span>기본은 마감임박순 정렬이에요. 항목을 드래그하면 원하는 순서로 바꿀 수 있어요. 북마크 아이콘을 누르면 저장이 취소되며, 3초 안에 실행취소할 수 있어요.</span>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
  },
  count: {
    fontSize: 12,
    fontWeight: 600,
    color: '#007FFF',
    backgroundColor: '#F0F7FF',
    padding: '3px 10px',
    borderRadius: 20,
  },
  sortBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    lineHeight: 1,
    padding: '5px 10px',
    borderRadius: 20,
    border: '1.5px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#6b7280',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  dragHandle: {
    cursor: 'grab',
    flexShrink: 0,
  },
  rank: {
    fontSize: 11,
    fontWeight: 700,
    color: '#9ca3af',
    width: 14,
    textAlign: 'center',
    flexShrink: 0,
  },
  deadline: {
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 12,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  itemTitle: {
    fontSize: 13,
    color: '#374151',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s',
  },
  actionArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  undoBtn: {
    background: 'none',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.15s',
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    fontSize: 11,
    color: '#9ca3af',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '56px 20px 52px',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1E293B',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.7,
    marginBottom: 6,
  },
  emptyActions: {
    display: 'flex',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    lineHeight: 1,
    padding: '10px 18px',
    borderRadius: 10,
    border: '1.5px solid #E2E8F0',
    backgroundColor: '#ffffff',
    color: '#374151',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  actionBtnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    lineHeight: 1,
    padding: '10px 18px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#007FFF',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
}
