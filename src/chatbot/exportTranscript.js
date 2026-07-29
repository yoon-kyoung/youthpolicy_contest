// 대화 내용 내보내기 — 텍스트(.txt) / 워드(.doc) / PDF(인쇄) 3가지 형식 지원.

function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function usableMessages(messages) {
  return (messages || []).filter((m) => m && !m.streaming && m.text)
}

function safeFileName(title) {
  return (title || '대화').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
}

export function buildTranscriptText(messages, sessionTitle) {
  const lines = [
    '청년ON AI 챗봇 대화 기록',
    `제목: ${sessionTitle || '새 대화'}`,
    `생성일: ${new Date().toLocaleString('ko-KR')}`,
    '',
  ]
  usableMessages(messages).forEach((m) => {
    const who = m.from === 'user' ? '나' : '청년ON'
    lines.push(`[${who}] ${m.text}`)
    if (m.policies?.length) {
      m.policies.forEach((p) => lines.push(`  · ${p.title}${p.org ? ` (${p.org})` : ''}`))
    }
    lines.push('')
  })
  return lines.join('\n')
}

function buildTranscriptHtmlBody(messages) {
  return usableMessages(messages)
    .map((m) => {
      const who = m.from === 'user' ? '나' : '청년ON'
      const cls = m.from === 'user' ? 'user' : 'bot'
      let html = `<p><b class="${cls}">[${who}]</b> ${escapeHtml(m.text).replace(/\n/g, '<br/>')}</p>`
      if (m.policies?.length) {
        html += '<ul>' + m.policies.map((p) =>
          `<li>${escapeHtml(p.title)}${p.org ? ` (${escapeHtml(p.org)})` : ''}</li>`,
        ).join('') + '</ul>'
      }
      return html
    })
    .join('\n')
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

export function downloadAsTxt(messages, sessionTitle) {
  const text = buildTranscriptText(messages, sessionTitle)
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safeFileName(sessionTitle)}.txt`)
}

export function downloadAsWord(messages, sessionTitle) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(sessionTitle || '대화')}</title></head>
<body style="font-family:'Malgun Gothic',sans-serif;">
<h2>청년ON AI 챗봇 대화 기록</h2>
<p>제목: ${escapeHtml(sessionTitle || '새 대화')}<br/>생성일: ${new Date().toLocaleString('ko-KR')}</p>
<hr/>
${buildTranscriptHtmlBody(messages)}
</body></html>`
  downloadBlob(new Blob(['﻿', html], { type: 'application/msword' }), `${safeFileName(sessionTitle)}.doc`)
}

// PDF 전용 라이브러리 없이, 브라우저 인쇄 기능(다른 창에서 열어 인쇄 → "PDF로 저장")으로 생성한다.
// 한글 폰트를 따로 임베드할 필요가 없어 깨짐 없이 안정적으로 동작한다.
export function downloadAsPdf(messages, sessionTitle) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sessionTitle || '대화')}</title>
<style>
  body{font-family:'Pretendard Variable','Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:32px;color:#111827;}
  h2{margin:0 0 4px;}
  .meta{color:#6b7280;font-size:13px;margin-bottom:20px;}
  p{line-height:1.7;margin:10px 0;}
  ul{margin:4px 0 14px;padding-left:22px;}
  b.user{color:#007FFF;} b.bot{color:#111827;}
  hr{border:none;border-top:1px solid #e5e7eb;margin:16px 0;}
</style></head>
<body>
<h2>청년ON AI 챗봇 대화 기록</h2>
<div class="meta">제목: ${escapeHtml(sessionTitle || '새 대화')} · 생성일: ${new Date().toLocaleString('ko-KR')}</div>
<hr/>
${buildTranscriptHtmlBody(messages)}
</body></html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) {
    alert('팝업이 차단되어 PDF 인쇄 창을 열 수 없어요. 팝업 차단을 해제한 뒤 다시 시도해주세요.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
