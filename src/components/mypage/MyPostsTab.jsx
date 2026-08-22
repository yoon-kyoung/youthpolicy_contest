import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'
import Icon from '../../styles/Icon'

const POST_CAT = {
  '후기': { bg: '#F0FDF4', text: '#15803D' },
  '정보': { bg: '#EFF6FF', text: '#007FFF' },
  'Q&A': { bg: '#FFF1F2', text: '#BE123C' },
  '정책제안 팀모집': { bg: '#FDF4FF', text: '#A21CAF' },
}

const PROPOSAL_CAT = {
  job:    { bg: '#E0F2FE', text: '#0369A1', label: '취업·창업' },
  house:  { bg: '#F0FDF4', text: '#15803D', label: '주거' },
  money:  { bg: '#FFFBEB', text: '#B45309', label: '금융·자산' },
  edu:    { bg: '#F5F3FF', text: '#6D28D9', label: '교육·역량' },
  health: { bg: '#FFF1F2', text: '#BE123C', label: '건강·심리' },
}

const PROPOSAL_STATUS = {
  pending:  { label: '답변대기',   text: '#64748B', bg: '#F1F5F9' },
  matching: { label: '부처매칭중', text: '#007FFF', bg: '#EFF6FF' },
  answered: { label: '답변완료',   text: '#B45309', bg: '#FEF3C7' },
  adopted:  { label: '반영완료',   text: '#15803D', bg: '#DCFCE7' },
}

export default function MyPostsTab({ userId, onNavigate }) {
  const [posts, setPosts] = useState([])
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const [postsRes, proposalsRes] = await Promise.all([
      supabase.from('posts').select('id,cat,title,created_at,likes,comments_count').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('proposals').select('id,category,title,created_at,votes,comments_count,status').eq('user_id', userId).order('created_at', { ascending: false }),
    ])
    setPosts(postsRes.data || [])
    setProposals(proposalsRes.data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div style={styles.empty}><div style={styles.emptyDesc}>불러오는 중...</div></div>
  }

  if (posts.length === 0 && proposals.length === 0) {
    return (
      <div style={styles.empty}>
        <Icon name="article" size={40} color="#d1d5db" />
        <div style={styles.emptyTitle}>아직 작성한 글이 없어요</div>
        <div style={styles.emptyDesc}>
          커뮤니티에 후기·정보·Q&A를 남기거나<br />정책제안을 작성하면 여기서 모아볼 수 있어요.
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.section}>
        <div style={styles.header}>
          <span style={styles.title}>
            <Icon name="forum" size={16} color="#111827" style={{ marginRight: 6 }} />
            내가 쓴 커뮤니티 글
          </span>
          <span style={styles.count}>{posts.length}건</span>
        </div>
        {posts.length === 0 ? (
          <div style={styles.emptyInline}>작성한 커뮤니티 글이 없어요</div>
        ) : (
          <div style={styles.list}>
            {posts.map(p => {
              const c = POST_CAT[p.cat] || { bg: '#f3f4f6', text: '#374151' }
              return (
                <div key={p.id} style={styles.item} onClick={() => onNavigate?.('post', p.id)}>
                  <div style={styles.itemLeft}>
                    <span style={{ ...styles.badge, backgroundColor: c.bg, color: c.text }}>{p.cat}</span>
                    <span style={styles.itemTitle}>{p.title}</span>
                  </div>
                  <div style={styles.itemRight}>
                    <span style={styles.stat}><Icon name="favorite" size={12} color="#9ca3af" /> {p.likes || 0}</span>
                    <span style={styles.stat}><Icon name="chat_bubble" size={12} color="#9ca3af" /> {p.comments_count || 0}</span>
                    <span style={styles.date}>{(p.created_at || '').slice(0, 10)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.header}>
          <span style={styles.title}>
            <Icon name="campaign" size={16} color="#111827" style={{ marginRight: 6 }} />
            내가 쓴 정책제안
          </span>
          <span style={styles.count}>{proposals.length}건</span>
        </div>
        {proposals.length === 0 ? (
          <div style={styles.emptyInline}>작성한 정책제안이 없어요</div>
        ) : (
          <div style={styles.list}>
            {proposals.map(p => {
              const c = PROPOSAL_CAT[p.category] || { bg: '#f3f4f6', text: '#374151', label: '기타' }
              const s = PROPOSAL_STATUS[p.status] || PROPOSAL_STATUS.pending
              return (
                <div key={p.id} style={styles.item} onClick={() => onNavigate?.('proposal', p.id)}>
                  <div style={styles.itemLeft}>
                    <span style={{ ...styles.badge, backgroundColor: c.bg, color: c.text }}>{c.label}</span>
                    <span style={{ ...styles.badge, backgroundColor: s.bg, color: s.text }}>{s.label}</span>
                    <span style={styles.itemTitle}>{p.title}</span>
                  </div>
                  <div style={styles.itemRight}>
                    <span style={styles.stat}><Icon name="favorite" size={12} color="#9ca3af" /> {p.votes || 0}</span>
                    <span style={styles.stat}><Icon name="chat_bubble" size={12} color="#9ca3af" /> {p.comments_count || 0}</span>
                    <span style={styles.date}>{(p.created_at || '').slice(0, 10)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  section: {
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
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
    minWidth: 0,
  },
  itemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 11,
    color: '#9ca3af',
    whiteSpace: 'nowrap',
  },
  date: {
    fontSize: 11,
    color: '#9ca3af',
    whiteSpace: 'nowrap',
  },
  emptyInline: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    padding: '16px 0',
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
  },
}
