export const MONTHLY_TREND = [
  { month: '1월', visitors: 12400, policyViews: 38200, applications: 2840 },
  { month: '2월', visitors: 13800, policyViews: 41600, applications: 3120 },
  { month: '3월', visitors: 15200, policyViews: 47800, applications: 3580 },
  { month: '4월', visitors: 17600, policyViews: 54200, applications: 4210 },
  { month: '5월', visitors: 19400, policyViews: 61800, applications: 4960 },
  { month: '6월', visitors: 21200, policyViews: 68400, applications: 5920 },
]

export const CATEGORY_STATS = [
  { category: '일자리·창업', views: 23240, applies: 2010 },
  { category: '주거·금융', views: 17100, applies: 1580 },
  { category: '교육', views: 10940, applies: 890 },
  { category: '복지·문화', views: 10260, applies: 720 },
  { category: '참여·권리', views: 6860, applies: 360 },
]

export const REGION_STATS = [
  { region: '서울', members: 412, policyViews: 19240 },
  { region: '경기', members: 318, policyViews: 14360 },
  { region: '부산', members: 186, policyViews: 8240 },
  { region: '인천', members: 124, policyViews: 5820 },
  { region: '대구', members: 98, policyViews: 4610 },
]

export const FUNNEL = [
  { step: '방문자', count: 21200, rate: 100 },
  { step: '정책 탐색', count: 14840, rate: 70 },
  { step: '상세 조회', count: 8480, rate: 40 },
  { step: '신청 시작', count: 7420, rate: 35 },
  { step: '신청 완료', count: 5920, rate: 28 },
]

export const DROPOFF = [
  {
    from: '방문자 → 정책 탐색',
    dropped: 6360,
    dropRate: 30,
    severity: 'amber',
    insight: '첫 화면에서 원하는 정책을 빠르게 찾지 못해 이탈. 검색 UX·추천 개선 여지.',
  },
  {
    from: '정책 탐색 → 상세 조회',
    dropped: 6360,
    dropRate: 43,
    severity: 'rose',
    insight: '목록 카드만 보고 종료. 제목·요약 정보 부족으로 클릭 유도 실패 가능성 높음.',
  },
  {
    from: '상세 조회 → 신청 시작',
    dropped: 1060,
    dropRate: 13,
    severity: 'green',
    insight: '자격 미달 판단 후 자연 이탈. 자격조건 미리보기 제공 시 이탈 추가 감소 가능.',
  },
  {
    from: '신청 시작 → 신청 완료',
    dropped: 1500,
    dropRate: 20,
    severity: 'amber',
    insight: '양식 작성 중 이탈. 필수 서류 안내 부족 또는 입력 오류 발생이 주된 원인으로 추정.',
  },
]

export const SEVERITY_LABEL = { rose: '이탈 높음', amber: '이탈 보통', green: '이탈 낮음' }

export const KPIS = [
  { title: '이번달 방문자', value: '21,200', change: '+9.3%', tone: 'blue' },
  { title: '정책 조회수', value: '68,400', change: '+10.7%', tone: 'green' },
  { title: '신청 완료', value: '5,920', change: '+19.4%', tone: 'amber' },
  { title: '신청 전환율', value: '27.9%', change: '+2.1%p', tone: 'rose' },
]
