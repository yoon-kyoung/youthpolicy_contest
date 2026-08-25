import { useRef } from 'react'
import Icon from '../styles/Icon'
import chatbotHome from '../assets/howto/chatbot-home.jpg'
import chatbotConversation from '../assets/howto/chatbot-conversation.jpg'
import chatbotTrending from '../assets/howto/chatbot-trending.jpg'
import chatbotMic from '../assets/howto/chatbot-mic.jpg'
import chatbotHistory from '../assets/howto/chatbot-history.jpg'
import chatbotDownload from '../assets/howto/chatbot-download.jpg'
import searchList from '../assets/howto/search-list.jpg'
import searchFilters from '../assets/howto/search-filters.jpg'
import searchMap from '../assets/howto/search-map.jpg'
import searchMyFilterSave from '../assets/howto/search-myfilter-save.jpg'
import searchCompare from '../assets/howto/search-compare.jpg'
import policyDetail from '../assets/howto/policy-detail.jpg'
import policyDetailDocs from '../assets/howto/policy-detail-docs.jpg'
import proposalHome from '../assets/howto/proposal-home.jpg'
import proposalTimelineStep from '../assets/howto/proposal-timeline-step.jpg'
import proposalWrite from '../assets/howto/proposal-write.jpg'
import proposalDetail from '../assets/howto/proposal-detail.jpg'
import proposalAnswer from '../assets/howto/proposal-answer.jpg'
import communityHome from '../assets/howto/community-home.jpg'
import communityWrite from '../assets/howto/community-write.jpg'
import communityDetail from '../assets/howto/community-detail.jpg'
import communityRecruit from '../assets/howto/community-recruit.jpg'
import mypageOnboarding from '../assets/howto/mypage-onboarding.jpg'
import mypageHome from '../assets/howto/mypage-home.jpg'
import mypagePrefs from '../assets/howto/mypage-prefs.jpg'
import mypageApplications from '../assets/howto/mypage-applications.jpg'
import mypageSaved from '../assets/howto/mypage-saved.jpg'
import mypageMyPosts from '../assets/howto/mypage-myposts.jpg'

const SECTIONS = [
  {
    id: 'chatbot',
    icon: 'smart_toy',
    title: 'AI 챗봇',
    lead: '나이·지역·관심사를 말하면 AI가 맞는 청년정책을 찾아드려요.',
    shots: [
      { img: chatbotHome, caption: '자유롭게 물어보거나, 하단 추천 질문 칩을 눌러 바로 시작할 수 있어요.' },
      { img: chatbotConversation, caption: '답변에 실제로 언급된 정책만 카드로 정리되고, 후속 질문 칩으로 대화를 이어갈 수 있어요.' },
      { img: chatbotTrending, caption: '우상단 실시간 인기 정책 검색어를 누르면 해당 정책 상세로 바로 이동해요.' },
      { img: chatbotMic, caption: '마이크로 음성 질문을 하고, 답변은 스피커 아이콘으로 들을 수 있어요.' },
      { img: chatbotHistory, caption: '대화목록에서 이전 대화를 다시 열거나 삭제할 수 있어요.' },
      { img: chatbotDownload, caption: '대화 내용을 txt·Word·PDF 파일로 내려받을 수 있어요.' },
    ],
  },
  {
    id: 'search',
    icon: 'search',
    title: '검색',
    lead: '카테고리·지역·부처까지 촘촘하게 걸러 원하는 정책만 찾아볼 수 있어요.',
    shots: [
      { img: searchList, caption: '카테고리·지역·중앙부처 칩으로 조건을 좁혀 원하는 정책만 찾아볼 수 있어요.' },
      { img: searchFilters, caption: '학력·취업상태 등 추가 필터를 펼쳐서 더 세밀하게 좁힐 수 있어요.' },
      { img: searchMap, caption: '지도에서 지역을 직접 선택할 수도 있어요.' },
      { img: searchMyFilterSave, caption: '자주 쓰는 조건은 이름 붙여 저장해두고 "내 필터"에서 바로 불러올 수 있어요.' },
      { img: searchCompare, caption: '정책을 최대 3개까지 비교하고, AI가 차이점과 상황별 추천을 정리해줘요.' },
      { img: policyDetail, caption: '카드를 누르면 정책 상세로 이동해 사업 개요와 핵심 정보를 확인할 수 있어요.' },
      { img: policyDetailDocs, caption: '신청 방법과 필요 서류까지 한 화면에서 확인할 수 있어요.' },
    ],
  },
  {
    id: 'proposal',
    icon: 'campaign',
    title: '청년정책 제안',
    lead: '필요한 정책을 직접 제안하고, 공감을 모아 실제 정책으로 이어갈 수 있어요.',
    shots: [
      { img: proposalHome, caption: '진행 상태(등록→공감투표→부처매칭중→답변)와 전체 제안 목록을 볼 수 있어요.' },
      { img: proposalTimelineStep, caption: '진행 상태의 아이콘을 누르면 각 단계에 대한 설명이 펼쳐져요.' },
      { img: proposalWrite, caption: '카테고리·배경·제안내용·기대효과를 적어 등록하고, AI 검토로 부적절한 표현을 미리 확인할 수 있어요.' },
      { img: proposalDetail, caption: '상세 화면에서 작성→검토→공개→답변→반영까지 진행 단계를 한눈에 볼 수 있어요.' },
      { img: proposalAnswer, caption: '제안 내용과 소관 부처의 공식 답변을 함께 확인하고, 의견을 댓글로 남길 수 있어요.' },
    ],
  },
  {
    id: 'community',
    icon: 'forum',
    title: '커뮤니티',
    lead: '실제 신청 후기, 정보, 궁금한 점을 자유롭게 나누는 공간이에요.',
    shots: [
      { img: communityHome, caption: '후기·정보·Q&A·정책제안 팀모집 4개 카테고리로 나눠 글을 올리고 찾아볼 수 있어요.' },
      { img: communityWrite, caption: '글쓰기에서 관련 정책을 연결하면 실제 신청 여부가 자동으로 인증돼요.' },
      { img: communityDetail, caption: '공감·관련 정책 카드와 함께 "실제 신청 인증" 배지를 확인할 수 있어요.' },
      { img: communityRecruit, caption: '팀모집 글에는 참가하기 버튼이 있고, 정원이 차면 자동으로 마감돼요.' },
    ],
  },
  {
    id: 'mypage',
    icon: 'person',
    title: '마이페이지',
    lead: '로그인하면 나타나는 개인 맞춤 공간이에요. 저장·신청·조건을 한곳에서 관리해요.',
    shots: [
      { img: mypageOnboarding, caption: '처음 들어가면 핵심 기능을 안내하는 온보딩 팝업이 한 번 나와요.' },
      { img: mypageHome, caption: '상단 캘린더에서 저장한 정책의 마감일과 예상 신청 시작일을 확인할 수 있어요.' },
      { img: mypagePrefs, caption: '맞춤 조건 탭에서 지역·나이·소득·학력 등을 설정하면 나에게 맞는 정책이 추려져요.' },
      { img: mypageApplications, caption: '신청 내역 탭에서 지원준비중→지원완료→심사중→결과대기→완료 단계를 체크할 수 있어요.' },
      { img: mypageSaved, caption: '저장한 정책 탭은 마감임박순으로 정렬되고, 드래그로 순서를 바꿀 수 있어요.' },
      { img: mypageMyPosts, caption: '내가 쓴 글 탭에서 커뮤니티 글과 정책제안을 모아 다시 볼 수 있어요.' },
    ],
  },
]

function ShotGrid({ shots, isDesktop }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: 24 }}>
      {shots.map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ aspectRatio: '16 / 10', background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={s.img} alt={s.caption} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>{s.caption}</p>
        </div>
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
      <ShotGrid shots={section.shots} isDesktop={isDesktop} />
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
