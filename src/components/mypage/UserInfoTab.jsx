import JoinHistoryCard from './JoinHistoryCard'

export default function UserInfoTab({ user, favIds, policies, onGoDetail, onToggleFav }) {
  return (
    <div style={styles.wrapper}>
      {/* 신청 내역 — 전체 너비 */}
      <JoinHistoryCard policies={policies} favIds={favIds} onGoDetail={onGoDetail} onToggleFav={onToggleFav} />
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
}
