# 청년ON 개발 가이드

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
