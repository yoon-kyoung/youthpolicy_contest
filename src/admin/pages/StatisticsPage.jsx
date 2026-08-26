import { useEffect, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  KPIS,
  MONTHLY_TREND,
  CATEGORY_STATS,
  REGION_STATS,
  FUNNEL,
  DROPOFF,
  SEVERITY_LABEL,
} from '../data/statisticsData'
import { downloadReportAsPdf, downloadReportAsWord, downloadReportAsPpt, downloadReportAsCsv } from '../exportStatisticsReport'

const SEVERITY_COLOR = { rose: '#EF4444', amber: '#F59E0B', green: '#10B981' }
const SEVERITY_BG    = { rose: '#FEF2F2', amber: '#FFFBEB', green: '#ECFDF5' }

function ReportDownloadMenu() {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handle = async (format) => {
    setOpen(false)
    if (format === 'pdf') downloadReportAsPdf()
    else if (format === 'word') downloadReportAsWord()
    else if (format === 'csv') downloadReportAsCsv()
    else if (format === 'ppt') {
      setExporting(true)
      try { await downloadReportAsPpt() } finally { setExporting(false) }
    }
  }

  return (
    <div className="report-download" ref={ref}>
      <button
        type="button"
        className="action-btn action-btn-primary"
        disabled={exporting}
        onClick={() => setOpen((v) => !v)}
      >
        {exporting ? '내보내는 중…' : '리포트 다운로드'}
      </button>
      {open && (
        <div className="report-download-menu">
          <button type="button" onClick={() => handle('pdf')}>PDF</button>
          <button type="button" onClick={() => handle('word')}>Word 문서 (.doc)</button>
          <button type="button" onClick={() => handle('csv')}>CSV (엑셀)</button>
          <button type="button" onClick={() => handle('ppt')}>PPT (.pptx)</button>
        </div>
      )}
    </div>
  )
}

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  color: '#111827',
  fontSize: '0.86rem',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

const AXIS_STYLE = { fontSize: 12, fill: '#9ca3af' }
const AXIS_STROKE = '#e5e7eb'

function StatisticsPage() {
  return (
    <div className="page-content">
      <div className="page-header-row">
        <ReportDownloadMenu />
      </div>

      <div className="page-stat-grid">
        {KPIS.map((k) => (
          <div key={k.title} className={`page-stat-card page-stat-card-${k.tone}`}>
            <span className="page-stat-title">{k.title}</span>
            <div className="page-stat-value-row">
              <strong className="page-stat-value">{k.value}</strong>
            </div>
            <span className="page-stat-change">{k.change}</span>
          </div>
        ))}
      </div>

      {/* 월별 추이 */}
      <article className="panel-card">
        <div className="section-heading">
          <div>
            <h3>월별 방문자 · 조회 · 신청 추이</h3>
          </div>
        </div>
        <div className="chart-shell">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={MONTHLY_TREND}>
              <defs>
                <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#007FFF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#007FFF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5BA4FF" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#5BA4FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#93C5FD" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#93C5FD" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(209,213,219,0.5)" />
              <XAxis dataKey="month" stroke={AXIS_STROKE} tick={AXIS_STYLE} />
              <YAxis stroke={AXIS_STROKE} tick={AXIS_STYLE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '0.84rem', paddingTop: 12 }} />
              <Area type="monotone" dataKey="visitors" name="방문자" stroke="#007FFF" strokeWidth={2.5} fill="url(#gVisitors)" dot={{ r: 4 }} />
              <Area type="monotone" dataKey="policyViews" name="정책 조회" stroke="#5BA4FF" strokeWidth={2.5} fill="url(#gViews)" dot={{ r: 4 }} />
              <Area type="monotone" dataKey="applications" name="신청 완료" stroke="#93C5FD" strokeWidth={2.5} fill="url(#gApps)" dot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      {/* 카테고리 & 지역별 */}
      <div className="stat-chart-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <h3>카테고리별 조회 · 신청 비교</h3>
            </div>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={CATEGORY_STATS} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(209,213,219,0.5)" horizontal={false} />
                <XAxis type="number" stroke={AXIS_STROKE} tick={AXIS_STYLE} />
                <YAxis type="category" dataKey="category" stroke={AXIS_STROKE} tick={AXIS_STYLE} width={80} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '0.84rem', paddingTop: 12 }} />
                <Bar dataKey="views" name="조회수" fill="#007FFF" radius={[0, 4, 4, 0]} />
                <Bar dataKey="applies" name="신청수" fill="#93C5FD" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <h3>지역별 회원 · 조회 현황</h3>
            </div>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={REGION_STATS}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(209,213,219,0.5)" />
                <XAxis dataKey="region" stroke={AXIS_STROKE} tick={AXIS_STYLE} />
                <YAxis stroke={AXIS_STROKE} tick={AXIS_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '0.84rem', paddingTop: 12 }} />
                <Bar dataKey="members" name="회원수" fill="#007FFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="policyViews" name="정책 조회" fill="#5BA4FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      {/* 전환 퍼널 + 이탈 분석 */}
      <div className="stat-chart-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <h3>신청 전환 퍼널 (이번달 기준)</h3>
            </div>
          </div>
          <div className="funnel-list">
            {FUNNEL.map((item, index) => (
              <div key={item.step} className="funnel-item">
                <div className="funnel-meta">
                  <span className="funnel-step-num">0{index + 1}</span>
                  <span className="funnel-step-label">{item.step}</span>
                  <strong className="funnel-count">{item.count.toLocaleString()}명</strong>
                  <span className="funnel-rate">{item.rate}%</span>
                </div>
                <div className="funnel-track">
                  <div className="funnel-fill" style={{ width: `${item.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <h3>구간별 이탈 분석</h3>
            </div>
          </div>
          <div className="dropoff-list">
            {DROPOFF.map((item) => (
              <div key={item.from} className="dropoff-item">
                <div className="dropoff-header">
                  <span className="dropoff-label">{item.from}</span>
                  <span
                    className="dropoff-badge"
                    style={{ background: SEVERITY_BG[item.severity], color: SEVERITY_COLOR[item.severity] }}
                  >
                    {SEVERITY_LABEL[item.severity]} {item.dropRate}%
                  </span>
                </div>
                <div className="dropoff-track">
                  <div
                    className="dropoff-fill"
                    style={{ width: `${item.dropRate}%`, background: SEVERITY_COLOR[item.severity] }}
                  />
                </div>
                <p className="dropoff-insight">{item.insight}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}

export default StatisticsPage
