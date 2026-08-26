function AiUsageWidget({ data, onNavigate }) {
  if (!data) return null
  const won = Math.round(data.cost)

  return (
    <article className="panel-card compact-panel">
      <div className="section-heading">
        <div>
          <h3>AI 사용량</h3>
        </div>
        <button type="button" className="action-btn" onClick={() => onNavigate?.('aiUsage')}>자세히 보기</button>
      </div>
      <div className="ai-usage-grid">
        <div className="ai-usage-cell">
          <span>호출 수</span>
          <strong>{data.calls.toLocaleString()}회</strong>
        </div>
        <div className="ai-usage-cell">
          <span>이번 달 비용</span>
          <strong>약 {won.toLocaleString()}원</strong>
        </div>
        <div className="ai-usage-cell">
          <span>사용 모델</span>
          <strong>{data.model}</strong>
        </div>
      </div>
      <div className="ai-usage-limit">
        <div className="ai-usage-limit-topline">
          <span>한도 대비 사용률</span>
          <strong>{data.usedPct}%</strong>
        </div>
        <div className="funnel-track">
          <div className="funnel-fill" style={{ width: `${data.usedPct}%` }} />
        </div>
      </div>
    </article>
  )
}

export default AiUsageWidget
