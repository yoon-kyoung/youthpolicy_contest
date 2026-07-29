import { getPolicies } from './policiesStore.js'
import { isExpired, todayYmdKST } from './recommend.js'

// 실시간 인기 검색어 위젯용 순위. 실제 조회수 데이터가 없어 정책 id 기반 해시로
// 안정적인 인기도 점수를 만들고, 10분 단위 시간 버킷을 섞어 순위가 주기적으로
// 조금씩 바뀌도록 한다 (렌더마다 흔들리지 않도록 버킷 단위로만 변화).
const BUCKET_MS = 10 * 60 * 1000

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function rankAt(bucket, limit) {
  const today = todayYmdKST()
  return getPolicies()
    .filter((p) => !isExpired(p.period, today))
    .map((p) => ({
      id: p.id,
      name: p.name,
      org: p.org,
      score: (hashStr(p.id) % 1000) + (hashStr(p.id + ':' + bucket) % 120),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function popularPolicies(limit = 5) {
  const bucket = Math.floor(Date.now() / BUCKET_MS)
  const current = rankAt(bucket, limit)
  const prevRank = new Map(rankAt(bucket - 1, limit).map((p, i) => [p.id, i]))
  return current.map((p, i) => {
    const prevIdx = prevRank.get(p.id)
    let trend = 'new'
    if (prevIdx != null) trend = prevIdx > i ? 'up' : prevIdx < i ? 'down' : 'same'
    return { ...p, rank: i + 1, trend }
  })
}

export const POPULARITY_REFRESH_MS = BUCKET_MS
