import { useEffect, useRef, useState } from 'react'
import Icon from '../styles/Icon'
import LegalFooterLinks from './LegalModal'

const SECTIONS = [
  { id: 'motive', icon: 'edit_note', title: '만들게 된 동기' },
  { id: 'ai', icon: 'smart_toy', title: 'AI 도구 활용' },
  { id: 'stack', icon: 'apps', title: '기술스택 활용' },
  { id: 'credit', icon: 'description', title: '저작권·출처' },
  { id: 'update', icon: 'sync', title: '업데이트 과정' },
]

const STACK_ITEMS = [
  { name: 'React + Vite', role: '프론트엔드 프레임워크·빌드 도구', detail: '화면 전체(챗봇·검색·정책제안·커뮤니티·마이페이지·관리자)를 컴포넌트 단위로 구성했어요.' },
  { name: 'GitHub Pages', role: '프론트엔드 배포', detail: 'main 브랜치에 push하면 GitHub Actions가 자동으로 빌드해 정적 사이트로 배포해요.' },
  { name: 'Supabase', role: '회원 인증 + 데이터베이스 + 스토리지', detail: '이메일·카카오 로그인, 커뮤니티 게시글·댓글, 정책제안·제안 댓글, 알림, 첨부파일 업로드를 모두 처리해요.' },
  { name: 'Vercel', role: 'AI 챗봇 백엔드 서버', detail: '챗봇 답변 생성 API를 별도 서버로 분리해 배포했어요. API 키는 서버에만 있어서 프론트에 노출되지 않아요.' },
  { name: 'Upstage Solar API', role: 'AI 챗봇 답변 생성 (모델: solar-pro3)', detail: '자연어 질문을 이해해 상황에 맞는 청년정책을 골라 추천 답변을 만들어요.' },
  { name: 'OpenRouter API', role: '정책제안 AI 검토 · 정책 비교 분석 (Nemotron 3 Nano)', detail: '제안 등록 전 부적절한 표현을 검사하고, 선택한 정책들의 차이점을 요약해줘요.' },
  { name: '온통청년 API', role: '청년정책·청년센터 데이터', detail: '정부(청년정책 통합정보시스템)가 제공하는 전국 청년지원정책과 청년센터 정보를 가져와 사용해요.' },
]

const CREDIT_ITEMS = [
  { name: '온통청년 청년정책 데이터', source: '청년정책 통합정보시스템 (youthcenter.go.kr) · 대한민국 정부 공공 API', license: '공공데이터', note: '정책 제목·대상·기간·신청방법 등 원문 데이터를 그대로 가져와 서비스에 노출해요. 실제 신청 전에는 반드시 원문 공고를 확인해달라는 안내를 항상 함께 보여줘요.' },
  { name: 'Pretendard Variable', source: 'orioncactus/Pretendard (길형진 제작)', license: 'SIL Open Font License 1.1', note: '화면 전체 본문·제목에 사용한 한글 웹폰트예요. 오픈소스로 배포되어 상업적 사용도 자유로워요.' },
  { name: 'Material Symbols (Rounded / Outlined)', source: 'Google Fonts', license: 'Apache License 2.0', note: '모든 아이콘은 이모지 대신 구글의 Material Symbols만 사용해요. 실제 쓰는 아이콘만 서브셋으로 추려 폰트 용량을 최소화했어요.' },
  { name: '사용법 페이지 스크린샷', source: '청년ON 자체 제작', license: '자체 저작물', note: '"사용 방법" 페이지의 화면 캡처는 전부 이 서비스를 직접 촬영한 이미지예요.' },
  { name: 'Upstage Solar / OpenRouter', source: '업스테이지, OpenRouter', license: '각 사 API 이용약관에 따름', note: 'AI 모델 자체를 배포하지 않고, 각 제공사의 API를 호출해 응답만 받아와요.' },
]

const UPDATE_LOG = [
  { date: '2026.06.11', text: '정책 목록에 부처·지역 필터 추가' },
  { date: '2026.06.12', text: '정책 상세 내용 정제(공문서 기호 자동 제거), 공유하기 버튼, 마감 제외 필터 저장' },
  { date: '2026.06.13', text: 'Supabase 연동 — 회원가입·로그인·커뮤니티·댓글 구현, 공감 토글' },
  { date: '2026.06.14', text: '카카오 소셜 로그인, 관리자 대시보드 도입' },
  { date: '이후', text: '정책 비교·정책제안·마이페이지·알림 등 기능을 계속 추가하며 지금도 매주 업데이트하고 있어요' },
]

function Section({ id, icon, title, children, sectionRef, isDesktop }) {
  return (
    <section ref={sectionRef} id={`story-${id}`} style={{ padding: isDesktop ? '40px 0' : '28px 0', borderTop: '1px solid #eef2f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={18} color="var(--accent)" />
        </div>
        <h3 style={{ fontSize: isDesktop ? 22 : 18, fontWeight: 800, color: '#111827', margin: 0 }}>{title}</h3>
      </div>
      {children}
    </section>
  )
}

export default function StoryPage({ onBack, bp }) {
  const isDesktop = bp?.isDesktop
  const h = isDesktop ? 56 : 52
  const refs = useRef({})
  const scrollRef = useRef(null)
  const [activeId, setActiveId] = useState(SECTIONS[0].id)

  const scrollTo = (id) => {
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveId(entry.target.id.replace('story-', ''))
      })
    }, { root, rootMargin: '-20% 0px -70% 0px', threshold: 0 })
    SECTIONS.forEach(s => { if (refs.current[s.id]) observer.observe(refs.current[s.id]) })
    return () => observer.disconnect()
  }, [])

  const bodyText = { fontSize: 14, color: '#374151', lineHeight: 1.8, margin: 0 }
  const card = { background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: isDesktop ? '18px 20px' : '16px' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F9FC', fontFamily: "'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: isDesktop ? '0 40px' : '0 18px', flexShrink: 0 }}>
        <div style={{ height: h, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 14, fontWeight: 600, padding: '8px 0', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = '#374151'}
          ><Icon name="arrow_back" size={16} color="currentColor" /> 돌아가기</button>
          <span style={{ color: '#e5e7eb' }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>About</span>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,var(--accent-dark),var(--accent))', color: 'white', padding: isDesktop ? '56px 40px 40px' : '36px 20px 28px', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
            <Icon name="description" size={14} color="white" style={{ marginRight: 4, verticalAlign: '-2px' }} />About 청년ON
          </span>
          <h2 style={{ fontSize: isDesktop ? 30 : 22, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.35, letterSpacing: '-0.02em' }}>청년ON을 왜, 어떻게 만들었는지<br />자세히 소개할게요</h2>
          <p style={{ fontSize: isDesktop ? 14 : 13, opacity: 0.85, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>만들게 된 동기부터 사용한 AI 도구·기술스택, 저작권 출처, 업데이트 과정까지</p>
        </div>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(245,249,252,0.92)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: isDesktop ? '10px 40px' : '8px 16px' }}>
            <div style={{ display: 'flex', overflowX: 'auto', gap: 4, padding: 6, background: '#eef2f7', borderRadius: 12 }}>
              {SECTIONS.map(s => {
                const active = activeId === s.id
                return (
                  <button key={s.id} onClick={() => scrollTo(s.id)} style={{
                    flex: '1 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 14px', fontSize: 13.5, lineHeight: 1, cursor: 'pointer', border: 'none', borderRadius: 9,
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                    color: active ? 'var(--accent)' : '#6b7280', fontWeight: active ? 700 : 500,
                    background: active ? '#ffffff' : 'transparent', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  }}><Icon name={s.icon} size={15} color="currentColor" />{s.title}</button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: isDesktop ? '8px 40px 40px' : '4px 18px 32px' }}>

          <Section id="motive" icon="edit_note" title="만들게 된 동기" sectionRef={el => { refs.current.motive = el }} isDesktop={isDesktop}>
            <div style={{ ...card }}>
              <p style={{ ...bodyText }}>
                과학기술정보통신부에서 인턴으로 근무하며 과학기술 분야에 관심을 갖게 되었습니다. 이후 과학기술정보통신부 2030 청년자문단 활동을 통해 부처의 정책을 좀 더 깊이 있게 들여다보고, 실무자분들과 소통할 수 있는 기회를 가졌습니다.
                <br /><br />
                이 과정에서, 실제 정책과 청년들이 실제로 체감하는 정책 사이에 거리가 있다는 것을 느꼈고, 청년들이 자신에게 필요한 정책을 스스로 확인하고 나아가 자유롭게 의견을 제안할 수 있는 창구가 마련되면 좋겠다는 생각을 하게 되었습니다.
                <br /><br />
                이번 대회에서는 이러한 문제의식을 바탕으로, 청년들이 자신에게 맞는 정책을 안내받고 수요자의 입장에서 필요한 정책들을 제안할 수 있는 AI 기반 서비스를 개발하고자 합니다.
              </p>
            </div>
          </Section>

          <Section id="ai" icon="smart_toy" title="교육에서 배운 AI 도구 활용" sectionRef={el => { refs.current.ai = el }} isDesktop={isDesktop}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 6 }}>개발 도구로서의 AI</div>
                <p style={bodyText}>교육 과정에서 배운 AI 페어 프로그래밍 방식을 실제 서비스 개발에 그대로 적용했습니다. 원하는 기능이나 고쳐야 할 부분을 대화로 요청하면 AI 코딩 도구(Claude Code)가 코드를 작성하고, 직접 화면으로 확인한 뒤 문제가 없으면 반영·배포하는 흐름을 반복하며 청년ON의 거의 모든 화면을 만들었습니다.</p>
              </div>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 6 }}>서비스에 내장된 AI</div>
                <p style={bodyText}>개발을 도와준 AI와는 별개로, 서비스 안에서 실제로 동작하는 AI 기능도 있습니다. <b>AI 챗봇</b>은 자연어 질문을 이해해 2,600여 건의 정책 중 상황에 맞는 정책을 골라 추천하고, <b>정책제안 AI 검토</b>는 제안 등록 전 부적절한 표현을 자동으로 걸러주며, <b>정책 비교 AI 분석</b>은 선택한 정책들의 실질적인 차이를 요약해줍니다.</p>
              </div>
            </div>
          </Section>

          <Section id="stack" icon="apps" title="기술스택별 활용 방식" sectionRef={el => { refs.current.stack = el }} isDesktop={isDesktop}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STACK_ITEMS.map(s => (
                <div key={s.name} style={card}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: '#111827' }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 20, padding: '2px 10px' }}>{s.role}</span>
                  </div>
                  <p style={{ ...bodyText, color: '#6b7280' }}>{s.detail}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="credit" icon="description" title="청년ON의 저작권 활용 (출처와 라이선스)" sectionRef={el => { refs.current.credit = el }} isDesktop={isDesktop}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CREDIT_ITEMS.map(c => (
                <div key={c.name} style={card}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: '#111827' }}>{c.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20, padding: '2px 10px' }}>{c.license}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#9ca3af', fontWeight: 600, marginBottom: 6 }}>출처 · {c.source}</div>
                  <p style={{ ...bodyText, color: '#6b7280' }}>{c.note}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="update" icon="sync" title="업데이트 과정" sectionRef={el => { refs.current.update = el }} isDesktop={isDesktop}>
            <div style={{ ...card, marginBottom: 12 }}>
              <p style={bodyText}>정해진 기획을 한 번에 완성하기보다, 실제로 사용해보며 발견한 불편함이나 필요한 기능을 그때그때 요청하고 AI 코딩 도구가 반영한 결과를 바로 확인하는 방식으로 계속 다듬어왔습니다. main 브랜치에 반영되면 GitHub Actions가 자동으로 빌드·배포해, 요청한 내용이 실제 서비스에 곧바로 반영됩니다.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {UPDATE_LOG.map((u, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '10px 4px', borderBottom: i < UPDATE_LOG.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', width: isDesktop ? 84 : 64, flexShrink: 0 }}>{u.date}</span>
                  <span style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{u.text}</span>
                </div>
              ))}
            </div>
          </Section>

          <div style={{ textAlign: 'center', padding: '32px 0 8px' }}>
            <button onClick={onBack} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 14, padding: '14px 36px', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px var(--accent-shadow)', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >청년ON 둘러보기 →</button>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '24px 18px 32px', background: '#111827', color: '#ffffff', fontSize: 12 }}>
          <LegalFooterLinks />
          <div style={{ marginTop: 6, color: '#9ca3af' }}>© 2026 청년ON. All rights reserved.</div>
        </div>
      </div>
    </div>
  )
}
