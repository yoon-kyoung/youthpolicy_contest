import { useEffect, useRef, useState } from 'react'
import { downloadCsv } from '../../../exportStatisticsReport'

const statusClassMap = {
  심사중: 'status-blue',
  보완요청: 'status-amber',
  승인대기: 'status-violet',
  완료: 'status-green',
  반려: 'status-rose',
}

const priorityClassMap = {
  높음: 'status-rose',
  중간: 'status-amber',
  낮음: 'status-green',
}

const STATUS_TABS = ['전체', '대기중', '심사중', '보완요청', '승인대기', '완료']

const AVATAR_COLORS = ['#007FFF', '#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#0EA5E9']
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const CSV_COLUMNS = [
  { key: 'name', label: '정책명' },
  { key: 'category', label: '카테고리' },
  { key: 'region', label: '지역' },
  { key: 'target', label: '대상' },
  { key: 'owner', label: '담당자' },
  { key: 'status', label: '상태' },
  { key: 'submittedAt', label: '접수 시각' },
  { key: 'priority', label: '우선순위' },
]

function PolicyReviewTable({ rows: initialRows, focusToken }) {
  const [rows, setRows] = useState(initialRows)
  const [statusTab, setStatusTab] = useState('전체')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'submittedAt', dir: 'desc' })
  const [selected, setSelected] = useState(() => new Set())
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!focusToken) return
    setStatusTab('대기중')
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusToken])

  const filtered = rows
    .filter((r) => {
      if (statusTab === '대기중') return r.status !== '완료'
      if (statusTab !== '전체') return r.status === statusTab
      return true
    })
    .filter((r) => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      const { key, dir } = sort
      const av = a[key]
      const bv = b[key]
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return dir === 'asc' ? cmp : -cmp
    })

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }
  const sortIndicator = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.name))
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        filtered.forEach((r) => next.delete(r.name))
        return next
      }
      const next = new Set(prev)
      filtered.forEach((r) => next.add(r.name))
      return next
    })
  }

  const bulkSetStatus = (status) => {
    setRows((prev) => prev.map((r) => (selected.has(r.name) ? { ...r, status } : r)))
    setSelected(new Set())
  }

  const handleCsv = () => {
    downloadCsv(`정책심사현황_${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLUMNS, filtered)
  }

  return (
    <article className="panel-card" ref={sectionRef}>
      <div className="section-heading">
        <div>
          <h3>정책 심사/처리 현황 보드</h3>
        </div>
        <button type="button" className="action-btn" onClick={handleCsv}>CSV 다운로드</button>
      </div>

      <div className="table-toolbar">
        <div className="filter-bar" style={{ margin: 0 }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`filter-btn${statusTab === t ? ' filter-btn-active' : ''}`}
              onClick={() => setStatusTab(t)}
            >{t}</button>
          ))}
        </div>
        <input
          className="table-search"
          placeholder="정책명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selected.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selected.size}건 선택됨</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="action-btn action-btn-primary" onClick={() => bulkSetStatus('완료')}>선택 승인</button>
            <button type="button" className="action-btn action-btn-danger" onClick={() => bulkSetStatus('반려')}>선택 반려</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="review-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="전체 선택" />
              </th>
              <th className="th-sortable" onClick={() => toggleSort('name')}>정책명{sortIndicator('name')}</th>
              <th>카테고리</th>
              <th>지역</th>
              <th>대상</th>
              <th>담당자</th>
              <th>상태</th>
              <th className="th-sortable" onClick={() => toggleSort('submittedAt')}>접수 시각{sortIndicator('submittedAt')}</th>
              <th className="th-sortable" onClick={() => toggleSort('priority')}>우선순위{sortIndicator('priority')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.name}>
                <td>
                  <input type="checkbox" checked={selected.has(row.name)} onChange={() => toggleSelect(row.name)} aria-label={`${row.name} 선택`} />
                </td>
                <td>{row.name}</td>
                <td>{row.category}</td>
                <td>{row.region}</td>
                <td>{row.target}</td>
                <td>
                  <div className="owner-cell">
                    <span className="avatar-initial" style={{ background: avatarColor(row.owner) }}>{row.owner.slice(0, 1)}</span>
                    {row.owner}
                  </div>
                </td>
                <td>
                  <span className={`status-pill ${statusClassMap[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.submittedAt}</td>
                <td>
                  <span className={`status-pill ${priorityClassMap[row.priority]}`}>{row.priority}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>조건에 맞는 항목이 없어요.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export default PolicyReviewTable
