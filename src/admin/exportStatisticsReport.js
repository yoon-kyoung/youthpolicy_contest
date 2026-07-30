// 통계 및 분석 페이지 리포트 내보내기 — PDF(인쇄) / Word(.doc) / PPT(.pptx) 3가지 형식 지원.
import { KPIS, MONTHLY_TREND, CATEGORY_STATS, REGION_STATS, FUNNEL, DROPOFF, SEVERITY_LABEL } from './data/statisticsData'

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function safeFileName() {
  return `청년ON_운영리포트_${new Date().toISOString().slice(0, 10)}`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildReportBodyHtml() {
  const generatedAt = new Date().toLocaleString('ko-KR')

  const kpiRows = KPIS.map((k) =>
    `<tr><td>${escapeHtml(k.title)}</td><td>${escapeHtml(k.value)}</td><td>${escapeHtml(k.change)}</td></tr>`,
  ).join('')

  const trendRows = MONTHLY_TREND.map((r) =>
    `<tr><td>${r.month}</td><td>${r.visitors.toLocaleString()}</td><td>${r.policyViews.toLocaleString()}</td><td>${r.applications.toLocaleString()}</td></tr>`,
  ).join('')

  const categoryRows = CATEGORY_STATS.map((r) =>
    `<tr><td>${escapeHtml(r.category)}</td><td>${r.views.toLocaleString()}</td><td>${r.applies.toLocaleString()}</td></tr>`,
  ).join('')

  const regionRows = REGION_STATS.map((r) =>
    `<tr><td>${escapeHtml(r.region)}</td><td>${r.members.toLocaleString()}</td><td>${r.policyViews.toLocaleString()}</td></tr>`,
  ).join('')

  const funnelRows = FUNNEL.map((r, i) =>
    `<tr><td>0${i + 1}</td><td>${escapeHtml(r.step)}</td><td>${r.count.toLocaleString()}명</td><td>${r.rate}%</td></tr>`,
  ).join('')

  const dropoffRows = DROPOFF.map((r) =>
    `<tr><td>${escapeHtml(r.from)}</td><td>${SEVERITY_LABEL[r.severity]} ${r.dropRate}%</td><td>${escapeHtml(r.insight)}</td></tr>`,
  ).join('')

  return `
<h2>청년ON 운영 리포트</h2>
<p class="meta">생성일: ${generatedAt}</p>

<h3>핵심 지표 (KPI)</h3>
<table><thead><tr><th>지표</th><th>값</th><th>전월 대비</th></tr></thead><tbody>${kpiRows}</tbody></table>

<h3>월별 방문자 · 조회 · 신청 추이</h3>
<table><thead><tr><th>월</th><th>방문자</th><th>정책 조회</th><th>신청 완료</th></tr></thead><tbody>${trendRows}</tbody></table>

<h3>카테고리별 조회 · 신청 비교</h3>
<table><thead><tr><th>카테고리</th><th>조회수</th><th>신청수</th></tr></thead><tbody>${categoryRows}</tbody></table>

<h3>지역별 회원 · 조회 현황</h3>
<table><thead><tr><th>지역</th><th>회원수</th><th>정책 조회</th></tr></thead><tbody>${regionRows}</tbody></table>

<h3>신청 전환 퍼널 (이번달 기준)</h3>
<table><thead><tr><th>단계</th><th>구분</th><th>인원</th><th>비율</th></tr></thead><tbody>${funnelRows}</tbody></table>

<h3>구간별 이탈 분석</h3>
<table><thead><tr><th>구간</th><th>이탈률</th><th>인사이트</th></tr></thead><tbody>${dropoffRows}</tbody></table>
`
}

const TABLE_CSS = `
  body{font-family:'Pretendard Variable','Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#111827;padding:32px;}
  h2{margin:0 0 4px;}
  h3{margin:24px 0 8px;color:#007FFF;font-size:15px;}
  .meta{color:#6b7280;font-size:13px;margin-bottom:16px;}
  table{border-collapse:collapse;width:100%;margin-bottom:8px;}
  th,td{border:1px solid #d1d5db;padding:6px 10px;font-size:13px;text-align:left;}
  th{background:#f3f4f6;}
`

export function downloadReportAsWord() {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>청년ON 운영 리포트</title>
<style>${TABLE_CSS}</style></head>
<body>${buildReportBodyHtml()}</body></html>`
  downloadBlob(new Blob(['﻿', html], { type: 'application/msword' }), `${safeFileName()}.doc`)
}

// PDF 전용 라이브러리 없이, 브라우저 인쇄 기능(다른 창에서 열어 인쇄 → "PDF로 저장")으로 생성한다.
export function downloadReportAsPdf() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>청년ON 운영 리포트</title>
<style>${TABLE_CSS}</style></head>
<body>${buildReportBodyHtml()}</body></html>`

  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) {
    alert('팝업이 차단되어 PDF 인쇄 창을 열 수 없어요. 팝업 차단을 해제한 뒤 다시 시도해주세요.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

const BLUE = '007FFF'
const TABLE_HEADER_FILL = 'F3F4F6'

export async function downloadReportAsPpt() {
  const { default: pptxgen } = await import('pptxgenjs')
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  const generatedAt = new Date().toLocaleString('ko-KR')

  const title = pptx.addSlide()
  title.addText('청년ON 운영 리포트', { x: 0.5, y: 1.7, w: 9, h: 1, fontSize: 32, bold: true, color: BLUE })
  title.addText(`생성일: ${generatedAt}`, { x: 0.5, y: 2.55, w: 9, h: 0.4, fontSize: 13, color: '6B7280' })
  title.addText(
    KPIS.map((k) => `${k.title}: ${k.value} (${k.change})`).join('    |    '),
    { x: 0.5, y: 3.2, w: 9, h: 0.6, fontSize: 12, color: '374151' },
  )

  const trendSlide = pptx.addSlide()
  trendSlide.addText('월별 방문자 · 조회 · 신청 추이', { x: 0.4, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true, color: BLUE })
  trendSlide.addChart(
    pptx.ChartType.line,
    [
      { name: '방문자', labels: MONTHLY_TREND.map((r) => r.month), values: MONTHLY_TREND.map((r) => r.visitors) },
      { name: '정책 조회', labels: MONTHLY_TREND.map((r) => r.month), values: MONTHLY_TREND.map((r) => r.policyViews) },
      { name: '신청 완료', labels: MONTHLY_TREND.map((r) => r.month), values: MONTHLY_TREND.map((r) => r.applications) },
    ],
    { x: 0.4, y: 1, w: 9, h: 4.3, showLegend: true, lineSmooth: true, chartColors: ['007FFF', '5BA4FF', '93C5FD'] },
  )

  const categorySlide = pptx.addSlide()
  categorySlide.addText('카테고리별 조회 · 신청 비교', { x: 0.4, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true, color: BLUE })
  categorySlide.addChart(
    pptx.ChartType.bar,
    [
      { name: '조회수', labels: CATEGORY_STATS.map((r) => r.category), values: CATEGORY_STATS.map((r) => r.views) },
      { name: '신청수', labels: CATEGORY_STATS.map((r) => r.category), values: CATEGORY_STATS.map((r) => r.applies) },
    ],
    { x: 0.4, y: 1, w: 9, h: 4.3, barDir: 'bar', showLegend: true, chartColors: ['007FFF', '93C5FD'] },
  )

  const regionSlide = pptx.addSlide()
  regionSlide.addText('지역별 회원 · 조회 현황', { x: 0.4, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true, color: BLUE })
  regionSlide.addChart(
    pptx.ChartType.bar,
    [
      { name: '회원수', labels: REGION_STATS.map((r) => r.region), values: REGION_STATS.map((r) => r.members) },
      { name: '정책 조회', labels: REGION_STATS.map((r) => r.region), values: REGION_STATS.map((r) => r.policyViews) },
    ],
    { x: 0.4, y: 1, w: 9, h: 4.3, barDir: 'col', showLegend: true, chartColors: ['007FFF', '5BA4FF'] },
  )

  const funnelSlide = pptx.addSlide()
  funnelSlide.addText('신청 전환 퍼널 (이번달 기준)', { x: 0.4, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true, color: BLUE })
  funnelSlide.addTable(
    [
      [
        { text: '단계', options: { bold: true, fill: { color: TABLE_HEADER_FILL } } },
        { text: '인원', options: { bold: true, fill: { color: TABLE_HEADER_FILL } } },
        { text: '비율', options: { bold: true, fill: { color: TABLE_HEADER_FILL } } },
      ],
      ...FUNNEL.map((r) => [r.step, `${r.count.toLocaleString()}명`, `${r.rate}%`]),
    ],
    { x: 0.4, y: 1, w: 9, fontSize: 12, border: { type: 'solid', color: 'E5E7EB', pt: 1 } },
  )

  const dropoffSlide = pptx.addSlide()
  dropoffSlide.addText('구간별 이탈 분석', { x: 0.4, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true, color: BLUE })
  dropoffSlide.addTable(
    [
      [
        { text: '구간', options: { bold: true, fill: { color: TABLE_HEADER_FILL } } },
        { text: '이탈률', options: { bold: true, fill: { color: TABLE_HEADER_FILL } } },
        { text: '인사이트', options: { bold: true, fill: { color: TABLE_HEADER_FILL } } },
      ],
      ...DROPOFF.map((r) => [r.from, `${SEVERITY_LABEL[r.severity]} ${r.dropRate}%`, r.insight]),
    ],
    { x: 0.4, y: 1, w: 9, fontSize: 11, colW: [2.5, 1.8, 4.7], border: { type: 'solid', color: 'E5E7EB', pt: 1 } },
  )

  await pptx.writeFile({ fileName: `${safeFileName()}.pptx` })
}
