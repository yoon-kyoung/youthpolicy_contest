import { useState } from 'react'
import Icon from '../styles/Icon'

const CONTACT_EMAIL = 'ykchoi1020@gmail.com'

const PRIVACY_SECTIONS = [
  { h: '1. 수집하는 개인정보 항목', b: '청년ON은 회원가입 시 이름, 이메일, 비밀번호를 수집합니다. 카카오 소셜 로그인 이용 시에는 카카오가 제공하는 닉네임, 이메일을 수집합니다. 맞춤 정책 추천을 위해 나이, 거주 지역, 관심 분야, 학력, 취업 상태 등을 이용자가 직접 입력하는 경우에 한해 추가로 수집하며, 서비스 이용 과정에서 접속 로그, 기기 정보가 자동으로 생성될 수 있습니다.' },
  { h: '2. 개인정보의 수집 및 이용 목적', b: '회원 식별 및 가입 의사 확인, 로그인 등 본인 확인, 나이·지역·관심분야 기반 맞춤 정책 추천, AI 챗봇 상담 이력 관리, 커뮤니티·정책제안 게시물 작성 및 신원 확인, 공지사항 및 알림 전달, 서비스 부정이용 방지에 이용합니다.' },
  { h: '3. 개인정보의 보유 및 이용 기간', b: '회원 탈퇴 시 즉시 파기하며, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관합니다. 챗봇 대화 기록은 이용자가 직접 삭제할 수 있으며, 삭제 시 즉시 파기됩니다.' },
  { h: '4. 개인정보의 제3자 제공', b: '청년ON은 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령에 근거가 있거나 이용자가 사전에 동의한 경우에 한해 필요한 최소한의 정보만 제공할 수 있습니다.' },
  { h: '5. 개인정보 처리 위탁', b: '서비스 운영을 위해 클라우드 인프라(호스팅), AI 응답 생성(외부 LLM API)을 제공하는 업체에 처리 업무를 위탁할 수 있습니다. 위탁받은 업체는 위탁 목적 외 개인정보를 이용하지 않습니다.' },
  { h: '6. 이용자의 권리와 행사 방법', b: '이용자는 마이페이지에서 언제든지 본인의 개인정보를 조회·수정할 수 있으며, 회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다. 그 외 열람·정정·삭제·처리정지 요청은 하단 문의처로 연락해주시면 지체 없이 조치합니다.' },
  { h: '7. 개인정보의 안전성 확보 조치', b: '비밀번호는 암호화하여 저장하며, 개인정보에 대한 접근 권한을 최소한의 담당자로 제한하는 등 개인정보가 분실·도난·유출·변조되지 않도록 합리적인 보호조치를 취합니다.' },
  { h: '8. 문의처', b: `개인정보 관련 문의사항은 아래 이메일로 연락해주세요.\n담당자: 최윤경(Choi Yoon Kyoung)\n이메일: ${CONTACT_EMAIL}` },
  { h: '부칙', b: '이 개인정보처리방침은 2026년 8월 26일부터 적용됩니다.' },
]

const TERMS_SECTIONS = [
  { h: '제1조 (목적)', b: '이 약관은 청년ON(이하 "서비스")이 제공하는 청년정책 추천, 검색, 정책제안, 커뮤니티 등 제반 서비스의 이용조건 및 절차, 이용자와 서비스 운영자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.' },
  { h: '제2조 (정의)', b: '"이용자"란 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다. "회원"이란 서비스에 개인정보를 제공하여 회원가입을 한 자로서, 서비스가 제공하는 정보를 지속적으로 제공받으며 서비스를 계속적으로 이용할 수 있는 자를 말합니다.' },
  { h: '제3조 (약관의 효력 및 변경)', b: '이 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다. 서비스는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있으며, 변경된 약관은 공지 후 적용됩니다.' },
  { h: '제4조 (서비스의 제공 및 변경)', b: 'AI 챗봇 기반 정책 상담, 정책 검색 및 비교, 청년정책 제안, 커뮤니티, 마이페이지 등을 제공합니다. 서비스는 운영상·기술상 필요에 따라 제공하는 서비스의 내용을 변경할 수 있으며, 이 경우 변경 내용을 사전에 공지합니다.' },
  { h: '제5조 (서비스 이용의 중단)', b: '서비스는 컴퓨터 등 정보통신설비의 보수점검·교체 및 고장, 통신의 두절 등의 사유가 발생한 경우 서비스 제공을 일시적으로 중단할 수 있습니다.' },
  { h: '제6조 (회원가입 및 탈퇴)', b: '이용자는 서비스가 정한 절차에 따라 회원가입을 신청하며, 서비스는 이를 승낙함으로써 회원가입이 성립됩니다. 회원은 마이페이지를 통해 언제든지 탈퇴를 요청할 수 있고, 탈퇴 즉시 관련 정보는 관계 법령이 정하는 바를 제외하고 파기됩니다.' },
  { h: '제7조 (이용자의 의무)', b: '이용자는 다음 행위를 하여서는 안 됩니다: 타인의 정보 도용, 서비스가 게시한 정보의 무단 변경, 허위 사실 유포 및 명예훼손, 욕설·비속어·도배성 게시물 작성, 정책제안·커뮤니티 게시물을 이용한 영리목적의 광고성 정보 전송, 그 밖의 불법적이거나 부당한 행위.' },
  { h: '제8조 (게시물의 관리 및 저작권)', b: '이용자가 서비스 내에 게시한 게시물의 저작권은 해당 게시물의 작성자에게 귀속됩니다. 다만 서비스 운영 및 홍보를 위해 필요한 범위 내에서 게시물을 사용할 수 있으며, 관련 법령 및 이 약관을 위반하는 게시물은 사전 통지 없이 삭제되거나 이동될 수 있습니다.' },
  { h: '제9조 (정책 정보의 정확성에 대한 안내)', b: '서비스가 제공하는 정책 정보 및 AI 챗봇 답변은 공공 데이터 및 각 정책 소관 기관의 공고를 기초로 제공되나, 실제 신청 자격·기간·지원 내용은 변경될 수 있으므로 신청 전 반드시 소관 기관의 공식 공고를 확인해야 합니다.' },
  { h: '제10조 (책임의 제한)', b: '서비스는 천재지변, 이용자의 귀책사유 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우 책임이 면제됩니다. 서비스는 이용자가 게시하거나 AI 챗봇을 통해 안내받은 정보를 신뢰함으로써 발생한 손해에 대해 법령이 허용하는 범위 내에서 책임을 지지 않습니다.' },
  { h: '제11조 (분쟁 해결)', b: '서비스와 이용자 간 발생한 분쟁에 대해서는 대한민국 법을 적용하며, 관할 법원은 민사소송법에 따른 법원으로 합니다.' },
  { h: '부칙', b: '이 약관은 2026년 8월 26일부터 적용됩니다.' },
]

export function LegalModal({ type, onClose }) {
  const isPrivacy = type === 'privacy'
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #eef2f7', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>{isPrivacy ? '개인정보처리방침' : '이용약관'}</h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={15} color="#6b7280" />
          </button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: i === sections.length - 1 ? 0 : 18 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{s.h}</div>
              <p style={{ margin: 0, fontSize: 13, color: '#4b5563', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{s.b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LegalFooterLinks() {
  const [modal, setModal] = useState(null)
  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setModal('privacy')}>개인정보처리방침</span>
        <span style={{ color: '#4b5563' }}>|</span>
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setModal('terms')}>이용약관</span>
        <span style={{ color: '#4b5563' }}>|</span>
        <span>이메일 {CONTACT_EMAIL}</span>
      </div>
      {modal && <LegalModal type={modal} onClose={() => setModal(null)} />}
    </>
  )
}
