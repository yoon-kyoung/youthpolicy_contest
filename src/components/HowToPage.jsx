import { useRef } from 'react'
import Icon from '../styles/Icon'
import chatbotHome from '../assets/howto/chatbot-home.jpg'
import chatbotConversation from '../assets/howto/chatbot-conversation.jpg'
import searchList from '../assets/howto/search-list.jpg'
import searchCompare from '../assets/howto/search-compare.jpg'
import proposalHome from '../assets/howto/proposal-home.jpg'
import communityHome from '../assets/howto/community-home.jpg'
import policyDetail from '../assets/howto/policy-detail.jpg'
import mypageHome from '../assets/howto/mypage-home.jpg'
import mypageApplications from '../assets/howto/mypage-applications.jpg'
import mypageSaved from '../assets/howto/mypage-saved.jpg'
import mypageOnboarding from '../assets/howto/mypage-onboarding.jpg'

const SECTIONS = [
  {
    id: 'chatbot',
    icon: 'smart_toy',
    title: 'AI 챗봇',
    lead: '나이·지역·관심사를 말하면 AI가 맞는 청년정책을 찾아드려요.',
    tips: [
      '입력창에 자유롭게 물어보거나, 하단 추천 질문 칩을 눌러 바로 시작할 수 있어요.',
      '답변에 실제로 언급된 정책만 카드로 정리돼요. 카드를 누르면 정책 상세로 바로 이동해요.',
      '답변 아래 후속 질문 칩을 누르면 대화를 이어서 더 구체적으로 물어볼 수 있어요.',
      '스피커 아이콘으로 답변을 읽어주고(TTS), 마이크 아이콘으로 음성으로 질문할 수도 있어요.',
      '우상단 "실시간 인기 정책 검색어"를 누르면 지금 많이 찾는 정책으로 바로 이동해요.',
      '"대화목록"에서 이전 대화를 다시 열거나, 대화 내용을 txt·Word·PDF로 내려받을 수 있어요.',
      '한 대화당 질문 횟수가 정해져 있어요(입력창 아래 "내 남은 질문" 확인). 다 쓰면 "새 대화"를 눌러주세요.',
    ],
    images: [
      { src: chatbotHome, caption: '챗봇 첫 화면 — 추천 질문과 실시간 인기 검색어' },
      { src: chatbotConversation, caption: '답변에 언급된 정책이 카드로, 후속 질문이 칩으로 정리돼요' },
    ],
  },
  {
    id: 'search',
    icon: 'search',
    title: '검색',
    lead: '카테고리·지역·부처까지 촘촘하게 걸러 원하는 정책만 찾아볼 수 있어요.',
    tips: [
      '카테고리, 지역, 중앙부처 칩을 눌러 조건을 좁히고, "지도로 보기"로 지역을 직접 골라도 돼요.',
      '학력·취업상태 등 추가 필터는 필터 영역 오른쪽 화살표를 눌러 펼칠 수 있어요.',
      '자주 쓰는 조건은 "현재 조건 저장"으로 이름 붙여두면 "내 필터"에서 바로 불러올 수 있어요.',
      '인기순·마감임박순·지원금 큰 순·최신순으로 정렬하고, "마감 제외"로 끝난 정책은 숨길 수 있어요.',
      '"정책 비교하기"를 누르고 카드를 최대 3개 선택하면 나란히 비교할 수 있어요.',
      '비교 화면에서 "AI 차이점 분석"을 누르면 정책 간 실질적인 차이와 상황별 추천을 자동으로 정리해줘요.',
    ],
    images: [
      { src: searchList, caption: '카테고리·지역·부처 필터와 정책 카드 목록' },
      { src: searchCompare, caption: '정책 3개 비교 + AI 차이점 분석 결과' },
    ],
  },
  {
    id: 'proposal',
    icon: 'campaign',
    title: '청년정책 제안',
    lead: '필요한 정책을 직접 제안하고, 공감을 모아 실제 정책으로 이어갈 수 있어요.',
    tips: [
      '우측 상단 "정책 제안하기"를 눌러 카테고리·개인/팀 여부·배경·내용을 작성하면 제안이 등록돼요.',
      '작성 중 AI가 부적절한 표현을 미리 검토해주고, 제출 전 미리보기로 최종 확인할 수 있어요.',
      '진행 상태 바(등록 → 공감투표 → 부처매칭중 → 답변)의 아이콘을 누르면 각 단계 설명을 볼 수 있어요.',
      '공감투표가 일정 수를 넘으면 자동으로 "부처매칭중"으로 바뀌고, 소관 부처의 답변을 받을 수 있어요.',
      '상세 화면 댓글에서 다른 청년들과 의견을 나누고, 공유 링크로 제안을 알릴 수 있어요.',
      '내 제안에 댓글이 달리거나 상태가 바뀌면 알림(벨 아이콘)으로 알려드려요.',
    ],
    images: [
      { src: proposalHome, caption: '정책제안 진행 상태와 전체 목록' },
    ],
  },
  {
    id: 'community',
    icon: 'forum',
    title: '커뮤니티',
    lead: '실제 신청 후기, 정보, 궁금한 점을 자유롭게 나누는 공간이에요.',
    tips: [
      '후기·정보·Q&A·정책제안 팀모집 4개 카테고리 탭으로 나눠 글을 올리고 찾아볼 수 있어요.',
      '후기 글을 쓸 때 관련 정책을 연결하면, 마이페이지 신청내역과 비교해 "실제 신청 인증" 배지가 자동으로 붙어요.',
      '공감이 많은 후기는 상단 "베스트 후기"에 노출돼요.',
      '팀모집 글에는 "참가하기" 버튼이 있고, 정원이 차면 자동으로 비활성화돼요.',
      '"청년정책 역제안" 배너로 커뮤니티에서 나온 이야기를 바로 정책제안으로 이어갈 수 있어요.',
      '내 글에 새 댓글이 달리면 알림으로 알려드려요.',
    ],
    images: [
      { src: communityHome, caption: '커뮤니티 카테고리 탭과 베스트 후기' },
    ],
  },
  {
    id: 'mypage',
    icon: 'person',
    title: '마이페이지',
    lead: '로그인하면 나타나는 개인 맞춤 공간이에요. 저장·신청·조건을 한곳에서 관리해요.',
    tips: [
      '처음 들어가면 핵심 기능을 30초 안에 안내하는 온보딩 팝업이 한 번 나와요. "다시 보지 않기"로 끌 수 있어요.',
      '상단 캘린더에서 저장한 정책의 마감일과 예상 신청 시작일을 월별로 확인할 수 있어요.',
      '"맞춤 조건" 탭에서 지역·나이·소득·학력 등을 설정하면 나에게 맞는 정책이 실시간으로 추려져요.',
      '"신청 내역" 탭에서 지원준비중 → 지원완료 → 심사중 → 결과대기 → 완료 단계를 직접 체크하고 메모를 남길 수 있어요.',
      '"저장한 정책" 탭은 마감임박순으로 정렬되고, 드래그로 순서를 바꿀 수 있어요. 북마크를 취소해도 3초 안에 되돌릴 수 있어요.',
      '"내가 쓴 글" 탭에서 커뮤니티 글과 정책제안을 모아 다시 볼 수 있어요.',
      '프로필 옆 "계정 관리"에서 정보 수정, 알림 권한, 비밀번호 변경, 로그아웃, 회원탈퇴를 할 수 있어요.',
    ],
    images: [
      { src: mypageOnboarding, caption: '최초 진입 시 나오는 온보딩 안내' },
      { src: mypageHome, caption: '프로필 · 신청 캘린더' },
      { src: mypageApplications, caption: '신청 내역 — 단계별 상태 체크' },
      { src: mypageSaved, caption: '저장한 정책 — 드래그로 순서 변경' },
    ],
  },
  {
    id: 'detail',
    icon: 'description',
    title: '정책 상세',
    lead: '검색·챗봇·마이페이지 어디서든 카드를 누르면 이 화면으로 이동해요.',
    tips: [
      '사업 개요, 신청 방법, 필요 서류, 핵심 정보(대상·기관·기한·금액)를 한 화면에서 확인할 수 있어요.',
      '별 아이콘으로 저장하고, 공유 아이콘으로 링크를 복사해 다른 사람에게 보낼 수 있어요.',
      '온라인 신청이나 공식 홈페이지로 바로 이동하는 버튼이 있어요.',
      '화면 하단에는 제목 키워드를 기반으로 비슷한 정책도 함께 추천해줘요.',
    ],
    images: [
      { src: policyDetail, caption: '정책 상세 — 핵심 정보와 저장·공유' },
    ],
  },
]

function TipList({ tips }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tips.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          <Icon name="check_circle" size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function Gallery({ images, isDesktop }) {
  return (
    <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: 14, flexWrap: 'wrap' }}>
      {images.map((img, i) => (
        <figure key={i} style={{ margin: 0, flex: isDesktop && images.length > 1 ? '1 1 260px' : '1 1 auto', minWidth: 0 }}>
          <img src={img.src} alt={img.caption} style={{ width: '100%', display: 'block', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }} />
          <figcaption style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>{img.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function Section({ section, isDesktop, sectionRef }) {
  return (
    <section ref={sectionRef} id={`howto-${section.id}`} style={{ padding: isDesktop ? '40px 0' : '28px 0', borderTop: '1px solid #eef2f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={section.icon} size={18} color="var(--accent)" />
        </div>
        <h3 style={{ fontSize: isDesktop ? 22 : 18, fontWeight: 800, color: '#111827', margin: 0 }}>{section.title}</h3>
      </div>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>{section.lead}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Gallery images={section.images} isDesktop={isDesktop} />
        <TipList tips={section.tips} />
      </div>
    </section>
  )
}

export default function HowToPage({ onBack, bp }) {
  const isDesktop = bp?.isDesktop
  const h = isDesktop ? 56 : 52
  const refs = useRef({})

  const scrollTo = (id) => {
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F9FC', fontFamily: "'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: isDesktop ? '0 40px' : '0 18px', flexShrink: 0 }}>
        <div style={{ height: h, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 14, fontWeight: 600, padding: '8px 0', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = '#374151'}
          ><Icon name="arrow_back" size={16} color="currentColor" /> 돌아가기</button>
          <span style={{ color: '#e5e7eb' }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>사용 방법</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,var(--accent-dark),var(--accent))', color: 'white', padding: isDesktop ? '56px 40px 40px' : '36px 20px 28px', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
            <Icon name="help" size={14} color="white" style={{ marginRight: 4, verticalAlign: '-2px' }} />청년ON 사용 방법
          </span>
          <h2 style={{ fontSize: isDesktop ? 30 : 22, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.35, letterSpacing: '-0.02em' }}>화면마다 실제로 어떤 기능이 있는지<br />하나씩 캡처해서 알려드려요</h2>
          <p style={{ fontSize: isDesktop ? 14 : 13, opacity: 0.85, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>궁금한 화면을 아래에서 눌러 바로 이동해보세요.</p>
        </div>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(245,249,252,0.92)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: isDesktop ? '12px 40px' : '10px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: 'white', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151' }}
              ><Icon name={s.icon} size={14} color="currentColor" />{s.title}</button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isDesktop ? '8px 40px 40px' : '4px 18px 32px' }}>
          {SECTIONS.map(s => (
            <Section key={s.id} section={s} isDesktop={isDesktop} sectionRef={el => { refs.current[s.id] = el }} />
          ))}

          <div style={{ textAlign: 'center', padding: '32px 0 8px' }}>
            <button onClick={onBack} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 14, padding: '14px 36px', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px var(--accent-shadow)', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >지금 시작하기 →</button>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '24px 18px 32px', background: '#111827', color: '#ffffff', fontSize: 12 }}>
          <div>개발자: 최윤경(Choi Yoon Kyoung) · ykchoi1020@gmail.com</div>
          <div style={{ marginTop: 6, color: '#9ca3af' }}>© 2026 청년ON. All rights reserved.</div>
        </div>
      </div>
    </div>
  )
}
