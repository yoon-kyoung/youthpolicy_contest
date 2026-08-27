import { useState } from 'react'
import Icon from '../../styles/Icon'

const STATUS_MAP = {
  ready:   { label: '준비중',   color: '#1D4ED8' },
  applied: { label: '지원완료', color: '#15803D' },
  review:  { label: '심사중',   color: '#B45309' },
  waiting: { label: '결과대기', color: '#6D28D9' },
  done:    { label: '완료',     color: '#15803D' },
}

function loadLS(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} }
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

const now = new Date()
const BASE_YEAR  = now.getFullYear()
const BASE_MONTH = now.getMonth() + 1  // 1-indexed
const TODAY      = now.getDate()

export default function ApplicationCalendar({ policies, favIds, onGoDetail, isMobile }) {
  const [offset, setOffset] = useState(0)
  const [expandedDays, setExpandedDays] = useState(() => new Set())
  const statuses = loadLS('yoa:apply-status')
  const memos    = loadLS('yoa:apply-memo')

  // offset 기준 표시 연/월 계산
  const raw = BASE_MONTH - 1 + offset          // 0-indexed month
  const displayYear  = BASE_YEAR + Math.floor(raw / 12)
  const displayMonth = ((raw % 12) + 12) % 12 + 1

  // 해당 월의 1일 요일(월요일=0 기준), 말일
  const firstDow   = (new Date(displayYear, displayMonth - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(displayYear, displayMonth, 0).getDate()

  // 저장한 정책 중 이 달에 마감·신청 시작이 걸리는 것 수집
  // 신청 시작일 데이터가 없어서, 마감일 30일 전을 신청 시작일로 임의 계산한다.
  const APPLY_START_LEAD_DAYS = 30
  const markedDays = {}
  const addMark = (y, m, d, entry) => {
    if (y !== displayYear || m !== displayMonth) return
    if (!markedDays[d]) markedDays[d] = []
    markedDays[d].push(entry)
  }
  ;(policies || [])
    .filter(p => favIds?.has(p.id) && p.deadline && p.deadline !== '상시')
    .forEach(p => {
      const [dY, dM, dD] = p.deadline.split('-').map(Number)
      addMark(dY, dM, dD, { ...p, eventType: 'deadline' })

      const startDate = new Date(dY, dM - 1, dD)
      startDate.setDate(startDate.getDate() - APPLY_START_LEAD_DAYS)
      addMark(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate(), { ...p, eventType: 'start' })
    })

  // 달력 셀 생성
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isCurrentMonth = offset === 0
  const hasEvents = Object.keys(markedDays).length > 0

  return (
    <div style={isMobile ? { ...styles.card, padding: '14px 12px' } : styles.card} data-tour="calendar">
      {/* 헤더 */}
      <div style={styles.header}>
        <button type="button" style={styles.navBtn} onClick={() => setOffset(o => o - 1)}>
          <Icon name="chevron_left" size={18} />
        </button>
        <span style={styles.monthLabel}>{displayYear}년 {displayMonth}월</span>
        <button type="button" style={styles.navBtn} onClick={() => setOffset(o => o + 1)}>
          <Icon name="chevron_right" size={18} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            style={{
              ...styles.weekDay,
              color: d === '일' ? '#ef4444' : d === '토' ? '#007FFF' : '#6b7280',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} style={styles.emptyCell} />

          const events  = markedDays[day] || []
          const dayKey  = `${displayYear}-${displayMonth}-${day}`
          const isToday = isCurrentMonth && day === TODAY
          const dow     = i % 7   // 0=월 … 5=토 6=일
          const isSat   = dow === 5
          const isSun   = dow === 6

          return (
            <div key={day} style={isMobile ? { ...styles.cell, padding: '4px 2px 6px' } : styles.cell}>
              <span
                style={{
                  ...styles.dayNum,
                  ...(isMobile ? { width: 24, height: 24, fontSize: 12.5 } : null),
                  color: isToday ? '#ffffff' : isSun ? '#ef4444' : isSat ? '#007FFF' : '#374151',
                  backgroundColor: isToday ? '#007FFF' : 'transparent',
                }}
              >
                {day}
              </span>

              {events.length > 0 && (() => {
                const isExpanded = expandedDays.has(dayKey)
                const maxVisible = isMobile && !isExpanded ? 1 : events.length
                const shown = events.slice(0, maxVisible)
                const extra = events.length - shown.length
                return (
                  <div style={styles.events}>
                    {shown.map((ev, idx) => {
                      const isDeadline = ev.eventType === 'deadline'
                      const eventColor = isDeadline ? '#ef4444' : '#16a34a'
                      const eventBg    = isDeadline ? '#FEF2F2' : '#F0FDF4'
                      const st         = STATUS_MAP[statuses[ev.id]] || STATUS_MAP.ready
                      const memo       = memos[ev.id] || ''
                      return (
                        <div
                          key={idx}
                          onClick={() => onGoDetail?.(ev)}
                          style={{
                            ...styles.eventBlock,
                            backgroundColor: eventBg,
                            borderLeft: `3px solid ${eventColor}`,
                            cursor: onGoDetail ? 'pointer' : 'default',
                          }}
                          title={`${ev.title} ${isDeadline ? '마감' : '신청 시작'}`}
                        >
                          <span style={{ ...styles.evTitle, color: eventColor }}>
                            {ev.title} {isDeadline ? '마감' : '신청 시작'}
                          </span>
                          {isDeadline && (
                            <div style={styles.evMeta}>
                              <span style={{ ...styles.evStatus, color: st.color }}>● {st.label}</span>
                              {memo && <span style={styles.evMemo}>{memo}</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {extra > 0 && (
                      <button
                        type="button"
                        style={styles.moreBtn}
                        onClick={() => setExpandedDays(prev => new Set(prev).add(dayKey))}
                      >
                        +{extra}
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {!hasEvents && (
        <div style={styles.noData}>
          <Icon name="bookmark" size={16} color="#d1d5db" />
          이 달 마감·신청 시작인 저장 정책이 없습니다
        </div>
      )}
    </div>
  )
}

const styles = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    border: '1px solid #e5e7eb',
    padding: '24px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1.5px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    color: '#6b7280',
    cursor: 'pointer',
    padding: 0,
  },
  weekRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    borderBottom: '1px solid #f3f4f6',
    marginBottom: 4,
  },
  weekDay: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 0 8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gridAutoRows: 'minmax(72px, auto)',
  },
  emptyCell: {
    borderTop: '1px solid #f9fafb',
  },
  cell: {
    borderTop: '1px solid #f3f4f6',
    padding: '6px 4px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
    overflow: 'hidden',
  },
  dayNum: {
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1,
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginLeft: 2,
  },
  events: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    width: '100%',
    minWidth: 0,
  },
  eventBlock: {
    padding: '4px 6px',
    borderRadius: '0 4px 4px 0',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  evTitle: {
    fontSize: 11,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
    minWidth: 0,
  },
  evMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  evStatus: {
    fontSize: 10,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    lineHeight: 1.3,
  },
  evMemo: {
    fontSize: 10,
    color: '#9ca3af',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
  },
  moreBtn: {
    alignSelf: 'flex-start',
    padding: '1px 6px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textAlign: 'center',
    fontSize: 12,
    color: '#d1d5db',
    padding: '16px 0 4px',
  },
}
