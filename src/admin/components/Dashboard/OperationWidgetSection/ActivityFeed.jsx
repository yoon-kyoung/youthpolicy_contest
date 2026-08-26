function ActivityFeed({ items, onNavigate }) {
  return (
    <article className="panel-card compact-panel">
      <div className="section-heading">
        <div>
          <h3>최근 활동 및 소식</h3>
        </div>
      </div>
      <div className="feed-list">
        {items.map((item) => (
          <button
            key={`${item.title}-${item.time}`}
            type="button"
            className="feed-item feed-item-clickable"
            onClick={() => onNavigate?.('policy')}
          >
            <span className="feed-tag">{item.category}</span>
            <strong>{item.title}</strong>
            <p>{item.time}</p>
          </button>
        ))}
      </div>
    </article>
  )
}

export default ActivityFeed
