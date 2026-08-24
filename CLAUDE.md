# 청년ON 개발 가이드

## 페이지 구성

> 실제로 렌더링되는 컴포넌트 기준으로 정리. 코드를 고칠 때는 실제 진입 경로(`App.jsx`의 `page===...` 분기)를 먼저 확인할 것 — 과거에 `App.jsx` 안에 어디서도 호출되지 않는 죽은 마이페이지 컴포넌트(`MyPageView`/`CalendarView`/`CustomPoliciesView`/`ChecklistView`)가 남아있었던 적이 있었다(2026-08-22 삭제됨).

### AI 챗봇 (`src/chatbot/ChatBotView.jsx`)
- 자연어 대화로 정책 추천 (나이·지역·관심사 기반), 세션당 질문 횟수 제한(`QUESTION_LIMIT`) 도달 시 새 대화 유도
- 대화목록 드로어(과거 세션 목록/재개/삭제), 새 대화 시작, 대화 내용 다운로드(txt/Word/PDF)
- 모델 선택 드롭다운(Solar Pro 3 / Nemotron 3 Nano 등), 옵션 패널(나이·지역·관심분야 빠른선택 칩)
- 음성 인식 입력(mic), 답변 읽어주기(TTS), 답변에 실제로 언급된 정책만 하단에 추천 카드로 노출
- 실시간 인기 정책 검색어 위젯(우상단 고정, 클릭 시 정책 상세로 바로 이동, 순위/트렌드 표시)

### 검색 (`SearchView`, App.jsx)
- 카테고리 필터, 통합검색(디바운스), 정렬(인기/마감임박/지원금/최신), "마감 제외" 토글
- 지역/중앙부처 필터 칩 + 지도로 지역 선택(`RegionMapModal`), 학력/취업상태 추가 필터
- 현재 조건에 이름 붙여 저장하는 "내 필터" 프리셋(로컬 저장)
- 정책 비교: 카드 클릭으로 최대 3개 선택 → 인라인 비교 패널(컬럼 균등폭), 비교 중엔 배경 grayscale 처리. 하단에 "AI 차이점 분석"(챗봇 백엔드 `/api/compare`) — 정책 간 실질적 차이(지원대상/금액/마감 등)와 상황별 추천을 자동 생성, AI를 A/B/C 라벨로만 지칭시켜 제목 한글 깨짐을 방지하고 프론트에서 라벨-제목 매핑 표시
- 페이지네이션

### 청년정책 제안 (`PolicyProposalPage`, App.jsx, Supabase `proposals`/`proposal_comments`)
- 제안 작성(카테고리/개인·팀 구분/팀원 태그/배경·내용·기대효과 글자수 하한/첨부파일/제목 기반 해시태그 자동표시)
- AI 검토(서버 API로 욕설·부적절 표현 검사), 임시저장, 제출 전 미리보기 모달
- 공감투표(500표 임계치 도달 시 "부처매칭중"으로 자동 전환), 상태 탭/카테고리 필터/정렬
- 상세: 5단계 타임라인(작성→검토→공개→답변→반영), 소관부처 답변, 댓글(Enter=등록, Shift+Enter=줄바꿈), 공유 링크(`?proposal=id`)
- 댓글이 달리거나 상태가 바뀌면 작성자에게 알림(`notifications` 테이블) 발송

### 커뮤니티 (`CommunityView`, App.jsx, Supabase `posts`/`comments`)
- 4개 카테고리(후기/정보/Q&A/정책제안 팀모집), 검색+정렬(최신/인기/댓글많은순)
- 후기 탭(검색어 없을 때): 공감순 상위 3개를 "베스트 후기" 섹션으로 상단 하이라이트, 해당 글은 일반 목록에서도 BEST 배지 표시
- 글쓰기: 후기는 연관 정책 검색·링크 + 마이페이지 신청내역과 대조해 "실제 신청 인증" 배지 자동 판정, 팀모집은 지역 입력 필수
- 상세: 공감, 댓글(Enter=줄바꿈, 커뮤니티만 다른 규칙), 연관 정책 카드, 팀모집 글은 "참가하기"(정원 마감 시 비활성)
- "청년정책 역제안" 배너로 정책제안 페이지 유도, 딥링크(`?post=id`)로 특정 글 바로 열기
- 새 댓글이 달리면 글 작성자에게 알림 발송

### 마이페이지 (`MyPageContainer`, `src/components/mypage/`, 로그인 시에만 노출)
- 상단 고정: 신청 캘린더(`ApplicationCalendar.jsx`) — 저장한 정책 중 마감·(마감 30일 전으로 추정한) 신청시작일을 월별로 표시, 이벤트 클릭 시 정책 상세로 이동
- 프로필 바 + "계정 관리" 드롭다운(정보수정, 브라우저 알림 권한 토글, 비밀번호 변경, 로그아웃, 회원탈퇴)
- 탭 4개: **맞춤 조건**(지역/나이/소득/학력 등 설정 → 실시간 매칭 정책 미리보기), **신청 내역**(단계별 상태 변경 + 메모, 즐겨찾기 해제 시 3초 실행취소), **저장한 정책**(마감임박순, 드래그 순서변경, 북마크 취소 실행취소), **내가 쓴 글**(`MyPostsTab.jsx`, 내가 쓴 커뮤니티 글 + 정책제안 목록, 클릭 시 해당 글/제안으로 이동)
- 최초 진입 시 온보딩 투어 안내

### 정책 상세 (`PolicyDetailView`, App.jsx)
- 사업 개요, 신청 방법, 필요 서류, 핵심 정보(대상/기관/기한/금액), 온라인 신청/공식홈페이지 링크
- 저장하기, 공유(URL 복사, `?policy=id`), 제목 키워드 기반 비슷한 정책 추천

### 알림 (전역, 로그인 시 헤더에 벨 아이콘, Supabase `notifications`)
- 내 게시물/제안에 댓글, 내 제안 상태 전환(부처매칭중), 저장한 정책 마감 3일 이내(관심 정책 "업데이트"의 대체 신호) 알림
- 클릭 시 해당 게시물/제안/정책 상세로 이동, 안 읽은 알림 뱃지 표시

### 로그인 / 회원가입 / 소개
- 로그인: 이메일+비밀번호, 카카오 OAuth / 회원가입: 이름·이메일·비밀번호, 이용약관 동의, 카카오 OAuth
- 소개(About): 실제 페이지 단위로 5개 카드(AI 챗봇/정책 검색/정책 제안/커뮤니티/마이페이지)를 좌우 스와이프 캐러셀로 탐색(양옆 화살표·하단 점 인디케이터·상단 탭 바로 바로 이동). 각 카드는 해당 페이지의 하위 기능도 함께 소개 — 정책 검색엔 AI 비교 분석, 정책 제안엔 AI 검토+타임라인, 커뮤니티엔 베스트 후기+팀모집, 마이페이지엔 신청 체크리스트+맞춤 조건+내가 쓴 글을 녹여 넣음 + FAQ 아코디언

### 관리자 (`src/admin/`, `#admin` 해시로 진입, `AdminShell`)
- 대시보드(KPI/트렌드/카테고리 차트), 정책 콘텐츠 관리, 회원 관리, 소통/게시판 관리, 통계 및 분석, AI 사용량
- 전부 정적 데모 데이터이며 실제 DB 연동 CRUD는 없음

## 아이콘 규칙

모든 아이콘은 **Google Fonts Material Symbols Rounded** 스타일만 사용합니다. 이모지(📋💼🏠 등) 사용 금지.

### 사용법
```jsx
import { Icon } from "./Icon"; // 상대경로 조정

<Icon name="search" />                              // 기본 (outlined)
<Icon name="star" fill={1} />                       // filled
<Icon name="search" size={24} />                    // 크기
<Icon name="star" fill={1} size={18} weight={700} /> // 모든 옵션
```

### 새 아이콘 추가 시
1. https://fonts.google.com/icons?icon.style=Rounded 에서 Rounded 스타일로 검색
2. 아이콘 이름을 `name` prop으로 사용
3. CLAUDE.md 하단 목록에 추가
4. **중요**: `src/assets/fonts/material-symbols-*.woff2`는 실제로 쓰는 아이콘만 담은 서브셋 폰트라서, 이름만 코드에 추가하고 폰트를 재생성하지 않으면 그 아이콘은 화면에서 깨져서(빈 사각형/오류) 보인다. 새 아이콘을 추가했으면 아래처럼 두 폰트를 모두 재생성해야 한다.

```bash
# 1) 코드에서 쓰는 모든 아이콘 이름을 콤마로 나열 (기존 목록 + 새로 추가한 것)
ICONS="account_balance,add,...,work"

# 2) Google Fonts에서 FILL 축만 가변으로 남기고(opsz=24,wght=400,GRAD=0 고정) 서브셋 CSS 요청
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${ICONS}" -o outlined.css
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${ICONS}" -o rounded.css

# 3) CSS 안의 fonts.gstatic.com woff2 URL을 다운받아 교체
curl -s "$(grep -oE 'https://fonts.gstatic.com[^)]+' outlined.css)" -o src/assets/fonts/material-symbols-outlined.woff2
curl -s "$(grep -oE 'https://fonts.gstatic.com[^)]+' rounded.css)" -o src/assets/fonts/material-symbols-rounded.woff2
```

fontTools(`pip install fonttools`)로 `TTFont(path)`를 열어 `'fvar' in f`와 FILL 0~1 범위, GSUB 리가처에 새 아이콘 이름이 들어있는지 확인하면 안전하다.

### 현재 사용 중인 아이콘

| name | 설명 |
|------|------|
| `apps` | 카테고리 전체 |
| `work` | 취업·창업 |
| `home` | 주거 |
| `payments` | 금융·자산 |
| `school` | 교육·역량 |
| `local_hospital` | 건강·심리 |
| `search` | 검색 네비 |
| `smart_toy` | AI챗봇 |
| `person` | 마이페이지 |
| `forum` | 커뮤니티 네비 |
| `auto_awesome` | 나의 맞춤 정책 |
| `task_alt` | 커뮤니티 후기 "실제 신청 인증" 배지 / 정책제안 - 신청 정책 선택됨 표시 |
| `calendar_month` | 정책 캘린더 |
| `star` | 저장 (fill=1 저장됨, fill=0 저장하기) |
| `local_fire_department` | 인기 |
| `link` | 공유 |
| `alarm` | 마감 알람 |
| `visibility` / `visibility_off` | 비밀번호 표시/숨김 |
| `favorite` | 공감 (fill=1 공감, fill=0 취소) |
| `account_balance` | 로고 |
| `list_alt` | 사업 개요 섹션 |
| `edit_note` | 신청 방법 섹션 |
| `folder_open` | 필요 서류 섹션 |
| `push_pin` | 핵심 정보 |
| `group` | 신청 대상 |
| `description` | 공식 공고문 |
| `visibility` | 관심도 |
| `chat_bubble` | 댓글 수 |
| `celebration` | 완료 |
| `admin_panel_settings` | 관리자 |
| `notifications` | 알림 |
| `campaign` | 청년정책 제안 |
| `schedule` | 역제안 답변대기 상태 |
| `sync` | 역제안 부처매칭중 상태 |
| `check_circle` | 역제안 답변완료 상태 |
| `mic` | 챗봇 음성 인식 입력 (fill=1 인식 중, fill=0 대기) |
| `fact_check` | 역제안 상세 타임라인 - 검토 단계 |
| `public` | 역제안 상세 타임라인 - 공개 단계 |
| `question_answer` | 역제안 상세 타임라인 - 답변 단계 |
| `map` | 지도로 지역 선택 |
| `help` | 정책제안 안내 패널 (방법·FAQ) |
| `drag_indicator` | 저장한 정책 목록 드래그 순서 변경 핸들 |
| `download` | 챗봇 대화 다운로드 버튼 |
| `article` | 대화 다운로드 - Word 문서 옵션 |
| `picture_as_pdf` | 대화 다운로드 - PDF 옵션 |
| `volume_up` | 챗봇 답변 듣기(TTS) 대기 상태 |
| `stop` | 챗봇 답변 듣기(TTS) 재생 중 (클릭 시 중지) |
| `attach_file` | 정책제안 작성 - 첨부자료 |
| `more_horiz` | 정책제안 작성 - 카테고리 "기타" |
| `error` | 정책제안 작성 - AI 검토 경고(부적절한 표현) |
| `event` | 마이페이지 신청 내역 - 마감임박순 정렬, 마감내역 섹션 |
| `arrow_downward` | 챗봇 접힌 상태 말풍선 안내 - 펼치기 유도 화살표 |
