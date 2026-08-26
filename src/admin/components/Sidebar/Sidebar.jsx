import NavigationMenu from './NavigationMenu'

function Sidebar({ items, activePage, onNavigate, pendingCount, onFocusPending }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-panel">
        <div className="sidebar-heading">
          <h2>운영 메뉴</h2>
        </div>
        <NavigationMenu items={items} activePage={activePage} onNavigate={onNavigate} />
        <button type="button" className="sidebar-summary sidebar-summary-btn" onClick={onFocusPending}>
          <span className="sidebar-summary-label">오늘 운영 포커스</span>
          <strong>심사 대기 {pendingCount}건</strong>
          <p>우선순위 높은 신청건을 오전 내 1차 검토로 이동하세요.</p>
          <span className="sidebar-summary-cta">심사 목록 바로가기 →</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
