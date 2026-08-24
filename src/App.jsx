import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import MyPageContainer from "./components/mypage/MyPageContainer";
import {
  Search, Bot, User, MessageCircle,
  Sparkles, ClipboardList, Calendar,
  Landmark, Star, Link2,
  ChevronLeft, ChevronDown, X,
  Shield, Clock, Briefcase, Home,
  Wallet, BookOpen, HeartPulse, LayoutGrid,
  Flame, Share2, BookMarked,
} from "lucide-react";
import ChatBotView from "./chatbot/ChatBotView";
import AdminPage from "./chatbot/AdminPage";
import AdminShell from "./admin/AdminShell";
import { loadPolicies } from "./chatbot/policiesStore";
import { API_BASE } from "./chatbot/config";
import { supabase, getDisplayName } from "./supabase";
import Icon from "./styles/Icon";

// ─── policies.json → 내부 포맷 변환 ───────────────────────────────────────

function mapCat(category=""){
  const c=category;
  if(c.includes("일자리")||c.includes("취업")||c.includes("창업"))return"job";
  if(c.includes("주거"))return"house";
  if(c.includes("금융")||c.includes("복지")||c.includes("문화")||c.includes("자산"))return"money";
  if(c.includes("교육")||c.includes("역량")||c.includes("훈련"))return"edu";
  if(c.includes("건강")||c.includes("보건")||c.includes("의료")||c.includes("심리"))return"health";
  return"job";
}

const TITLE_STOPWORDS=new Set(["청년","지원","지원사업","사업","운영","신청","모집","프로그램","정책","대상자","참여자","선발","안내","공고","서비스","제도","사업비","시행"]);
function titleKeywords(title=""){
  return (title.match(/[가-힣a-zA-Z]+/g)||[]).filter(w=>w.length>=2&&!TITLE_STOPWORDS.has(w));
}

function extractAmount(support=""){
  const m1=support.match(/최대\s*([\d,]+(?:\.\d+)?)\s*억/);
  if(m1)return Math.round(parseFloat(m1[1].replace(/,/g,""))*10000);
  const m2=support.match(/최대\s*([\d,]+)\s*만\s*원/);
  if(m2)return parseInt(m2[1].replace(/,/g,""));
  const m3=support.match(/([\d,]+)\s*만\s*원/);
  if(m3)return parseInt(m3[1].replace(/,/g,""));
  return 0;
}

function parsePeriodEnd(period=""){
  if(!period)return"상시";
  const m=period.match(/~\s*(\d{8})/);
  if(!m)return"상시";
  const d=m[1];
  return`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

function buildHowto(applyUrl,refUrl,org){
  const steps=[];
  if(refUrl||applyUrl){
    steps.push("공식 홈페이지에서 공고 내용 및 신청 자격 확인");
  }else{
    steps.push(`${org||"주관기관"} 담당 부서에 신청 일정 문의`);
  }
  if(applyUrl){
    steps.push("우측 '신청하러 가기' 버튼으로 온라인 신청 접수");
  }else if(refUrl){
    steps.push("공고 안내에 따라 신청서 작성 후 제출");
  }else{
    steps.push("담당자 안내에 따라 신청서 작성 후 제출");
  }
  steps.push("제출 서류 검토 및 자격 심사");
  steps.push("선정 결과 개별 통보 후 지원 시작");
  return steps.join("\n");
}

const SUPPORT_REMOVE=[
  '사업기간','총사업비','사업비','사업규모','사업량','사업명','사업목표','사업목적',
  '수행기관','주관기관','운영기관','추진기관','담당기관','담당자','주최','주관','운영주체',
  '운영방식','운영방법','운영방안','운영기간','운영계획',
  '역할','주요역할','수행역할',
  '추진방법','추진방향','추진일정','추진방안','추진체계','추진절차',
  '참여인원','모집인원','지원인원','선발인원','모집규모','사업별',
  '신청기간','접수기간','접수방법','신청방법',
  '임기','문의처','문의','지원근거','법적근거',
  '구성','위치','장소','기간/장소',
  '대상','지원대상','참여대상','신청대상','신청자격','참여자격',
  '근거','경과','시기',
];
// "label - 내용" 처럼 콜론 없이 대시로 라벨을 구분하는 경우를 위한 위치 탐색 (앞 18자 이내에서만)
function findLabelSeparator(head){
  const colon=head.indexOf(":");
  const dashMatch=head.match(/\s-\s/);
  const dash=dashMatch?dashMatch.index:-1;
  if(colon>-1&&(dash===-1||colon<dash))return{index:colon,skip:1};
  if(dash>-1)return{index:dash,skip:3};
  return null;
}
function extractBulletLabel(inner){
  // (label) 형식
  const pm=inner.match(/^\(([^)]{1,12})\)/);
  if(pm)return pm[1].replace(/\s/g,"");
  // label: 또는 label - 형식 — 구분자는 앞 18자 이내에서만 탐색 (이후 텍스트에 섞인 구분자 오탐 방지)
  const sep=findLabelSeparator(inner.slice(0,18));
  if(sep)return inner.slice(0,sep.index).replace(/\s/g,"");
  return inner.slice(0,12).replace(/\s/g,"");
}
const KEEP_LABELS=['주요내용','지원내용','주요혜택','주요사업내용'];
function stripSectionLabel(s){
  if(/^\([^)]+\)/.test(s)) return s.replace(/^\([^)]+\)\s*/,"").replace(/^[\s\-:：]+/,"");
  const sep=findLabelSeparator(s.slice(0,18));
  if(sep) return s.slice(sep.index+sep.skip).trimStart();
  // 라벨을 못 찾았지만 맨 앞이 그냥 "- " 불릿인 경우 (뒤쪽에 다른 항목이 있어 ○ 분기로 온 첫 조각 등)
  if(/^-\s/.test(s)) return s.replace(/^-\s+/,"");
  return s;
}
function cleanSupportFull(text){
  if(!text)return"";
  let t=text;
  // ㅇ·❍·◦·□·"- label:" → ○ 로 정규화 (뒤에 공백 없이 바로 라벨/괄호가 붙는 경우도 포함)
  if(/^ㅇ/.test(t))t="○"+t.slice(1);
  t=t.replace(/([ \n])ㅇ/g,"$1\n○");
  t=t.replace(/❍/g,"○");
  t=t.replace(/◦/g,"○");
  t=t.replace(/□/g,"○");
  // 라벨에 공백이 섞여도 인식하되, 콜론 바로 앞은 공백 없이 한글이어야 함 (label : 처럼 공백 있는 건 상위 항목의 하위 서술로 보고 건드리지 않음)
  t=t.replace(/ - (?=[가-힣](?:[가-힣\s]{0,12}[가-힣])?[：:])/g,"\n○ ");
  if(/^- [가-힣](?:[가-힣\s]{0,12}[가-힣])?[：:]/.test(t))t="○ "+t.slice(2);
  if(!t.includes("○")){
    // 불릿 없는 텍스트: 섹션 라벨만 있는 줄 제거 + 맨앞 "라벨:" 패턴 제거
    t=t.split("\n").filter(line=>!KEEP_LABELS.includes(line.trim())&&!SUPPORT_REMOVE.some(kw=>line.trim()===kw)).join("\n");
    t=t.replace(new RegExp(`^(${KEEP_LABELS.join("|")})\\s*[:：]\\s*`),"");
    // 숫자 목록 "2. " "3. " 등 앞에 줄바꿈 추가
    t=t.replace(/ (\d+)\. (?=[가-힣])/g,"\n$1. ");
    // 라벨 없이 그냥 "- "로 시작하는 목록이면 맨 앞 대시만 제거 (항목 사이 대시는 구분자로 유지)
    t=t.replace(/^-\s+/,"");
    return t.trim();
  }
  const parts=t.split(/(?=○)/).filter(s=>s.trim());
  // 주요내용·지원내용 등 명시 섹션이 있으면 해당 섹션만 추출
  const keepParts=parts.filter(part=>{
    const inner=part.replace(/^[○▪□❍◆·\s]+/,"");
    const label=extractBulletLabel(inner);
    return KEEP_LABELS.some(kw=>label.includes(kw));
  });
  const targetParts=keepParts.length>0
    ?keepParts
    :parts.filter(part=>{
        const inner=part.replace(/^[○▪□❍◆·\s]+/,"");
        const label=extractBulletLabel(inner);
        return!SUPPORT_REMOVE.some(kw=>label.includes(kw));
      });
  const result=targetParts.map(part=>{
    let s=part.replace(/^[○▪□❍◆·\s]+/,"");
    // KEEP_LABELS 라벨이 맨 앞에 있으면 직접 제거 (콜론 없는 형식도 처리)
    const matched=KEEP_LABELS.find(kw=>s.startsWith(kw));
    if(matched) s=s.slice(matched.length).replace(/^[\s\-:：]+/,"");
    else s=stripSectionLabel(s);
    return s.trim();
  }).filter(Boolean);
  return result.length>0?result.join("\n"):"";
}

function stripBulletMarkers(text){
  if(!text)return"";
  return text.replace(/(^|\s)[ㅇ○❍◦□]\s*/g,"$1").replace(/^-\s+/,"").trim();
}

export function mapRawPolicy(raw,idx){
  const deadline=parsePeriodEnd(raw.period);
  const d=deadline==="상시"?null:Math.ceil((new Date(deadline)-Date.now())/86400000);
  const hot=d!==null&&d>0&&d<=30;
  const applyUrl=raw.applyUrl||"";
  const refUrl=raw.refUrl||"";
  return{
    id:raw.id||String(idx),
    cat:mapCat(raw.category||""),
    title:raw.name||"",
    org:raw.org||"",
    target:[raw.minAge&&`만 ${raw.minAge}세 이상`,raw.maxAge&&`만 ${raw.maxAge}세 이하`].filter(Boolean).join(", ")||"청년",
    benefit:"",
    supportFull:raw.supportSummary||cleanSupportFull((raw.support||"").replace(/<[^>]+>/g,"").trim()),
    amount:extractAmount(raw.support||""),
    deadline,
    views:idx%500+100,
    hot,
    description:stripBulletMarkers(raw.summary||""),
    howto:raw.applyMethod||buildHowto(applyUrl,refUrl,raw.org||""),
    docs:raw.submitDocs||"",
    applyUrl,
    refUrl,
    region:(()=>{
      if(raw.regions&&raw.regions.length>0)return raw.regions[0];
      const m=(raw.org||"").match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/);
      return m?m[1]:"전국";
    })(),
  };
}

// ─── 데이터 ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value:"all",    icon:"apps",     label:"전체" },
  { value:"job",    icon:"work",     label:"취업·창업" },
  { value:"house",  icon:"home",     label:"주거" },
  { value:"money",  icon:"payments", label:"금융·자산" },
  { value:"edu",    icon:"school",   label:"교육·역량" },
  { value:"health", icon:"favorite", label:"건강·심리" },
];
export const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c=>[c.value,c.label]));
export const CAT_ICON  = Object.fromEntries(CATEGORIES.map(c=>[c.value,c.icon]));

const MINISTRIES = [
  "전체","고용노동부","중소벤처기업부","교육부","국토교통부","보건복지부",
  "농림축산식품부","과학기술정보통신부","문화체육관광부","국가보훈부",
  "행정안전부","외교부","산업통상자원부","해양수산부","병무청","산림청",
];

const REGIONS = [
  "전체","서울","경기","인천","부산","대구","광주","대전","울산",
  "강원","충북","충남","전북","전남","경북","경남","제주","세종",
];

const HASHTAG_SUGGESTIONS = [
  ...REGIONS.slice(1),
  ...CATEGORIES.slice(1).flatMap(c=>c.label.split("·")),
  "주거지원","취업준비","창업지원","등록금","전세","월세","육아","대학생","청년",
];

const EDUCATION_LEVELS = [
  "전체","중졸 이하","고교 재학","고교 졸업","전문대 재학","전문대 졸업",
  "대학 재학","대학 졸업","대학원 재학","대학원 졸업","기타",
];

const EMPLOYMENT_STATUSES = [
  "제한없음","재직자","자영업자","미취업자","프리랜서",
  "일용근로자","(예비)창업자","단기근로자","영농종사자","기타",
];

// 지도형 지역 선택 모달용 실제 지리 배치(%) — 위키미디어 공개 한국 백지도(Map_of_South_Korea-blank.svg, CC0)의
// 시·도 경계 좌표를 도형 무게중심으로 계산해서 얻은 값. 세종시는 그 지도에 없어 대전 인근에 눈대중으로 배치.
// 서울·경기·인천, 세종·대전처럼 서로 가까운 지역은 무게중심대로 두면 라벨이 겹쳐서, 해당 지역만 서로 떨어지게 손으로 조정.
const REGION_MAP_POS = {
  "경기":{top:"13%",   left:"33%"},
  "서울":{top:"18%",   left:"28%"},
  "인천":{top:"22%",   left:"15%"},
  "강원":{top:"16.4%", left:"62.2%"},
  "세종":{top:"34%",   left:"30%"},
  "충북":{top:"36.9%", left:"49.7%"},
  "충남":{top:"38.1%", left:"17.7%"},
  "대전":{top:"43%",   left:"39%"},
  "경북":{top:"43.5%", left:"72.9%"},
  "전북":{top:"53.5%", left:"29.2%"},
  "대구":{top:"52.3%", left:"68.7%"},
  "울산":{top:"56.6%", left:"90.9%"},
  "광주":{top:"63.8%", left:"20.3%"},
  "경남":{top:"63.2%", left:"63.3%"},
  "부산":{top:"63.2%", left:"85.1%"},
  "전남":{top:"70.2%", left:"21.1%"},
  "제주":{top:"96.5%", left:"12.5%"},
};

// 같은 출처 지도의 시·도 외곽선(점 개수를 줄여 단순화한 실루엣). viewBox "0 0 601 1155" 기준.
const KOREA_MAP_POLYGONS = [
  "204,469 203,502 214,514 221,506 234,512 252,509 256,528 261,545 246,553 235,562 229,552 219,551 215,539 196,540 173,544 162,528 140,529 131,545 110,553 95,550 91,541 81,529 67,525 79,517 74,506 69,489 67,477 66,464 63,446 64,428 57,426 45,424 40,426 33,425 29,408 24,409 10,414 8,408 18,404 12,397 5,406 5,399 8,389 8,381 12,381 14,379 15,369 25,365 29,370 34,350 39,369 35,382 36,385 48,371 52,360 40,349 51,344 66,362 66,332 106,347 122,364 143,364 161,360 170,355 183,354 197,362 208,376 222,388 209,403 182,414",
  "51,1091 57,1090 67,1086 80,1084 87,1081 89,1080 93,1079 96,1079 104,1078 108,1078 112,1076 118,1077 123,1078 126,1082 128,1084 130,1084 136,1085 136,1088 138,1092 138,1093 139,1096 142,1096 144,1100 141,1102 142,1106 139,1105 137,1111 136,1114 130,1122 126,1129 111,1135 109,1137 105,1137 99,1139 93,1139 88,1142 83,1146 78,1144 76,1144 73,1145 69,1145 65,1148 59,1149 56,1145 52,1147 47,1144 42,1147 34,1145 31,1147 28,1151 23,1154 20,1150 16,1145 11,1143 8,1140 5,1135 4,1131 4,1127 6,1122 8,1120 12,1118 15,1113 19,1112 21,1108 22,1105 25,1102 31,1099 32,1096 39,1095 44,1093",
  "419,624 447,642 478,637 498,652 529,674 518,703 494,720 481,727 471,734 466,751 458,747 451,741 444,743 435,739 428,728 432,740 437,749 429,757 427,752 423,746 409,747 407,754 395,762 398,762 410,755 414,761 411,770 403,772 404,790 407,788 409,798 405,811 399,806 395,801 396,797 391,795 382,791 385,781 378,789 375,783 364,783 360,791 349,790 345,786 334,780 336,763 335,757 327,762 327,773 318,773 313,774 304,782 297,782 289,775 283,754 267,736 257,713 261,696 270,678 266,664 268,621 278,601 292,589 303,580 315,588 332,593 348,595 359,609 376,631 395,640",
  "419,624 447,614 455,571 414,579 400,573 409,597 395,610 393,620 394,631 390,634 369,631 355,606 345,594 330,593 315,587 311,570 306,553 320,541 324,522 333,516 334,503 321,504 301,500 306,485 305,469 309,446 292,434 299,424 311,426 310,414 313,411 322,405 338,405 334,390 342,386 360,384 388,387 422,336 437,331 454,333 468,330 481,326 507,324 534,332 547,314 567,329 567,351 576,393 572,410 574,444 571,467 563,492 564,513 569,526 566,540 568,549 578,553 594,535 596,557 591,572 590,587 586,602 582,624 547,628 532,613 521,617 514,628 503,634 474,643 445,642",
  "264,544 273,546 278,552 286,554 296,551 308,561 311,571 304,578 298,586 289,590 281,596 273,605 268,621 257,650 266,668 271,677 265,685 261,696 257,705 246,699 238,695 227,698 196,702 185,700 164,699 160,689 161,679 155,673 145,687 122,668 109,677 101,697 82,701 67,696 64,682 57,674 66,662 76,657 85,655 95,652 94,645 87,645 69,647 61,642 61,634 72,627 83,620 89,604 114,609 110,598 119,585 118,579 106,583 88,571 76,565 108,559 123,550 132,537 141,529 159,530 167,541 177,544 197,541 214,536 216,545 222,556 229,553 235,561 245,561 251,551",
  "216,454 206,426 206,409 211,399 219,385 209,376 206,364 209,359 217,357 221,350 232,337 256,328 264,314 283,310 298,313 331,299 354,296 381,299 381,311 408,318 420,325 430,325 433,333 422,336 409,351 366,372 362,384 348,381 339,387 334,389 332,400 333,407 323,405 316,407 309,410 308,413 314,423 307,424 300,423 296,428 299,437 307,445 305,459 304,472 307,482 300,490 306,499 317,501 327,501 333,505 336,515 328,513 325,523 321,536 316,547 306,553 291,553 283,552 275,551 270,547 261,535 257,525 253,509 242,507 239,492 244,480 249,472 242,473 239,462 230,462",
  "436,330 426,326 412,323 388,311 380,302 352,299 325,292 288,314 281,300 284,280 288,259 286,237 297,228 285,222 270,217 259,209 246,210 248,196 240,193 244,180 257,152 244,138 230,126 206,108 200,95 187,100 181,87 174,83 187,65 210,63 229,66 257,61 283,58 308,61 333,65 364,43 373,22 383,4 389,16 396,31 399,41 413,62 422,85 427,103 435,113 446,126 450,136 456,143 463,156 473,168 483,178 491,188 500,197 501,208 509,216 514,231 517,237 527,253 536,260 542,275 552,287 552,300 547,314 534,330 521,326 492,325 480,327 471,332 457,325 450,335",
  "82,221 74,203 80,184 99,170 108,155 98,148 108,144 114,139 119,151 123,141 126,129 136,123 127,117 118,112 143,89 150,90 170,73 181,85 187,100 203,96 214,111 239,133 255,146 243,179 242,192 247,201 252,211 267,214 280,220 297,228 284,238 286,265 283,291 261,325 233,335 222,353 212,358 206,365 194,362 179,352 170,359 157,360 134,359 118,347 114,329 123,316 119,308 106,317 99,316 96,310 98,304 98,294 108,292 120,288 128,290 113,282 106,267 115,251 117,230 127,245 141,251 165,255 179,245 183,230 173,214 151,209 138,214 121,218 108,220 95,210",
  "95,893 106,903 106,923 91,902 85,910 61,902 59,889 56,871 28,851 27,830 40,835 50,855 52,847 47,841 49,834 55,841 72,845 77,843 47,819 43,812 48,793 43,777 33,780 43,768 33,760 20,762 8,749 30,741 39,753 50,757 58,755 45,737 32,732 37,716 55,694 64,682 92,702 122,668 160,673 165,700 209,706 245,697 262,724 283,755 283,780 260,787 271,807 290,802 281,829 267,848 248,806 229,806 219,826 234,842 230,859 229,871 214,882 203,882 185,873 184,855 190,860 204,838 207,826 190,830 165,845 153,860 149,883 123,888 116,859 108,880",
  "502,636 504,634 507,633 508,632 512,630 515,631 513,628 514,624 514,621 516,618 520,617 523,616 525,615 527,613 529,615 532,614 534,614 538,614 540,616 541,617 546,627 550,628 557,627 562,622 577,627 580,644 580,651 578,654 579,655 577,659 577,660 579,661 576,663 575,664 573,666 573,661 566,660 565,659 569,662 569,664 567,667 563,667 560,664 562,668 563,672 563,673 565,673 563,677 565,680 563,683 563,685 564,688 565,690 562,691 559,693 556,696 553,695 552,694 551,688 549,685 542,686 538,683 537,676 530,674 527,672 522,666 514,660 506,656 501,653 498,648",
  "556,696 552,697 548,700 549,703 544,711 546,712 546,716 544,720 543,724 541,727 538,729 536,733 532,733 527,733 526,734 524,735 523,738 524,739 525,745 520,746 516,744 516,741 513,742 512,742 511,745 510,747 506,752 507,755 506,754 504,750 502,751 503,757 500,756 499,757 498,760 496,757 496,748 493,749 493,745 490,749 486,745 486,743 484,751 480,753 474,751 475,747 471,740 469,735 472,735 477,733 480,734 482,731 481,727 481,724 485,723 488,722 490,722 494,720 500,719 503,717 507,709 514,705 520,703 523,699 525,691 538,685 543,686 550,687 551,691 553,694",
  "392,640 395,639 396,637 397,636 397,632 395,631 394,630 393,629 391,627 390,626 388,623 389,620 391,620 396,621 401,621 402,620 402,615 400,613 397,612 395,610 394,608 395,606 396,604 397,601 398,599 400,598 407,597 410,595 409,592 407,591 403,589 394,587 394,583 396,581 402,572 406,569 409,571 408,577 409,579 411,579 414,580 421,563 424,562 436,554 447,553 450,554 452,555 455,569 458,574 459,580 458,585 454,587 451,592 447,606 447,612 441,616 439,618 434,616 431,612 423,615 420,620 420,622 416,628 415,633 411,633 409,634 407,634 404,635 399,638 394,640",
  "216,454 219,453 220,452 222,454 223,455 223,461 229,461 230,463 233,462 234,458 236,457 237,462 240,462 240,464 238,466 240,469 242,473 243,469 244,468 246,469 247,470 249,472 250,474 248,474 246,475 244,477 244,481 242,484 241,486 241,489 239,492 240,493 239,495 239,499 238,501 238,508 235,511 233,514 231,517 228,516 225,514 224,511 222,509 221,503 220,501 218,501 217,506 216,511 215,513 214,515 212,519 209,512 206,511 202,507 203,503 203,502 201,501 199,500 197,498 198,491 202,484 204,470 206,468 208,469 210,469 211,468 213,465 214,463 215,461 216,458",
  "119,222 117,224 116,227 115,228 114,230 112,236 110,238 112,243 115,246 116,249 115,254 114,255 112,259 111,261 109,262 107,264 101,264 97,262 95,260 93,258 92,257 92,253 91,253 88,251 88,249 85,249 86,248 85,248 86,247 87,248 90,248 90,248 89,246 88,245 87,247 85,246 86,244 87,243 87,243 88,243 88,243 88,242 90,241 91,241 91,242 93,238 89,234 97,232 94,233 86,228 82,222 86,219 87,219 88,217 91,217 92,215 93,213 95,212 95,210 98,211 100,212 102,214 104,216 104,218 105,217 108,220 111,220 112,223 115,221 118,222",
  "119,222 120,221 120,218 122,219 124,220 127,223 130,224 132,223 133,221 137,219 138,213 139,211 138,208 139,209 144,207 145,206 149,211 151,208 153,203 158,197 165,199 170,204 170,206 173,210 173,218 174,219 171,223 174,226 178,225 181,223 185,227 183,230 181,231 180,233 178,237 179,239 181,239 180,243 177,245 177,246 175,247 172,248 169,251 167,252 166,254 165,255 159,247 158,249 156,249 155,247 152,249 143,252 141,251 137,253 135,248 134,246 133,245 132,241 130,242 127,245 123,243 123,241 124,238 124,235 122,230 119,232 116,229 115,228 116,227 117,225",
  "117,724 118,724 121,724 125,723 126,722 128,721 130,720 132,718 136,718 137,716 140,717 143,720 145,723 146,725 147,727 147,729 147,731 149,733 151,732 152,731 156,733 158,736 156,737 156,739 156,742 155,746 153,749 146,755 139,752 135,755 132,755 130,755 128,756 127,757 123,758 121,760 119,759 114,760 114,758 111,758 111,757 114,755 113,754 109,749 107,748 104,748 101,748 98,748 96,748 94,747 93,745 93,741 92,740 93,738 94,737 95,736 95,732 94,730 95,730 98,728 100,726 103,726 105,724 106,721 108,718 111,717 113,717 112,719 113,722 114,722",
];

function RegionMapModal({region,onSelect,onClose}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:20,padding:"20px 20px 24px",width:"100%",maxWidth:360,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827",display:"flex",alignItems:"center",gap:6}}><Icon name="map" size={18} color="var(--accent)"/>지역 선택</div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={14} color="#6b7280"/></button>
        </div>
        <button onClick={()=>onSelect("전체")} style={{width:"100%",padding:"8px 0",borderRadius:10,border:"1.5px solid",borderColor:region==="전체"?"var(--accent)":"#E2E8F0",background:region==="전체"?"var(--accent)":"#FFFFFF",color:region==="전체"?"#FFFFFF":"#475569",fontSize:13,fontWeight:region==="전체"?700:500,cursor:"pointer",marginBottom:14,flexShrink:0}}>전체 지역 보기</button>
        <div style={{position:"relative",width:"auto",height:"min(58vh,520px)",aspectRatio:"601/1155",margin:"0 auto",background:"linear-gradient(180deg,#EFF6FF,#F8FAFC)",borderRadius:16,border:"1px solid #E2E8F0",overflow:"hidden",flexShrink:0}}>
          <svg viewBox="0 0 601 1155" preserveAspectRatio="xMidYMid meet" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
            {KOREA_MAP_POLYGONS.map((pts,i)=>(
              <polygon key={i} points={pts} fill="#DCEAFE" stroke="#B9D3F1" strokeWidth="2" strokeLinejoin="round"/>
            ))}
          </svg>
          {REGIONS.slice(1).map(r=>{
            const pos=REGION_MAP_POS[r];
            const active=region===r;
            return(
              <button key={r} onClick={()=>onSelect(r)} style={{
                position:"absolute",top:pos.top,left:pos.left,transform:"translate(-50%,-50%)",
                padding:"5px 9px",borderRadius:10,border:"1.5px solid",
                borderColor:active?"var(--accent)":"#CBD5E1",
                background:active?"var(--accent)":"rgba(255,255,255,0.92)",
                color:active?"#FFFFFF":"#334155",
                fontSize:11,fontWeight:active?800:600,cursor:"pointer",
                whiteSpace:"nowrap",boxShadow:active?"0 3px 10px var(--accent-shadow)":"0 1px 3px rgba(0,0,0,0.08)",
                transition:"all 0.12s",
              }}>{r}</button>
            );
          })}
        </div>
        <div style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginTop:10}}>지도에서 지역을 선택하면 바로 적용돼요</div>
      </div>
    </div>
  );
}
function CompareModal({policies,onRemove,onClose}){
  const rows=[
    {label:"카테고리",render:p=><span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,padding:"3px 9px",borderRadius:20,background:(CAT_COLORS[p.cat]||{}).bg||"#f3f4f6",color:(CAT_COLORS[p.cat]||{}).text||"#374151"}}>{CATEGORIES.find(c=>c.value===p.cat)?.label||"기타"}</span>},
    {label:"지역",render:p=>p.region},
    {label:"기관",render:p=>p.org},
    {label:"대상",render:p=>p.target},
    {label:"지원금",render:p=>p.amount>0?`${p.amount.toLocaleString()}만원`:"-"},
    {label:"마감",render:p=>p.deadline==="상시"?"상시 접수":p.deadline},
    {label:"지원 내용",render:p=><div style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.6,minHeight:160,maxHeight:160,overflowY:"auto"}}>{p.supportFull||"-"}</div>},
  ];
  const colWidth=`${85/Math.max(policies.length,1)}%`;

  const [aiState,setAiState]=useState({loading:false,result:null,failedSignature:null});
  const signature=policies.map(p=>p.id).join(",");
  const runCompare=useCallback(async()=>{
    setAiState({loading:true,result:null,failedSignature:null});
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),25000);
      const res=await fetch(`${API_BASE}/api/compare`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({policies:policies.map(p=>({
          title:p.title,category:CATEGORIES.find(c=>c.value===p.cat)?.label||"기타",
          region:p.region,org:p.org,target:p.target,amount:p.amount,
          deadline:p.deadline==="상시"?"상시 접수":p.deadline,support:p.supportFull,
        }))}),
        signal:controller.signal,
      });
      clearTimeout(timer);
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(data.aiAvailable===false){
        setAiState({loading:false,result:null,failedSignature:signature});
      }else{
        setAiState({loading:false,result:data,failedSignature:null});
      }
    }catch{
      setAiState({loading:false,result:null,failedSignature:signature});
    }
  },[policies,signature]);

  useEffect(()=>{
    if(policies.length>=2)runCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature]);

  return(
    <div style={{width:"100%",maxWidth:820,pointerEvents:"auto"}}>
      <div style={{background:"white",borderRadius:20,padding:"20px 20px 24px",maxHeight:"70vh",overflowY:"auto",boxShadow:"0 -10px 40px rgba(0,0,0,0.18)",border:"1.5px solid #E2E8F0",animation:"fadeUp 0.25s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827",display:"flex",alignItems:"center",gap:6}}><Icon name="bar_chart" size={18} color="var(--accent)"/>정책 비교</div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={14} color="#6b7280"/></button>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed",minWidth:policies.length*180+100}}>
            <colgroup>
              <col style={{width:90}}/>
              {policies.map(p=><col key={p.id} style={{width:colWidth}}/>)}
            </colgroup>
            <thead>
              <tr>
                <th style={{width:90}}></th>
                {policies.map(p=>(
                  <th key={p.id} style={{textAlign:"left",padding:"0 10px 12px",verticalAlign:"top"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6,minHeight:36}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#111827",lineHeight:1.4}}>{p.title}</div>
                      <button onClick={()=>onRemove(p.id)} title="비교함에서 빼기" style={{flexShrink:0,background:"none",border:"none",cursor:"pointer",color:"#cbd5e1",padding:2,display:"flex"}}><Icon name="close" size={14} color="#cbd5e1"/></button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.label} style={{borderTop:"1px solid #F1F5F9"}}>
                  <td style={{padding:"10px 10px 10px 0",fontSize:12,fontWeight:700,color:"#64748B",whiteSpace:"nowrap",verticalAlign:"top"}}>{r.label}</td>
                  {policies.map(p=>(
                    <td key={p.id} style={{padding:"10px",fontSize:13,color:"#334155",verticalAlign:"top",wordBreak:"break-word"}}>{r.render(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {policies.length>=2&&(
          <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #F1F5F9"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:800,color:"#111827",display:"flex",alignItems:"center",gap:6}}>
                <Icon name="smart_toy" size={15} color="var(--accent)"/>AI 차이점 분석
              </div>
              {!aiState.loading&&(
                <button onClick={runCompare} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:11,fontWeight:600,padding:2}}>
                  <Icon name="sync" size={13} color="#94a3b8"/>다시 분석
                </button>
              )}
            </div>

            {aiState.loading&&(
              <div style={{fontSize:12,color:"#6b7280",padding:"10px 2px"}}>AI가 정책 간 차이를 분석하고 있어요...</div>
            )}

            {!aiState.loading&&aiState.failedSignature===signature&&(
              <div style={{borderRadius:10,padding:"12px 14px",fontSize:12,lineHeight:1.6,background:"#FFFBEB",border:"1.5px solid #FDE68A",display:"flex",alignItems:"flex-start",gap:6,color:"#B45309"}}>
                <Icon name="error" size={15} color="#D97706"/>
                <span>AI 분석 서버가 응답하지 않았어요. '다시 분석'을 눌러주세요.</span>
              </div>
            )}

            {!aiState.loading&&aiState.result&&(
              <div style={{borderRadius:10,padding:"14px 16px",fontSize:12,lineHeight:1.7,background:"#EFF6FF",border:"1.5px solid var(--accent-bg)",color:"#1e3a5f"}}>
                {aiState.result.labels?.length>0&&(
                  <div style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(0,0,0,0.08)",display:"flex",flexDirection:"column",gap:2}}>
                    {aiState.result.labels.map(l=>(
                      <div key={l.label}><b>{l.label}</b> = {l.title}</div>
                    ))}
                  </div>
                )}
                {aiState.result.points?.length>0?(
                  <ul style={{margin:0,paddingLeft:18}}>
                    {aiState.result.points.map((pt,i)=>(
                      <li key={i} style={{marginBottom:6}}><b>{pt.aspect}</b> — {pt.detail}</li>
                    ))}
                  </ul>
                ):(
                  <div style={{color:"#6b7280"}}>뚜렷한 차이점을 찾지 못했어요.</div>
                )}
                {aiState.result.recommendation&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(0,0,0,0.08)",display:"flex",gap:6,alignItems:"flex-start"}}>
                    <Icon name="task_alt" size={14} color="#007FFF"/>
                    <span>{aiState.result.recommendation}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export const CAT_COLORS = {
  job:    { bg:"#E0F2FE", border:"#BAE6FD", text:"#0369A1", dot:"#0369A1", grad:"linear-gradient(135deg,#0C4A6E,#0369A1)" },
  house:  { bg:"#DCFCE7", border:"#BBF7D0", text:"#15803D", dot:"#15803D", grad:"linear-gradient(135deg,#14532D,#15803D)" },
  money:  { bg:"#FEF3C7", border:"#FDE68A", text:"#B45309", dot:"#B45309", grad:"linear-gradient(135deg,#78350F,#B45309)" },
  edu:    { bg:"#EDE9FE", border:"#DDD6FE", text:"#6D28D9", dot:"#6D28D9", grad:"linear-gradient(135deg,#4C1D95,#6D28D9)" },
  health: { bg:"#FCE7F3", border:"#FBCFE8", text:"#BE185D", dot:"#BE185D", grad:"linear-gradient(135deg,#831843,#BE185D)" },
};

const POLICIES = [
  { id:"p1",  cat:"job",    title:"청년 일자리 도약 장려금",    org:"고용노동부",     target:"만 15~34세 미취업청년",      benefit:"월 최대 60만원 × 6개월",    amount:360,   deadline:"2025-12-31", views:8420, hot:true,
    description:"청년층의 취업을 촉진하고 중소·중견기업의 안정적 인력 수급을 지원하기 위한 장려금입니다.",
    howto:"1. 워크넷(work.net) 접속\n2. 청년 일자리 도약 장려금 신청\n3. 필요 서류 제출\n4. 심사 후 지급",
    docs:"주민등록등본, 재직증명서, 통장사본" },
  { id:"p2",  cat:"house",  title:"청년 월세 한시 특별지원",    org:"국토교통부",     target:"만 19~34세 중위소득 60%↓",  benefit:"월 최대 20만원 × 12개월",   amount:240,   deadline:"2025-06-30", views:6100, hot:true,
    description:"경제적으로 어려운 청년 1인 가구를 위한 월세 지원 사업입니다.",
    howto:"1. 복지로(bokjiro.go.kr) 접속\n2. 청년 월세 한시 특별지원 신청\n3. 소득·재산 서류 제출\n4. 자격 심사 후 계좌 지급",
    docs:"임대차계약서, 주민등록등본, 소득증빙서류" },
  { id:"p3",  cat:"money",  title:"청년 도약 계좌",             org:"금융위원회",     target:"만 19~34세 근로·사업소득자", benefit:"5년 후 최대 5,000만원",      amount:5000,  deadline:"상시",       views:5500, hot:true,
    description:"청년의 중장기 자산 형성을 위한 정책금융 상품입니다. 5년 유지 시 최대 5,000만원 수령 가능.",
    howto:"1. 취급 은행 방문 또는 앱 신청\n2. 소득 조건 확인\n3. 계좌 개설 후 매월 40~70만원 납입",
    docs:"소득확인증명서, 신분증" },
  { id:"p4",  cat:"edu",    title:"국민내일배움카드",           org:"고용노동부",     target:"만 15세 이상 취업준비생",    benefit:"최대 500만원 직업훈련 지원", amount:500,   deadline:"상시",       views:4800, hot:false,
    description:"국민 스스로 직업능력을 개발할 수 있도록 훈련비를 지원하는 카드형 제도입니다.",
    howto:"1. 고용24 접속\n2. 국민내일배움카드 신청\n3. 상담 후 카드 발급\n4. 훈련기관 선택 후 수강",
    docs:"신분증, 최종학력증명서" },
  { id:"p5",  cat:"health", title:"청년 마음건강 지원사업",     org:"보건복지부",     target:"만 19~34세 청년",            benefit:"전문상담 최대 10회 무료",    amount:0,     deadline:"2025-11-30", views:3200, hot:false,
    description:"심리적 어려움을 겪고 있는 청년이 전문 심리상담을 통해 정신건강을 회복할 수 있도록 지원합니다.",
    howto:"1. 정신건강복지센터 또는 1577-0199 문의\n2. 초기 상담 후 연계 기관 안내\n3. 전문 상담사 배정",
    docs:"신분증 (소득 조건 없음)" },
  { id:"p6",  cat:"job",    title:"청년 취업 아카데미",         org:"교육부",         target:"만 15~34세 미취업청년",      benefit:"무료 직무교육 + 취업연계",   amount:0,     deadline:"상시",       views:2900, hot:false,
    description:"대학과 기업이 연계하여 청년에게 현장 맞춤형 직무교육을 제공하는 사업입니다.",
    howto:"1. HRD-Net 접속\n2. 청년 취업 아카데미 과정 검색\n3. 원하는 과정 신청\n4. 수료 후 취업 연계",
    docs:"신분증, 최종학력증명서" },
  { id:"p7",  cat:"house",  title:"청년 전세임대주택",          org:"LH공사",         target:"만 19~39세 무주택청년",      benefit:"전세금 최대 1.2억 지원",     amount:12000, deadline:"상시",       views:4200, hot:false,
    description:"LH가 기존 주택을 전세계약한 후 청년에게 저렴하게 재임대하는 주거 지원 사업입니다.",
    howto:"1. LH청약센터 접속\n2. 청년 전세임대 공고 확인\n3. 온라인 또는 방문 신청\n4. 심사 후 계약",
    docs:"주민등록등본, 소득증빙, 무주택확인서" },
  { id:"p8",  cat:"money",  title:"청년 희망적금",              org:"금융위원회",     target:"만 19~34세 근로소득자",      benefit:"이자소득 비과세 + 우대금리", amount:600,   deadline:"2025-09-30", views:3800, hot:false,
    description:"청년층의 저축 습관 형성과 자산 형성을 지원하기 위한 비과세 우대 적금 상품입니다.",
    howto:"1. 취급 은행 앱 또는 지점 방문\n2. 소득 조건 확인\n3. 희망적금 신규 신청",
    docs:"근로소득 원천징수영수증, 신분증" },
  { id:"p9",  cat:"edu",    title:"이공계 전문기술연수",        org:"과기정통부",     target:"이공계 대졸 미취업청년",      benefit:"월 100만원 + 연수 비용",     amount:1200,  deadline:"2025-07-31", views:2100, hot:false,
    description:"이공계 대학 졸업 미취업 청년에게 전문 기술 연수 기회를 제공하고 연수지원금을 지급합니다.",
    howto:"1. 과기정통부 홈페이지 공고 확인\n2. 온라인 지원서 제출\n3. 서류심사 및 면접\n4. 연수 기관 배정",
    docs:"졸업증명서, 이공계 전공 증명서, 자기소개서" },
  { id:"p10", cat:"health", title:"청년 정신건강 복지서비스",   org:"보건복지부",     target:"만 18~34세 청년",            benefit:"정신건강 검진 + 연계서비스", amount:0,     deadline:"상시",       views:1700, hot:false,
    description:"정신건강 조기 발견 및 치료 연계를 위한 청년 대상 복지서비스입니다.",
    howto:"1. 가까운 정신건강복지센터 방문\n2. 정신건강 선별검사 실시\n3. 결과에 따른 상담·연계 서비스 제공",
    docs:"신분증 (무료, 별도 증빙 불필요)" },
  { id:"p11", cat:"job",    title:"청년 창업 지원 바우처",      org:"중소벤처기업부", target:"만 39세 이하 예비창업자",    benefit:"최대 1,000만원 사업비 지원", amount:1000,  deadline:"2025-08-31", views:3100, hot:false,
    description:"청년 예비창업자의 초기 사업비(개발·마케팅·지재권 등)를 바우처 형태로 지원합니다.",
    howto:"1. K-스타트업 접속\n2. 청년 창업 지원 바우처 공고 확인\n3. 사업계획서 제출\n4. 심사 후 바우처 지급",
    docs:"사업계획서, 신분증, 사업자등록증(예정)" },
  { id:"p12", cat:"house",  title:"청년 주거급여 분리지급",     org:"국토교통부",     target:"부모와 주소 분리 청년",      benefit:"월 최대 33만원 주거급여",    amount:396,   deadline:"상시",       views:2600, hot:false,
    description:"주거급여 수급 가구의 청년 자녀가 부모와 떨어져 거주할 경우 주거급여를 분리 지급합니다.",
    howto:"1. 주민센터 방문\n2. 주거급여 분리지급 신청서 작성\n3. 서류 제출\n4. 심사 후 지급",
    docs:"임대차계약서, 재학증명서 또는 구직활동 증빙, 주민등록등본" },
];

const SORT_OPTIONS = [
  { value:"popular",  label:"인기순" },
  { value:"deadline", label:"마감 임박순" },
  { value:"amount",   label:"지원금 큰 순" },
  { value:"recent",   label:"최신순" },
];

const NAV_ITEMS = [
  { page:"chatbot",   icon:"smart_toy", label:"AI챗봇" },
  { page:"search",    icon:"search",    label:"검색" },
  { page:"proposal",  icon:"campaign",  label:"정책제안" },
  { page:"community", icon:"forum",     label:"커뮤니티" },
  { page:"mypage",    icon:"person",    label:"마이페이지", hasSub:true },
];

const THEMES = [
  { key:'blue', color:'#007FFF', colorDark:'#0052A3', colorBg:'#E6F2FF', colorBgActive:'#F0F7FF', colorShadow:'rgba(0,127,255,0.25)', orbColor1:'#4AA8FF', orbColor2:'#19CEBD', headerBg:'#ffffff', bodyBg:'#f0f7ff', title:'로얄블루' },
  { key:'red',  color:'#DC2626', colorDark:'#991B1B', colorBg:'#FEE2E2', colorBgActive:'#FFF5F5', colorShadow:'rgba(220,38,38,0.25)',  orbColor1:'#7877C6', orbColor2:'#E16FA1', headerBg:'#ffffff', bodyBg:'#ffe4e4', title:'레드' },
];

const COMMUNITY_POSTS = [
  { id:1, cat:"후기",  title:"청년 도약 계좌 가입 성공! 솔직 후기 공유해요",     author:"김o준",   date:"2025-06-05", likes:87,  comments:23, preview:"드디어 청년 도약 계좌 개설했습니다! 처음엔 서류 준비가 막막했는데 은행 앱으로 했더니 15분 만에 끝났어요." },
  { id:2, cat:"정보",  title:"청년 월세 지원 신청 꿀팁 정리 (임박 마감 주의!)",   author:"이o현",   date:"2025-06-04", likes:124, comments:31, preview:"신청 시 많이들 놓치는 부분을 정리했어요. 임대차 계약서 날짜 꼭 확인하세요!" },
  { id:3, cat:"Q&A",   title:"국민내일배움카드 재직자도 신청 가능한가요?",          author:"박o영",     date:"2025-06-03", likes:12,  comments:8,  preview:"현재 단기 아르바이트 중인데 배움카드 신청 자격이 되는지 여쭤봅니다." },
  { id:4, cat:"후기",  title:"청년 취업 아카데미 3개월 수료 후 취업까지 연결됐어요", author:"최o민",   date:"2025-06-02", likes:56,  comments:15, preview:"과정 중에 팀프로젝트가 있었는데 거기서 만난 사람들과 같이 창업까지 준비 중이에요!" },
  { id:5, cat:"정보",  title:"2025년 하반기 청년 지원 정책 변경사항 정리",          author:"정o서",   date:"2025-06-01", likes:203, comments:47, preview:"하반기부터 달라지는 청년 정책들을 정리했습니다. 소득 기준이 일부 완화됩니다." },
  { id:6, cat:"Q&A",   title:"전세임대주택 부모님이 주택 보유하면 신청 불가?",      author:"오o진", date:"2025-05-31", likes:8,   comments:12, preview:"부모와 별도 주소지이면 괜찮다는 말도 있고 아니라는 말도 있어서 혼란스럽네요." },
  { id:7, cat:"후기",  title:"마음건강 지원사업으로 번아웃 극복한 경험 나눠요",     author:"한o아", date:"2025-05-29", likes:91,  comments:38, preview:"처음에 신청하기 부끄러웠는데 막상 받아보니 정말 큰 도움이 됐어요. 혼자 힘들어하지 마세요." },
  { id:8, cat:"정보",  title:"창업 바우처 + 청년 도약 계좌 동시 수령 가능한가요?", author:"윤o혁",  date:"2025-05-27", likes:34,  comments:9,  preview:"두 제도 모두 중복 수혜 여부가 궁금해서 직접 문의한 내용 공유드립니다." },
];

// ─── Hooks ─────────────────────────────────────────────────────────────────

// Safari/iOS와 Firefox는 비표준 CSS zoom을 지원하지 않아 --font-scale 보정만 적용되면
// 레이아웃 높이가 어긋난다(글자 깨짐·정렬 붕괴로 보임). 지원 브라우저에서만 배율 기능을 켠다.
const ZOOM_SUPPORTED=typeof CSS!=="undefined"&&typeof CSS.supports==="function"&&CSS.supports("zoom","1");

function useBreakpoint() {
  const [w, setW] = useState(typeof window!=="undefined"?window.innerWidth:1200);
  useEffect(()=>{
    const h=()=>setW(window.innerWidth);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);
  return { isMobile:w<768, isTablet:w>=768&&w<1200, isDesktop:w>=1200, w };
}

function useReveal(threshold=0.12) {
  const ref=useRef(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVisible(true);obs.disconnect();}},{threshold});
    if(ref.current)obs.observe(ref.current);
    return ()=>obs.disconnect();
  },[threshold]);
  return [ref,visible];
}

function HScrollFade({children,style,fadeColor="#ffffff"}){
  const ref=useRef(null);
  const [canScrollRight,setCanScrollRight]=useState(false);
  const check=useCallback(()=>{
    const el=ref.current;
    if(!el)return;
    setCanScrollRight(el.scrollWidth-el.clientWidth-el.scrollLeft>4);
  },[]);
  useEffect(()=>{
    check();
    const el=ref.current;
    if(!el)return;
    el.addEventListener("scroll",check,{passive:true});
    window.addEventListener("resize",check);
    return()=>{el.removeEventListener("scroll",check);window.removeEventListener("resize",check);};
  },[check]);
  return(
    <div style={{position:"relative",minWidth:0}}>
      <div ref={ref} style={{display:"flex",overflowX:"auto",...style}}>{children}</div>
      {canScrollRight&&<div style={{position:"absolute",top:0,right:0,bottom:0,width:28,pointerEvents:"none",background:`linear-gradient(to right, rgba(255,255,255,0), ${fadeColor})`}}/>}
    </div>
  );
}

function useDebounce(val,ms){
  const [dv,setDv]=useState(val);
  useEffect(()=>{const t=setTimeout(()=>setDv(val),ms);return ()=>clearTimeout(t);},[val,ms]);
  return dv;
}

function useLocalStorage(key,init){
  const [val,setVal]=useState(()=>{
    try{
      const s=localStorage.getItem(key);
      if(s===null)return init;
      const p=JSON.parse(s);
      return init instanceof Set?new Set(p):p;
    }catch{return init;}
  });
  useEffect(()=>{
    const handler=e=>{
      if(e.detail.key!==key)return;
      setVal(e.detail.value);
    };
    window.addEventListener("yoa:ls",handler);
    return()=>window.removeEventListener("yoa:ls",handler);
  },[key]);
  const set=useCallback(upd=>{
    setVal(prev=>{
      const next=typeof upd==="function"?upd(prev):upd;
      try{
        localStorage.setItem(key,JSON.stringify(next instanceof Set?[...next]:next));
        window.dispatchEvent(new CustomEvent("yoa:ls",{detail:{key,value:next}}));
      }catch{}
      return next;
    });
  },[key]);
  return [val,set];
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────

export function daysLeft(deadline){
  if(!deadline||deadline==="상시")return null;
  return Math.ceil((new Date(deadline)-Date.now())/86400000);
}
export function dDayStyle(d){
  if(d<=7)  return{color:"#FF4D4D",bg:"#FFF0F0",border:"#FFBDBD"};
  if(d<30)  return{color:"#FF9100",bg:"#FFF4E6",border:"#FFD9A0"};
  return{color:"#00C853",bg:"#E6FAEF",border:"#99F0BC"};
}
function dDayHeroStyle(d){
  if(d<=7)  return{color:"#fca5a5",bg:"rgba(239,68,68,0.25)", border:"rgba(239,68,68,0.4)"};
  if(d<30)  return{color:"#fde68a",bg:"rgba(245,158,11,0.25)",border:"rgba(245,158,11,0.4)"};
  return{color:"#86efac",bg:"rgba(34,197,94,0.25)", border:"rgba(34,197,94,0.4)"};
}

// ─── 공통 컴포넌트 ──────────────────────────────────────────────────────────

const TAG_BASE={fontSize:12,fontWeight:700,lineHeight:1,padding:"4px 10px",borderRadius:20,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center"};

function CatBadge({cat}){
  const c=CAT_COLORS[cat]||{};
  return(
    <span style={{...TAG_BASE,background:c.bg,border:`1px solid ${c.border}`,color:c.text,gap:4}}>
      <Icon name={CAT_ICON[cat]||"apps"} size={13} color={c.text}/>{CAT_LABEL[cat]||cat}
    </span>
  );
}

function DeadlinePill({deadline}){
  const d=daysLeft(deadline);
  if(d===null)return<span style={{...TAG_BASE,background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#64748B"}}>상시 접수</span>;
  if(d<=0)    return<span style={{...TAG_BASE,background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#94A3B8"}}>마감됨</span>;
  const s=dDayStyle(d);
  return<span style={{...TAG_BASE,background:s.bg,border:`1px solid ${s.border}`,color:s.color}}>D-{d}</span>;
}

function Pagination({page,pageCount,onChange}){
  if(pageCount<=1)return null;
  const nums=[];
  const start=Math.max(1,Math.min(page-2,pageCount-4));
  const end=Math.min(pageCount,Math.max(page+2,5));
  for(let i=Math.max(1,start);i<=end;i++)nums.push(i);
  const btn=(active)=>({
    minWidth:30,height:30,padding:"0 6px",borderRadius:9,border:"1.5px solid",
    borderColor:active?"var(--accent)":"#E2E8F0",background:active?"var(--accent)":"#FFFFFF",
    color:active?"#FFFFFF":"#475569",fontSize:13,fontWeight:active?700:500,cursor:"pointer",
    display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s",
  });
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"24px 0"}}>
      <button onClick={()=>onChange(Math.max(1,page-1))} disabled={page===1} style={{...btn(false),color:page===1?"#cbd5e1":"#475569",cursor:page===1?"default":"pointer"}}>
        <Icon name="chevron_left" size={16} color={page===1?"#cbd5e1":"#475569"}/>
      </button>
      {start>1&&<span style={{color:"#94a3b8",fontSize:13,padding:"0 2px"}}>…</span>}
      {nums.map(n=>(
        <button key={n} onClick={()=>onChange(n)} style={btn(n===page)}>{n}</button>
      ))}
      {end<pageCount&&<span style={{color:"#94a3b8",fontSize:13,padding:"0 2px"}}>…</span>}
      <button onClick={()=>onChange(Math.min(pageCount,page+1))} disabled={page===pageCount} style={{...btn(false),color:page===pageCount?"#cbd5e1":"#475569",cursor:page===pageCount?"default":"pointer"}}>
        <Icon name="chevron_right" size={16} color={page===pageCount?"#cbd5e1":"#475569"}/>
      </button>
    </div>
  );
}

function PolicyCard({policy,favIds,onToggle,onGoDetail,compact,delay=0,compareChecked,onToggleCompare}){
  const [ref,visible]=useReveal();
  const [copied,setCopied]=useState(false);
  const isFav=favIds.has(policy.id);
  const c=CAT_COLORS[policy.cat]||{};
  const handleShare=e=>{
    e.stopPropagation();
    const url=`${window.location.origin}${window.location.pathname}?policy=${policy.id}`;
    navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  return(
    <div ref={ref} onClick={()=>onToggleCompare?onToggleCompare(policy.id):onGoDetail(policy)} style={{
      background:compareChecked?"var(--accent-bg)":"white",borderRadius:16,border:compareChecked?"1.5px solid var(--accent)":"1.5px solid #E2E8F0",
      padding:compact?"12px 14px":"18px 20px",
      cursor:"pointer",position:"relative",
      display:"flex",flexDirection:"column",
      transition:"transform 0.2s,box-shadow 0.2s,opacity 0.4s,background 0.15s,border-color 0.15s",
      opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",
      transitionDelay:`${delay}ms`,
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.09)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="";}}
    >
      {onToggleCompare&&<button onClick={e=>{e.stopPropagation();onToggleCompare(policy.id);}}
        title="비교함에 담기"
        style={{position:"absolute",top:9,left:10,width:20,height:20,borderRadius:6,border:compareChecked?"none":"1.5px solid #cbd5e1",background:compareChecked?"var(--accent)":"#FFFFFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,zIndex:5}}
      >{compareChecked&&<Icon name="check" size={13} color="#FFFFFF"/>}</button>}
      {policy.hot&&<span style={{position:"absolute",top:10,right:74,fontSize:11,color:"#FF4D4D",background:"#FFF0F0",padding:"2px 7px",borderRadius:20,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}><Icon name="local_fire_department" size={12} color="#FF4D4D"/> 인기</span>}
      <button onClick={handleShare}
        style={{position:"absolute",top:9,right:38,background:"none",border:"none",cursor:"pointer",color:"#d1d5db",padding:4,transition:"color 0.15s,transform 0.12s",display:"flex",alignItems:"center"}}
        onMouseEnter={e=>e.currentTarget.style.color="#6b7280"}
        onMouseLeave={e=>e.currentTarget.style.color="#d1d5db"}
        title="링크 복사"
      ><Icon name="share" size={16}/></button>
      <button onClick={e=>{e.stopPropagation();onToggle(policy.id);}}
        style={{position:"absolute",top:9,right:10,background:"none",border:"none",cursor:"pointer",color:isFav?"#FFD200":"#d1d5db",padding:4,transition:"color 0.15s,transform 0.12s",display:"flex",alignItems:"center"}}
        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.35)"}
        onMouseLeave={e=>e.currentTarget.style.transform=""}
      ><Icon name="bookmark" filled={isFav} size={18}/></button>
      {copied&&<div style={{position:"absolute",top:38,right:6,background:"#1f2937",color:"white",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",zIndex:20,boxShadow:"0 2px 8px rgba(0,0,0,0.18)",animation:"fadeUp 0.2s ease"}}>URL 복사 완료</div>}
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        <CatBadge cat={policy.cat}/><DeadlinePill deadline={policy.deadline}/>
      </div>
      <div style={{fontWeight:700,fontSize:compact?13:14,color:"#111827",lineHeight:1.4,marginBottom:4,paddingRight:60}}>{policy.title}</div>
      <div style={{fontSize:12,color:"#9ca3af",marginBottom:compact?0:12}}>{policy.org} · {policy.target}</div>
      {!compact&&<div style={{fontSize:12,color:"#9ca3af",marginTop:"auto",paddingTop:12}}>자세히 보기 →</div>}
    </div>
  );
}

function renderWithLinks(text){
  const urlRe=/(https?:\/\/[^\s]+)/g;
  const parts=text.split(urlRe);
  return parts.map((p,i)=>
    urlRe.test(p)
      ?<a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{color:"var(--accent)",wordBreak:"break-all"}}>{p}</a>
      :<span key={i}>{p}</span>
  );
}

// ─── 정책 상세 페이지 ──────────────────────────────────────────────────────

function PolicyDetailView({policy,favIds,onToggle,onBack,onGoDetail,bp,policies}){
  const isFav=favIds.has(policy.id);
  const [copied,setCopied]=useState(false);
  const c=CAT_COLORS[policy.cat]||{grad:"linear-gradient(135deg,var(--accent-dark),var(--accent))",bg:"var(--accent-bg)",border:"var(--accent-bg)",text:"var(--accent)"};
  const d=daysLeft(policy.deadline);
  const handleShare=()=>{
    const url=`${window.location.origin}${window.location.pathname}?policy=${policy.id}`;
    navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  const similar=useMemo(()=>{
    const words=titleKeywords(policy.title);
    const byKeyword=policies
      .filter(p=>p.id!==policy.id)
      .map(p=>({p,score:words.filter(w=>titleKeywords(p.title).some(pw=>pw===w||pw.includes(w)||w.includes(pw))).length}))
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||(a.p.cat===policy.cat?-1:1))
      .slice(0,3)
      .map(x=>x.p);
    return byKeyword.length>0?byKeyword:policies.filter(p=>p.cat===policy.cat&&p.id!==policy.id).slice(0,3);
  },[policies,policy.id,policy.title,policy.cat]);
  const cols=bp.isDesktop?3:bp.isTablet?2:1;

  useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"});},[policy.id]);

  return(
    <div style={{background:"#F5F9FC",minHeight:"100%",animation:"fadeUp 0.25s ease"}}>
      {/* 뒤로가기 헤더 */}
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:bp.isDesktop?"0 40px":"0 16px",position:"sticky",top:0,zIndex:40}}>
        <div style={{height:bp.isDesktop?56:52,display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"#374151",fontSize:14,fontWeight:600,padding:"8px 0",transition:"color 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"}
            onMouseLeave={e=>e.currentTarget.style.color="#374151"}
          ><Icon name="arrow_back" size={16} color="currentColor"/> 뒤로가기</button>
          <span style={{color:"#e5e7eb"}}>|</span>
          <span style={{fontSize:13,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{policy.title}</span>
          <button onClick={()=>onToggle(policy.id)} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,lineHeight:1,background:isFav?"#fffbeb":"#f8fafc",border:isFav?"1px solid #fde68a":"1px solid #e5e7eb",borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:600,color:isFav?"#b45309":"#9ca3af",transition:"all 0.15s"}}>
            <Icon name="bookmark" filled={isFav} size={14}/>{isFav?"저장됨":"저장하기"}
          </button>
        </div>
      </div>

      {/* 히어로 */}
      <div style={{background:c.grad,padding:bp.isDesktop?"52px 40px 44px":bp.isTablet?"36px 24px 30px":"28px 18px 24px",position:"relative",overflow:"hidden",color:"white"}}>
        <div style={{position:"absolute",right:"-5%",top:"-30%",width:bp.isDesktop?360:200,height:bp.isDesktop?360:200,borderRadius:"50%",background:"rgba(255,255,255,0.08)",animation:"floatOrb 8s ease-in-out infinite"}}/>
        <div style={{position:"relative",maxWidth:bp.isDesktop?860:"100%"}}>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><Icon name={CAT_ICON[policy.cat]||"apps"} size={13} color="white"/>{CAT_LABEL[policy.cat]}</span>
            {d!==null&&d>0&&(()=>{const s=dDayHeroStyle(d);return<span style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,color:s.color}}>D-{d}</span>;})()}
            {policy.hot&&<span style={{background:"rgba(251,191,36,0.2)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,color:"#fde68a",display:"inline-flex",alignItems:"center",gap:3}}><Icon name="local_fire_department" size={12} color="#fde68a"/>인기</span>}
          </div>
          <h1 style={{fontSize:bp.isDesktop?38:bp.isTablet?28:22,fontWeight:900,margin:"0 0 12px",lineHeight:1.25,letterSpacing:"-0.02em"}}>{policy.title}</h1>
          <p style={{fontSize:bp.isDesktop?16:14,opacity:0.85,margin:"0 0 4px",lineHeight:1.7,maxWidth:600}}>{policy.org} · {policy.target}</p>
        </div>
        {(policy.supportFull||policy.amount>0)&&<div style={{position:"relative",marginTop:20,background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:14,padding:bp.isDesktop?"14px 22px":"10px 16px"}}>
          <div style={{fontSize:11,opacity:0.7,marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>주요 혜택</div>
          {policy.supportFull&&<div style={{fontSize:bp.isDesktop?15:13,fontWeight:600,lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{policy.supportFull}</div>}
          {policy.amount>0&&<div style={{fontSize:12,opacity:0.75,marginTop:8}}>최대 {policy.amount.toLocaleString()}만원</div>}
        </div>}
      </div>

      {/* 본문 */}
      <div style={{padding:bp.isDesktop?"40px 40px 60px":bp.isTablet?"28px 24px 60px":"20px 16px 80px"}}>
        <div style={{display:bp.isDesktop?"grid":"block",gridTemplateColumns:"1fr 360px",gap:28,maxWidth:bp.isDesktop?1200:"100%",margin:"0 auto"}}>
          <div>
            {[
              {title:<><Icon name="description" size={16} style={{marginRight:6}}/>사업 개요</>,content:<p style={{fontSize:bp.isDesktop?15:14,color:"#374151",lineHeight:1.8,margin:0}}>{policy.description}</p>},
              {title:<><Icon name="edit_note" size={16} style={{marginRight:6}}/>신청 방법</>,content:(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {policy.howto.split("\n").map((step,i)=>(
                    <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      <div style={{width:26,height:26,borderRadius:"50%",background:c.bg,border:`1.5px solid ${c.border}`,color:c.text,fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                      <div style={{fontSize:bp.isDesktop?14:13,color:"#374151",lineHeight:1.7,paddingTop:3}}>{renderWithLinks(step.replace(/^(\d+\.\s*|○\s*)/,""))}</div>
                    </div>
                  ))}
                </div>
              )},
              {title:<><Icon name="folder_open" size={16} style={{marginRight:6}}/>필요 서류</>,content:(
                policy.docs
                  ?(()=>{
                    const CIRCLES=['①','②','③','④','⑤','⑥','⑦','⑧','⑨'];
                    const chips=[],notes=[];
                    let lastCircleIdx=-1;
                    // "A 또는 B 중 택 1부" 처럼 여러 서류 중 하나를 고르는 문구는 각 서류만 칩으로, "또는"·"중 택 n부"·문장 중간의 "※ 비고"는 일반 텍스트로 분리
                    const finalizeDoc=raw=>{
                      let doc=raw.replace(/\s*등\s*$/,"").trim();
                      const noteIdx=doc.indexOf("※");
                      const noteSuffix=noteIdx>-1?doc.slice(noteIdx).trim():null;
                      if(noteIdx>-1)doc=doc.slice(0,noteIdx).trim();
                      doc=doc.replace(/\.\s*$/,"");
                      const trailingMatch=doc.match(/\s*중\s*택\s*\d+\s*부\s*(\(필수\)|\(선택\))?\s*$/);
                      const trailing=trailingMatch?trailingMatch[0].trim():null;
                      const body=(trailingMatch?doc.slice(0,trailingMatch.index):doc).trim();
                      const parts=body.split(/\s*또는\s*/).map(s=>s.trim()).filter(Boolean);
                      if(parts.length<=1&&!trailing&&!noteSuffix)return doc;
                      const tokens=[];
                      parts.forEach((part,i)=>{
                        if(i>0)tokens.push({type:"text",text:"또는"});
                        tokens.push({type:"chip",text:part});
                      });
                      if(trailing)tokens.push({type:"text",text:trailing});
                      if(noteSuffix)tokens.push({type:"text",text:noteSuffix});
                      return tokens;
                    };
                    // 줄바꿈이 있으면 줄 단위로, 없으면 콤마로 항목을 구분 (줄바꿈 형식에서 콤마까지 나누면 문장 중간이 잘림)
                    (policy.docs.includes("\n")?policy.docs.split(/\r?\n/):policy.docs.split(",")).forEach(raw=>{
                      const doc=raw.trim().replace(/^[○ㅇ❍◦□·]\s*/,"").replace(/^-\s+/,"").replace(/^\d+\.\s*/,"");
                      if(!doc)return;
                      // 섹션 라벨 제거 (추가서류 요청, ~의 경우 등)
                      if(/추가서류\s*요청|의\s*경우/.test(doc))return;
                      // "[필수서류]"처럼 대괄호로만 된 줄은 칩이 아니라 구분용 소제목 텍스트로 표시
                      const bracketOnly=doc.match(/^\[([^\]]+)\]$/);
                      if(bracketOnly){chips.push({type:"section",text:bracketOnly[1]});return;}
                      // ①②③ 포함 시 각 항목을 개별 칩으로 분리
                      if(/[①②③④⑤⑥⑦⑧⑨]/.test(doc)){
                        doc.split(/(?=[①②③④⑤⑥⑦⑧⑨])/).forEach(p=>{
                          const t=p.trim();if(!t)return;
                          const ci=CIRCLES.findIndex(c=>t.startsWith(c));
                          if(ci>=0)lastCircleIdx=ci;
                          chips.push(finalizeDoc(t));
                        });
                        return;
                      }
                      // ※ 주석은 칩 밖으로 분리
                      if(doc.startsWith("※")){notes.push(doc);return;}
                      // 앞 항목이 ①② 시리즈였다면 다음 번호 자동 부여
                      if(lastCircleIdx>=0&&lastCircleIdx+1<CIRCLES.length){
                        chips.push(finalizeDoc(CIRCLES[lastCircleIdx+1]+" "+doc));
                        lastCircleIdx++;
                      }else chips.push(finalizeDoc(doc));
                    });
                    const chipStyle={background:c.bg,border:`1px solid ${c.border}`,color:c.text,borderRadius:20,padding:"5px 14px",fontSize:13,fontWeight:600,whiteSpace:"pre-line"};
                    return(
                      <div>
                        <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-start"}}>
                          {chips.map((doc,i)=>
                            !Array.isArray(doc)&&doc?.type==="section"?(
                              <div key={i} style={{fontSize:13,fontWeight:800,color:"#374151",marginTop:i>0?4:0}}>{doc.text}</div>
                            ):Array.isArray(doc)?(
                              <div key={i} style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                                {doc.map((tok,j)=>tok.type==="chip"
                                  ?<span key={j} style={chipStyle}>{tok.text}</span>
                                  :<span key={j} style={{fontSize:13,color:"#6b7280",fontWeight:500}}>{tok.text}</span>
                                )}
                              </div>
                            ):(
                              <span key={i} style={chipStyle}>{doc}</span>
                            )
                          )}
                        </div>
                        {notes.length>0&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
                          {notes.map((n,i)=><p key={i} style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.6}}>{n}</p>)}
                        </div>}
                      </div>
                    );
                  })()
                  :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <p style={{margin:0,fontSize:bp.isDesktop?14:13,color:"#9ca3af",lineHeight:1.8}}>
                      필요 서류 없음
                    </p>
                    {(policy.refUrl||policy.applyUrl)&&(
                      <a href={policy.refUrl||policy.applyUrl} target="_blank" rel="noopener noreferrer"
                        style={{display:"inline-flex",alignItems:"center",gap:6,background:c.bg,border:`1px solid ${c.border}`,color:c.text,borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,textDecoration:"none",width:"fit-content"}}
                      ><Icon name="open_in_new" size={14} style={{marginRight:4}}/>공식 공고문 바로가기 →</a>
                    )}
                  </div>
              )},
            ].map(({title,content},i)=>(
              <section key={i} style={{background:"white",borderRadius:20,padding:bp.isDesktop?"28px 32px":"20px 18px",marginBottom:16,border:"1.5px solid #f1f5f9"}}>
                <h2 style={{fontSize:bp.isDesktop?17:15,fontWeight:800,color:"#111827",marginTop:0,marginBottom:14}}>{title}</h2>
                {content}
              </section>
            ))}
          </div>
          <div>
            <div style={{background:"white",borderRadius:20,padding:bp.isDesktop?"24px":"20px 18px",marginBottom:16,border:"1.5px solid #f1f5f9",position:bp.isDesktop?"sticky":"static",top:72}}>
              <h2 style={{fontSize:bp.isDesktop?15:14,fontWeight:800,color:"#111827",marginTop:0,marginBottom:16,display:"flex",alignItems:"center",gap:6}}><Icon name="push_pin" size={16}/>핵심 정보</h2>
              {[
                {icon:"person_search", label:"신청 대상", val:policy.target},
                {icon:"account_balance", label:"주관 기관", val:policy.org},
                {icon:"event", label:"신청 기한", val:policy.deadline==="상시"?"상시 접수":`${policy.deadline}${d!==null&&d>0?` (D-${d})`:""}`},
                {icon:"payments", label:"지원 금액", val:policy.amount>0?`최대 ${policy.amount.toLocaleString()}만원`:"비금전 지원"},
                {icon:"visibility", label:"관심도", val:`${policy.views.toLocaleString()}명 확인`},
              ].map(({icon,label,val})=>(
                <div key={label} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid #f8fafc"}}>
                  <div style={{fontSize:12,color:"#9ca3af",minWidth:90,flexShrink:0,paddingTop:1,display:"flex",alignItems:"center",gap:4}}><Icon name={icon} size={13} color="#9ca3af"/>{label}</div>
                  <div style={{fontSize:13,color:"#374151",fontWeight:600,lineHeight:1.5}}>{val}</div>
                </div>
              ))}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:20}}>
                <button
                  onClick={()=>{const u=policy.applyUrl||policy.refUrl;if(u)window.open(u,"_blank");}}
                  style={{padding:"14px",borderRadius:14,background:policy.applyUrl||policy.refUrl?c.grad:"#e5e7eb",border:"none",color:policy.applyUrl||policy.refUrl?"white":"#9ca3af",fontSize:15,fontWeight:800,cursor:policy.applyUrl||policy.refUrl?"pointer":"default",boxShadow:policy.applyUrl||policy.refUrl?`0 4px 20px ${c.dot}44`:"none",transition:"opacity 0.15s"}}
                  onMouseEnter={e=>{if(policy.applyUrl||policy.refUrl)e.currentTarget.style.opacity="0.88";}}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}
                >{policy.applyUrl?"온라인 신청하러 가기 →":policy.refUrl?"공식 홈페이지 바로가기 →":"신청 링크 미제공"}</button>
                <button onClick={()=>onToggle(policy.id)} style={{padding:"12px",borderRadius:14,border:isFav?"1.5px solid #fde68a":"1.5px solid #e5e7eb",background:isFav?"#fffbeb":"white",color:isFav?"#b45309":"#6b7280",fontSize:14,fontWeight:700,lineHeight:1,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Icon name="bookmark" filled={isFav} size={16}/>{isFav?"저장됨":"저장하기"}</button>
                <div style={{position:"relative"}}>
                  <button onClick={handleShare} style={{width:"100%",padding:"12px",borderRadius:14,border:"1.5px solid #e5e7eb",background:"white",color:"#6b7280",fontSize:14,fontWeight:700,lineHeight:1,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="share" size={16}/>공유하기</button>
                  {copied&&<div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"#1f2937",color:"white",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,whiteSpace:"nowrap",zIndex:20,boxShadow:"0 2px 8px rgba(0,0,0,0.18)",animation:"fadeUp 0.2s ease"}}>URL이 복사되었습니다</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
        {similar.length>0&&(
          <div style={{maxWidth:bp.isDesktop?1200:"100%",margin:bp.isDesktop?"32px auto 0":"0 auto"}}>
            <h2 style={{fontSize:bp.isDesktop?18:15,fontWeight:800,color:"#111827",marginBottom:14,display:"flex",alignItems:"center",gap:6}}><Icon name={CAT_ICON[policy.cat]||"apps"} size={18}/>비슷한 {CAT_LABEL[policy.cat]} 정책</h2>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:bp.isDesktop?14:9}}>
              {similar.map((p,i)=><PolicyCard key={p.id} policy={p} favIds={favIds} onToggle={onToggle} onGoDetail={onGoDetail} delay={i*80}/>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 검색 뷰 ──────────────────────────────────────────────────────────────

function SearchView({favIds,onToggleFav,onGoDetail,bp,policies}){
  const [rawQ,setRawQ]=useState("");
  const [cat,setCat]=useState("all");
  const [sort,setSort]=useLocalStorage("yoa:sort","popular");
  const [excludeExpired,setExcludeExpired]=useLocalStorage("yoa:excludeExpired",false);
  const [ministry,setMinistry]=useLocalStorage("yoa:search:ministry","전체");
  const [region,setRegion]=useLocalStorage("yoa:search:region","전체");
  const [education,setEducation]=useLocalStorage("yoa:search:education","전체");
  const [employmentStatus,setEmploymentStatus]=useLocalStorage("yoa:search:employmentStatus","제한없음");
  const [showRegionMap,setShowRegionMap]=useState(false);
  const [showMoreFilters,setShowMoreFilters]=useState(false);
  const [presets,setPresets]=useLocalStorage("yoa:search:presets",[]);
  const [savingPreset,setSavingPreset]=useState(false);
  const [presetName,setPresetName]=useState("");
  const query=useDebounce(rawQ,300);

  const presetLabel=(p)=>[
    p.cat!=="all"?CATEGORIES.find(c=>c.value===p.cat)?.label:null,
    p.region!=="전체"?p.region:null,
    p.ministry!=="전체"?p.ministry:null,
    p.education!=="전체"?p.education:null,
    p.employmentStatus!=="제한없음"?p.employmentStatus:null,
  ].filter(Boolean).join(" · ")||"전체 조건";

  const applyPreset=(p)=>{
    setCat(p.cat);setRegion(p.region);setMinistry(p.ministry);setEducation(p.education);setEmploymentStatus(p.employmentStatus);
  };
  const deletePreset=(id)=>setPresets(presets.filter(p=>p.id!==id));
  const openSavePreset=()=>{setPresetName(presetLabel({cat,region,ministry,education,employmentStatus}));setSavingPreset(true);};
  const confirmSavePreset=()=>{
    const name=presetName.trim();
    if(!name)return;
    setPresets([...presets,{id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,cat,region,ministry,education,employmentStatus}]);
    setSavingPreset(false);
  };

  const [compareMode,setCompareMode]=useState(false);
  const [compareIds,setCompareIds]=useState([]);
  const [showCompare,setShowCompare]=useState(false);
  const toggleCompare=(id)=>{
    setCompareIds(prev=>{
      if(prev.includes(id))return prev.filter(x=>x!==id);
      if(prev.length>=3)return prev;
      return [...prev,id];
    });
  };
  const toggleCompareMode=()=>{
    setCompareMode(v=>!v);
    setCompareIds([]);
  };
  const compareList=policies.filter(p=>compareIds.includes(p.id));

  const myFiltersRow=(
    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
      <span style={{fontSize:12,fontWeight:700,color:"#64748B",display:"flex",alignItems:"center",gap:4,flexShrink:0}}><Icon name="bookmark" size={13} color="#64748B"/>내 필터</span>
      {presets.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:2,background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:20,paddingRight:4}}>
          <button onClick={()=>applyPreset(p)} style={{padding:"4px 4px 4px 10px",borderRadius:20,border:"none",background:"none",color:"#334155",fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}>{p.name}</button>
          <button onClick={()=>deletePreset(p.id)} title="삭제" style={{background:"none",border:"none",cursor:"pointer",color:"#cbd5e1",padding:2,display:"flex",alignItems:"center"}}><Icon name="close" size={12} color="#cbd5e1"/></button>
        </div>
      ))}
      {!savingPreset?(
        <button onClick={openSavePreset} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,border:"1.5px dashed #CBD5E1",background:"#FFFFFF",color:"#64748B",fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}><Icon name="add" size={13} color="#64748B"/>현재 조건 저장</button>
      ):(
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input value={presetName} onChange={e=>setPresetName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmSavePreset();if(e.key==="Escape")setSavingPreset(false);}} autoFocus placeholder="필터 이름" style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid var(--accent)",fontSize:12,outline:"none",width:140,fontFamily:"inherit"}}/>
          <button onClick={confirmSavePreset} style={{padding:"4px 10px",borderRadius:20,border:"none",background:"var(--accent)",color:"white",fontSize:12,fontWeight:600,cursor:"pointer"}}>저장</button>
          <button onClick={()=>setSavingPreset(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af",padding:2,display:"flex",alignItems:"center"}}><Icon name="close" size={14} color="#9ca3af"/></button>
        </div>
      )}
    </div>
  );

  useEffect(()=>{
    if(!EDUCATION_LEVELS.includes(education))setEducation("전체");
    if(!EMPLOYMENT_STATUSES.includes(employmentStatus))setEmploymentStatus("제한없음");
  },[]);

  const catCounts=useMemo(()=>{
    const base=excludeExpired
      ?policies.filter(p=>{
          if(p.deadline==="상시")return true;
          return Math.ceil((new Date(p.deadline)-Date.now())/86400000)>0;
        })
      :policies;
    const m={all:base.length};
    CATEGORIES.slice(1).forEach(c=>{m[c.value]=base.filter(p=>p.cat===c.value).length;});
    return m;
  },[policies,excludeExpired]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    let list=policies.filter(p=>{
      if(cat!=="all"&&p.cat!==cat)return false;
      if(q&&!(p.title+p.org+p.target+p.benefit).toLowerCase().includes(q))return false;
      if(excludeExpired&&p.deadline!=="상시"){
        const d=Math.ceil((new Date(p.deadline)-Date.now())/86400000);
        if(d<=0)return false;
      }
      if(ministry!=="전체"&&p.org!==ministry)return false;
      if(region!=="전체"&&p.region!==region)return false;
      return true;
    });
    if(sort==="deadline")list=[...list].sort((a,b)=>{if(a.deadline==="상시")return 1;if(b.deadline==="상시")return -1;return a.deadline.localeCompare(b.deadline);});
    else if(sort==="amount")list=[...list].sort((a,b)=>b.amount-a.amount);
    else if(sort==="popular")list=[...list].sort((a,b)=>b.views-a.views);
    return list;
  },[query,cat,sort,excludeExpired,ministry,region,policies]);

  const cols=bp.isDesktop?3:bp.isTablet?2:1;
  const pageSize=cols*4;
  const [pageNum,setPageNum]=useState(1);
  useEffect(()=>{setPageNum(1);},[query,cat,sort,excludeExpired,ministry,region]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const pageItems=filtered.slice((pageNum-1)*pageSize,pageNum*pageSize);

  if(bp.isDesktop){
    return(
      <div style={{display:"flex",height:"100%",background:"#F5F9FC"}}>
        <div style={{width:220,flexShrink:0,background:"white",borderRight:"1px solid #E2E8F0",padding:"24px 16px",overflowY:"auto",filter:compareMode?"grayscale(1) opacity(0.55)":"none",transition:"filter 0.2s"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:14}}>카테고리</div>
          {CATEGORIES.map(c=>(
            <button key={c.value} onClick={()=>setCat(c.value)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",background:cat===c.value?"var(--accent-bg-active)":"transparent",color:cat===c.value?"var(--accent)":"#475569",fontSize:13,fontWeight:cat===c.value?700:400,marginBottom:2,transition:"all 0.12s"}}
              onMouseEnter={e=>{if(cat!==c.value)e.currentTarget.style.background="#F8FAFC"}}
              onMouseLeave={e=>{if(cat!==c.value)e.currentTarget.style.background="transparent"}}
            >
              <span style={{display:"flex",alignItems:"center",gap:4,lineHeight:1}}><Icon name={c.icon} size={13} color={cat===c.value?"var(--accent)":"#475569"}/>{c.label}</span><span style={{fontSize:11,opacity:0.7}}>{catCounts[c.value]??0}</span>
            </button>
          ))}
          <div style={{marginTop:20,paddingTop:20,borderTop:"1px solid #E2E8F0"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:10}}>정렬</div>
            {SORT_OPTIONS.map(o=>(
              <button key={o.value} onClick={()=>setSort(o.value)}
                style={{display:"block",width:"100%",padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:sort===o.value?"var(--accent-bg-active)":"transparent",color:sort===o.value?"var(--accent)":"#475569",fontSize:13,fontWeight:sort===o.value?700:400,marginBottom:2,textAlign:"left",transition:"all 0.12s"}}
                onMouseEnter={e=>{if(sort!==o.value)e.currentTarget.style.background="#F8FAFC"}}
                onMouseLeave={e=>{if(sort!==o.value)e.currentTarget.style.background="transparent"}}
              >{o.label}</button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <div style={{position:"relative",flex:1}}>
                <input type="search" value={rawQ} onChange={e=>setRawQ(e.target.value)} placeholder="검색어 입력 (정책명, 기관명, 혜택 등)"
                  style={{width:"100%",padding:"9px 40px 9px 14px",border:"1.5px solid #E2E8F0",borderRadius:12,fontSize:13,outline:"none",fontFamily:"inherit",background:"white",boxSizing:"border-box",transition:"border-color 0.15s"}}
                  onFocus={e=>e.target.style.borderColor="var(--accent)"}
                  onBlur={e=>e.target.style.borderColor="#E2E8F0"}
                />
                {rawQ&&<button onClick={()=>setRawQ("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"#e5e7eb",border:"none",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={12} color="#6b7280"/></button>}
              </div>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                <input type="checkbox" checked={excludeExpired} onChange={e=>setExcludeExpired(e.target.checked)} style={{width:16,height:16,accentColor:"var(--accent)",cursor:"pointer"}}/>
                <span style={{fontSize:13,color:"#374151",fontWeight:500}}>마감 제외</span>
              </label>
              {query&&<div style={{fontSize:13,color:"#6b7280",whiteSpace:"nowrap"}}>"{query}" 검색 결과</div>}
              <button onClick={toggleCompareMode} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:20,border:compareMode?"none":"1.5px solid #E2E8F0",background:compareMode?"var(--accent)":"white",color:compareMode?"white":"#475569",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,marginLeft:"auto"}}><Icon name={compareMode?"close":"bar_chart"} size={15} color={compareMode?"white":"#475569"}/>{compareMode?"비교 모드 종료":"정책 비교하기"}</button>
            </div>
            <div style={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:12,padding:"12px 16px",display:"flex",flexDirection:"column",gap:10,marginTop:4,filter:compareMode?"grayscale(1) opacity(0.55)":"none",transition:"filter 0.2s"}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#374151",lineHeight:1,marginBottom:6,display:"flex",alignItems:"center",gap:4}}>지역</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                  {REGIONS.map(r=>(
                    <button key={r} onClick={()=>setRegion(r)} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:region===r?"var(--accent)":"#E2E8F0",background:region===r?"var(--accent)":"#FFFFFF",color:region===r?"#FFFFFF":"#475569",fontSize:12,fontWeight:region===r?700:400,cursor:"pointer",transition:"all 0.12s",whiteSpace:"nowrap"}}>{r}</button>
                  ))}
                  <button onClick={()=>setShowRegionMap(true)} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,border:"1.5px solid #E2E8F0",background:"#FFFFFF",color:"#475569",fontSize:12,fontWeight:400,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,marginLeft:2}}>
                    <Icon name="map" size={13} color="#475569"/>지도로 보기
                  </button>
                </div>
              </div>
              <div style={{borderTop:"1px solid #E2E8F0",paddingTop:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"#374151",lineHeight:1,marginBottom:6,display:"flex",alignItems:"center",gap:4}}>중앙부처</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {MINISTRIES.map(m=>(
                    <button key={m} onClick={()=>setMinistry(m)} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:ministry===m?"var(--accent)":"#E2E8F0",background:ministry===m?"var(--accent)":"#FFFFFF",color:ministry===m?"#FFFFFF":"#475569",fontSize:12,fontWeight:ministry===m?700:400,cursor:"pointer",transition:"all 0.12s",whiteSpace:"nowrap"}}>{m}</button>
                  ))}
                </div>
                {!showMoreFilters&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:8}}>
                  {myFiltersRow}
                  <button onClick={()=>setShowMoreFilters(v=>!v)} title="학력·취업 상태 더보기" style={{display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:"50%",border:"none",background:"var(--accent)",color:"#FFFFFF",cursor:"pointer",boxShadow:"0 2px 6px rgba(0,0,0,0.2)",flexShrink:0}}>
                    <Icon name="expand_more" size={18} color="#FFFFFF"/>
                  </button>
                </div>}
              </div>
              {showMoreFilters&&<>
              <div style={{borderTop:"1px solid #E2E8F0",paddingTop:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"#374151",lineHeight:1,marginBottom:6,display:"flex",alignItems:"center",gap:4}}>학력</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {EDUCATION_LEVELS.map(e=>(
                    <button key={e} onClick={()=>setEducation(e)} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:education===e?"var(--accent)":"#E2E8F0",background:education===e?"var(--accent)":"#FFFFFF",color:education===e?"#FFFFFF":"#475569",fontSize:12,fontWeight:education===e?700:400,cursor:"pointer",transition:"all 0.12s",whiteSpace:"nowrap"}}>{e}</button>
                  ))}
                </div>
              </div>
              <div style={{borderTop:"1px solid #E2E8F0",paddingTop:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"#374151",lineHeight:1,marginBottom:6,display:"flex",alignItems:"center",gap:4}}>취업 상태</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {EMPLOYMENT_STATUSES.map(e=>(
                    <button key={e} onClick={()=>setEmploymentStatus(e)} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:employmentStatus===e?"var(--accent)":"#E2E8F0",background:employmentStatus===e?"var(--accent)":"#FFFFFF",color:employmentStatus===e?"#FFFFFF":"#475569",fontSize:12,fontWeight:employmentStatus===e?700:400,cursor:"pointer",transition:"all 0.12s",whiteSpace:"nowrap"}}>{e}</button>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:8}}>
                  {myFiltersRow}
                  <button onClick={()=>setShowMoreFilters(v=>!v)} title="학력·취업 상태 접기" style={{display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:"50%",border:"none",background:"var(--accent)",color:"#FFFFFF",cursor:"pointer",boxShadow:"0 2px 6px rgba(0,0,0,0.2)",flexShrink:0}}>
                    <Icon name="expand_less" size={18} color="#FFFFFF"/>
                  </button>
                </div>
              </div>
              </>}
            </div>
          </div>
          <div style={{fontSize:12,color:"#94A3B8",marginBottom:10,fontWeight:500}}>
            {query?`"${query}" 검색 결과 · `:"전체 "}<span style={{color:"var(--accent)",fontWeight:700}}>{filtered.length}건</span>
          </div>
          <div>
          {filtered.length===0
            ?<div style={{textAlign:"center",padding:"80px 0",color:"#9ca3af"}}><div style={{marginBottom:12}}><Icon name="search" size={48} color="#9ca3af"/></div><div style={{fontSize:16,fontWeight:600,color:"#374151",marginBottom:6}}>검색 결과가 없어요</div><div style={{fontSize:13}}>다른 키워드나 카테고리를 시도해 보세요</div></div>
            :<>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:14}}>{pageItems.map((p,i)=><PolicyCard key={p.id} policy={p} favIds={favIds} onToggle={onToggleFav} onGoDetail={onGoDetail} delay={i*40} compareChecked={compareIds.includes(p.id)} onToggleCompare={compareMode?toggleCompare:undefined}/>)}</div>
              <Pagination page={pageNum} pageCount={pageCount} onChange={setPageNum}/>
            </>
          }
          </div>
        </div>
        {compareIds.length>0&&
          <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,display:"flex",flexDirection:"column",alignItems:"center",gap:10,padding:"0 20px 14px",pointerEvents:"none"}}>
            {showCompare&&<CompareModal policies={compareList} onRemove={toggleCompare} onClose={()=>setShowCompare(false)}/>}
            <div style={{display:"flex",alignItems:"center",gap:12,background:"#111827",borderRadius:30,padding:"10px 12px 10px 18px",boxShadow:"0 10px 30px rgba(0,0,0,0.25)",pointerEvents:"auto"}}>
              <span style={{color:"white",fontSize:13,fontWeight:600}}>비교함 {compareIds.length}/3</span>
              <button onClick={()=>setCompareIds([])} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:13,cursor:"pointer",padding:"4px 6px"}}>비우기</button>
              <button onClick={()=>setShowCompare(v=>!v)} disabled={compareIds.length<2} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:20,border:"none",background:compareIds.length<2?"#374151":"var(--accent)",color:"white",fontSize:13,fontWeight:700,cursor:compareIds.length<2?"default":"pointer",whiteSpace:"nowrap"}}><Icon name="bar_chart" size={15} color="white"/>{showCompare?"닫기":"비교하기"}</button>
            </div>
          </div>
        }
        {showRegionMap&&<RegionMapModal region={region} onSelect={r=>{setRegion(r);setShowRegionMap(false);}} onClose={()=>setShowRegionMap(false)}/>}
      </div>
    );
  }

  return(
    <div style={{background:"#F5F9FC",minHeight:"100%"}}>
      <div style={{background:"white",padding:"16px 8px 12px",borderBottom:"1px solid #e5e7eb"}}>
        <div style={{fontSize:17,fontWeight:800,color:"#1A202C",marginBottom:10,paddingLeft:6,display:"flex",alignItems:"center",gap:6}}><Icon name="search" size={18} color="#1A202C"/>정책 검색</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{position:"relative",flex:1}}>
            <input type="search" value={rawQ} onChange={e=>setRawQ(e.target.value)} placeholder="검색어 입력 (정책명, 기관명, 혜택 등)"
              style={{width:"100%",padding:"12px 42px 12px 16px",border:"1.5px solid #E2E8F0",borderRadius:12,fontSize:14,outline:"none",background:"var(--accent-bg)",fontFamily:"inherit",transition:"border-color 0.15s",boxSizing:"border-box"}}
              onFocus={e=>e.target.style.borderColor="var(--accent)"}
              onBlur={e=>e.target.style.borderColor="#E2E8F0"}
            />
            {rawQ&&<button onClick={()=>setRawQ("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"#e5e7eb",border:"none",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            <input type="checkbox" checked={excludeExpired} onChange={e=>setExcludeExpired(e.target.checked)}
              style={{width:16,height:16,accentColor:"var(--accent)",cursor:"pointer"}}
            />
            <span style={{fontSize:13,color:"#1A202C",fontWeight:500}}>마감 제외</span>
          </label>
        </div>
        <div style={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 12px",display:"flex",flexDirection:"column",gap:8,marginTop:2}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:6,display:"flex",alignItems:"center",gap:4}}>지역</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {REGIONS.map(r=>(
                <button key={r} onClick={()=>setRegion(r)} style={{padding:"3px 9px",borderRadius:20,border:"1.5px solid",borderColor:region===r?"var(--accent)":"#E2E8F0",background:region===r?"var(--accent)":"#FFFFFF",color:region===r?"#FFFFFF":"#475569",fontSize:11,fontWeight:region===r?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>{r}</button>
              ))}
              <button onClick={()=>setShowRegionMap(true)} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,border:"1.5px solid #E2E8F0",background:"#FFFFFF",color:"#475569",fontSize:11,fontWeight:400,cursor:"pointer",whiteSpace:"nowrap"}}>
                <Icon name="map" size={12} color="#475569"/>지도로 보기
              </button>
            </div>
          </div>
          <div style={{borderTop:"1px solid #E2E8F0",paddingTop:8}}>
            <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:6,display:"flex",alignItems:"center",gap:4}}>중앙부처</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {MINISTRIES.map(m=>(
                <button key={m} onClick={()=>setMinistry(m)} style={{padding:"3px 9px",borderRadius:20,border:"1.5px solid",borderColor:ministry===m?"var(--accent)":"#E2E8F0",background:ministry===m?"var(--accent)":"#FFFFFF",color:ministry===m?"#FFFFFF":"#475569",fontSize:11,fontWeight:ministry===m?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {query&&<div style={{fontSize:13,color:"#6b7280",padding:"10px 14px 0"}}>"{query}" 검색 결과</div>}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px 4px",background:"white",borderBottom:"1px solid #f1f5f9"}}>
        <HScrollFade style={{gap:5,flex:1}} fadeColor="#ffffff">
          {CATEGORIES.map(c=>(
            <button key={c.value} onClick={()=>setCat(c.value)} style={{whiteSpace:"nowrap",flexShrink:0,padding:"5px 10px",borderRadius:20,border:"1.5px solid",cursor:"pointer",borderColor:cat===c.value?"var(--accent)":"#E2E8F0",background:cat===c.value?"var(--accent-bg)":"white",color:cat===c.value?"var(--accent)":"#718096",fontSize:11,fontWeight:cat===c.value?700:500,transition:"all 0.12s"}}>{c.label}</button>
          ))}
        </HScrollFade>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{flexShrink:0,fontSize:12,border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 8px",background:"white",color:"#374151",outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
          {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div style={{padding:"14px 14px 0",display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:9}}>
        {filtered.length===0
          ?<div style={{gridColumn:`span ${cols}`,textAlign:"center",padding:"48px 0",color:"#9ca3af"}}><div style={{marginBottom:10}}><Icon name="search" size={36} color="#9ca3af"/></div><div style={{fontSize:15,fontWeight:600,color:"#374151",marginBottom:6}}>검색 결과가 없어요</div><div style={{fontSize:13}}>다른 키워드나 카테고리를 시도해 보세요</div></div>
          :pageItems.map((p,i)=><PolicyCard key={p.id} policy={p} favIds={favIds} onToggle={onToggleFav} onGoDetail={onGoDetail} delay={i*40}/>)
        }
      </div>
      {filtered.length>0&&<div style={{paddingBottom:80}}><Pagination page={pageNum} pageCount={pageCount} onChange={setPageNum}/></div>}
      {showRegionMap&&<RegionMapModal region={region} onSelect={r=>{setRegion(r);setShowRegionMap(false);}} onClose={()=>setShowRegionMap(false)}/>}
    </div>
  );
}

// ─── 커뮤니티 글쓰기 뷰 ──────────────────────────────────────────────────

const CAT_COLOR_MAP={후기:{bg:"#F0FDF4",border:"#BBF7D0",text:"#15803D"},정보:{bg:"#EFF6FF",border:"var(--accent-bg)",text:"var(--accent)"},"Q&A":{bg:"#FFF1F2",border:"#FECDD3",text:"#BE123C"},"정책제안 팀모집":{bg:"#FDF4FF",border:"#F5D0FE",text:"#A21CAF"}};

function PolicyPickerField({policies,value,onChange}){
  const [query,setQuery]=useState("");
  const suggestions=useMemo(()=>{
    const q=query.trim();
    if(!q)return [];
    return (policies||[]).filter(p=>p.title?.includes(q)).slice(0,8);
  },[query,policies]);

  if(value){
    return(
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white"}}>
        <Icon name="task_alt" size={16} color="var(--accent)"/>
        <span style={{flex:1,fontSize:13,fontWeight:600,color:"#111827"}}>{value.title}</span>
        <button type="button" onClick={()=>onChange(null)} style={{background:"none",border:"none",color:"#9ca3af",fontSize:16,lineHeight:1,padding:0,cursor:"pointer"}}>×</button>
      </div>
    );
  }
  return(
    <div style={{position:"relative"}}>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="신청한 정책명을 검색해보세요" style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/>
      {suggestions.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"white",border:"1.5px solid #E2E8F0",borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:30,overflow:"hidden"}}>
          {suggestions.map(p=>(
            <div key={p.id} onMouseDown={e=>{e.preventDefault();onChange(p);setQuery("");}} style={{padding:"9px 14px",fontSize:13,color:"#374151",cursor:"pointer",borderBottom:"1px solid #f1f5f9"}}>
              <div style={{fontWeight:600}}>{p.title}</div>
              {p.org&&<div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{p.org}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunityWriteView({bp,user,policies,onSubmit,onCancel}){
  const [cat,setCat]=useState("후기");
  const [title,setTitle]=useState("");
  const [content,setContent]=useState("");
  const [region,setRegion]=useState("");
  const [capacity,setCapacity]=useState("");
  const [appliedPolicy,setAppliedPolicy]=useState(null);
  const [policyCat,setPolicyCat]=useState(null);
  const [postRegion,setPostRegion]=useState(null);
  const [errors,setErrors]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const cats=["후기","정보","Q&A","정책제안 팀모집"];
  const isRecruit=cat==="정책제안 팀모집";
  const isReview=cat==="후기";

  const selfVerified=useMemo(()=>{
    if(!appliedPolicy)return false;
    try{
      const statuses=JSON.parse(localStorage.getItem("yoa:apply-status"))||{};
      return ["applied","review","waiting","done"].includes(statuses[appliedPolicy.id]);
    }catch{return false;}
  },[appliedPolicy]);

  useEffect(()=>{
    if(appliedPolicy)setPolicyCat(appliedPolicy.cat);
  },[appliedPolicy]);

  const validate=()=>{
    const e={};
    if(!title.trim())e.title="제목을 입력해주세요.";
    if(!content.trim())e.content="내용을 입력해주세요.";
    else if(content.trim().length<10)e.content="내용을 10자 이상 입력해주세요.";
    if(isRecruit&&!region.trim())e.region="지역을 입력해주세요.";
    if(isRecruit&&!capacity.trim())e.capacity="모집 인원을 입력해주세요.";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSubmit=async e=>{
    e.preventDefault();
    if(!validate())return;
    setSubmitting(true);
    await onSubmit({
      user_id:user?.id||null,
      cat,
      title:title.trim(),
      author:maskName(user?.user_metadata?.name||user?.email||"익명"),
      content:content.trim(),
      likes:0,
      comments_count:0,
      views:0,
      region:isRecruit?region.trim():postRegion,
      capacity:isRecruit?capacity.trim():null,
      status:isRecruit?"모집중":null,
      verified:isReview?selfVerified:false,
      applied_policy_id:isReview?(appliedPolicy?.id||null):null,
      applied_policy_title:isReview?(appliedPolicy?.title||null):null,
      policy_cat:policyCat,
    });
    setSubmitting(false);
  };

  const inp={width:"100%",padding:"11px 14px",borderRadius:10,fontSize:14,outline:"none",transition:"border-color 0.15s",boxSizing:"border-box",fontFamily:"inherit"};

  return(
    <div style={{background:"#F5F9FC",minHeight:"100%",animation:"fadeUp 0.25s ease"}}>
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:bp.isDesktop?"0 40px":"0 16px",position:"sticky",top:0,zIndex:40}}>
        <div style={{height:bp.isDesktop?56:52,display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onCancel} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"#374151",fontSize:14,fontWeight:600,padding:"8px 0",transition:"color 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"}
            onMouseLeave={e=>e.currentTarget.style.color="#374151"}
          ><Icon name="arrow_back" size={16}/> 뒤로가기</button>
          <span style={{color:"#e5e7eb"}}>|</span>
          <span style={{fontSize:13,color:"#9ca3af"}}>새 글 작성</span>
        </div>
      </div>

      <div style={{padding:bp.isDesktop?"32px 40px 60px":bp.isTablet?"24px 24px 60px":"16px 16px 80px"}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
          <h1 style={{fontSize:bp.isDesktop?26:20,fontWeight:900,margin:"0 0 6px",letterSpacing:"-0.02em",color:"#111827"}}>새 글 작성</h1>
          <p style={{fontSize:13,color:"#6b7280",margin:"0 0 20px"}}>후기·정보·Q&A·팀모집까지, 청년들과 자유롭게 이야기를 나눠보세요</p>

          <form onSubmit={handleSubmit} style={{background:"white",borderRadius:16,border:"1.5px solid #E2E8F0",padding:bp.isDesktop?24:16,display:"flex",flexDirection:"column",gap:16}}>
            <ProposalFormRow label="카테고리">
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {cats.map(c=>{const cc=CAT_COLOR_MAP[c];const sel=cat===c;return(
                  <button key={c} type="button" onClick={()=>setCat(c)} style={{padding:"8px 18px",borderRadius:20,fontSize:13,fontWeight:sel?700:500,cursor:"pointer",transition:"all 0.15s",background:sel?cc.bg:"white",border:`1.5px solid ${sel?cc.border:"#e5e7eb"}`,color:sel?cc.text:"#9ca3af"}}>{c}</button>
                );})}
              </div>
            </ProposalFormRow>

            <ProposalFormRow label="정책 분야 (선택)">
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {CATEGORIES.slice(1).map(c=>(
                  <button key={c.value} type="button" onClick={()=>setPolicyCat(policyCat===c.value?null:c.value)} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:20,border:"1.5px solid",cursor:"pointer",borderColor:policyCat===c.value?"var(--accent)":"#E2E8F0",background:policyCat===c.value?"var(--accent-bg)":"white",color:policyCat===c.value?"var(--accent)":"#718096",fontSize:12,fontWeight:policyCat===c.value?700:500}}>
                    <Icon name={c.icon} size={13} color={policyCat===c.value?"var(--accent)":"#718096"}/>{c.label}
                  </button>
                ))}
              </div>
            </ProposalFormRow>

            {!isRecruit&&(
              <ProposalFormRow label="지역 (선택)">
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {REGIONS.slice(1).map(r=>(
                    <button key={r} type="button" onClick={()=>setPostRegion(postRegion===r?null:r)} style={{padding:"6px 12px",borderRadius:20,border:"1.5px solid",cursor:"pointer",borderColor:postRegion===r?"var(--accent)":"#E2E8F0",background:postRegion===r?"var(--accent-bg)":"white",color:postRegion===r?"var(--accent)":"#718096",fontSize:12,fontWeight:postRegion===r?700:500}}>{r}</button>
                  ))}
                </div>
              </ProposalFormRow>
            )}
            {isRecruit&&(
              <>
                <ProposalFormRow label="지역">
                  <input type="text" value={region} onChange={e=>setRegion(e.target.value)} placeholder="예: 서울, 전국(온라인)" maxLength={20}
                    style={{...inp,border:`1.5px solid ${errors.region?"#fca5a5":"#E2E8F0"}`,background:errors.region?"#fff8f8":"white"}}
                    onFocus={e=>e.target.style.borderColor=errors.region?"#f87171":"#6b7280"} onBlur={e=>e.target.style.borderColor=errors.region?"#fca5a5":"#E2E8F0"}
                  />
                  {errors.region&&<p style={{fontSize:12,color:"#dc2626",margin:"5px 0 0"}}>{errors.region}</p>}
                </ProposalFormRow>
                <ProposalFormRow label="모집 인원">
                  <input type="text" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="예: 2~3명" maxLength={20}
                    style={{...inp,border:`1.5px solid ${errors.capacity?"#fca5a5":"#E2E8F0"}`,background:errors.capacity?"#fff8f8":"white"}}
                    onFocus={e=>e.target.style.borderColor=errors.capacity?"#f87171":"#6b7280"} onBlur={e=>e.target.style.borderColor=errors.capacity?"#fca5a5":"#E2E8F0"}
                  />
                  {errors.capacity&&<p style={{fontSize:12,color:"#dc2626",margin:"5px 0 0"}}>{errors.capacity}</p>}
                </ProposalFormRow>
              </>
            )}
            {isReview&&(
              <ProposalFormRow label="신청한 정책 (선택)">
                <PolicyPickerField policies={policies} value={appliedPolicy} onChange={setAppliedPolicy}/>
                {appliedPolicy&&(
                  <p style={{fontSize:12,margin:"6px 0 0",color:selfVerified?"#15803D":"#9ca3af",fontWeight:selfVerified?700:500}}>
                    {selfVerified?"마이페이지 신청내역에 신청 기록이 있어요 · 실제 신청 인증 배지가 붙어요":"이 기기의 신청내역에는 아직 기록이 없어요 · 인증배지 없이 등록돼요"}
                  </p>
                )}
                <p style={{fontSize:11,margin:"4px 0 0",color:"#cbd5e1"}}>이 인증은 이 기기에 저장된 신청내역을 기준으로 표시돼요</p>
              </ProposalFormRow>
            )}

            <ProposalFormRow label="제목">
              <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="제목을 입력하세요 (최대 50자)" maxLength={50}
                style={{...inp,border:`1.5px solid ${errors.title?"#fca5a5":"#E2E8F0"}`,background:errors.title?"#fff8f8":"white"}}
                onFocus={e=>e.target.style.borderColor=errors.title?"#f87171":"#6b7280"} onBlur={e=>e.target.style.borderColor=errors.title?"#fca5a5":"#E2E8F0"}
              />
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                {errors.title?<p style={{fontSize:12,color:"#dc2626",margin:0}}>{errors.title}</p>:<span/>}
                <span style={{fontSize:11,color:"#9ca3af"}}>{title.length}/50</span>
              </div>
            </ProposalFormRow>

            <ProposalFormRow label="내용">
              <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="정책 신청 후기, 꿀팁, 질문 등을 자유롭게 작성해보세요 (최소 10자)" maxLength={2000} rows={bp.isDesktop?10:7}
                style={{...inp,resize:"vertical",lineHeight:1.7,border:`1.5px solid ${errors.content?"#fca5a5":"#E2E8F0"}`,background:errors.content?"#fff8f8":"white"}}
                onFocus={e=>e.target.style.borderColor=errors.content?"#f87171":"#6b7280"} onBlur={e=>e.target.style.borderColor=errors.content?"#fca5a5":"#E2E8F0"}
              />
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                {errors.content?<p style={{fontSize:12,color:"#dc2626",margin:0}}>{errors.content}</p>:<span/>}
                <span style={{fontSize:11,color:"#9ca3af"}}>{content.length}/2000</span>
              </div>
            </ProposalFormRow>

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button type="button" onClick={onCancel} style={{padding:"9px 16px",borderRadius:20,background:"white",border:"1.5px solid #E2E8F0",color:"#374151",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#E2E8F0";e.currentTarget.style.color="#374151";}}
              >취소</button>
              <button type="submit" disabled={submitting} style={{padding:"9px 20px",borderRadius:20,background:"var(--accent)",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:submitting?"default":"pointer",transition:"opacity 0.15s",opacity:submitting?0.7:1}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >{submitting?"게시 중...":"게시하기"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── 커뮤니티 상세 뷰 ─────────────────────────────────────────────────────

const AUTHOR_MAP={"서울청년":"이O준","정보통청년":"박O영","취준생이제그만":"최O우","첫취업준비중":"정O빈","정책헌터":"김O양","만34세청년":"윤O연"};
function maskName(name){
  if(AUTHOR_MAP[name])return AUTHOR_MAP[name];
  const n=(name||"").trim();
  if(n.length<=1)return n;
  if(n.length===2)return n[0]+"O";
  return n[0]+"O".repeat(n.length-2)+n[n.length-1];
}

function CommunityPostDetailView({post,bp,user,policies,onGoDetail,favIds,onToggleFav,onBack,onLike,onUpdate}){
  const linkedPolicy=useMemo(()=>(policies||[]).find(p=>p.id===post.applied_policy_id),[policies,post.applied_policy_id]);
  const [comments,setComments]=useState([]);
  const [liked,setLiked]=useLocalStorage(`yoa:liked_${post.id}`,false);
  const [viewed,setViewed]=useLocalStorage(`yoa:viewed_${post.id}`,false);
  const [commentText,setCommentText]=useState("");
  const [commentError,setCommentError]=useState("");
  const [submittingComment,setSubmittingComment]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [editText,setEditText]=useState("");
  const cc=CAT_COLOR_MAP[post.cat]||{bg:"#f8fafc",border:"#e5e7eb",text:"#6b7280"};
  const totalComments=comments.length;
  const body=(post.content||post.preview||"").replace(/\\n/g,"\n");
  const fmtDate=iso=>iso?(iso.slice(0,10)):"";
  const isQnA=post.cat==="Q&A";
  const isAuthor=Boolean(user&&post.user_id&&user.id===post.user_id);
  const sortedComments=isQnA&&post.best_comment_id
    ?[...comments].sort((a,b)=>(b.id===post.best_comment_id)-(a.id===post.best_comment_id))
    :comments;
  const isRecruit=post.cat==="정책제안 팀모집";
  const isOwner=Boolean(isRecruit&&user&&post.user_id&&user.id===post.user_id);
  const recruitDone=post.status==="모집완료";
  const [participants,setParticipants]=useState([]);
  const [joining,setJoining]=useState(false);
  const [showJoinNotice,setShowJoinNotice]=useState(false);
  const joined=Boolean(user&&participants.some(p=>p.user_id===user.id));

  useEffect(()=>{
    if(!showJoinNotice)return;
    const t=setTimeout(()=>setShowJoinNotice(false),4000);
    return()=>clearTimeout(t);
  },[showJoinNotice]);

  useEffect(()=>{
    supabase.from("comments").select("*").eq("post_id",post.id).order("created_at",{ascending:true})
      .then(({data})=>setComments(data||[]));
  },[post.id]);

  useEffect(()=>{
    if(!isRecruit)return;
    supabase.from("post_participants").select("*").eq("post_id",post.id)
      .then(({data})=>setParticipants(data||[]));
  },[isRecruit,post.id]);

  useEffect(()=>{
    if(!isRecruit||viewed)return;
    setViewed(true);
    onUpdate?.(post.id,{views:(post.views||0)+1});
  },[isRecruit,viewed,post.id]);

  const handleJoin=async()=>{
    if(!user){alert("로그인 후 참가 신청을 할 수 있어요.");return;}
    if(recruitDone&&!joined)return;
    setJoining(true);
    if(joined){
      setShowJoinNotice(false);
      await supabase.from("post_participants").delete().eq("post_id",post.id).eq("user_id",user.id);
      setParticipants(prev=>prev.filter(p=>p.user_id!==user.id));
    }else{
      const{data}=await supabase.from("post_participants").insert({
        post_id:post.id,
        user_id:user.id,
        name:maskName(user.user_metadata?.name||user.email||"익명"),
      }).select().single();
      if(data){setParticipants(prev=>[...prev,data]);setShowJoinNotice(true);}
    }
    setJoining(false);
  };

  const handleStatusToggle=()=>{
    onUpdate?.(post.id,{status:recruitDone?"모집중":"모집완료"});
  };

  const handleLike=()=>{
    const next=!liked;
    setLiked(next);
    onLike(post.id,post.likes||0,next);
  };

  const handleComment=async e=>{
    e.preventDefault();
    if(!user){setCommentError("로그인 후 댓글을 작성할 수 있어요.");return;}
    if(!commentText.trim()){setCommentError("댓글 내용을 입력해주세요.");return;}
    setSubmittingComment(true);
    const{data,error}=await supabase.from("comments").insert({
      post_id:post.id,
      user_id:user.id,
      author:maskName(user.user_metadata?.name||user.email||"익명"),
      content:commentText.trim(),
    }).select().single();
    setSubmittingComment(false);
    if(error){setCommentError("댓글 작성에 실패했어요.");return;}
    setCommentError("");
    setComments(prev=>[...prev,data]);
    setCommentText("");
    await onUpdate?.(post.id,{comments_count:(post.comments_count||0)+1});
    if(post.user_id&&post.user_id!==user.id){
      supabase.from("notifications").insert({
        user_id:post.user_id,type:"comment_post",
        title:"내 게시물에 새 댓글이 달렸어요",body:post.title,
        link_type:"post",link_id:String(post.id),
      });
    }
  };

  const handleEditSave=async id=>{
    if(!editText.trim())return;
    const{error}=await supabase.from("comments").update({content:editText.trim()}).eq("id",id);
    if(!error){
      setComments(prev=>prev.map(c=>c.id===id?{...c,content:editText.trim()}:c));
      setEditingId(null);
    }
  };

  const handleDelete=async id=>{
    if(!window.confirm("댓글을 삭제할까요?"))return;
    const{error}=await supabase.from("comments").delete().eq("id",id);
    if(!error){
      setComments(prev=>prev.filter(c=>c.id!==id));
      await onUpdate?.(post.id,{comments_count:Math.max(0,(post.comments_count||1)-1)});
    }
  };

  const handleSelectBest=async c=>{
    const next=post.best_comment_id===c.id?null:c.id;
    await onUpdate?.(post.id,{best_comment_id:next});
    if(next&&c.user_id&&c.user_id!==user.id){
      supabase.from("notifications").insert({
        user_id:c.user_id,type:"best_answer",
        title:"내 답변이 베스트 답변으로 채택됐어요",body:post.title,
        link_type:"post",link_id:String(post.id),
      });
    }
  };

  return(
    <div style={{background:"#f8fafc",minHeight:"100%"}}>
      <div style={{background:"linear-gradient(160deg,#0f172a 0%,var(--accent-dark) 60%,var(--accent) 100%)",padding:bp.isDesktop?"24px 40px":bp.isTablet?"20px 24px":"16px 16px"}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.12)",border:"none",borderRadius:10,color:"white",padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:600,transition:"background 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.22)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.12)"}
        ><Icon name="arrow_back" size={16} color="currentColor"/> 목록으로</button>
      </div>
      <div style={{padding:bp.isDesktop?"32px 40px":bp.isTablet?"24px 24px":"18px 14px",maxWidth:bp.isDesktop?820:"100%",margin:"0 auto"}}>
        <div style={{background:"white",borderRadius:16,padding:bp.isDesktop?"28px 32px":bp.isTablet?"22px 24px":"18px 18px",border:"1.5px solid #f1f5f9"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:cc.bg,color:cc.text,border:`1px solid ${cc.border}`}}>{post.cat}</span>
            <span style={{fontSize:12,color:"#9ca3af"}}>{fmtDate(post.created_at||post.date)}</span>
            {isRecruit&&(
              <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:recruitDone?"#F1F5F9":"#F0FDF4",border:`1px solid ${recruitDone?"#E2E8F0":"#BBF7D0"}`,color:recruitDone?"#64748B":"#15803D"}}>{post.status||"모집중"}</span>
            )}
            {isOwner&&(
              <button type="button" onClick={handleStatusToggle} style={{marginLeft:"auto",padding:"4px 12px",borderRadius:20,border:"1.5px solid #e5e7eb",background:"white",color:"#374151",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e7eb";e.currentTarget.style.color="#374151";}}
              >{recruitDone?"모집중으로 변경":"모집완료로 변경"}</button>
            )}
          </div>
          <h1 style={{fontSize:bp.isDesktop?26:bp.isTablet?22:18,fontWeight:900,margin:"0 0 16px",lineHeight:1.35,letterSpacing:"-0.02em",color:"#111827",paddingBottom:16,borderBottom:"1px solid #f1f5f9"}}>{post.title}</h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {post.verified&&(
              <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"var(--accent-dark)",background:"var(--accent-bg)",border:"1px solid var(--accent)",borderRadius:20,padding:"3px 10px"}}>
                <Icon name="task_alt" size={12} color="var(--accent-dark)"/>실제 신청 인증{post.applied_policy_title?` · ${post.applied_policy_title}`:""}
              </span>
            )}
            <div style={{fontSize:13,fontWeight:700,color:"#111827"}}>{maskName(post.author)}</div>
          </div>
          {isRecruit&&(
            <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 140px",background:cc.bg,border:`1px solid ${cc.border}`,borderRadius:12,padding:"12px 16px"}}>
                <div style={{fontSize:11,fontWeight:700,color:cc.text,marginBottom:4}}>지역</div>
                <div style={{fontSize:14,fontWeight:700,color:"#111827"}}>{post.region||"-"}</div>
              </div>
              <div style={{flex:"1 1 140px",background:cc.bg,border:`1px solid ${cc.border}`,borderRadius:12,padding:"12px 16px"}}>
                <div style={{fontSize:11,fontWeight:700,color:cc.text,marginBottom:4}}>인원</div>
                <div style={{fontSize:14,fontWeight:700,color:"#111827"}}>{post.capacity||"-"}</div>
              </div>
            </div>
          )}
          <div style={{fontSize:bp.isDesktop?15:14,lineHeight:1.85,color:"#374151",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
            {body}
          </div>
          {post.cat==="후기"&&post.applied_policy_title&&(
            <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:800,color:"var(--accent-dark)"}}>
                <Icon name="open_in_new" size={15} color="var(--accent-dark)"/>이 후기와 관련된 정책
              </div>
              {linkedPolicy?(
                <PolicyCard policy={linkedPolicy} favIds={favIds} onToggle={onToggleFav} onGoDetail={onGoDetail}/>
              ):(
                <div style={{background:"var(--accent-bg)",border:"1px solid var(--accent-bg-active)",borderRadius:14,padding:"16px 18px",fontSize:14,fontWeight:700,color:"#111827"}}>{post.applied_policy_title}</div>
              )}
            </div>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",gap:14,marginTop:20}}>
            <span style={{fontSize:13,color:"#6b7280",display:"flex",alignItems:"center",gap:4}}><Icon name="favorite" size={14} color="#9ca3af"/> {post.likes||0}</span>
            <span style={{fontSize:13,color:"#6b7280",display:"flex",alignItems:"center",gap:4}}><Icon name="chat_bubble" size={14} color="#9ca3af"/> {totalComments}</span>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:10,margin:"24px 0",flexWrap:"wrap"}}>
          <button onClick={handleLike} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 28px",borderRadius:30,fontSize:14,fontWeight:700,cursor:"pointer",border:`2px solid ${liked?"#fca5a5":"#e5e7eb"}`,background:liked?"#fff1f2":"white",color:liked?"#dc2626":"#6b7280",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#fca5a5";e.currentTarget.style.color="#dc2626";e.currentTarget.style.background="#fff1f2";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=liked?"#fca5a5":"#e5e7eb";e.currentTarget.style.color=liked?"#dc2626":"#6b7280";e.currentTarget.style.background=liked?"#fff1f2":"white";}}
          ><Icon name={liked?"favorite":"favorite_border"} size={18} color={liked?"#dc2626":"#6b7280"}/>{liked?"공감 취소":"공감해요"} {post.likes||0}</button>
          {isRecruit&&(
            <div style={{position:"relative"}}>
              {showJoinNotice&&(
                <div style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",marginBottom:10,background:"#1f2937",color:"white",borderRadius:10,padding:"10px 16px",fontSize:12,fontWeight:600,lineHeight:1.5,width:220,textAlign:"center",boxShadow:"0 4px 14px rgba(0,0,0,0.2)",animation:"fadeUp 0.3s ease",zIndex:5}}>
                  <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:"6px solid #1f2937"}}/>
                  참가 신청이 완료됐어요! 담당자가 개별로 연락드릴 예정이에요.
                </div>
              )}
              <button onClick={handleJoin} disabled={joining||(recruitDone&&!joined)} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 28px",borderRadius:30,fontSize:14,fontWeight:700,cursor:joining||(recruitDone&&!joined)?"default":"pointer",border:`2px solid ${joined?"var(--accent)":"#e5e7eb"}`,background:joined?"var(--accent-bg)":"white",color:recruitDone&&!joined?"#cbd5e1":joined?"var(--accent)":"#6b7280",opacity:joining?0.7:1,transition:"all 0.2s"}}
                onMouseEnter={e=>{if(recruitDone&&!joined)return;e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";e.currentTarget.style.background="var(--accent-bg)";}}
                onMouseLeave={e=>{if(recruitDone&&!joined)return;e.currentTarget.style.borderColor=joined?"var(--accent)":"#e5e7eb";e.currentTarget.style.color=joined?"var(--accent)":"#6b7280";e.currentTarget.style.background=joined?"var(--accent-bg)":"white";}}
              ><Icon name={joined?"check_circle":"group"} size={18} color={recruitDone&&!joined?"#cbd5e1":joined?"var(--accent)":"#6b7280"}/>{recruitDone&&!joined?"모집 마감":joined?"참가 취소":"참가하기"} {participants.length}</button>
            </div>
          )}
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:16}}>댓글 {totalComments}개</div>
          <form onSubmit={handleComment} style={{background:"white",borderRadius:14,padding:bp.isDesktop?"20px 24px":"16px 18px",border:"1.5px solid #f1f5f9",marginBottom:16,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <textarea placeholder="댓글을 입력하세요" value={commentText} onChange={e=>setCommentText(e.target.value)} rows={2} maxLength={500}
                style={{flex:1,padding:"9px 12px",borderRadius:8,border:"1.5px solid #e5e7eb",fontSize:13,fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.6,boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor="#6b7280"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}
              />
              <button type="submit" disabled={submittingComment} style={{padding:"9px 16px",borderRadius:8,border:"none",background:"var(--accent)",color:"white",fontSize:13,fontWeight:700,cursor:submittingComment?"default":"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"opacity 0.15s",alignSelf:"stretch",opacity:submittingComment?0.7:1}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >{submittingComment?"등록 중":"등록"}</button>
            </div>
            {commentError&&<p style={{fontSize:12,color:"#dc2626",margin:0}}>{commentError}</p>}
          </form>
          {post.comments>0&&comments.length===0&&(
            <div style={{textAlign:"center",padding:"16px",color:"#9ca3af",fontSize:13,background:"white",borderRadius:12,border:"1.5px solid #f1f5f9",marginBottom:10}}>
              댓글 {post.comments}개 · 로그인 후 전체 댓글을 확인할 수 있어요
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:bp.isMobile?80:40}}>
            {sortedComments.map(c=>{
              const isBest=isQnA&&post.best_comment_id===c.id;
              return(
              <div key={c.id} style={{background:isBest?"#FFFBEB":"white",borderRadius:12,padding:bp.isDesktop?"16px 20px":"13px 16px",border:isBest?"1.5px solid #FDE68A":"1.5px solid #f1f5f9"}}>
                {isBest&&(
                  <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:800,color:"#B45309",marginBottom:8}}>
                    <Icon name="star" fill={1} size={13} color="#F59E0B"/>베스트 답변
                  </div>
                )}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#374151",flexShrink:0}}>{c.author?.[0]||"?"}</div>
                  <span style={{fontSize:13,fontWeight:700,color:"#111827"}}>{maskName(c.author)}</span>
                  <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>{fmtDate(c.created_at)}</span>
                  {isQnA&&isAuthor&&(
                    <button onClick={()=>handleSelectBest(c)}
                      style={{padding:"3px 9px",borderRadius:6,border:isBest?"1px solid #FDE68A":"1px solid #e5e7eb",background:isBest?"#FEF3C7":"white",fontSize:11,color:isBest?"#B45309":"#6b7280",cursor:"pointer",transition:"all 0.12s",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3,marginLeft:8}}
                      onMouseEnter={e=>{if(!isBest){e.currentTarget.style.borderColor="#F59E0B";e.currentTarget.style.color="#B45309";}}}
                      onMouseLeave={e=>{if(!isBest){e.currentTarget.style.borderColor="#e5e7eb";e.currentTarget.style.color="#6b7280";}}}
                    ><Icon name="star" filled={isBest} size={12} color={isBest?"#B45309":"#9ca3af"}/>{isBest?"채택 취소":"베스트 답변으로 채택"}</button>
                  )}
                  {user&&c.user_id===user.id&&editingId!==c.id&&(
                    <div style={{display:"flex",gap:4,marginLeft:8}}>
                      <button onClick={()=>{setEditingId(c.id);setEditText(c.content);}}
                        style={{padding:"3px 9px",borderRadius:6,border:"1px solid #e5e7eb",background:"white",fontSize:11,color:"#6b7280",cursor:"pointer",transition:"all 0.12s",fontFamily:"inherit"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="#374151";e.currentTarget.style.color="#111827";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e7eb";e.currentTarget.style.color="#6b7280";}}
                      >수정</button>
                      <button onClick={()=>handleDelete(c.id)}
                        style={{padding:"3px 9px",borderRadius:6,border:"1px solid #fecdd3",background:"white",fontSize:11,color:"#ef4444",cursor:"pointer",transition:"all 0.12s",fontFamily:"inherit"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#fff5f5"}
                        onMouseLeave={e=>e.currentTarget.style.background="white"}
                      >삭제</button>
                    </div>
                  )}
                </div>
                {editingId===c.id?(
                  <div style={{paddingLeft:34}}>
                    <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={2} maxLength={500} autoFocus
                      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #6b7280",fontSize:13,fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.6,boxSizing:"border-box"}}
                      onFocus={e=>e.target.style.borderColor="#111827"} onBlur={e=>e.target.style.borderColor="#6b7280"}
                    />
                    <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
                      <button onClick={()=>setEditingId(null)}
                        style={{padding:"5px 13px",borderRadius:7,border:"1px solid #e5e7eb",background:"white",fontSize:12,color:"#6b7280",cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#374151"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}
                      >취소</button>
                      <button onClick={()=>handleEditSave(c.id)}
                        style={{padding:"5px 13px",borderRadius:7,border:"none",background:"var(--accent)",fontSize:12,color:"white",fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"opacity 0.12s"}}
                        onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
                      >저장</button>
                    </div>
                  </div>
                ):(
                  <div style={{fontSize:13,color:"#374151",lineHeight:1.65,paddingLeft:34}}>{c.content}</div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 커뮤니티 뷰 ──────────────────────────────────────────────────────────

function CommunityView({bp,user,policies,favIds,onToggleFav,onGoProposal,onGoDetail,initialCatFilter}){
  const [catFilter,setCatFilter]=useState(initialCatFilter&&initialCatFilter!=="전체"?initialCatFilter:"후기");
  const [showWrite,setShowWrite]=useState(false);
  const [selectedPost,setSelectedPost]=useState(null);
  const [posts,setPosts]=useState([]);
  const [loadingPosts,setLoadingPosts]=useState(true);
  const [proposalBannerDismissed,setProposalBannerDismissed]=useLocalStorage("yoa:proposalBannerDismissed",false);
  const [search,setSearch]=useState("");
  const [sortBy,setSortBy]=useState("recent");
  const cats=["후기","정보","Q&A","정책제안 팀모집"];
  const filtered=posts
    .filter(p=>p.cat===catFilter)
    .filter(p=>!search.trim()||p.title.includes(search.trim())||(p.content||"").includes(search.trim()))
    .sort((a,b)=>
      sortBy==="likes"?(b.likes||0)-(a.likes||0)
      :sortBy==="comments"?(b.comments_count||0)-(a.comments_count||0)
      :new Date(b.created_at)-new Date(a.created_at)
    );
  const bestReviews=useMemo(()=>
    posts.filter(p=>p.cat==="후기").sort((a,b)=>(b.likes||0)-(a.likes||0)).slice(0,3)
  ,[posts]);
  const bestReviewIds=useMemo(()=>new Set(bestReviews.map(p=>p.id)),[bestReviews]);
  const [pageNum,setPageNum]=useState(1);
  useEffect(()=>{setPageNum(1);},[catFilter,search,sortBy]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/4));
  const pageItems=filtered.slice((pageNum-1)*4,pageNum*4);

  const fetchPosts=useCallback(async()=>{
    setLoadingPosts(true);
    const{data}=await supabase.from("posts").select("*").order("created_at",{ascending:false});
    setPosts(data||[]);
    setLoadingPosts(false);
  },[]);

  useEffect(()=>{
    fetchPosts();
  },[fetchPosts]);

  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("post");
    if(!id||selectedPost)return;
    const found=posts.find(p=>String(p.id)===id);
    if(found){
      setSelectedPost(found);
      if(found.cat)setCatFilter(found.cat);
    }
  },[posts,selectedPost]);

  const handleAddPost=useCallback(async newPost=>{
    await supabase.from("posts").insert(newPost);
    await fetchPosts();
    setShowWrite(false);
  },[fetchPosts]);

  const handleLike=useCallback(async(id,currentLikes,add)=>{
    const next=currentLikes+(add?1:-1);
    await supabase.from("posts").update({likes:Math.max(0,next)}).eq("id",id);
    setPosts(prev=>prev.map(p=>p.id===id?{...p,likes:Math.max(0,next)}:p));
    if(selectedPost?.id===id)setSelectedPost(prev=>({...prev,likes:Math.max(0,next)}));
  },[selectedPost]);

  const handlePostUpdate=useCallback(async(id,fields)=>{
    await supabase.from("posts").update(fields).eq("id",id);
    setPosts(prev=>prev.map(p=>p.id===id?{...p,...fields}:p));
    if(selectedPost?.id===id)setSelectedPost(prev=>({...prev,...fields}));
  },[selectedPost]);

  if(showWrite)return <CommunityWriteView bp={bp} user={user} policies={policies} onSubmit={handleAddPost} onCancel={()=>setShowWrite(false)}/>;
  if(selectedPost){
    const livePost=posts.find(p=>p.id===selectedPost.id)||selectedPost;
    return <CommunityPostDetailView post={livePost} bp={bp} user={user} policies={policies} onGoDetail={onGoDetail} favIds={favIds} onToggleFav={onToggleFav} onBack={()=>setSelectedPost(null)} onLike={handleLike} onUpdate={handlePostUpdate}/>;
  }

  return(
    <div style={{background:"#f8fafc",minHeight:"100%"}}>
      <div style={{background:"linear-gradient(160deg,#0f172a 0%,var(--accent-dark) 60%,var(--accent) 100%)",padding:bp.isDesktop?"36px 40px 28px":bp.isTablet?"28px 24px 20px":"22px 16px 16px",color:"white"}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>
          <div style={{fontSize:12,opacity:0.6,marginBottom:8}}>청년 ON 커뮤니티</div>
          <h1 style={{fontSize:bp.isDesktop?32:bp.isTablet?24:20,fontWeight:900,margin:"0 0 8px",letterSpacing:"-0.02em",display:"flex",alignItems:"center",gap:10}}>함께 나누는 정책 이야기 <Icon name="forum" size={bp.isDesktop?28:bp.isTablet?22:18} color="rgba(255,255,255,0.75)"/></h1>
          <p style={{fontSize:bp.isDesktop?15:13,opacity:0.7,margin:0}}>실제 신청 후기, 꿀팁, 궁금한 점을 자유롭게 나눠보세요</p>
        </div>
      </div>
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:bp.isDesktop?"0 40px":"0 14px"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <HScrollFade style={{gap:0,minWidth:0}} fadeColor="#ffffff">
            {cats.map(c=>(
              <button key={c} onClick={()=>setCatFilter(c)} style={{padding:bp.isDesktop?"13px 18px":"11px 14px",border:"none",background:"none",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontSize:bp.isDesktop?14:13,fontWeight:catFilter===c?700:500,color:catFilter===c?"#111827":"#9ca3af",borderBottom:`2.5px solid ${catFilter===c?"#111827":"transparent"}`,transition:"all 0.15s"}}>{c}</button>
            ))}
          </HScrollFade>
          <button onClick={()=>user?setShowWrite(true):alert("로그인 후 글을 작성할 수 있어요.")} style={{padding:"7px 16px",borderRadius:20,background:"var(--accent)",border:"none",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"opacity 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
          >+ 글쓰기</button>
        </div>
      </div>
      <div style={{background:"white",borderBottom:"1px solid #f1f5f9",padding:bp.isDesktop?"14px 40px":"12px 14px"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",gap:8,alignItems:"center"}}>
          <div style={{position:"relative",flex:1}}>
            <Icon name="search" size={15} color="#9ca3af" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="제목·내용 검색" style={{width:"100%",padding:"8px 12px 8px 34px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
          </div>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{flexShrink:0,fontSize:12,border:"1px solid #E2E8F0",borderRadius:8,padding:"7px 8px",background:"white",color:"#374151",outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
            <option value="recent">최신순</option>
            <option value="likes">인기순</option>
            <option value="comments">댓글많은순</option>
          </select>
        </div>
      </div>
      <div style={{padding:bp.isDesktop?"28px 40px 60px":bp.isTablet?"20px 24px 60px":"14px 14px 80px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:860,margin:"0 auto"}}>
          {!loadingPosts&&(catFilter==="정책제안 팀모집"||!proposalBannerDismissed)&&(
            <div onClick={()=>onGoProposal?.()} style={{position:"relative",background:"linear-gradient(135deg,var(--accent-dark),var(--accent))",borderRadius:16,padding:bp.isDesktop?"22px 26px":"16px 16px",cursor:"pointer",color:"white",display:"flex",alignItems:"center",gap:16,transition:"transform 0.15s,box-shadow 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 10px 28px rgba(0,0,0,0.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}
            >
              {catFilter!=="정책제안 팀모집"&&(
                <button onClick={e=>{e.stopPropagation();setProposalBannerDismissed(true);}} aria-label="배너 닫기"
                  style={{position:"absolute",top:8,right:8,width:22,height:22,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.22)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.35)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.22)"}
                >
                  <Icon name="close" size={14} color="white"/>
                </button>
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:20,background:"rgba(255,255,255,0.22)",letterSpacing:"0.02em"}}>NEW</span>
                  <span style={{fontSize:12,fontWeight:700,opacity:0.85}}>청년정책 역제안</span>
                </div>
                <div style={{fontSize:bp.isDesktop?16:14,fontWeight:800,lineHeight:1.4,marginBottom:4}}>커뮤니티에서 나눈 이야기, 이제 정책으로 제안해보세요</div>
                <div style={{fontSize:bp.isDesktop?13:12,opacity:0.8,lineHeight:1.5}}>공감이 모이면 담당 부처에 자동으로 전달돼요</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0,padding:"9px 16px",borderRadius:20,background:"white",color:"var(--accent-dark)",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>
                제안 써보기<Icon name="arrow_forward" size={15} color="var(--accent-dark)"/>
              </div>
            </div>
          )}
          {!loadingPosts&&catFilter==="후기"&&!search.trim()&&bestReviews.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:2}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:800,color:"#111827",padding:"0 2px"}}>
                <Icon name="star" fill={1} size={16} color="#F59E0B"/>베스트 후기
              </div>
              {bestReviews.map((post,i)=>(
                <div key={post.id} onClick={()=>setSelectedPost(post)} style={{background:"linear-gradient(135deg,#FFFBEB,#ffffff)",borderRadius:16,padding:bp.isDesktop?"20px 24px":"14px 16px",cursor:"pointer",border:"1.5px solid #FDE68A",transition:"transform 0.15s,box-shadow 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 24px rgba(245,158,11,0.15)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}
                >
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,fontWeight:800,padding:"2px 9px",borderRadius:20,background:"#F59E0B",color:"white"}}>
                          <Icon name="star" fill={1} size={11} color="white"/>BEST {i+1}
                        </span>
                        {post.region&&(
                          <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#F8FAFC",border:"1px solid #E2E8F0",color:"#64748B"}}>{post.region}</span>
                        )}
                        <span style={{fontSize:11,color:"#9ca3af"}}>{(post.created_at||post.date||"").slice(0,10)}</span>
                      </div>
                      <div style={{fontWeight:700,fontSize:bp.isDesktop?15:14,color:"#111827",lineHeight:1.4}}>{post.title}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginTop:12,paddingTop:12,borderTop:"1px solid #FDE68A"}}>
                    <span style={{fontSize:12,color:"#9ca3af"}}>by <span style={{color:"#374151",fontWeight:600}}>{maskName(post.author)}</span></span>
                    {post.verified&&(
                      <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"var(--accent-dark)",background:"var(--accent-bg)",border:"1px solid var(--accent)",borderRadius:20,padding:"2px 9px"}}>
                        <Icon name="task_alt" size={12} color="var(--accent-dark)"/>실제 신청 인증
                      </span>
                    )}
                    <div style={{marginLeft:"auto",display:"flex",gap:12}}>
                      <span style={{fontSize:12,color:"#9ca3af",display:"flex",alignItems:"center",gap:3}}><Icon name="favorite" size={13} color="#9ca3af"/> {post.likes}</span>
                      <span style={{fontSize:12,color:"#9ca3af",display:"flex",alignItems:"center",gap:3}}><Icon name="chat_bubble" size={13} color="#9ca3af"/> {post.comments_count||0}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{fontSize:13,fontWeight:800,color:"#374151",padding:"6px 2px 0",letterSpacing:"0.02em"}}>전체 후기</div>
            </div>
          )}
          {loadingPosts&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"72px 20px",gap:14,background:"white",borderRadius:16,border:"1.5px solid #E2E8F0"}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:"100%",height:88,borderRadius:12,background:"linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>
              ))}
            </div>
          )}
          {!loadingPosts&&filtered.length===0&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"64px 20px",gap:10,background:"white",borderRadius:16,border:"1.5px solid #E2E8F0"}}>
              <Icon name="edit_note" size={44} color="#d1d5db"/>
              <div style={{fontSize:16,fontWeight:700,color:"#1E293B",marginTop:4}}>아직 게시글이 없어요</div>
              <div style={{fontSize:13,color:"#94a3b8",marginBottom:8}}>첫 번째 글을 작성해보세요!</div>
              <button onClick={()=>user?setShowWrite(true):alert("로그인 후 글을 작성할 수 있어요.")} style={{display:"flex",alignItems:"center",gap:6,lineHeight:1,padding:"10px 20px",borderRadius:10,border:"none",background:"var(--accent)",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",transition:"opacity 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              ><Icon name="edit" size={15} color="white"/>글 작성하기</button>
            </div>
          )}
          {pageItems.map((post,i)=>{
            const catColor=CAT_COLOR_MAP[post.cat]||{bg:"#f8fafc",border:"#e5e7eb",text:"#6b7280"};
            return(
              <div key={post.id} onClick={()=>setSelectedPost(post)} style={{background:"white",borderRadius:16,padding:bp.isDesktop?"20px 24px":"14px 16px",cursor:"pointer",border:"1.5px solid #E2E8F0",transition:"transform 0.15s,box-shadow 0.15s",animation:`fadeUp 0.25s ease ${i*50}ms both`}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 24px rgba(0,0,0,0.07)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}
              >
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:catColor.bg,border:`1px solid ${catColor.border}`,color:catColor.text}}>{post.cat}</span>
                      {post.cat==="후기"&&bestReviewIds.has(post.id)&&(
                        <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,fontWeight:800,padding:"2px 9px",borderRadius:20,background:"#F59E0B",color:"white"}}>
                          <Icon name="star" fill={1} size={11} color="white"/>BEST
                        </span>
                      )}
                      {post.policy_cat&&(
                        <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#F8FAFC",border:"1px solid #E2E8F0",color:"#64748B"}}>{CAT_LABEL[post.policy_cat]}</span>
                      )}
                      {post.region&&(
                        <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#F8FAFC",border:"1px solid #E2E8F0",color:"#64748B"}}>{post.region}</span>
                      )}
                      <span style={{fontSize:11,color:"#9ca3af"}}>{(post.created_at||post.date||"").slice(0,10)}</span>
                      {post.cat==="정책제안 팀모집"&&(
                        <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:post.status==="모집완료"?"#F1F5F9":"#F0FDF4",border:`1px solid ${post.status==="모집완료"?"#E2E8F0":"#BBF7D0"}`,color:post.status==="모집완료"?"#64748B":"#15803D"}}>{post.status||"모집중"}</span>
                      )}
                    </div>
                    <div style={{fontWeight:700,fontSize:bp.isDesktop?15:14,color:"#111827",lineHeight:1.4}}>{post.title}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:14,marginTop:12,paddingTop:12,borderTop:"1px solid #E2E8F0"}}>
                  <span style={{fontSize:12,color:"#9ca3af"}}>by <span style={{color:"#374151",fontWeight:600}}>{maskName(post.author)}</span></span>
                  {post.verified&&(
                    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"var(--accent-dark)",background:"var(--accent-bg)",border:"1px solid var(--accent)",borderRadius:20,padding:"2px 9px"}}>
                      <Icon name="task_alt" size={12} color="var(--accent-dark)"/>실제 신청 인증
                    </span>
                  )}
                  <div style={{marginLeft:"auto",display:"flex",gap:12}}>
                    <span style={{fontSize:12,color:"#9ca3af",display:"flex",alignItems:"center",gap:3}}><Icon name="favorite" size={13} color="#9ca3af"/> {post.likes}</span>
                    <span style={{fontSize:12,color:"#9ca3af",display:"flex",alignItems:"center",gap:3}}><Icon name="chat_bubble" size={13} color="#9ca3af"/> {post.comments_count||0}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length>0&&<Pagination page={pageNum} pageCount={pageCount} onChange={setPageNum}/>}
        </div>
      </div>
    </div>
  );
}

// ─── 청년정책 제안 페이지 (역제안 · 공감투표) ──────────────────────────────

const VOTE_THRESHOLD=500;

const PROPOSAL_STATUS_TABS=[
  {value:"all",     label:"전체"},
  {value:"pending", label:"답변대기"},
  {value:"answered",label:"답변완료"},
  {value:"adopted", label:"반영완료"},
];

const PROPOSAL_SORTS=[
  {value:"recent", label:"최신순"},
  {value:"votes",  label:"공감순"},
];

const PROPOSAL_CATEGORY_FILTERS=[
  {value:"all", label:"전체"},
  ...CATEGORIES.slice(1).map(c=>({value:c.value,label:c.label})),
  {value:"etc", label:"기타"},
];

function proposalStatusMeta(status){
  switch(status){
    case "matching": return{label:"부처매칭중",icon:"sync",         bg:"#EFF6FF",border:"var(--accent-bg)",text:"var(--accent)"};
    case "answered": return{label:"답변완료",  icon:"check_circle", bg:"#FEF3C7",border:"#FDE68A",         text:"#B45309"};
    case "adopted":  return{label:"반영완료",  icon:"celebration",  bg:"#DCFCE7",border:"#BBF7D0",         text:"#15803D"};
    default:         return{label:"답변대기",  icon:"schedule",     bg:"#F1F5F9",border:"#E2E8F0",         text:"#64748B"};
  }
}

const PROPOSAL_TIMELINE_STEPS=["작성","검토","공개","답변","반영"];
const PROPOSAL_TIMELINE_ICONS=["edit_note","fact_check","public","question_answer","celebration"];
const PROPOSAL_TIMELINE_DESC=[
  "청년이 필요한 정책을 자유롭게 작성해 제안을 등록하는 단계예요.",
  "운영진이 제안 내용에 부적절한 부분이 없는지 1차로 확인하는 단계예요.",
  "제안이 게시판에 공개되어 다른 청년들의 공감투표를 받는 단계예요.",
  "공감이 모여 매칭된 담당 부처가 제안을 검토하고 답변을 등록하는 단계예요.",
  "제안 내용이 실제 정책에 반영되어 시행되는 단계예요.",
];
const PROPOSAL_TIMELINE_DONE_COUNT={pending:2,matching:3,answered:4,adopted:5};
function proposalTimelineStates(status){
  const doneCount=PROPOSAL_TIMELINE_DONE_COUNT[status]??2;
  return PROPOSAL_TIMELINE_STEPS.map((_,i)=>{
    if(i<doneCount)return"done";
    if(i===doneCount&&doneCount<PROPOSAL_TIMELINE_STEPS.length)return"current";
    return"upcoming";
  });
}
const PROPOSAL_TIMELINE_META=PROPOSAL_TIMELINE_STEPS.map((label,i)=>({label,icon:PROPOSAL_TIMELINE_ICONS[i],detail:PROPOSAL_TIMELINE_DESC[i]}));

function ProposalTimelineWidget({steps,states,title="진행 상태",clickFill=false,children}){
  const [openIndex,setOpenIndex]=useState(null);
  const clickedFilled=i=>clickFill&&openIndex!=null&&i<=openIndex;
  return(
    <section style={{background:"white",borderRadius:20,padding:"18px 14px",border:"1.5px solid #f1f5f9"}}>
      {title&&<h2 style={{fontSize:15,fontWeight:800,color:"#111827",marginTop:0,marginBottom:20}}>{title}</h2>}
      <div style={{display:"flex",alignItems:"flex-start"}}>
        {steps.map((step,i)=>{
          const st=states[i];
          const isOpen=openIndex===i;
          const isFilled=st!=="upcoming"||clickedFilled(i);
          const lineFilled=i>0&&(states[i-1]==="done"||clickedFilled(i-1));
          const isPulsing=clickFill?(openIndex==null?st==="current":isOpen):st==="current";
          return(
            <div key={step.label} style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>
              {i>0&&<div style={{position:"absolute",top:15,right:"50%",width:"100%",height:2,background:lineFilled?"var(--accent)":"#e2e8f0",zIndex:0}}/>}
              <button type="button" onClick={()=>setOpenIndex(prev=>prev===i?null:i)} style={{width:30,height:30,borderRadius:"50%",background:isFilled?"var(--accent)":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1,position:"relative",animation:isPulsing?"pulse 1.4s infinite":"none",border:isFilled?"none":"1.5px solid #e2e8f0",boxShadow:isOpen?"0 0 0 3px var(--accent-bg)":"none",flexShrink:0,padding:0,cursor:"pointer",transition:"background 0.2s,border 0.2s,box-shadow 0.2s"}}>
                <Icon name={step.icon} size={15} color={isFilled?"white":"#94a3b8"}/>
              </button>
              <span style={{fontSize:11,marginTop:6,fontWeight:(st==="current"||isOpen)?700:600,color:isFilled?"#374151":"#94a3b8",textAlign:"center"}}>{step.label}</span>
              {clickFill&&st==="current"&&openIndex==null&&(
                <div style={{position:"relative",marginTop:10,background:"#1f2937",color:"white",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:600,width:"max-content",maxWidth:130,textAlign:"center",lineHeight:1.4,boxShadow:"0 2px 8px rgba(0,0,0,0.18)",animation:"fadeUp 0.3s ease",zIndex:2}}>
                  <div style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderBottom:"5px solid #1f2937"}}/>
                  아이콘을 클릭해서 상세 내용을 확인해보세요!
                </div>
              )}
            </div>
          );
        })}
      </div>
      {openIndex!=null&&(
        <div style={{marginTop:16,padding:"14px 16px",borderRadius:12,background:"#F8FAFC",border:"1px solid #E2E8F0",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:19,fontWeight:800,color:"#111827"}}>{steps[openIndex].title??steps[openIndex].label}</div>
          {steps[openIndex].summary&&<div style={{fontSize:14,fontWeight:700,color:"var(--accent)",lineHeight:1.5}}>{steps[openIndex].summary}</div>}
          <div style={{fontSize:14,color:"#6b7280",lineHeight:1.7}}>{steps[openIndex].detail}</div>
        </div>
      )}
      {children}
    </section>
  );
}

function ProposalCard({proposal,user,onVote,onOpen,bp}){
  const [voted,setVoted]=useLocalStorage(`yoa:proposalVoted_${proposal.id}`,false);
  const s=proposalStatusMeta(proposal.status);
  const c=CAT_COLORS[proposal.category]||{};
  const votes=proposal.votes||0;
  const progress=Math.min(100,Math.round((votes/VOTE_THRESHOLD)*100));

  const handleVote=e=>{
    e.stopPropagation();
    if(!user){alert("로그인 후 공감할 수 있어요.");return;}
    if(voted){
      setVoted(false);
      onVote(proposal.id,-1);
    }else{
      setVoted(true);
      onVote(proposal.id,1);
    }
  };

  return(
    <div onClick={()=>onOpen(proposal)} style={{background:"white",borderRadius:16,border:"1.5px solid #E2E8F0",padding:bp.isDesktop?"18px 20px":"14px 16px",cursor:"pointer"}}>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{...TAG_BASE,background:c.bg,border:`1px solid ${c.border}`,color:c.text,gap:4}}><Icon name={CAT_ICON[proposal.category]||"apps"} size={13} color={c.text}/>{CAT_LABEL[proposal.category]||proposal.category}</span>
        <span style={{...TAG_BASE,background:s.bg,border:`1px solid ${s.border}`,color:s.text,gap:4}}><Icon name={s.icon} size={13} color={s.text}/>{s.label}</span>
      </div>
      <div style={{fontWeight:700,fontSize:bp.isDesktop?15:14,color:"#111827",marginBottom:6,wordBreak:"break-word"}}>{proposal.title}</div>

      {proposal.status==="pending"&&(
        <div style={{marginTop:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button disabled style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,padding:"6px 10px",borderRadius:20,border:voted?"1.5px solid #fca5a5":"1.5px solid #E2E8F0",background:voted?"#fff1f2":"white",color:voted?"#dc2626":"#6b7280",cursor:"default",transition:"all 0.15s"}}>
              <Icon name="favorite" filled={voted} size={14} color={voted?"#dc2626":"#9ca3af"}/>
            </button>
            <div style={{flex:1,height:6,borderRadius:20,background:"#F1F5F9",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${progress}%`,background:"var(--accent)",borderRadius:20,transition:"width 0.3s"}}/>
            </div>
          </div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>공감 {votes}/{VOTE_THRESHOLD} · 임계치 도달 시 부처 매칭이 자동으로 시작돼요</div>
        </div>
      )}
      {proposal.status==="matching"&&(
        <div style={{fontSize:12,color:"var(--accent)",marginTop:10,display:"flex",alignItems:"center",gap:5}}><Icon name="sync" size={14} color="var(--accent)"/>공감 임계치 도달로 담당 부처 매칭이 진행 중이에요</div>
      )}
      {(proposal.status==="answered"||proposal.status==="adopted")&&proposal.answer&&(
        <div style={{marginTop:12,background:s.bg,border:`1px solid ${s.border}`,borderRadius:12,padding:"10px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:s.text,marginBottom:4}}>담당 부처 답변</div>
          <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{proposal.answer}</div>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12,paddingTop:12,borderTop:"1px solid #E2E8F0",fontSize:12,color:"#9ca3af"}}>
        <span>by <span style={{color:"#374151",fontWeight:600}}>{maskName(proposal.author)}</span></span>
        <span>{(proposal.createdAt||"").slice(0,10)}</span>
        <button onClick={handleVote} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,lineHeight:1,padding:"6px 14px",borderRadius:20,border:voted?"1.5px solid #fca5a5":"1.5px solid #E2E8F0",background:voted?"#fff1f2":"white",color:voted?"#dc2626":"#6b7280",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
          <Icon name="favorite" filled={voted} size={14} color={voted?"#dc2626":"#9ca3af"}/>공감 {votes}
        </button>
        <span style={{display:"flex",alignItems:"center",gap:5,lineHeight:1,padding:"6px 14px",fontSize:12,fontWeight:700,color:"#6b7280"}}>
          <Icon name="chat_bubble" size={14} color="#9ca3af"/>댓글 {proposal.comments_count||0}
        </span>
      </div>
    </div>
  );
}

function ProposalDetailView({proposal,user,onVote,onUpdate,onBack,bp}){
  const [voted,setVoted]=useLocalStorage(`yoa:proposalVoted_${proposal.id}`,false);
  const [comments,setComments]=useState([]);
  const [commentText,setCommentText]=useState("");
  const [viewerOpen,setViewerOpen]=useState(false);
  const commentRef=useRef(null);
  useEffect(()=>{
    const el=commentRef.current;
    if(!el)return;
    el.style.height="auto";
    el.style.height=Math.min(el.scrollHeight,120)+"px";
  },[commentText]);
  const [copied,setCopied]=useState(false);
  const s=proposalStatusMeta(proposal.status);
  const c=CAT_COLORS[proposal.category]||{grad:"linear-gradient(135deg,var(--accent-dark),var(--accent))",bg:"var(--accent-bg)",border:"var(--accent-bg)",text:"var(--accent)"};
  const votes=proposal.votes||0;
  const progress=Math.min(100,Math.round((votes/VOTE_THRESHOLD)*100));
  const timeline=proposalTimelineStates(proposal.status);

  useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"});},[proposal.id]);

  useEffect(()=>{
    supabase.from("proposal_comments").select("*").eq("proposal_id",proposal.id).order("created_at",{ascending:true}).then(({data})=>setComments(data||[]));
  },[proposal.id]);

  const handleVote=()=>{
    if(!user){alert("로그인 후 공감할 수 있어요.");return;}
    if(voted){
      setVoted(false);
      onVote(proposal.id,-1);
    }else{
      setVoted(true);
      onVote(proposal.id,1);
    }
  };
  const handleShare=()=>{
    const url=`${window.location.origin}${window.location.pathname}?proposal=${proposal.id}`;
    navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  const handleAddComment=async e=>{
    e.preventDefault();
    if(!user){alert("로그인 후 의견을 남길 수 있어요.");return;}
    if(!commentText.trim())return;
    const{data,error}=await supabase.from("proposal_comments").insert({
      proposal_id:proposal.id,
      user_id:user.id,
      author:user.user_metadata?.name||user.email||"익명",
      content:commentText.trim(),
    }).select().single();
    if(error)return;
    setComments(prev=>[...prev,data]);
    setCommentText("");
    await onUpdate?.(proposal.id,{comments_count:(proposal.comments_count||0)+1});
    if(proposal.user_id&&proposal.user_id!==user.id){
      supabase.from("notifications").insert({
        user_id:proposal.user_id,type:"comment_proposal",
        title:"내 정책제안에 새 의견이 달렸어요",body:proposal.title,
        link_type:"proposal",link_id:String(proposal.id),
      });
    }
  };

  return(
    <>
    <div style={{background:"#F5F9FC",minHeight:"100%",animation:"fadeUp 0.25s ease"}}>
      {/* 뒤로가기 헤더 */}
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:bp.isDesktop?"0 40px":"0 16px",position:"sticky",top:0,zIndex:40}}>
        <div style={{height:bp.isDesktop?56:52,display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"#374151",fontSize:14,fontWeight:600,padding:"8px 0",transition:"color 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"}
            onMouseLeave={e=>e.currentTarget.style.color="#374151"}
          ><Icon name="arrow_back" size={16}/> 뒤로가기</button>
          <span style={{color:"#e5e7eb"}}>|</span>
          <span style={{flex:"1 1 0%",minWidth:0,fontSize:13,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proposal.title}</span>
        </div>
      </div>

      {/* 히어로 */}
      <div style={{background:c.grad,padding:bp.isDesktop?"40px 40px 32px":bp.isTablet?"30px 24px 24px":"24px 18px 20px",color:"white"}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><Icon name={CAT_ICON[proposal.category]||"apps"} size={13} color="white"/>{CAT_LABEL[proposal.category]}</span>
            <span style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><Icon name={s.icon} size={13} color="white"/>{s.label}</span>
          </div>
          <h1 style={{fontSize:bp.isDesktop?30:bp.isTablet?24:20,fontWeight:900,margin:"0 0 10px",lineHeight:1.3,letterSpacing:"-0.02em",wordBreak:"break-word"}}>{proposal.title}</h1>
          <p style={{fontSize:13,opacity:0.8,margin:0}}>by {maskName(proposal.author)} · {(proposal.createdAt||"").slice(0,10)} · 공감 {votes}</p>
        </div>
      </div>

      <div style={{padding:bp.isDesktop?"32px 40px 60px":bp.isTablet?"24px 24px 60px":"16px 16px 80px"}}>
        <div style={{maxWidth:820,margin:"0 auto",display:"flex",flexDirection:"column",gap:16}}>

          {/* 상태 타임라인 */}
          <ProposalTimelineWidget steps={PROPOSAL_TIMELINE_META} states={timeline}>
            {proposal.status==="pending"&&(
              <div style={{marginTop:16}}>
                <div style={{height:6,borderRadius:20,background:"#F1F5F9",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${progress}%`,background:"var(--accent)",borderRadius:20,transition:"width 0.3s"}}/>
                </div>
                <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>공감 {votes}/{VOTE_THRESHOLD} · 임계치 도달 시 부처 매칭이 자동으로 시작돼요</div>
              </div>
            )}
          </ProposalTimelineWidget>

          {/* 제안 원문 */}
          <section style={{background:"white",borderRadius:20,padding:bp.isDesktop?"24px 28px":"18px 16px",border:"1.5px solid #f1f5f9"}}>
            <h2 style={{fontSize:15,fontWeight:800,color:"#111827",marginTop:0,marginBottom:0,display:"flex",alignItems:"center",gap:6}}>
              <Icon name="description" size={16}/>정책 제안서
              {proposal.aiVerified&&(
                <span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"#15803D",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:20,padding:"3px 10px"}}>
                  <Icon name="smart_toy" size={12} color="#15803D"/>AI 검토 완료
                </span>
              )}
            </h2>
            <div style={{height:1,background:"#f1f5f9",margin:"14px 0 16px"}}/>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:4}}>진행 방식</div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",fontSize:14,color:"#374151"}}>
                <Icon name={proposal.isTeam?"group":"person"} size={15} color="#9ca3af"/>{proposal.isTeam?"팀":"개인"}
                {proposal.isTeam&&proposal.teamMembers?.map(id=>(
                  <span key={id} style={{padding:"2px 9px",borderRadius:20,background:"var(--accent-bg)",color:"var(--accent)",fontSize:12,fontWeight:600}}>@{id}</span>
                ))}
              </div>
            </div>
            {proposal.background&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:4}}>배경</div>
                <p style={{margin:0,fontSize:14,color:"#374151",lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{proposal.background}</p>
              </div>
            )}
            <div style={{marginBottom:proposal.expectedEffect||proposal.attachment?14:0}}>
              <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:4}}>제안 내용</div>
              <p style={{margin:0,fontSize:14,color:"#374151",lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{proposal.content}</p>
            </div>
            {proposal.expectedEffect&&(
              <div style={{marginBottom:proposal.attachment?14:0}}>
                <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:4}}>기대 효과</div>
                <p style={{margin:0,fontSize:14,color:"#374151",lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{proposal.expectedEffect}</p>
              </div>
            )}
            {proposal.attachment&&(
              <div onClick={()=>{
                if(!proposal.attachment_url)return;
                if(proposal.attachment_type==="hwp")window.open(proposal.attachment_url,"_blank","noopener,noreferrer");
                else setViewerOpen(true);
              }} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:13,color:proposal.attachment_url?"var(--accent)":"#6b7280",cursor:proposal.attachment_url?"pointer":"default"}}>
                <Icon name="attach_file" size={15} color={proposal.attachment_url?"var(--accent)":"#9ca3af"}/>
                <span style={{textDecoration:proposal.attachment_url?"underline":"none",textUnderlineOffset:2}}>{proposal.attachment}</span>
                {!!proposal.attachment_size&&<span style={{color:"#9ca3af"}}>({formatFileSize(proposal.attachment_size)})</span>}
                {proposal.attachment_url&&<Icon name={proposal.attachment_type==="hwp"?"download":"visibility"} size={13} color="var(--accent)"/>}
              </div>
            )}
          </section>

          {/* 소관 부처 답변 */}
          {(proposal.status==="answered"||proposal.status==="adopted")&&proposal.answer&&(
            <section style={{background:s.bg,borderRadius:20,padding:bp.isDesktop?"24px 28px":"18px 16px",border:`1.5px solid ${s.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:6}}>
                <h2 style={{fontSize:15,fontWeight:800,color:s.text,margin:0,display:"flex",alignItems:"center",gap:6}}><Icon name={s.icon} size={16} color={s.text}/>소관 부처 공식 답변</h2>
                <span style={{fontSize:12,fontWeight:700,color:s.text}}>{proposal.answerOrg}{proposal.answeredAt?` · ${proposal.answeredAt}`:""}</span>
              </div>
              <p style={{margin:0,fontSize:14,color:"#374151",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{proposal.answer}</p>
            </section>
          )}

          {/* 공감 · 공유 */}
          <div style={{display:"flex",gap:10}}>
            <button onClick={handleVote} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"12px",borderRadius:14,border:voted?"1.5px solid #fca5a5":"1.5px solid #E2E8F0",background:voted?"#fff1f2":"white",color:voted?"#dc2626":"#374151",fontSize:14,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
              <Icon name="favorite" filled={voted} size={16} color={voted?"#dc2626":"#9ca3af"}/>공감 {votes}
            </button>
            <div style={{position:"relative",flex:1}}>
              <button onClick={handleShare} style={{width:"100%",padding:"12px",borderRadius:14,border:"1.5px solid #E2E8F0",background:"white",color:"#374151",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s"}}>
                <Icon name="share" size={16}/>공유하기
              </button>
              {copied&&<div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"#1f2937",color:"white",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,whiteSpace:"nowrap",zIndex:20,boxShadow:"0 2px 8px rgba(0,0,0,0.18)",animation:"fadeUp 0.2s ease"}}>URL이 복사되었습니다</div>}
            </div>
          </div>

          {/* 추가 의견(댓글) */}
          <section style={{background:"white",borderRadius:20,padding:bp.isDesktop?"24px 28px":"18px 16px",border:"1.5px solid #f1f5f9"}}>
            <h2 style={{fontSize:15,fontWeight:800,color:"#111827",marginTop:0,marginBottom:14,display:"flex",alignItems:"center",gap:6}}><Icon name="chat_bubble" size={16}/>추가 의견 <span style={{color:"#9ca3af",fontWeight:600}}>({comments.length})</span></h2>
            <form onSubmit={handleAddComment} style={{display:"flex",gap:8,marginBottom:comments.length?16:0}}>
              <textarea ref={commentRef} value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleAddComment(e);}}} placeholder="다른 청년들에게 보충 의견을 남겨보세요 (Shift+Enter로 줄바꿈)" rows={1} style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",resize:"none",overflow:"hidden",maxHeight:120,lineHeight:1.5}}/>
              <button type="submit" style={{padding:"9px 18px",borderRadius:10,background:"var(--accent)",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0,transition:"opacity 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >등록</button>
            </form>
            {comments.length===0?(
              <p style={{margin:0,fontSize:13,color:"#9ca3af"}}>아직 등록된 의견이 없어요. 첫 의견을 남겨보세요!</p>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {comments.map(cm=>(
                  <div key={cm.id} style={{borderTop:"1px solid #f1f5f9",paddingTop:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#374151"}}>{maskName(cm.author)}</span>
                      <span style={{fontSize:11,color:"#9ca3af"}}>{(cm.createdAt||"").slice(0,10)}</span>
                    </div>
                    <p style={{margin:0,fontSize:13,color:"#6b7280",lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{cm.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
    {viewerOpen&&proposal.attachment_url&&(
      <div onClick={()=>setViewerOpen(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:16,padding:14,maxWidth:"90vw",maxHeight:"90vh",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <span style={{fontSize:13,fontWeight:700,color:"#111827",wordBreak:"break-word"}}>{proposal.attachment}</span>
            <button onClick={()=>setViewerOpen(false)} style={{flexShrink:0,background:"#f1f5f9",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={14} color="#6b7280"/></button>
          </div>
          {proposal.attachment_type==="image"?(
            <img src={proposal.attachment_url} alt={proposal.attachment} style={{maxWidth:"85vw",maxHeight:"75vh",objectFit:"contain",borderRadius:8}}/>
          ):(
            <iframe src={proposal.attachment_url} title={proposal.attachment} style={{width:"85vw",height:"75vh",border:"none",borderRadius:8}}/>
          )}
        </div>
      </div>
    )}
    </>
  );
}

function ProposalFormRow({label,children}){
  return(
    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
      <div style={{width:86,flexShrink:0,paddingTop:11,fontSize:13,fontWeight:700,color:"#374151"}}>{label}</div>
      <div style={{flex:1,minWidth:0}}>{children}</div>
    </div>
  );
}

function HashtagAutocompleteField({as="input",value,onChange,tagPool,placeholder,rows,style}){
  const ref=useRef(null);
  const [caret,setCaret]=useState(null);
  const [activeIdx,setActiveIdx]=useState(0);

  const match=useMemo(()=>{
    if(caret==null)return null;
    const m=value.slice(0,caret).match(/#([^\s#]*)$/);
    return m?{query:m[1],start:caret-m[0].length}:null;
  },[value,caret]);

  const suggestions=useMemo(()=>{
    if(!match)return [];
    return tagPool.filter(t=>t!==match.query&&t.startsWith(match.query)).slice(0,6);
  },[match,tagPool]);

  useEffect(()=>{setActiveIdx(0);},[suggestions.length,match?.query]);

  const applySuggestion=tag=>{
    if(!match)return;
    const newCaret=match.start+tag.length+2;
    onChange(value.slice(0,match.start)+"#"+tag+" "+value.slice(caret));
    setCaret(newCaret);
    requestAnimationFrame(()=>{ref.current?.setSelectionRange(newCaret,newCaret);});
  };

  const handleKeyDown=e=>{
    if(!suggestions.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();setActiveIdx(i=>(i+1)%suggestions.length);}
    else if(e.key==="ArrowUp"){e.preventDefault();setActiveIdx(i=>(i-1+suggestions.length)%suggestions.length);}
    else if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();applySuggestion(suggestions[activeIdx]);}
    else if(e.key==="Escape"){setCaret(null);}
  };

  const Field=as;
  return(
    <div style={{position:"relative"}}>
      <Field
        ref={ref}
        value={value}
        placeholder={placeholder}
        rows={rows}
        style={style}
        onChange={e=>{onChange(e.target.value);setCaret(e.target.selectionStart);}}
        onClick={e=>setCaret(e.target.selectionStart)}
        onKeyUp={e=>setCaret(e.target.selectionStart)}
        onKeyDown={handleKeyDown}
        onBlur={()=>setTimeout(()=>setCaret(null),120)}
      />
      {suggestions.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,marginTop:4,background:"white",border:"1.5px solid #E2E8F0",borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:30,overflow:"hidden",minWidth:140}}>
          {suggestions.map((t,i)=>(
            <div key={t} onMouseDown={e=>{e.preventDefault();applySuggestion(t);}} style={{padding:"8px 14px",fontSize:13,fontWeight:i===activeIdx?700:500,color:i===activeIdx?"var(--accent)":"#374151",background:i===activeIdx?"var(--accent-bg)":"white",cursor:"pointer"}}>
              #{t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalPreviewModal({title,category,isTeam,teamMembers,background,content,expectedEffect,attachmentName,onClose,onConfirm,submitting}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:20,padding:"24px 24px 20px",width:"100%",maxWidth:680,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827",display:"flex",alignItems:"center",gap:6}}><Icon name="visibility" size={18} color="var(--accent)"/>제안 미리보기</div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={14} color="#6b7280"/></button>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,padding:"3px 12px",borderRadius:20,background:"var(--accent-bg)",color:"var(--accent)"}}>
            <Icon name={CAT_ICON[category]||"apps"} size={13} color="var(--accent)"/>{CAT_LABEL[category]||"기타"}
          </span>
          <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,padding:"3px 12px",borderRadius:20,background:"#f1f5f9",color:"#374151"}}>
            <Icon name={isTeam?"group":"person"} size={13} color="#374151"/>{isTeam?"팀":"개인"}
          </span>
          {isTeam&&teamMembers.map(id=>(
            <span key={id} style={{fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"var(--accent-bg)",color:"var(--accent)"}}>@{id}</span>
          ))}
        </div>

        <h2 style={{fontSize:20,fontWeight:900,margin:"0 0 16px",color:"#111827",lineHeight:1.4,wordBreak:"break-word"}}>{title}</h2>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:4}}>배경</div>
            <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{background}</p>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:4}}>제안 내용</div>
            <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{content}</p>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:4}}>기대 효과</div>
            <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{expectedEffect}</p>
          </div>
          {attachmentName&&(
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#6b7280"}}>
              <Icon name="attach_file" size={14} color="#9ca3af"/>{attachmentName}
            </div>
          )}
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20,paddingTop:16,borderTop:"1px solid #f1f5f9"}}>
          <button type="button" onClick={onClose} style={{padding:"9px 16px",borderRadius:20,background:"white",border:"1.5px solid #E2E8F0",color:"#374151",fontSize:13,fontWeight:600,cursor:"pointer"}}>수정하기</button>
          <button type="button" onClick={onConfirm} disabled={submitting} style={{padding:"9px 20px",borderRadius:20,background:"var(--accent)",border:"none",color:"white",fontSize:13,fontWeight:600,cursor:submitting?"default":"pointer",opacity:submitting?0.7:1}}>{submitting?"등록 중...":"제안 등록하기"}</button>
        </div>
      </div>
    </div>
  );
}

function ProposalExampleModal({onClose}){
  const FIELDS=[
    {label:"진행 방식",content:"개인",tip:"개인/팀 여부를 선택하세요. 팀으로 준비했다면 함께한 팀원을 태그하면 좋아요."},
    {label:"배경",content:"편의점, 카페 등에서 야간 아르바이트를 하는 청년들 중 상당수가 산재보험 가입 여부조차 모른 채 일하고 있습니다. 실제로 한 설문에서는 야간 아르바이트생의 약 60%가 산재보험 적용 대상인지 몰랐다고 답했습니다.",tip:"막연한 느낌보다 구체적인 숫자나 사례를 넣으면 설득력이 훨씬 올라가요. (예: '약 60%가 몰랐다')"},
    {label:"제안 내용",content:"아르바이트 채용 공고와 근로계약서 작성 시 산재보험 가입 여부와 신청 방법을 의무적으로 안내하도록 하고, 온통청년 앱 등에서도 관련 정보를 쉽게 찾아볼 수 있도록 안내 페이지를 신설해주시기 바랍니다. 또한 사업주 대상 교육 자료도 함께 배포해 실질적인 안내가 이루어지도록 해주세요.",tip:"누가, 무엇을, 어떻게 해야 하는지 실행 가능한 형태로 구체적으로 적어주세요. '~해주세요'로만 끝내지 말고 방법까지 제시하면 더 설득력 있어요."},
    {label:"기대 효과",content:"산재 발생 시 청년들이 정당한 보상을 받을 수 있는 기반이 마련되고, 안전 사각지대에 놓인 야간·단기 근로 청년들의 권익 보호에도 크게 기여할 것으로 기대됩니다.",tip:"제안이 실현되면 어떤 변화가 생기는지, 청년 입장에서 체감할 수 있는 효과를 구체적으로 적어주세요."},
  ];
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:20,padding:"24px 24px 20px",width:"100%",maxWidth:640,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827",display:"flex",alignItems:"center",gap:6}}><Icon name="menu_book" size={18} color="var(--accent)"/>정책제안서 예시</div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={14} color="#6b7280"/></button>
        </div>
        <p style={{fontSize:12,color:"#9ca3af",margin:"0 0 16px"}}>채택 가능성이 높은 제안서는 이렇게 씁니다. 각 항목 아래 말풍선 팁을 참고해서 작성해보세요.</p>

        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,padding:"3px 12px",borderRadius:20,background:"var(--accent-bg)",color:"var(--accent)"}}>
            <Icon name="work" size={13} color="var(--accent)"/>취업·창업
          </span>
        </div>
        <h2 style={{fontSize:19,fontWeight:900,margin:"0 0 16px",color:"#111827",lineHeight:1.4}}>심야 시간대 아르바이트 청년을 위한 산재보험 안내 강화</h2>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {FIELDS.map(f=>(
            <div key={f.label}>
              <div style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:4}}>{f.label}</div>
              <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.7}}>{f.content}</p>
              <div style={{position:"relative",marginTop:9,background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"9px 12px",display:"flex",gap:6,alignItems:"flex-start"}}>
                <div style={{position:"absolute",top:-7,left:16,width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderBottom:"7px solid #FDE68A"}}/>
                <div style={{position:"absolute",top:-5,left:16,width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderBottom:"6px solid #FFFBEB"}}/>
                <Icon name="lightbulb" size={14} color="#B45309"/>
                <span style={{fontSize:12,color:"#92400E",lineHeight:1.6}}>{f.tip}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{marginTop:18,background:"#EFF6FF",border:"1px solid var(--accent-bg)",borderRadius:12,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:800,color:"#111827",marginBottom:8}}>
            <Icon name="info" size={15} color="var(--accent)"/>제출 전 주의사항
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
              <span style={{fontSize:12,fontWeight:800,color:"var(--accent)",lineHeight:1.6,flexShrink:0}}>글자 수 제한</span>
              <span style={{fontSize:12,color:"#374151",lineHeight:1.6}}>배경 50자, 제안 내용 150자, 기대 효과 100자 이상을 채워야 제출할 수 있어요. 미달 시 등록 버튼이 눌리지 않아요.</span>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
              <span style={{fontSize:12,fontWeight:800,color:"var(--accent)",lineHeight:1.6,flexShrink:0}}>AI 검토</span>
              <span style={{fontSize:12,color:"#374151",lineHeight:1.6}}>제출 전 'AI 검토' 버튼을 누르면 ①욕설·비속어 등 부적절한 표현이 있는지, ②이미 등록된 비슷한 제안이 있는지를 자동으로 확인해줘요. 부적절한 표현이 감지되면 제출이 제한돼요.</span>
            </div>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,paddingTop:16,borderTop:"1px solid #f1f5f9"}}>
          <button type="button" onClick={onClose} style={{padding:"9px 20px",borderRadius:20,background:"var(--accent)",border:"none",color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>확인했어요</button>
        </div>
      </div>
    </div>
  );
}

const PROPOSAL_MIN_LEN={background:50,content:150,expectedEffect:100};

function getAttachmentType(fileName){
  const lower=(fileName||"").toLowerCase();
  if(lower.endsWith(".hwp"))return"hwp";
  if(/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower))return"image";
  if(lower.endsWith(".pdf"))return"pdf";
  return"";
}
function formatFileSize(bytes){
  if(!bytes&&bytes!==0)return"";
  if(bytes<1024*1024)return`${Math.max(1,Math.round(bytes/1024))}KB`;
  return`${(bytes/(1024*1024)).toFixed(1)}MB`;
}

function ProposalWriteView({category,setCategory,title,setTitle,background,setBackground,content,setContent,expectedEffect,setExpectedEffect,attachmentName,setAttachmentName,attachmentFile,setAttachmentFile,isTeam,setIsTeam,teamMembers,setTeamMembers,proposals,onSubmit,onSaveDraft,onBack,bp,submitting}){
  useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"});},[]);

  const [aiChecking,setAiChecking]=useState(false);
  const [aiResult,setAiResult]=useState(null);
  const [checkedSignature,setCheckedSignature]=useState(null);
  const [teamInput,setTeamInput]=useState("");
  const [draftSaved,setDraftSaved]=useState(false);
  const [showPreview,setShowPreview]=useState(false);
  const [showExample,setShowExample]=useState(false);
  const [exampleSeen,setExampleSeen]=useState(false);

  const tagPool=useMemo(()=>{
    const fromProposals=(proposals||[]).flatMap(p=>{
      const text=[p.title,p.content,p.background,p.expectedEffect].filter(Boolean).join(" ");
      return (text.match(/#[^\s#]+/g)||[]).map(t=>t.slice(1));
    });
    return [...new Set([...HASHTAG_SUGGESTIONS,...fromProposals])];
  },[proposals]);

  const autoTags=useMemo(()=>{
    const found=[...new Set(tagPool.filter(t=>title.includes(t)))];
    const specific=found.filter(t=>!found.some(o=>o!==t&&o.length>t.length&&o.includes(t)));
    return specific.slice(0,6);
  },[title,tagPool]);

  const handleSaveDraft=()=>{
    onSaveDraft();
    setDraftSaved(true);
    setTimeout(()=>setDraftSaved(false),2000);
  };

  const addTeamMember=()=>{
    const id=teamInput.trim().replace(/^@/,"");
    if(!id||teamMembers.includes(id)){setTeamInput("");return;}
    setTeamMembers([...teamMembers,id]);
    setTeamInput("");
  };
  const removeTeamMember=id=>setTeamMembers(teamMembers.filter(m=>m!==id));
  const handleTeamInputKeyDown=e=>{
    if(e.key==="Enter"){e.preventDefault();addTeamMember();}
  };

  const signature=`${category}|${title}|${background}|${content}|${expectedEffect}`;
  const aiPassed=!!aiResult&&aiResult.aiAvailable!==false&&!aiResult.profanity&&checkedSignature===signature;
  const lenOk={
    background:background.trim().length>=PROPOSAL_MIN_LEN.background,
    content:content.trim().length>=PROPOSAL_MIN_LEN.content,
    expectedEffect:expectedEffect.trim().length>=PROPOSAL_MIN_LEN.expectedEffect,
  };
  const allLenOk=title.trim()&&lenOk.background&&lenOk.content&&lenOk.expectedEffect;

  const runAiCheck=async()=>{
    if(!allLenOk){
      alert(`아직 작성이 부족해요.\n- 제목\n- 배경 ${PROPOSAL_MIN_LEN.background}자 이상 (현재 ${background.trim().length}자)\n- 제안내용 ${PROPOSAL_MIN_LEN.content}자 이상 (현재 ${content.trim().length}자)\n- 기대효과 ${PROPOSAL_MIN_LEN.expectedEffect}자 이상 (현재 ${expectedEffect.trim().length}자)`);
      return;
    }
    setAiChecking(true);
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),25000);
      const res=await fetch(`${API_BASE}/api/moderate`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({title,background,content,expectedEffect,existingProposals:(proposals||[]).map(p=>({id:p.id,title:p.title}))}),
        signal:controller.signal,
      });
      clearTimeout(timer);
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      setAiResult(data);
      setCheckedSignature(signature);
    }catch{
      alert("AI 검토 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.");
    }finally{
      setAiChecking(false);
    }
  };

  const handleFormSubmit=e=>{
    e.preventDefault();
    if(!allLenOk){
      alert(`배경 ${PROPOSAL_MIN_LEN.background}자, 제안내용 ${PROPOSAL_MIN_LEN.content}자, 기대효과 ${PROPOSAL_MIN_LEN.expectedEffect}자 이상 작성해야 제안할 수 있어요.`);
      return;
    }
    if(!aiPassed){
      alert(aiResult&&checkedSignature===signature&&aiResult.aiAvailable===false
        ?"AI 검토 서버가 일시적으로 응답하지 않았어요. 'AI 검토' 버튼을 다시 눌러주세요."
        :"제안하기 전에 'AI 검토' 버튼으로 먼저 확인해주세요.");
      return;
    }
    setShowPreview(true);
  };

  const handleConfirmSubmit=()=>{
    setShowPreview(false);
    onSubmit();
  };

  return(
    <>
    <div style={{background:"#F5F9FC",minHeight:"100%",animation:"fadeUp 0.25s ease"}}>
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:bp.isDesktop?"0 40px":"0 16px",position:"sticky",top:0,zIndex:40}}>
        <div style={{height:bp.isDesktop?56:52,display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"#374151",fontSize:14,fontWeight:600,padding:"8px 0",transition:"color 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"}
            onMouseLeave={e=>e.currentTarget.style.color="#374151"}
          ><Icon name="arrow_back" size={16}/> 뒤로가기</button>
          <span style={{color:"#e5e7eb"}}>|</span>
          <span style={{fontSize:13,color:"#9ca3af"}}>정책 제안하기</span>
        </div>
      </div>

      <div style={{padding:bp.isDesktop?"32px 40px 60px":bp.isTablet?"24px 24px 60px":"16px 16px 80px"}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
          <h1 style={{fontSize:bp.isDesktop?26:20,fontWeight:900,margin:"0 0 6px",letterSpacing:"-0.02em",color:"#111827"}}>청년 정책제안서</h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:20,flexWrap:"wrap"}}>
            <p style={{fontSize:13,color:"#6b7280",margin:0}}>여러분의 목소리가 공감투표를 통해 새로운 청년정책으로 이어질 수 있어요</p>
            <div style={{position:"relative"}}>
              {!exampleSeen&&(
                <div style={{position:"absolute",bottom:"100%",right:0,marginBottom:10,background:"#1f2937",color:"white",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:600,width:"max-content",maxWidth:150,textAlign:"center",lineHeight:1.4,boxShadow:"0 2px 8px rgba(0,0,0,0.18)",animation:"fadeUp 0.3s ease",zIndex:2}}>
                  처음이라면 예시부터 확인해보세요!
                  <div style={{position:"absolute",top:"100%",right:16,width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid #1f2937"}}/>
                </div>
              )}
              <button type="button" onClick={()=>{setShowExample(true);setExampleSeen(true);}} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:20,border:"1.5px solid var(--accent-bg)",background:"white",color:"var(--accent)",fontSize:12.5,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"background 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--accent-bg)"}
                onMouseLeave={e=>e.currentTarget.style.background="white"}
              >정책제안서 예시</button>
            </div>
          </div>
          {showExample&&<ProposalExampleModal onClose={()=>setShowExample(false)}/>}

          <form onSubmit={handleFormSubmit} style={{background:"white",borderRadius:16,border:"1.5px solid #E2E8F0",padding:bp.isDesktop?24:16,display:"flex",flexDirection:"column",gap:16}}>
            <ProposalFormRow label="제목">
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="제안 제목을 입력하세요" style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/>
              {autoTags.length>0&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  {autoTags.map(t=>(
                    <span key={t} style={{fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"var(--accent-bg)",color:"var(--accent)"}}>#{t}</span>
                  ))}
                </div>
              )}
            </ProposalFormRow>

            <ProposalFormRow label="정책 제안분야">
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {CATEGORIES.slice(1).map(c=>(
                  <button key={c.value} type="button" onClick={()=>setCategory(c.value)} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:20,border:"1.5px solid",cursor:"pointer",borderColor:category===c.value?"var(--accent)":"#E2E8F0",background:category===c.value?"var(--accent-bg)":"white",color:category===c.value?"var(--accent)":"#718096",fontSize:12,fontWeight:category===c.value?700:500}}>
                    <Icon name={c.icon} size={13} color={category===c.value?"var(--accent)":"#718096"}/>{c.label}
                  </button>
                ))}
                <button key="etc" type="button" onClick={()=>setCategory("etc")} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:20,border:"1.5px solid",cursor:"pointer",borderColor:category==="etc"?"var(--accent)":"#E2E8F0",background:category==="etc"?"var(--accent-bg)":"white",color:category==="etc"?"var(--accent)":"#718096",fontSize:12,fontWeight:category==="etc"?700:500}}>
                  <Icon name="more_horiz" size={13} color={category==="etc"?"var(--accent)":"#718096"}/>기타
                </button>
              </div>
            </ProposalFormRow>

            <ProposalFormRow label="진행 방식">
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",width:"fit-content"}}>
                  <input type="checkbox" checked={!isTeam} onChange={e=>setIsTeam(!e.target.checked)} style={{width:16,height:16,accentColor:"var(--accent)",cursor:"pointer"}}/>
                  <span style={{fontSize:13,color:"#374151",fontWeight:500}}>개인</span>
                </label>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",width:"fit-content"}}>
                  <input type="checkbox" checked={isTeam} onChange={e=>setIsTeam(e.target.checked)} style={{width:16,height:16,accentColor:"var(--accent)",cursor:"pointer"}}/>
                  <span style={{fontSize:13,color:"#374151",fontWeight:500}}>팀</span>
                </label>
              </div>
              {isTeam&&(
                <div style={{marginTop:10}}>
                  <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white"}}>
                    {teamMembers.map(id=>(
                      <span key={id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,background:"var(--accent-bg)",color:"var(--accent)",fontSize:13,fontWeight:600,border:"1px solid var(--accent)",whiteSpace:"nowrap"}}>
                        @{id}
                        <button type="button" onClick={()=>removeTeamMember(id)} style={{background:"none",border:"none",color:"var(--accent)",fontSize:15,lineHeight:1,padding:0,cursor:"pointer"}}>×</button>
                      </span>
                    ))}
                    <input value={teamInput} onChange={e=>setTeamInput(e.target.value)} onKeyDown={handleTeamInputKeyDown} placeholder={teamMembers.length===0?"팀원 아이디 입력 후 Enter":"+ 추가"} style={{flex:1,minWidth:120,border:"none",outline:"none",fontSize:13,padding:"2px 0",fontFamily:"inherit"}}/>
                  </div>
                  <div style={{fontSize:11,marginTop:4,color:"#9ca3af"}}>아이디를 입력하고 Enter를 누르면 @아이디 형태로 팀원이 추가돼요.</div>
                </div>
              )}
            </ProposalFormRow>

            <ProposalFormRow label="배경">
              <textarea value={background} onChange={e=>setBackground(e.target.value)} placeholder="이 제안이 필요하게 된 배경을 적어주세요" rows={3} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:14,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
              <div style={{fontSize:11,marginTop:4,color:lenOk.background?"#16A34A":"#9ca3af"}}>{background.trim().length} / {PROPOSAL_MIN_LEN.background}자 이상</div>
            </ProposalFormRow>

            <ProposalFormRow label="제안내용">
              <HashtagAutocompleteField as="textarea" value={content} onChange={setContent} tagPool={tagPool} placeholder="어떤 정책이 필요한지 구체적으로 적어주세요 (#해시태그 입력 시 자동완성)" rows={5} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:14,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
              <div style={{fontSize:11,marginTop:4,color:lenOk.content?"#16A34A":"#9ca3af"}}>{content.trim().length} / {PROPOSAL_MIN_LEN.content}자 이상</div>
            </ProposalFormRow>

            <ProposalFormRow label="기대효과">
              <textarea value={expectedEffect} onChange={e=>setExpectedEffect(e.target.value)} placeholder="이 제안이 반영되면 어떤 효과가 있을지 적어주세요" rows={3} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:14,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
              <div style={{fontSize:11,marginTop:4,color:lenOk.expectedEffect?"#16A34A":"#9ca3af"}}>{expectedEffect.trim().length} / {PROPOSAL_MIN_LEN.expectedEffect}자 이상</div>
            </ProposalFormRow>

            <ProposalFormRow label="첨부자료">
              <label style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderRadius:10,border:"1.5px dashed #E2E8F0",fontSize:13,color:"#6b7280",cursor:"pointer",width:"fit-content"}}>
                <Icon name="attach_file" size={16} color="#9ca3af"/>
                {attachmentName?`${attachmentName}${attachmentFile?` (${formatFileSize(attachmentFile.size)})`:""}`:"파일 선택"}
                <input type="file" accept="application/pdf,image/*,.hwp" onChange={e=>{
                  const file=e.target.files?.[0];
                  if(!file){setAttachmentName("");setAttachmentFile(null);return;}
                  if(!getAttachmentType(file.name)){
                    alert("PDF, 이미지, HWP 파일만 첨부할 수 있어요.");
                    e.target.value="";
                    return;
                  }
                  if(file.size>10*1024*1024){
                    alert("파일 용량은 최대 10MB까지 첨부할 수 있어요.");
                    e.target.value="";
                    return;
                  }
                  setAttachmentName(file.name);
                  setAttachmentFile(file);
                }} style={{display:"none"}}/>
              </label>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>PDF, 이미지, HWP 첨부 가능 (최대 10MB) · HWP는 미리보기 없이 다운로드만 제공돼요</div>
            </ProposalFormRow>

            {aiResult&&checkedSignature===signature&&(
              aiResult.aiAvailable===false?(
                <div style={{borderRadius:10,padding:"12px 14px",fontSize:12,lineHeight:1.6,background:"#FFFBEB",border:"1.5px solid #FDE68A"}}>
                  <div style={{fontWeight:800,fontSize:12,color:"#111827",marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
                    <Icon name="smart_toy" size={14} color="var(--accent)"/>AI 검토 결과
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"flex-start",color:"#B45309"}}>
                    <Icon name="error" size={15} color="#D97706"/>
                    <span>AI 검토 서버가 응답하지 않았어요. 'AI 검토' 버튼을 다시 눌러주세요.</span>
                  </div>
                </div>
              ):(
                <div style={{borderRadius:10,padding:"12px 14px",fontSize:12,lineHeight:1.6,background:aiResult.profanity?"#FEF2F2":"#EFF6FF",border:`1.5px solid ${aiResult.profanity?"#FECACA":"var(--accent-bg)"}`}}>
                  <div style={{fontWeight:800,fontSize:12,color:"#111827",marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
                    <Icon name="smart_toy" size={14} color="var(--accent)"/>AI 검토 결과
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"flex-start",color:aiResult.profanity?"#B91C1C":"#15803D"}}>
                    <Icon name={aiResult.profanity?"error":"check_circle"} size={15} color={aiResult.profanity?"#DC2626":"#16A34A"}/>
                    <span>
                      욕설·부적절한 표현 감지율 <b>{aiResult.profanityScore??0}%</b>
                      {aiResult.profanity?` — 제출할 수 없어요: ${aiResult.profanityReason}`:" — 제안하기를 눌러주세요."}
                    </span>
                  </div>
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(0,0,0,0.08)",color:"#374151"}}>
                    <div style={{fontWeight:700,marginBottom:4}}>유사 정책 확인</div>
                    {aiResult.similar?.length>0?(
                      aiResult.similar.map(s=>(<div key={s.id} style={{marginBottom:2}}>· {s.title} — {s.reason}</div>))
                    ):(
                      <div style={{color:"#6b7280"}}>비슷한 기존 제안을 찾지 못했어요.</div>
                    )}
                  </div>
                </div>
              )
            )}

            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <div style={{position:"relative"}}>
                <button type="button" onClick={handleSaveDraft} style={{padding:"9px 16px",borderRadius:20,background:"white",border:"1.5px solid #E2E8F0",color:"#374151",fontSize:13,fontWeight:600,cursor:"pointer",transition:"opacity 0.15s"}}>
                  임시저장
                </button>
                {draftSaved&&<div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"#1f2937",color:"white",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,whiteSpace:"nowrap",zIndex:20,boxShadow:"0 2px 8px rgba(0,0,0,0.18)",animation:"fadeUp 0.2s ease"}}>임시저장 되었습니다</div>}
              </div>
              <button type="button" onClick={runAiCheck} disabled={aiChecking} style={{padding:"9px 16px",borderRadius:20,background:"white",border:"1.5px solid var(--accent)",color:"var(--accent)",fontSize:13,fontWeight:600,cursor:aiChecking?"default":"pointer",opacity:aiChecking?0.6:1,transition:"opacity 0.15s"}}>
                {aiChecking?"검토 중...":"AI 검토"}
              </button>
              <button type="submit" style={{padding:"9px 20px",borderRadius:20,background:"var(--accent)",border:"none",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",transition:"opacity 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >제안하기</button>
            </div>
          </form>
        </div>
      </div>
    </div>
    {showPreview&&(
      <ProposalPreviewModal
        title={title} category={category} isTeam={isTeam} teamMembers={teamMembers}
        background={background} content={content} expectedEffect={expectedEffect} attachmentName={attachmentName}
        onClose={()=>setShowPreview(false)} onConfirm={handleConfirmSubmit} submitting={submitting}
      />
    )}
    </>
  );
}

const PROPOSAL_GUIDE_STEPS=[
  "카테고리를 고르고 제목·내용을 작성해 제안을 등록해요",
  "등록된 제안은 다른 청년들의 공감투표를 받아요",
  `공감이 ${VOTE_THRESHOLD}건 이상 모이면 담당 부처 매칭이 자동으로 시작돼요`,
  "담당 부처의 검토가 끝나면 답변이 등록되고 상태가 업데이트돼요",
];

const PROPOSAL_FAQ=[
  {q:"제안은 누구나 할 수 있나요?",a:"로그인한 회원이라면 누구나 자유롭게 제안할 수 있어요."},
  {q:"공감투표는 어떻게 하나요?",a:"제안 카드의 공감 버튼을 누르면 투표할 수 있어요. 1인 1표만 가능해요."},
  {q:"답변은 언제쯤 오나요?",a:"공감 임계치 도달 후 부처 매칭과 검토를 거쳐 순차적으로 답변이 제공돼요."},
  {q:"채택되면 어떻게 되나요?",a:"실제 정책에 반영되면 '반영완료' 상태로 바뀌고 시행 시기가 함께 안내돼요."},
];

const PROPOSAL_ONBOARDING_META=[
  {icon:"edit_note",   gradient:["#38BDF8","#0369A1"], title:"제안 등록하기",
    detail:"어떤 정책이, 왜 필요한지 구체적으로 적을수록 다른 청년들의 공감을 얻기 쉬워요. 배경과 기대 효과까지 함께 적어보세요. 작성이 끝나면 'AI 검토' 버튼으로 부적절한 표현이 없는지 자동으로 확인한 뒤 등록할 수 있어요."},
  {icon:"favorite",    gradient:["#FB7185","#BE123C"], title:"공감투표 받기",
    detail:"내 제안에 공감하는 청년이 많을수록 힘이 실려요. 다른 사람의 제안에도 공감을 눌러 함께 응원해주세요."},
  {icon:"sync",        gradient:["#60A5FA","#1D4ED8"], title:"부처 매칭 시작",
    detail:"임계치를 넘으면 제안 상태가 '부처매칭중'으로 바뀌고, 관련 정책을 담당하는 부처가 자동으로 연결돼요."},
  {icon:"check_circle",gradient:["#FBBF24","#B45309"], title:"답변 받기",
    detail:"검토가 끝나면 '답변완료'로, 실제 정책에 반영되면 '반영완료'로 상태가 바뀌며 시행 시기까지 안내받을 수 있어요."},
];
const PROPOSAL_ONBOARDING_STEPS=PROPOSAL_GUIDE_STEPS.map((summary,i)=>({...PROPOSAL_ONBOARDING_META[i],summary}));
const PROPOSAL_ONBOARDING_TIMELINE_META=PROPOSAL_ONBOARDING_STEPS.map(s=>({label:s.title,icon:s.icon,summary:s.summary,detail:s.detail}));

function ProposalOnboardingCarousel({bp}){
  const sidePad=bp.isDesktop?24:16;

  return(
    <div style={{background:"white",borderRadius:16,border:"1.5px solid #E2E8F0",padding:"18px 0 16px",overflow:"hidden"}}>
      <div style={{padding:`0 ${sidePad}px 14px`,display:"flex",alignItems:"center",gap:7}}>
        <Icon name="edit_note" size={17} color="var(--accent)"/>
        <div style={{fontSize:bp.isDesktop?16:15,fontWeight:800,color:"#111827"}}>정책제안 이렇게 진행돼요</div>
      </div>
      <div className="proposal-onboarding-scroll" style={{display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        {PROPOSAL_ONBOARDING_STEPS.map((step,i)=>(
          <div key={step.title} style={{flex:"0 0 100%",width:"100%",boxSizing:"border-box",scrollSnapAlign:"start",padding:`0 ${sidePad}px`,display:"flex",flexDirection:"column"}}>
            <ProposalTimelineWidget steps={PROPOSAL_ONBOARDING_TIMELINE_META} states={PROPOSAL_ONBOARDING_TIMELINE_META.map((_,idx)=>idx<i?"done":idx===i?"current":"upcoming")} clickFill/>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposalGuidePanel({bp,onGoCommunity}){
  const [collapsed,setCollapsed]=useLocalStorage("yoa:proposalGuide:collapsed",true);
  const isMobile=bp.isMobile;

  return(
    <div style={{
      position:"fixed",bottom:"calc(48px + env(safe-area-inset-bottom))",right:isMobile?38:48,
      width:collapsed?"auto":(isMobile?"calc(100vw - 28px)":"340px"),
      maxWidth:isMobile?"calc(100vw - 28px)":"340px",
      zIndex:45,
      ...(collapsed?{}:{border:"1.5px solid #E2E8F0",borderRadius:18,overflow:"hidden",background:"white",boxShadow:"0 4px 20px rgba(0,0,0,0.14)"}),
    }}>
      {!collapsed&&(
        <>
        <div style={{padding:isMobile?"14px 14px 6px":"16px 16px 8px",maxHeight:"48vh",overflowY:"auto"}}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:800,color:"#111827",marginBottom:14,display:"flex",alignItems:"center",gap:5}}>
              <Icon name="help" size={14} color="var(--accent)"/>자주 묻는 질문
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {PROPOSAL_FAQ.map(item=>(
                <div key={item.q}>
                  <div style={{fontSize:12,fontWeight:700,color:"#111827",marginBottom:3}}>Q. {item.q}</div>
                  <div style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>A. {item.a}</div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={onGoCommunity} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 14px",borderRadius:10,border:"none",background:"var(--accent)",color:"white",fontSize:13,fontWeight:700,cursor:"pointer",transition:"opacity 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
          >직접 질문하러가기<Icon name="arrow_forward" size={14} color="white"/></button>
        </div>

        <button onClick={()=>setCollapsed(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#F8FAFE",border:"none",borderTop:"1.5px solid #E2E8F0",cursor:"pointer",textAlign:"left"}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent-dark),var(--accent))",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px var(--accent-shadow)"}}>
            <Icon name="help" size={16} color="white"/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"#111827",lineHeight:1.3}}>정책제안 안내</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>자주하는 질문</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,color:"#9ca3af",fontSize:12,flexShrink:0}}>
            <span>접기</span>
            <span style={{display:"inline-block",transform:"rotate(180deg)",transition:"transform 0.25s",fontSize:10}}>▼</span>
          </div>
        </button>
        </>
      )}

      {collapsed&&(
        <div style={{position:"relative"}}>
          {/* 말풍선 안내 */}
          <div style={{position:"absolute",bottom:"100%",right:-8,marginBottom:14,width:180,padding:"12px 14px",borderRadius:16,background:"#ffffff",border:"2px solid var(--accent-bg)",boxShadow:"0 8px 28px var(--accent-shadow)"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#111827",lineHeight:1.3}}>정책제안 안내</div>
            <div style={{fontSize:11.5,color:"#6b7280",marginTop:2}}>자주하는 질문</div>
            <div style={{position:"absolute",top:"100%",right:26,width:0,height:0,borderLeft:"9px solid transparent",borderRight:"9px solid transparent",borderTop:"9px solid var(--accent-bg)"}}/>
            <div style={{position:"absolute",top:"calc(100% - 3px)",right:26,width:0,height:0,borderLeft:"7px solid transparent",borderRight:"7px solid transparent",borderTop:"7px solid #ffffff"}}/>
          </div>

          <div onClick={()=>setCollapsed(false)} style={{position:"relative",display:"flex",cursor:"pointer",transformOrigin:"top center",animation:"guideWiggle 5s ease-in-out infinite"}}>
            <span style={{position:"absolute",inset:0,borderRadius:"50%",zIndex:-1,background:"var(--accent)",animation:"pingRing 1.8s cubic-bezier(0,0,0.2,1) infinite"}}/>
            <div style={{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent-dark),var(--accent))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px var(--accent-shadow)"}}>
              <span style={{color:"white",fontSize:15,fontWeight:800,letterSpacing:"-0.02em"}}>FAQ</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mapProposalRow(r){
  return{...r,expectedEffect:r.expected_effect,isTeam:r.is_team,teamMembers:r.team_members||[],answerOrg:r.answer_org,answeredAt:r.answered_at};
}

function PolicyProposalPage({bp,user,onGoCommunity}){
  const [proposals,setProposals]=useState([]);
  const [loadingProposals,setLoadingProposals]=useState(true);
  const [draft,setDraft]=useLocalStorage("yoa:proposalDraft",null);
  const [title,setTitle]=useState(draft?.title||"");
  const [background,setBackground]=useState(draft?.background||"");
  const [content,setContent]=useState(draft?.content||"");
  const [expectedEffect,setExpectedEffect]=useState(draft?.expectedEffect||"");
  const [attachmentName,setAttachmentName]=useState(draft?.attachmentName||"");
  const [attachmentFile,setAttachmentFile]=useState(null);
  const [submitting,setSubmitting]=useState(false);
  const [isTeam,setIsTeam]=useState(draft?.isTeam||false);
  const [teamMembers,setTeamMembers]=useState(draft?.teamMembers||[]);
  const [category,setCategory]=useState(draft?.category||"job");
  const [statusTab,setStatusTab]=useState("all");
  const [catFilter,setCatFilter]=useState("all");
  const [sort,setSort]=useState("recent");
  const [selectedProposal,setSelectedProposal]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [pageNum,setPageNum]=useState(1);

  const fetchProposals=useCallback(async()=>{
    setLoadingProposals(true);
    const{data}=await supabase.from("proposals").select("*").order("created_at",{ascending:false});
    setProposals((data||[]).map(mapProposalRow));
    setLoadingProposals(false);
  },[]);

  useEffect(()=>{
    fetchProposals();
  },[fetchProposals]);

  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("proposal");
    if(!id||selectedProposal)return;
    const found=proposals.find(p=>String(p.id)===id);
    if(found)setSelectedProposal(found);
  },[proposals,selectedProposal]);

  const openProposal=useCallback(p=>{
    setSelectedProposal(p);
    history.replaceState({},"",`${window.location.pathname}?proposal=${p.id}`);
  },[]);

  const closeProposal=useCallback(()=>{
    setSelectedProposal(null);
    history.replaceState({},"",window.location.pathname);
  },[]);

  const handleSaveDraft=useCallback(()=>{
    setDraft({category,title,background,content,expectedEffect,attachmentName,isTeam,teamMembers,savedAt:new Date().toISOString()});
  },[setDraft,category,title,background,content,expectedEffect,attachmentName,isTeam,teamMembers]);

  const handleSubmit=async()=>{
    if(!user){alert("로그인 후 제안을 등록할 수 있어요.");return;}
    if(!title.trim()||background.trim().length<PROPOSAL_MIN_LEN.background||content.trim().length<PROPOSAL_MIN_LEN.content||expectedEffect.trim().length<PROPOSAL_MIN_LEN.expectedEffect)return;
    setSubmitting(true);
    let attachmentUrl="",attachmentSize=null,attachmentType="";
    if(attachmentFile){
      const path=`${user.id}/${Date.now()}-${attachmentFile.name}`;
      const{error:uploadError}=await supabase.storage.from("proposal-attachments").upload(path,attachmentFile);
      if(uploadError){
        alert("첨부파일 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
        setSubmitting(false);
        return;
      }
      attachmentUrl=supabase.storage.from("proposal-attachments").getPublicUrl(path).data?.publicUrl||"";
      attachmentSize=attachmentFile.size;
      attachmentType=getAttachmentType(attachmentFile.name);
    }
    const{data,error}=await supabase.from("proposals").insert({
      title:title.trim(),
      background:background.trim(),
      content:content.trim(),
      expected_effect:expectedEffect.trim(),
      attachment:attachmentName,
      attachment_url:attachmentUrl,
      attachment_size:attachmentSize,
      attachment_type:attachmentType,
      is_team:isTeam,
      team_members:isTeam?teamMembers:[],
      ai_verified:true,
      category,
      author:user.user_metadata?.name||user.email||"익명",
      user_id:user.id,
      status:"pending",
      votes:0,
      answer:"",
      answer_org:"",
      answered_at:"",
      comments_count:0,
    }).select().single();
    setSubmitting(false);
    if(error){alert("제안 등록에 실패했어요. 잠시 후 다시 시도해주세요.");return;}
    setProposals(prev=>[mapProposalRow(data),...prev]);
    setTitle("");
    setBackground("");
    setContent("");
    setExpectedEffect("");
    setAttachmentName("");
    setAttachmentFile(null);
    setIsTeam(false);
    setTeamMembers([]);
    setShowForm(false);
    setDraft(null);
  };

  const handleVote=useCallback(async(id,delta=1)=>{
    const target=proposals.find(p=>p.id===id);
    if(!target)return;
    const votes=Math.max(0,(target.votes||0)+delta);
    const status=target.status==="pending"&&votes>=VOTE_THRESHOLD?"matching":target.status;
    await supabase.from("proposals").update({votes,status}).eq("id",id);
    setProposals(prev=>prev.map(p=>p.id===id?{...p,votes,status}:p));
    setSelectedProposal(prev=>prev&&prev.id===id?{...prev,votes,status}:prev);
    if(status!==target.status&&target.user_id){
      supabase.from("notifications").insert({
        user_id:target.user_id,type:"proposal_status",
        title:"내 정책제안이 다음 단계로 진입했어요",body:`"${target.title}" · 부처 매칭중`,
        link_type:"proposal",link_id:String(id),
      });
    }
  },[proposals]);

  const handleProposalUpdate=useCallback(async(id,fields)=>{
    await supabase.from("proposals").update(fields).eq("id",id);
    setProposals(prev=>prev.map(p=>p.id===id?{...p,...fields}:p));
    setSelectedProposal(prev=>prev&&prev.id===id?{...prev,...fields}:prev);
  },[]);

  const statusCounts=useMemo(()=>{
    const m={all:proposals.length,pending:0,answered:0,adopted:0};
    proposals.forEach(p=>{
      if(p.status==="pending"||p.status==="matching")m.pending++;
      else if(p.status==="answered")m.answered++;
      else if(p.status==="adopted")m.adopted++;
    });
    return m;
  },[proposals]);

  const stats=useMemo(()=>{
    const total=proposals.length;
    const answered=proposals.filter(p=>p.status==="answered"||p.status==="adopted").length;
    const adopted=proposals.filter(p=>p.status==="adopted").length;
    return{total,rate:total>0?Math.round((answered/total)*100):0,adopted};
  },[proposals]);

  const filtered=useMemo(()=>{
    let list=proposals.filter(p=>{
      if(statusTab==="pending"){if(!(p.status==="pending"||p.status==="matching"))return false;}
      else if(statusTab!=="all"&&p.status!==statusTab)return false;
      if(catFilter==="etc"){if(CATEGORIES.slice(1).some(c=>c.value===p.category))return false;}
      else if(catFilter!=="all"&&p.category!==catFilter)return false;
      return true;
    });
    list=[...list].sort((a,b)=>sort==="votes"?(b.votes||0)-(a.votes||0):new Date(b.createdAt)-new Date(a.createdAt));
    return list;
  },[proposals,statusTab,catFilter,sort]);

  useEffect(()=>{setPageNum(1);},[statusTab,catFilter,sort]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/4));
  const pageItems=filtered.slice((pageNum-1)*4,pageNum*4);

  if(selectedProposal){
    const live=proposals.find(p=>p.id===selectedProposal.id)||selectedProposal;
    return <ProposalDetailView proposal={live} user={user} onVote={handleVote} onUpdate={handleProposalUpdate} onBack={closeProposal} bp={bp}/>;
  }

  if(showForm){
    return <ProposalWriteView category={category} setCategory={setCategory} title={title} setTitle={setTitle} background={background} setBackground={setBackground} content={content} setContent={setContent} expectedEffect={expectedEffect} setExpectedEffect={setExpectedEffect} attachmentName={attachmentName} setAttachmentName={setAttachmentName} attachmentFile={attachmentFile} setAttachmentFile={setAttachmentFile} isTeam={isTeam} setIsTeam={setIsTeam} teamMembers={teamMembers} setTeamMembers={setTeamMembers} proposals={proposals} onSubmit={handleSubmit} onSaveDraft={handleSaveDraft} onBack={()=>setShowForm(false)} bp={bp} submitting={submitting}/>;
  }

  const now=new Date();
  const pad=n=>String(n).padStart(2,"0");
  const statsAsOf=`${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}.${pad(now.getHours())}시 기준`;

  return(
    <div style={{background:"#f8fafc",minHeight:"100%"}}>
      <div style={{background:"linear-gradient(160deg,#0f172a 0%,var(--accent-dark) 60%,var(--accent) 100%)",padding:bp.isDesktop?"36px 40px 28px":bp.isTablet?"28px 24px 20px":"22px 16px 16px",color:"white"}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>
          <div style={{fontSize:12,opacity:0.6,marginBottom:8}}>청년 정책 제안</div>
          <h1 style={{fontSize:bp.isDesktop?32:bp.isTablet?24:20,fontWeight:900,margin:"0 0 8px",letterSpacing:"-0.02em",display:"flex",alignItems:"center",gap:10}}>필요한 정책을 직접 제안해보세요 <Icon name="campaign" size={bp.isDesktop?28:bp.isTablet?22:18} color="rgba(255,255,255,0.75)"/></h1>
          <p style={{fontSize:bp.isDesktop?15:13,opacity:0.7,margin:0}}>여러분의 목소리가 공감투표를 통해 새로운 청년정책으로 이어질 수 있어요</p>
        </div>
      </div>

      <div style={{padding:bp.isDesktop?"28px 40px 60px":bp.isTablet?"20px 24px 60px":"14px 14px 80px"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>
          <ProposalOnboardingCarousel bp={bp}/>

          <div style={{background:"var(--accent-bg)",borderRadius:16,border:"1.5px solid #E2E8F0",padding:bp.isDesktop?"14px 24px 10px":"10px 12px 8px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:bp.isMobile?8:12}}>
              {[
                {label:"누적 제안수", val:stats.total.toLocaleString()},
                {label:"답변율",      val:`${stats.rate}%`},
                {label:"반영 건수",   val:stats.adopted.toLocaleString()},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,textAlign:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:bp.isMobile?11:12,color:"#111827",fontWeight:600}}>{s.label}</div>
                  <div style={{fontSize:bp.isDesktop?22:18,fontWeight:900,color:"#111827"}}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{textAlign:"right",fontSize:10,color:"#9ca3af",fontWeight:500,marginTop:8}}>{statsAsOf}</div>
          </div>

          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid #e5e7eb",background:"white",borderRadius:"16px 16px 0 0",padding:"0 12px"}}>
              <HScrollFade style={{gap:0,flex:1}} fadeColor="#ffffff">
                {PROPOSAL_STATUS_TABS.map(t=>(
                  <button key={t.value} onClick={()=>setStatusTab(t.value)} style={{flexShrink:0,padding:bp.isDesktop?"13px 16px":"11px 10px",border:"none",background:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:bp.isDesktop?14:12,fontWeight:statusTab===t.value?700:500,color:statusTab===t.value?"#111827":"#9ca3af",borderBottom:`2.5px solid ${statusTab===t.value?"#111827":"transparent"}`,transition:"all 0.15s"}}>{t.label} <span style={{opacity:0.6,fontSize:11}}>({statusCounts[t.value]??0})</span></button>
                ))}
              </HScrollFade>
              <button type="button" onClick={()=>setShowForm(true)} style={{padding:bp.isMobile?"8px 14px":"9px 20px",borderRadius:20,background:"var(--accent)",border:"none",color:"white",fontSize:bp.isMobile?12:13,fontWeight:600,cursor:"pointer",transition:"opacity 0.15s",flexShrink:0,whiteSpace:"nowrap",marginLeft:"auto"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >+ 정책 제안하기</button>
            </div>

            <div style={{background:"white",borderRadius:"0 0 16px 16px",padding:"12px 16px",display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
              {PROPOSAL_CATEGORY_FILTERS.map(c=>(
                <button key={c.value} onClick={()=>setCatFilter(c.value)} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:catFilter===c.value?"var(--accent)":"#E2E8F0",background:catFilter===c.value?"var(--accent)":"white",color:catFilter===c.value?"white":"#475569",fontSize:12,fontWeight:catFilter===c.value?700:400,cursor:"pointer",transition:"all 0.12s",whiteSpace:"nowrap"}}>{c.label}</button>
              ))}
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{fontSize:12,border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 8px",background:"white",color:"#374151",outline:"none",fontFamily:"inherit",cursor:"pointer",flexShrink:0,marginLeft:"auto"}}>
                {PROPOSAL_SORTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:12}}>
              {loadingProposals&&(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"72px 20px",gap:14,background:"white",borderRadius:16,border:"1.5px solid #E2E8F0"}}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{width:"100%",height:88,borderRadius:12,background:"linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>
                  ))}
                </div>
              )}
              {!loadingProposals&&filtered.length===0&&(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"64px 20px",gap:10,background:"white",borderRadius:16,border:"1.5px solid #E2E8F0"}}>
                  <Icon name="campaign" size={44} color="#d1d5db"/>
                  <div style={{fontSize:16,fontWeight:700,color:"#1E293B",marginTop:4}}>해당하는 제안이 없어요</div>
                  <div style={{fontSize:13,color:"#9ca3af"}}>다른 상태 탭을 확인해보세요</div>
                </div>
              )}
              {!loadingProposals&&pageItems.map(p=><ProposalCard key={p.id} proposal={p} user={user} onVote={handleVote} onOpen={openProposal} bp={bp}/>)}
            </div>
            <Pagination page={pageNum} pageCount={pageCount} onChange={setPageNum}/>
          </div>
        </div>
      </div>

      {!bp.isMobile&&<ProposalGuidePanel bp={bp} onGoCommunity={onGoCommunity}/>}
    </div>
  );
}

// ─── 로그인 페이지 ────────────────────────────────────────────────────────

function LoginPage({setPage,bp}){
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [unconfirmed,setUnconfirmed]=useState(false);
  const [resending,setResending]=useState(false);
  const [resendMsg,setResendMsg]=useState("");

  const handleKakao=async()=>{
    const {error:err}=await supabase.auth.signInWithOAuth({
      provider:"kakao",
      options:{redirectTo:"https://on.policylab.co.kr/",scopes:"profile_nickname"}
    });
    if(err) setError("카카오 로그인 중 오류가 발생했습니다.");
  };

  const handleSubmit=async e=>{
    e.preventDefault();
    setUnconfirmed(false);setResendMsg("");
    if(!email){setError("이메일을 입력해주세요.");return;}
    if(!pw){setError("비밀번호를 입력해주세요.");return;}
    setLoading(true);
    const {error:err}=await supabase.auth.signInWithPassword({email,password:pw});
    setLoading(false);
    if(err){
      if(err.message==="Email not confirmed"){
        setError("이메일 인증이 완료되지 않았어요. 가입하신 메일함(스팸함 포함)에서 인증 메일을 확인해주세요.");
        setUnconfirmed(true);
      }else{
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      }
      return;
    }
    setPage("chatbot");
  };

  const handleResend=async()=>{
    setResending(true);setResendMsg("");
    const {error:err}=await supabase.auth.resend({type:"signup",email});
    setResending(false);
    setResendMsg(err?"인증 메일 재발송에 실패했어요. 잠시 후 다시 시도해주세요.":"인증 메일을 다시 보냈어요. 메일함을 확인해주세요.");
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",fontFamily:"'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif"}}>
      {/* 왼쪽 브랜드 패널 (데스크탑만) */}
      {bp.isDesktop&&(
        <div style={{width:480,background:"linear-gradient(160deg,#0f172a 0%,var(--accent-dark) 60%,var(--accent) 100%)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 56px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:"-15%",top:"-10%",width:400,height:400,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
          <div style={{position:"absolute",left:"-10%",bottom:"-10%",width:300,height:300,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
          <div style={{position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:48}}>
              <img src={import.meta.env.BASE_URL + 'logo.png'} alt="청년ON" style={{width:44,height:44,borderRadius:12}}/>
              <div style={{fontWeight:900,fontSize:22,color:"white",letterSpacing:"-0.03em"}}>청년ON</div>
            </div>
            <h2 style={{fontSize:36,fontWeight:900,color:"white",margin:"0 0 16px",lineHeight:1.25,letterSpacing:"-0.02em"}}>한 눈에 보는<br/>청년 정책</h2>
            <p style={{fontSize:15,color:"rgba(255,255,255,0.65)",lineHeight:1.8,margin:"0 0 40px"}}>취업·주거·금융·교육·건강까지<br/>나에게 딱 맞는 청년 정책을 찾아보세요.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[{icon:"auto_awesome",text:"AI가 찾아주고 내가 고르는 청년 정책 DB"},{icon:"calendar_month",text:"마감일 캘린더 & 체크리스트로 꼼꼼한 신청 관리"},{icon:"forum",text:"생생한 후기가 쏟아지는 청년 ON 커뮤니티"}].map(({icon,text})=>(
                <div key={text} style={{display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.8)",fontSize:14}}>
                  <Icon name={icon} size={18} color="rgba(255,255,255,0.8)"/>{text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 오른쪽 로그인 폼 */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc",padding:bp.isMobile?"24px 20px":"40px"}}>
        <div style={{width:"100%",maxWidth:400}}>
          {/* 모바일 로고 */}
          {!bp.isDesktop&&(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:36,justifyContent:"center"}}>
              <img src={import.meta.env.BASE_URL + 'logo.png'} alt="청년ON" style={{width:36,height:36,borderRadius:10}}/>
              <div style={{fontWeight:900,fontSize:20,color:"#111827",letterSpacing:"-0.03em"}}>청년ON</div>
            </div>
          )}

          <div style={{background:"white",borderRadius:20,padding:bp.isMobile?"28px 24px":"36px 40px",boxShadow:"0 4px 40px rgba(0,0,0,0.08)",border:"1.5px solid #f1f5f9"}}>
            <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:"0 0 6px",letterSpacing:"-0.02em"}}>로그인</h1>
            <p style={{fontSize:13,color:"#9ca3af",margin:"0 0 28px"}}>계정이 없으신가요? <button onClick={()=>setPage("signup")} style={{background:"none",border:"none",color:"var(--accent)",fontSize:13,fontWeight:700,cursor:"pointer",padding:0}}>회원가입</button></p>

            <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <label style={{fontSize:13,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>이메일</label>
                <input
                  type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
                  placeholder="example@email.com"
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.15s",background:"#f8fafc"}}
                  onFocus={e=>e.target.style.borderColor="var(--accent)"}
                  onBlur={e=>e.target.style.borderColor="#e2e8f0"}
                />
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <label style={{fontSize:13,fontWeight:600,color:"#374151"}}>비밀번호</label>
                  <button type="button" style={{background:"none",border:"none",color:"#6b7280",fontSize:12,cursor:"pointer",padding:0}}>비밀번호 찾기</button>
                </div>
                <div style={{position:"relative"}}>
                  <input
                    type={showPw?"text":"password"} value={pw} onChange={e=>{setPw(e.target.value);setError("");}}
                    placeholder="비밀번호를 입력해주세요"
                    style={{width:"100%",padding:"12px 44px 12px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.15s",background:"#f8fafc"}}
                    onFocus={e=>e.target.style.borderColor="var(--accent)"}
                    onBlur={e=>e.target.style.borderColor="#e2e8f0"}
                  />
                  <button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9ca3af",padding:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon name={showPw?"visibility_off":"visibility"} size={18} color="#9ca3af"/>
                  </button>
                </div>
              </div>

              {error&&(
                <div style={{fontSize:13,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px"}}>
                  {error}
                  {unconfirmed&&(
                    <button type="button" onClick={handleResend} disabled={resending} style={{display:"block",marginTop:8,background:"none",border:"none",color:"var(--accent)",fontSize:13,fontWeight:700,cursor:resending?"default":"pointer",padding:0}}>
                      {resending?"재발송 중...":"인증 메일 다시 받기"}
                    </button>
                  )}
                  {resendMsg&&<div style={{marginTop:6,color:"#374151"}}>{resendMsg}</div>}
                </div>
              )}

              <button type="submit" disabled={loading} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"var(--accent)",color:"white",fontSize:15,fontWeight:800,cursor:loading?"default":"pointer",marginTop:4,transition:"opacity 0.15s",boxShadow:"0 4px 20px var(--accent-shadow)",opacity:loading?0.7:1}}>
                {loading?"로그인 중...":"로그인"}
              </button>
            </form>

            <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0"}}>
              <div style={{flex:1,height:1,background:"#e5e7eb"}}/>
              <span style={{fontSize:12,color:"#9ca3af"}}>또는</span>
              <div style={{flex:1,height:1,background:"#e5e7eb"}}/>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={handleKakao} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"#FEE500",color:"#191919",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"opacity 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >카카오로 계속하기</button>
            </div>
          </div>

          <button onClick={()=>setPage("search")} style={{display:"flex",alignItems:"center",gap:4,margin:"20px auto 0",background:"none",border:"none",color:"#9ca3af",fontSize:13,cursor:"pointer",padding:"8px 16px",lineHeight:1}}>
            <Icon name="arrow_back" size={14} color="currentColor"/> 메인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 회원가입 페이지 ──────────────────────────────────────────────────────

function SignupPage({setPage,bp}){
  const [form,setForm]=useState({name:"",email:"",pw:"",pwConfirm:""});
  const [showPw,setShowPw]=useState(false);
  const [agreed,setAgreed]=useState(false);
  const [errors,setErrors]=useState({});

  const set=k=>e=>setForm(prev=>({...prev,[k]:e.target.value}));

  const validate=()=>{
    const e={};
    if(!form.name.trim())e.name="이름을 입력해주세요.";
    if(!form.email.includes("@"))e.email="올바른 이메일 형식을 입력해주세요.";
    if(form.pw.length<8)e.pw="비밀번호는 8자 이상이어야 합니다.";
    if(form.pw!==form.pwConfirm)e.pwConfirm="비밀번호가 일치하지 않습니다.";
    if(!agreed)e.agreed="이용약관에 동의해주세요.";
    return e;
  };

  const [loading,setLoading]=useState(false);

  const handleKakao=async()=>{
    const {error:err}=await supabase.auth.signInWithOAuth({
      provider:"kakao",
      options:{redirectTo:"https://on.policylab.co.kr/",scopes:"profile_nickname"}
    });
    if(err) setErrors({form:"카카오 로그인 중 오류가 발생했습니다."});
  };

  const handleSubmit=async e=>{
    e.preventDefault();
    const e2=validate();
    if(Object.keys(e2).length){setErrors(e2);return;}
    setLoading(true);
    const {data}=await supabase.auth.signUp({
      email:form.email,
      password:form.pw,
      options:{data:{name:form.name.trim()}},
    });
    if(!data?.session){
      await supabase.auth.signInWithPassword({email:form.email,password:form.pw}).catch(()=>{});
    }
    setLoading(false);
    setErrors({msg:"가입이 완료됐어요!"});
    setTimeout(()=>setPage("chatbot"),600);
  };

  const inputStyle={width:"100%",padding:"12px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.15s",background:"#f8fafc"};
  const labelStyle={fontSize:13,fontWeight:600,color:"#374151",display:"block",marginBottom:6};
  const errStyle={fontSize:12,color:"#dc2626",marginTop:4};

  return(
    <div style={{minHeight:"100vh",display:"flex",fontFamily:"'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif"}}>
      {bp.isDesktop&&(
        <div style={{width:480,background:"linear-gradient(160deg,#0f172a 0%,#0a7a6e 60%,#19CEBD 100%)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 56px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:"-15%",top:"-10%",width:400,height:400,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
          <div style={{position:"absolute",left:"-10%",bottom:"-10%",width:300,height:300,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
          <div style={{position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:48}}>
              <img src={import.meta.env.BASE_URL + 'logo.png'} alt="청년ON" style={{width:44,height:44,borderRadius:12}}/>
              <div style={{fontWeight:900,fontSize:22,color:"white",letterSpacing:"-0.03em"}}>청년ON</div>
            </div>
            <h2 style={{fontSize:36,fontWeight:900,color:"white",margin:"0 0 16px",lineHeight:1.25,letterSpacing:"-0.02em"}}>나를 위한<br/>청년 정책 큐레이터</h2>
            <p style={{fontSize:15,color:"rgba(255,255,255,0.65)",lineHeight:1.8,margin:"0 0 40px"}}>AI와 대화로 나만의 맞춤 정책 찾고<br/>한 곳에서 똑똑하게 관리해요.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[{icon:"auto_awesome",text:"AI가 찾아주고 내가 고르는 청년 정책 DB"},{icon:"calendar_month",text:"마감일 캘린더 & 체크리스트로 꼼꼼한 신청 관리"},{icon:"forum",text:"생생한 후기가 쏟아지는 청년 ON 커뮤니티"}].map(({icon,text})=>(
                <div key={text} style={{display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,0.8)",fontSize:14}}>
                  <Icon name={icon} size={18} color="rgba(255,255,255,0.8)"/>{text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc",padding:bp.isMobile?"24px 20px":"40px",overflowY:"auto"}}>
        <div style={{width:"100%",maxWidth:400}}>
          {!bp.isDesktop&&(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:36,justifyContent:"center"}}>
              <img src={import.meta.env.BASE_URL + 'logo.png'} alt="청년ON" style={{width:36,height:36,borderRadius:10}}/>
              <div style={{fontWeight:900,fontSize:20,color:"#111827",letterSpacing:"-0.03em"}}>청년ON</div>
            </div>
          )}

          <div style={{background:"white",borderRadius:20,padding:bp.isMobile?"28px 24px":"36px 40px",boxShadow:"0 4px 40px rgba(0,0,0,0.08)",border:"1.5px solid #f1f5f9"}}>
            <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:"0 0 6px",letterSpacing:"-0.02em"}}>회원가입</h1>
            <p style={{fontSize:13,color:"#9ca3af",margin:"0 0 28px"}}>이미 계정이 있으신가요? <button onClick={()=>setPage("login")} style={{background:"none",border:"none",color:"var(--accent)",fontSize:13,fontWeight:700,cursor:"pointer",padding:0}}>로그인</button></p>

            <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={labelStyle}>이름</label>
                <input value={form.name} onChange={set("name")} placeholder="홍길동"
                  style={{...inputStyle,borderColor:errors.name?"#fca5a5":"#e2e8f0"}}
                  onFocus={e=>e.target.style.borderColor="var(--accent)"}
                  onBlur={e=>e.target.style.borderColor=errors.name?"#fca5a5":"#e2e8f0"}
                />
                {errors.name&&<div style={errStyle}>{errors.name}</div>}
              </div>
              <div>
                <label style={labelStyle}>이메일</label>
                <input type="email" value={form.email} onChange={set("email")} placeholder="example@email.com"
                  style={{...inputStyle,borderColor:errors.email?"#fca5a5":"#e2e8f0"}}
                  onFocus={e=>e.target.style.borderColor="var(--accent)"}
                  onBlur={e=>e.target.style.borderColor=errors.email?"#fca5a5":"#e2e8f0"}
                />
                {errors.email&&<div style={errStyle}>{errors.email}</div>}
              </div>
              <div>
                <label style={labelStyle}>비밀번호</label>
                <div style={{position:"relative"}}>
                  <input type={showPw?"text":"password"} value={form.pw} onChange={set("pw")} placeholder="8자 이상 입력해주세요"
                    style={{...inputStyle,paddingRight:44,borderColor:errors.pw?"#fca5a5":"#e2e8f0"}}
                    onFocus={e=>e.target.style.borderColor="var(--accent)"}
                    onBlur={e=>e.target.style.borderColor=errors.pw?"#fca5a5":"#e2e8f0"}
                  />
                  <button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9ca3af",padding:4,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name={showPw?"visibility_off":"visibility"} size={18} color="#9ca3af"/></button>
                </div>
                {errors.pw&&<div style={errStyle}>{errors.pw}</div>}
              </div>
              <div>
                <label style={labelStyle}>비밀번호 확인</label>
                <input type={showPw?"text":"password"} value={form.pwConfirm} onChange={set("pwConfirm")} placeholder="비밀번호를 다시 입력해주세요"
                  style={{...inputStyle,borderColor:errors.pwConfirm?"#fca5a5":"#e2e8f0"}}
                  onFocus={e=>e.target.style.borderColor="var(--accent)"}
                  onBlur={e=>e.target.style.borderColor=errors.pwConfirm?"#fca5a5":"#e2e8f0"}
                />
                {errors.pwConfirm&&<div style={errStyle}>{errors.pwConfirm}</div>}
              </div>

              <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",marginTop:4}}>
                <div onClick={()=>setAgreed(v=>!v)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${agreed?"var(--accent)":"#d1d5db"}`,background:agreed?"var(--accent)":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.15s"}}>
                  {agreed&&<Icon name="check" size={13} color="white"/>}
                </div>
                <span style={{fontSize:13,color:"#374151",lineHeight:1.6}}>
                  <span style={{color:"var(--accent)",fontWeight:600,cursor:"pointer"}}>이용약관</span> 및 <span style={{color:"var(--accent)",fontWeight:600,cursor:"pointer"}}>개인정보처리방침</span>에 동의합니다.
                </span>
              </label>
              {errors.agreed&&<div style={{...errStyle,marginTop:-8}}>{errors.agreed}</div>}
              {errors.msg&&<div style={{fontSize:13,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px"}}>{errors.msg}</div>}

              <button type="submit" disabled={loading} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"var(--accent)",color:"white",fontSize:15,fontWeight:800,cursor:loading?"default":"pointer",marginTop:4,transition:"opacity 0.15s",boxShadow:"0 4px 20px var(--accent-shadow)",opacity:loading?0.7:1}}>
                {loading?"처리 중...":"가입하기"}
              </button>
            </form>

            <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0"}}>
              <div style={{flex:1,height:1,background:"#e5e7eb"}}/>
              <span style={{fontSize:12,color:"#9ca3af"}}>또는</span>
              <div style={{flex:1,height:1,background:"#e5e7eb"}}/>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={handleKakao} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"#FEE500",color:"#191919",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"opacity 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >카카오로 계속하기</button>
            </div>
          </div>

          <button onClick={()=>setPage("search")} style={{display:"flex",alignItems:"center",gap:4,margin:"20px auto 0",background:"none",border:"none",color:"#9ca3af",fontSize:13,cursor:"pointer",padding:"8px 16px",lineHeight:1}}>
            <Icon name="arrow_back" size={14} color="currentColor"/> 메인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 네비게이션 ────────────────────────────────────────────────────────────

function notifTimeAgo(iso){
  const diff=Math.max(0,Date.now()-new Date(iso).getTime());
  const min=Math.floor(diff/60000);
  if(min<1)return"방금";
  if(min<60)return`${min}분 전`;
  const hr=Math.floor(min/60);
  if(hr<24)return`${hr}시간 전`;
  const day=Math.floor(hr/24);
  if(day<7)return`${day}일 전`;
  return iso.slice(0,10);
}

const NOTIF_TYPE_ICON={comment_post:"chat_bubble",comment_proposal:"chat_bubble",proposal_status:"campaign",policy_deadline:"alarm",best_answer:"star"};

function NotificationBell({user,favIds,policies,onNavigate}){
  const [items,setItems]=useState([]);
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  const fetchNotifs=useCallback(async()=>{
    const{data}=await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);
    setItems(data||[]);
  },[user.id]);

  useEffect(()=>{
    fetchNotifs();
    const t=setInterval(fetchNotifs,60000);
    return()=>clearInterval(t);
  },[fetchNotifs]);

  useEffect(()=>{
    if(!open)return;
    const handle=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handle);
    return()=>document.removeEventListener("mousedown",handle);
  },[open]);

  const deadlineReminders=useMemo(()=>{
    if(!favIds?.size||!policies?.length)return[];
    return policies
      .filter(p=>favIds.has(p.id))
      .map(p=>({p,d:daysLeft(p.deadline)}))
      .filter(({d})=>d!==null&&d>=0&&d<=3)
      .sort((a,b)=>a.d-b.d)
      .slice(0,5)
      .map(({p,d})=>({
        id:`policy-${p.id}`,type:"policy_deadline",
        title:"관심 정책 마감이 얼마 안 남았어요",body:`${p.title} · D-${d}`,
        link_type:"policy",link_id:p.id,read:true,created_at:null,
      }));
  },[favIds,policies]);

  const merged=[...deadlineReminders,...items];
  const unreadCount=items.filter(n=>!n.read).length;

  const handleClickItem=n=>{
    if(n.created_at&&!n.read){
      setItems(prev=>prev.map(x=>x.id===n.id?{...x,read:true}:x));
      supabase.from("notifications").update({read:true}).eq("id",n.id);
    }
    setOpen(false);
    if(n.link_type&&n.link_id)onNavigate(n.link_type,n.link_id);
  };

  const handleMarkAllRead=()=>{
    const unreadIds=items.filter(n=>!n.read).map(n=>n.id);
    if(!unreadIds.length)return;
    setItems(prev=>prev.map(x=>({...x,read:true})));
    supabase.from("notifications").update({read:true}).in("id",unreadIds);
  };

  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} title="알림" style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"none",border:"none",cursor:"pointer",borderRadius:"50%",transition:"background 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
        onMouseLeave={e=>e.currentTarget.style.background="none"}
      >
        <Icon name="notifications" size={20} color="#6b7280"/>
        {unreadCount>0&&<span style={{position:"absolute",top:5,right:6,width:8,height:8,borderRadius:"50%",background:"#ef4444",border:"1.5px solid white"}}/>}
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"white",borderRadius:14,border:"1.5px solid #e5e7eb",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",width:320,maxHeight:420,overflowY:"auto",zIndex:200,animation:"fadeUp 0.15s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px 10px",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0,background:"white"}}>
            <span style={{fontSize:13,fontWeight:800,color:"#111827"}}>알림</span>
            {unreadCount>0&&<button onClick={handleMarkAllRead} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"var(--accent)",fontWeight:700}}>모두 읽음 처리</button>}
          </div>
          {merged.length===0?(
            <div style={{padding:"32px 16px",textAlign:"center",color:"#9ca3af",fontSize:12}}>아직 알림이 없어요</div>
          ):merged.map(n=>(
            <button key={n.id} onClick={()=>handleClickItem(n)} style={{width:"100%",display:"flex",gap:10,alignItems:"flex-start",padding:"12px 14px",background:n.read?"white":"#F5F9FF",border:"none",borderBottom:"1px solid #f8fafc",cursor:"pointer",textAlign:"left",transition:"background 0.12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
              onMouseLeave={e=>e.currentTarget.style.background=n.read?"white":"#F5F9FF"}
            >
              <div style={{width:28,height:28,borderRadius:"50%",background:"var(--accent-bg)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon name={NOTIF_TYPE_ICON[n.type]||"notifications"} size={14} color="var(--accent)"/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#111827",wordBreak:"break-word"}}>{n.title}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.body}</div>
                {n.created_at&&<div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{notifTimeAgo(n.created_at)}</div>}
              </div>
              {!n.read&&n.created_at&&<span style={{width:7,height:7,borderRadius:"50%",background:"var(--accent)",flexShrink:0,marginTop:4}}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavUserDropdown({user,onLogout,onGoMyPage,compact=false,favCount=0,fontScale,onFontInc,onFontDec,themeKey,onThemeChange}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  const name=getDisplayName(user);
  const email=user?.email||"";
  const avatar=name.charAt(0);

  useEffect(()=>{
    if(!open)return;
    const handle=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handle);
    return()=>document.removeEventListener("mousedown",handle);
  },[open]);

  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",gap:compact?0:7,background:"none",border:"none",cursor:"pointer",padding:compact?"4px":"5px 8px",borderRadius:compact?"50%":9,transition:"background 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
        onMouseLeave={e=>e.currentTarget.style.background="none"}
        title={compact?name:undefined}
      >
        <span style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent-dark),var(--accent))",color:"#fff",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{avatar}</span>
        {!compact&&<span style={{fontSize:13,color:"#374151",fontWeight:600}}>{name}</span>}
        {!compact&&<span style={{fontSize:9,color:"#9ca3af",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>}
      </button>

      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"white",borderRadius:14,border:"1.5px solid #e5e7eb",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",minWidth:210,overflow:"hidden",zIndex:200,animation:"fadeUp 0.15s ease"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 16px 14px"}}>
            <span style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent-dark),var(--accent))",color:"#fff",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{avatar}</span>
            <div style={{display:"flex",flexDirection:"column",minWidth:0,gap:2}}>
              <span style={{fontSize:14,color:"#111827",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
              <span style={{fontSize:11,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{email}</span>
              <span style={{fontSize:11,color:"#f59e0b",fontWeight:600,marginTop:2,display:"flex",alignItems:"center",gap:3}}><Icon name="bookmark" size={12} color="#f59e0b"/> {favCount}개 정책 저장 중</span>
            </div>
          </div>
          <div style={{height:1,background:"#f1f5f9",margin:"0 12px"}}/>
          <button onClick={()=>{setOpen(false);onGoMyPage();}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 16px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#374151",fontWeight:600,textAlign:"left",transition:"background 0.12s"}}
            onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
            onMouseLeave={e=>e.currentTarget.style.background="none"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            마이페이지
          </button>
          <div style={{height:1,background:"#f1f5f9",margin:"0 12px"}}/>
          <button onClick={()=>{setOpen(false);onLogout();}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 16px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#ef4444",fontWeight:600,textAlign:"left",transition:"background 0.12s"}}
            onMouseEnter={e=>e.currentTarget.style.background="#fff5f5"}
            onMouseLeave={e=>e.currentTarget.style.background="none"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            로그아웃
          </button>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 12px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
            <FontSizeControl scale={fontScale} onInc={onFontInc} onDec={onFontDec}/>
            <PaletteDots themeKey={themeKey} onChange={onThemeChange}/>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({page,setPage,favIds,user,open,setOpen,onLogoClick}){
  const [mySub,setMySub]=useLocalStorage("yoa:mysub","custom");
  const mainPage=page==="detail"?"":page.split("-")[0];
  const [navTooltip,setNavTooltip]=useState(null);

  const NAV=[
    {id:"chatbot", icon:"auto_awesome", label:"AI 챗봇"},
    {id:"search",  icon:"search",    label:"검색"},
    {id:"proposal",icon:"campaign", label:"청년정책 제안"},
    {id:"community",icon:"forum",    label:"커뮤니티"},
    ...(user?[{id:"mypage", icon:"person", label:"마이페이지"}]:[]),
  ];

  return(
    <>
    <aside style={{
      width:open?240:64, flexShrink:0, height:"100vh", position:"sticky", top:0,
      background:"#FFFFFF", borderRight:"1px solid #E2E8F0",
      display:"flex", flexDirection:"column",
      padding:open?"20px 16px 24px":"20px 8px 24px",
      overflowY:"auto", overflowX:"hidden",
      transition:"width 0.25s cubic-bezier(0.4,0,0.2,1), padding 0.25s ease",
    }}>

      {/* 로고 + 토글 */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32,justifyContent:open?"space-between":"center"}}>
        {open&&(
          <button onClick={onLogoClick} style={{display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",padding:0,minWidth:0}}>
            <img src={import.meta.env.BASE_URL + 'logo.png'} alt="청년ON" style={{width:34,height:34,borderRadius:10,flexShrink:0}}/>
            <div style={{overflow:"hidden"}}>
              <div style={{fontWeight:900,fontSize:16,color:"#0F172A",letterSpacing:"-0.03em",whiteSpace:"nowrap"}}>청년ON</div>
              <div style={{fontSize:10,color:"#94A3B8",marginTop:1,whiteSpace:"nowrap"}}>청년정책 안내</div>
            </div>
          </button>
        )}
        <button
          onClick={()=>setOpen(o=>!o)}
          title={open?"메뉴 접기":"메뉴 펼치기"}
          style={{
            width:34,height:34,borderRadius:9,border:"none",cursor:"pointer",
            background:"transparent",
            display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,transition:"background 0.15s",
          }}
          onMouseEnter={e=>e.currentTarget.style.background="#F1F5F9"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
        >
          <Icon name={open?"menu_open":"menu"} size={18} color="#475569"/>
        </button>
      </div>

      {/* 네비게이션 */}
      <nav style={{display:"flex",flexDirection:"column",gap:4,flex:1}}>
        {NAV.map(n=>{
          const active=mainPage===n.id;
          return(
            <button
              key={n.id}
              onClick={()=>setPage(n.id)}
              style={{
                display:"flex",alignItems:"center",
                gap:open?12:0,
                padding:open?"11px 14px":"11px 0",
                justifyContent:open?"flex-start":"center",
                borderRadius:12,border:"none",cursor:"pointer",
                background:active?"var(--accent-bg-active)":"transparent",
                color:active?"var(--accent)":"#475569",
                fontSize:14,fontWeight:active?700:400,
                transition:"all 0.15s",textAlign:"left",
                borderLeft:"none",
                width:"100%",
                position:"relative",
              }}
              onMouseEnter={e=>{
                if(!active){e.currentTarget.style.background="#F8FAFC";e.currentTarget.style.color="#475569"}
                if(!open){const r=e.currentTarget.getBoundingClientRect();setNavTooltip({label:n.label,top:r.top+r.height/2,left:r.right+10});}
              }}
              onMouseLeave={e=>{
                if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="#475569"}
                setNavTooltip(null);
              }}
            >
              <Icon name={n.icon} size={18} color={active?"var(--accent)":"#475569"}/>
              {open&&<span style={{whiteSpace:"nowrap",overflow:"hidden"}}>{n.label}</span>}
            </button>
          );
        })}
      </nav>

      {open&&(
        <>
          {user?.user_metadata?.role==="admin"&&(
            <button onClick={()=>window.location.hash="#admin"} style={{marginTop:10,display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(251,191,36,0.3)",background:"rgba(251,191,36,0.1)",color:"#fbbf24",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(251,191,36,0.2)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(251,191,36,0.1)"}
            ><Icon name="admin_panel_settings" size={16} color="#fbbf24"/> 관리자 대시보드</button>
          )}
          <div style={{marginTop:14,fontSize:10,color:"#CBD5E1",textAlign:"center"}}>© 2026 청년ON</div>
        </>
      )}

      {/* 축소 시 즐겨찾기 수 뱃지 */}
    </aside>
    {!open&&navTooltip&&createPortal(
      <div style={{
        position:"fixed",top:navTooltip.top,left:navTooltip.left,transform:"translateY(-50%)",
        background:"#1E293B",color:"#fff",fontSize:12,fontWeight:600,
        padding:"6px 10px",borderRadius:6,whiteSpace:"nowrap",
        zIndex:9999,pointerEvents:"none",boxShadow:"0 4px 12px rgba(0,0,0,0.18)",
      }}>
        {navTooltip.label}
        <div style={{position:"absolute",left:-4,top:"50%",transform:"translateY(-50%)",width:0,height:0,borderTop:"5px solid transparent",borderBottom:"5px solid transparent",borderRight:"5px solid #1E293B"}}/>
      </div>,
      document.body
    )}
    </>
  );
}

function FAQItem({q,a}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{background:"white",border:"1.5px solid #f1f5f9",borderRadius:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"none",border:"none",cursor:"pointer",fontSize:14,fontWeight:600,color:"#111827"}}
      >{q}<span style={{fontSize:11,color:"#9ca3af",transition:"transform 0.2s",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",flexShrink:0}}>▼</span></button>
      {open&&<div style={{padding:"0 18px 14px",fontSize:13,color:"#6b7280",lineHeight:1.75}}>{a}</div>}
    </div>
  );
}

const aboutStyles={
  mockCard:{background:"white",borderRadius:20,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
};

const ABOUT_CARDS=[
  {icon:"smart_toy",accent:"#7C3AED",iconBg:"#EDE9FE",bg:"#F5F3FF",border:"#EDE0FF",
    label:"AI 챗봇",
    title:"AI 챗봇이 내 상황에 맞는 정책을 찾아드려요",
    desc:"나이·지역·고민을 자유롭게 말하면 AI가 수백 개 정책 중 나에게 맞는 것만 골라 카드로 보여줘요. 마음에 들면 별표 한 번으로 저장할 수 있어요.",
    mockup:(
      <div style={aboutStyles.mockCard}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
          <div style={{background:"var(--accent)",color:"white",borderRadius:"16px 16px 4px 16px",padding:"10px 14px",fontSize:13,maxWidth:"85%",lineHeight:1.5}}>27살 서울 사는데 월세 지원 있을까?</div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-start"}}>
          <div style={{background:"#F5F3FF",borderRadius:"16px 16px 16px 4px",padding:"12px 14px",fontSize:13,color:"#374151",maxWidth:"88%"}}>
            <div style={{fontWeight:800,marginBottom:4}}>청년 월세 한시 특별지원</div>
            <div style={{fontSize:12,color:"#6b7280"}}>월 최대 20만원 · 최장 12개월</div>
          </div>
        </div>
      </div>
    )},
  {icon:"search",accent:"#2563EB",iconBg:"#DBEAFE",bg:"#EFF6FF",border:"#DCEAFF",
    label:"정책 검색",
    title:"지역·부처·학력까지, 촘촘한 정책 검색",
    desc:"1500개가 넘는 정책을 지역·중앙부처·학력·취업 상태로 세밀하게 좁혀보고, 인기순·마감임박순·지원금 큰 순으로 정렬해서 확인해요. 최대 3개까지 골라 나란히 비교하면 AI가 실질적인 차이점까지 짚어줘요.",
    mockup:(
      <div style={aboutStyles.mockCard}>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
          {["서울","고용노동부","대학 재학"].map(t=>(
            <span key={t} style={{borderRadius:20,border:"1px solid #BFDBFE",background:"#EFF6FF",color:"#1D4ED8",fontSize:12,fontWeight:700,padding:"5px 12px"}}>{t}</span>
          ))}
        </div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:10}}>검색 결과 <b style={{color:"#2563EB"}}>128건</b></div>
        {[["청년 창업 지원 바우처","D-30"],["청년 전세임대주택","상시"]].map(([t,d])=>(
          <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:10,border:"1px solid #eef2ff",marginBottom:6,fontSize:13}}>
            <span style={{fontWeight:600,color:"#111827"}}>{t}</span>
            <span style={{fontSize:11,color:"#2563EB",fontWeight:700}}>{d}</span>
          </div>
        ))}
      </div>
    )},
  {icon:"campaign",accent:"#0D9488",iconBg:"#CCFBF1",bg:"#F0FDFA",border:"#D5F7EE",
    label:"정책 제안",
    title:"제안부터 진행 상황까지, 청년정책 제안",
    desc:"청년에게 필요한 정책을 자유롭게 제안해보세요. 제출 전 'AI 검토'가 욕설·비속어·도배성 텍스트와 비슷한 기존 제안을 미리 걸러주고, 공감이 모이면 답변대기 → 부처매칭중 → 답변완료 단계를 거쳐 담당 부처에 자동으로 전달돼요.",
    mockup:(
      <div style={aboutStyles.mockCard}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:800,color:"#111827",marginBottom:8}}>
          <Icon name="smart_toy" size={15} color="#0D9488"/>AI 검토 결과
        </div>
        <div style={{background:"#F0FDFA",border:"1px solid #D5F7EE",borderRadius:10,padding:"9px 12px",fontSize:12,lineHeight:1.6,color:"#0D9488",display:"flex",gap:6,alignItems:"flex-start",marginBottom:16}}>
          <Icon name="check_circle" size={14} color="#0D9488"/>
          <span>욕설·부적절한 표현 감지율 <b>3%</b> — 제안하기를 눌러주세요.</span>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {["답변대기","부처매칭중","답변완료"].map((s,i)=>(
            <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1}}>
              <span style={{width:28,height:28,borderRadius:"50%",background:i<=1?"#0D9488":"#f1f5f9",color:i<=1?"white":"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>{i+1}</span>
              <span style={{fontSize:11,fontWeight:i===1?800:600,color:i<=1?"#0D9488":"#94a3b8"}}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    )},
  {icon:"forum",accent:"#B45309",iconBg:"#FEF3C7",bg:"#FFFBEB",border:"#FDECC8",
    label:"커뮤니티",
    title:"후기·정보·Q&A를 나누는 청년 커뮤니티",
    desc:"실제 신청 후기와 꿀팁을 나누고, 공감과 댓글로 소통해요. 공감순 베스트 후기는 상단에 따로 모아 보여주고, 팀원과 함께 정책 제안을 준비하는 팀모집 글은 참가하기 한 번으로 신청할 수 있어요.",
    mockup:(
      <div style={aboutStyles.mockCard}>
        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20,background:"#F59E0B",color:"white"}}>
            <Icon name="star" fill={1} size={10} color="white"/>BEST 1
          </span>
          <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0"}}>후기</span>
        </div>
        <div style={{fontWeight:800,color:"#111827",marginBottom:10}}>청년도약계좌 드디어 개설! 생각보다 간단했어요</div>
        <div style={{fontSize:12,color:"#9ca3af",display:"flex",alignItems:"center",gap:10}}>
          <span>by 서O영</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><Icon name="favorite" size={13} color="#9ca3af"/>91</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><Icon name="chat_bubble" size={13} color="#9ca3af"/>38</span>
        </div>
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #FDECC8",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:"#FDF4FF",color:"#A21CAF",border:"1px solid #F5D0FE"}}>정책제안 팀모집</span>
          <span style={{fontSize:12,color:"#374151",fontWeight:600}}>지방 청년 주거지원 제안 팀모집</span>
        </div>
      </div>
    )},
  {icon:"person",accent:"#E11D48",iconBg:"#FFE4E6",bg:"#FFF1F2",border:"#FFE1E6",
    label:"마이페이지",
    title:"마이페이지 하나로 신청 현황부터 맞춤 추천까지",
    desc:"관심 정책은 별표로 저장해두고 준비중 → 지원완료 → 심사중 → 결과대기 → 완료 단계를 체크하며 관리해요. 지역·나이·소득·학력 등 맞춤 조건을 설정하면 나를 위한 정책이 실시간으로 채워지고, 내가 쓴 커뮤니티 글과 정책제안도 한곳에서 모아볼 수 있어요.",
    mockup:(
      <div style={aboutStyles.mockCard}>
        <div style={{display:"flex",gap:4,padding:5,background:"#F1F5F9",borderRadius:10,marginBottom:14}}>
          {[{l:"맞춤 조건",a:false},{l:"신청 내역",a:true},{l:"저장한 정책",a:false},{l:"내가 쓴 글",a:false}].map(t=>(
            <span key={t.l} style={{flex:1,textAlign:"center",padding:"6px 4px",borderRadius:7,fontSize:10,fontWeight:t.a?800:500,color:t.a?"#E11D48":"#94a3b8",background:t.a?"white":"transparent",boxShadow:t.a?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>{t.l}</span>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <Icon name="bookmark" size={16} color="#E11D48"/>
          <span style={{fontSize:13,fontWeight:800,color:"#111827"}}>청년 월세 한시 특별지원</span>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["준비중","지원완료","심사중","결과대기","완료"].map((s,i)=>(
            <span key={s} style={{borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:700,background:i===1?"#FFE4E6":"#f3f4f6",color:i===1?"#E11D48":"#9ca3af"}}>{s}</span>
          ))}
        </div>
      </div>
    )},
];

const TESTIMONIALS=[
  {name:"김OO",age:24,location:"서울시 OO구 거주",
    quote:"자취방 월세가 부담됐는데 지원 조건이 복잡해서 포기하려던 참이었어요. 청년ON 정책제안 게시판에 글을 올렸더니 비슷한 처지의 청년들이 모여 함께 다듬었고, 결국 지자체 조례에 실제로 반영됐어요. 제 목소리가 정책이 될 수 있다는 걸 처음 경험했습니다.",
    policy:"청년 월세 한시 특별지원 확대"},
  {name:"이OO",age:27,location:"경기 OO시 거주",
    quote:"창업 초기엔 자금보다 정보가 더 부족했어요. 제안 글에 달린 댓글들 덕분에 놓치고 있던 지원 조건을 알게 됐고, 그 내용을 반영해 다시 제안했더니 실제로 바우처 지원 대상 범위가 넓어졌습니다.",
    policy:"청년 창업 지원 바우처 확대"},
  {name:"박OO",age:29,location:"부산 OO구 거주",
    quote:"전세임대 조건이 지역 사정을 잘 반영하지 못한다고 느껴서 올린 글이었는데, 담당 부처까지 전달돼서 실제로 요건이 완화됐어요. 청년ON이 아니었으면 어디에 말해야 할지도 몰랐을 거예요.",
    policy:"청년 전세임대주택 입주요건 완화"},
];

function AdoptedProposalCard({t,isDesktop}){
  return(
    <div style={{background:"white",border:"1.5px solid #DCFCE7",borderRadius:24,padding:isDesktop?"32px 36px":"22px 20px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",width:"100%",boxSizing:"border-box",minHeight:isDesktop?400:"auto",display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        <span style={{width:48,height:48,borderRadius:"50%",background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon name="person" size={26} color="#94a3b8"/>
        </span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:800,color:"#111827"}}>{t.name}, {t.age}세</div>
          <div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>{t.location}</div>
        </div>
        <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,padding:"4px 11px",borderRadius:20,background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0",flexShrink:0}}>
          <Icon name="task_alt" size={13} color="#15803D"/>채택됨
        </span>
      </div>
      <p style={{fontSize:14,lineHeight:1.85,color:"#374151",margin:"0 0 20px",fontStyle:"italic"}}>“{t.quote}”</p>
      <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:16,borderTop:"1px solid #f1f5f9",flexWrap:"wrap"}}>
        <span style={{fontSize:11,fontWeight:700,color:"#9ca3af"}}>채택 정책</span>
        <span style={{fontSize:13,fontWeight:700,color:"#15803D"}}>{t.policy}</span>
      </div>
    </div>
  );
}

function TestimonialCarousel({isDesktop}){
  const total=TESTIMONIALS.length;
  const [idx,setIdx]=useState(0);
  const touchStartX=useRef(null);

  const goPrev=()=>setIdx(i=>(i-1+total)%total);
  const goNext=()=>setIdx(i=>(i+1)%total);

  const onTouchStart=e=>{touchStartX.current=e.touches[0].clientX;};
  const onTouchEnd=e=>{
    if(touchStartX.current==null)return;
    const dx=e.changedTouches[0].clientX-touchStartX.current;
    if(dx>50)goPrev();
    else if(dx<-50)goNext();
    touchStartX.current=null;
  };

  const navBtn={
    position:"absolute",top:"50%",transform:"translateY(-50%)",zIndex:2,
    width:isDesktop?40:34,height:isDesktop?40:34,borderRadius:"50%",
    border:"1.5px solid #e5e7eb",background:"white",color:"#374151",cursor:"pointer",
    display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(0,0,0,0.08)",
    transition:"all 0.12s",
  };

  if(total===0)return null;

  return(
    <div style={{position:"relative"}}>
      {total>1&&(
        <>
          <button onClick={goPrev} aria-label="이전 후기" style={{...navBtn,left:isDesktop?-20:-6}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#15803D";e.currentTarget.style.color="#15803D";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e7eb";e.currentTarget.style.color="#374151";}}
          ><Icon name="chevron_left" size={isDesktop?20:16} color="currentColor"/></button>
          <button onClick={goNext} aria-label="다음 후기" style={{...navBtn,right:isDesktop?-20:-6}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#15803D";e.currentTarget.style.color="#15803D";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e7eb";e.currentTarget.style.color="#374151";}}
          ><Icon name="chevron_right" size={isDesktop?20:16} color="currentColor"/></button>
        </>
      )}
      <div style={{overflow:"hidden",borderRadius:24}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div style={{display:"flex",transform:`translateX(-${idx*100}%)`,transition:"transform 0.4s ease"}}>
          {TESTIMONIALS.map((t,i)=>(
            <div key={i} style={{flex:"0 0 100%",boxSizing:"border-box",padding:2}}>
              <AdoptedProposalCard t={t} isDesktop={isDesktop}/>
            </div>
          ))}
        </div>
      </div>
      {total>1&&(
        <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:18}}>
          {TESTIMONIALS.map((_,i)=>(
            <button key={i} onClick={()=>setIdx(i)} aria-label={`${i+1}번째 후기로 이동`} style={{
              width:idx===i?22:8,height:8,borderRadius:4,border:"none",padding:0,cursor:"pointer",
              background:idx===i?"#15803D":"#e2e8f0",transition:"all 0.2s",
            }}/>
          ))}
        </div>
      )}
    </div>
  );
}

function AboutCard({data,index,isDesktop}){
  const reverse=isDesktop&&index%2===1;
  return(
    <div style={{
      display:"flex",flexDirection:isDesktop?(reverse?"row-reverse":"row"):"column",
      alignItems:"center",gap:isDesktop?44:20,
      minHeight:isDesktop?400:"auto",
      borderRadius:28,border:`1px solid ${data.border}`,background:data.bg,
      padding:isDesktop?"40px 44px":"26px 22px",
      boxShadow:"0 1px 3px rgba(0,0,0,0.05)",
      width:"100%",boxSizing:"border-box",
    }}>
      <div style={{flex:1,width:"100%"}}>
        <span style={{display:"inline-flex",width:56,height:56,borderRadius:18,background:data.iconBg,alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <Icon name={data.icon} size={28} color={data.accent}/>
        </span>
        <div style={{fontSize:isDesktop?21:18,fontWeight:800,color:"#111827",marginBottom:10,lineHeight:1.4,wordBreak:"keep-all"}}>{data.title}</div>
        <div style={{fontSize:14,color:"#4b5563",lineHeight:1.75}}>{data.desc}</div>
      </div>
      <div style={{flex:1,width:"100%"}}>
        {data.mockup}
      </div>
    </div>
  );
}

function AboutCarousel({isDesktop}){
  const total=ABOUT_CARDS.length;
  const [idx,setIdx]=useState(0);
  const touchStartX=useRef(null);

  const goPrev=()=>setIdx(i=>(i-1+total)%total);
  const goNext=()=>setIdx(i=>(i+1)%total);

  const onTouchStart=e=>{touchStartX.current=e.touches[0].clientX;};
  const onTouchEnd=e=>{
    if(touchStartX.current==null)return;
    const dx=e.changedTouches[0].clientX-touchStartX.current;
    if(dx>50)goPrev();
    else if(dx<-50)goNext();
    touchStartX.current=null;
  };

  const navBtn={
    position:"absolute",top:"50%",transform:"translateY(-50%)",zIndex:2,
    width:isDesktop?44:36,height:isDesktop?44:36,borderRadius:"50%",
    border:"1.5px solid #e5e7eb",background:"white",color:"#374151",cursor:"pointer",
    display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(0,0,0,0.08)",
    transition:"all 0.12s",
  };

  return(
    <div>
      <HScrollFade style={{gap:4,padding:6,background:"#EEF2F7",borderRadius:12,marginBottom:16}} fadeColor="#EEF2F7">
        {ABOUT_CARDS.map((c,i)=>(
          <button key={i} onClick={()=>setIdx(i)} style={{
            flex:"1 0 auto",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            padding:isDesktop?"10px 18px":"9px 14px",fontSize:isDesktop?14:13,lineHeight:1,
            cursor:"pointer",border:"none",borderRadius:9,whiteSpace:"nowrap",transition:"all 0.15s",
            color:idx===i?c.accent:"#6b7280",fontWeight:idx===i?700:500,
            background:idx===i?"#ffffff":"transparent",
            boxShadow:idx===i?"0 1px 4px rgba(0,0,0,0.10)":"none",
          }}>
            {c.label}
          </button>
        ))}
      </HScrollFade>
      <div style={{position:"relative"}}>
      <button onClick={goPrev} aria-label="이전" style={{...navBtn,left:isDesktop?-22:-8}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e7eb";e.currentTarget.style.color="#374151";}}
      ><Icon name="chevron_left" size={isDesktop?22:18} color="currentColor"/></button>
      <button onClick={goNext} aria-label="다음" style={{...navBtn,right:isDesktop?-22:-8}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e7eb";e.currentTarget.style.color="#374151";}}
      ><Icon name="chevron_right" size={isDesktop?22:18} color="currentColor"/></button>

      <div style={{overflow:"hidden",borderRadius:28}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div style={{display:"flex",transform:`translateX(-${idx*100}%)`,transition:"transform 0.4s ease"}}>
          {ABOUT_CARDS.map((c,i)=>(
            <div key={i} style={{flex:"0 0 100%",boxSizing:"border-box",padding:2}}>
              <AboutCard data={c} index={i} isDesktop={isDesktop}/>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:22}}>
        {ABOUT_CARDS.map((_,i)=>(
          <button key={i} onClick={()=>setIdx(i)} aria-label={`${i+1}번째로 이동`} style={{
            width:idx===i?22:8,height:8,borderRadius:4,border:"none",padding:0,cursor:"pointer",
            background:idx===i?"var(--accent)":"#e2e8f0",transition:"all 0.2s",
          }}/>
        ))}
      </div>
      <div style={{textAlign:"center",marginTop:8,fontSize:12,color:"#9ca3af",fontWeight:700}}>{idx+1} / {total}</div>
      </div>
    </div>
  );
}

function AboutPage({onBack,bp}){
  const isDesktop=bp?.isDesktop;
  const h=isDesktop?56:52;

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#F5F9FC",fontFamily:"'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif"}}>
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:isDesktop?"0 40px":"0 18px",flexShrink:0}}>
        <div style={{height:h,display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"#374151",fontSize:14,fontWeight:600,padding:"8px 0",transition:"color 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"}
            onMouseLeave={e=>e.currentTarget.style.color="#374151"}
          ><Icon name="arrow_back" size={16} color="currentColor"/> 돌아가기</button>
          <span style={{color:"#e5e7eb"}}>|</span>
          <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>청년ON 알아보기</span>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,var(--accent-dark),var(--accent))",color:"white",padding:isDesktop?"64px 40px 56px":"44px 20px 36px",textAlign:"center"}}>
          <span style={{display:"inline-block",background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"4px 16px",fontSize:13,fontWeight:700,marginBottom:18}}>청년ON 기능 둘러보기</span>
          <h2 style={{fontSize:isDesktop?36:24,fontWeight:900,margin:"0 0 14px",lineHeight:1.3,letterSpacing:"-0.02em"}}>정책 찾기부터 신청 관리, 커뮤니티까지<br/>청년ON 하나로 끝내보세요</h2>
          <p style={{fontSize:isDesktop?15:13,opacity:0.85,maxWidth:520,margin:"0 auto",lineHeight:1.7}}>양옆으로 넘기면서 청년ON의 기능을 하나씩 살펴보세요.</p>
        </div>

        <div style={{maxWidth:1100,margin:"0 auto",padding:isDesktop?"48px 64px 40px":"28px 26px 24px"}}>
          <AboutCarousel isDesktop={isDesktop}/>
        </div>

        <div style={{maxWidth:1100,margin:"0 auto",padding:isDesktop?"40px 64px 40px":"24px 18px 24px"}}>
          <h3 style={{fontSize:isDesktop?22:18,fontWeight:800,color:"#111827",textAlign:"center",margin:"0 0 8px"}}>실제 정책제안 후기</h3>
          <p style={{fontSize:13,color:"#6b7280",textAlign:"center",margin:"0 0 24px"}}>청년ON에 올라온 제안이 실제 정책으로 이어진 이야기예요.</p>
          <TestimonialCarousel isDesktop={isDesktop}/>
        </div>

        <div style={{maxWidth:1100,margin:"0 auto",padding:isDesktop?"40px 64px 64px":"24px 18px 48px",borderTop:"1px solid #eef2f7"}}>
          <h3 style={{fontSize:isDesktop?22:18,fontWeight:800,color:"#111827",textAlign:"center",margin:"0 0 20px"}}>자주 묻는 질문</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[{q:"로그인 없이 이용할 수 있나요?",a:"정책 검색과 AI 챗봇은 로그인 없이 이용 가능합니다. 정책 저장, 체크리스트, 맞춤 추천, 커뮤니티 글쓰기·참가하기 기능은 로그인 후 이용하실 수 있어요."},
              {q:"비용이 드나요?",a:"청년ON의 모든 기능은 무료로 이용하실 수 있습니다."},
              {q:"정책제안 팀모집에 참가하면 바로 연락이 오나요?",a:"참가하기를 누르면 담당자가 개별로 연락드릴 예정이라는 안내가 뜨고, 게시글 작성자에게 참가 정보가 전달됩니다."},
              {q:"저장한 정책이 사라졌어요.",a:"로그인 상태에서 저장한 정책은 계정에 연동됩니다. 로그아웃 후 다시 로그인하면 저장 목록과 캘린더 표시를 그대로 확인할 수 있어요."},
            ].map((it,i)=><FAQItem key={i} q={it.q} a={it.a}/>)}
          </div>
          <div style={{textAlign:"center",padding:"32px 0 0"}}>
            <button onClick={onBack} style={{background:"var(--accent)",color:"white",border:"none",borderRadius:14,padding:"14px 36px",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 20px var(--accent-shadow)",transition:"opacity 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}
            >지금 정책 찾아보기 →</button>
          </div>
        </div>

        <div style={{textAlign:"center",padding:"24px 18px 32px",background:"#111827",color:"#ffffff",fontSize:12}}>
          <div>© 2026 청년ON. All rights reserved.</div>
          <div style={{marginTop:6,color:"#9ca3af"}}>개발자: 최윤경(Choi Yoon Kyoung) · ykchoi1020@gmail.com</div>
        </div>
      </div>
    </div>
  );
}

function ThemeStyle({color,colorDark,colorBg,colorBgActive,colorShadow,orbColor1,orbColor2,headerBg,bodyBg}){
  return <style>{`:root{--accent:${color};--accent-dark:${colorDark};--accent-bg:${colorBg};--accent-bg-active:${colorBgActive};--accent-shadow:${colorShadow};--orb1:${orbColor1};--orb2:${orbColor2};--header-bg:${headerBg};--body-bg:${bodyBg}}`}</style>;
}

function PaletteDots({themeKey,onChange}){
  return(
    <div style={{display:'flex',gap:5,alignItems:'center',marginRight:6}}>
      {THEMES.map(t=>{
        const isWhite=t.key==='white';
        const dotBg=isWhite?'#ffffff':t.color;
        const ringColor=isWhite?'#9ca3af':t.color;
        const selected=themeKey===t.key;
        return(
          <button key={t.key} onClick={()=>onChange(t.key)} title={t.title} style={{
            width:14,height:14,borderRadius:'50%',padding:0,cursor:'pointer',flexShrink:0,
            background:dotBg,
            border:isWhite?'1.5px solid #d1d5db':'none',
            boxShadow:selected
              ?`0 0 0 2px white,0 0 0 3.5px ${ringColor}`
              :(isWhite?'none':'0 0 0 1.5px rgba(0,0,0,0.12)'),
            transition:'box-shadow 0.15s',
          }}/>
        );
      })}
    </div>
  );
}

function FontSizeControl({scale,onInc,onDec}){
  const btnStyle=(disabled)=>({
    width:22,height:22,borderRadius:6,border:'1px solid #e2e8f0',background:'white',
    color:disabled?'#d1d5db':'#374151',fontSize:14,fontWeight:700,cursor:disabled?'default':'pointer',
    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:0,
    lineHeight:1,transition:'all 0.12s',
  });
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,marginRight:4}}>
      <div style={{display:'flex',alignItems:'center',gap:3}}>
        <button onClick={onDec} disabled={scale<=0.85} style={btnStyle(scale<=0.85)}>−</button>
        <span style={{fontSize:11,color:'#9ca3af',width:30,textAlign:'center',fontWeight:600}}>{Math.round(scale*100)}%</span>
        <button onClick={onInc} disabled={scale>=1.2} style={btnStyle(scale>=1.2)}>+</button>
      </div>
      <span style={{fontSize:9,color:'#111827',fontWeight:500,letterSpacing:'0.02em'}}>배율조정</span>
    </div>
  );
}

function MobileSettingsMenu({fontScale,onFontInc,onFontDec,themeKey,onThemeChange}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{
    if(!open)return;
    const handle=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handle);
    return()=>document.removeEventListener("mousedown",handle);
  },[open]);

  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} title="화면 설정"
        style={{width:28,height:28,borderRadius:"50%",background:open?"#f1f5f9":"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}
      >
        <Icon name="more_horiz" size={18} color="#6b7280"/>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"white",borderRadius:14,border:"1.5px solid #e5e7eb",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",padding:"12px 14px",zIndex:200,animation:"fadeUp 0.15s ease",display:"flex",alignItems:"center",gap:14}}>
          <FontSizeControl scale={fontScale} onInc={onFontInc} onDec={onFontDec}/>
          <PaletteDots themeKey={themeKey} onChange={onThemeChange}/>
        </div>
      )}
    </div>
  );
}

function TopNav({page,setPage,favIds,user,onLogout,themeKey,onThemeChange,fontScale,onFontInc,onFontDec,onLogoClick}){
  const mainPage=page==="detail"?"":["search","chatbot","mypage","community","proposal"].find(p=>page.startsWith(p))||"search";
  return(
    <header style={{background:'var(--header-bg,white)',borderBottom:"1px solid #e5e7eb",padding:"0 20px",position:"sticky",top:0,zIndex:50}}>
      <div style={{height:56,display:"flex",alignItems:"center",gap:0}}>
        <button onClick={onLogoClick} style={{display:"flex",alignItems:"center",gap:9,marginRight:24,background:"none",border:"none",cursor:"pointer",padding:0}}>
          <img src={import.meta.env.BASE_URL + 'logo.png'} alt="청년ON" style={{width:30,height:30,borderRadius:9}}/>
          <div style={{fontWeight:900,fontSize:15,color:"#111827"}}>청년ON</div>
        </button>
        <nav style={{display:"flex",gap:2,flex:1}}>
          {NAV_ITEMS.map(n=>(
            <button key={n.page} onClick={()=>setPage(n.page)} style={{display:"flex",alignItems:"center",gap:5,padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",background:mainPage===n.page?"#f8fafc":"transparent",color:mainPage===n.page?"#111827":"#6b7280",fontSize:13,fontWeight:mainPage===n.page?700:500,transition:"all 0.15s"}}>
              <Icon name={n.icon} size={15} color={mainPage===n.page?"#111827":"#6b7280"}/>{n.label}
              {n.page==="mypage"&&favIds.size>0&&<span style={{marginLeft:2,fontSize:11,background:'var(--accent)',color:"#fff",borderRadius:99,padding:"1px 6px"}}>{favIds.size}</span>}
            </button>
          ))}
        </nav>
        <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:8}}>
          {!user&&onFontInc&&<FontSizeControl scale={fontScale} onInc={onFontInc} onDec={onFontDec}/>}
          {!user&&onThemeChange&&<PaletteDots themeKey={themeKey} onChange={onThemeChange}/>}
          {user?(
            <NavUserDropdown user={user} onLogout={onLogout} onGoMyPage={()=>setPage("mypage")} favCount={favIds.size} fontScale={fontScale} onFontInc={onFontInc} onFontDec={onFontDec} themeKey={themeKey} onThemeChange={onThemeChange}/>
          ):(
            <>
              <button onClick={()=>setPage("signup")} style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#374151",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#374151";}}
              >회원가입</button>
              <button onClick={()=>setPage("login")} style={{padding:"7px 16px",borderRadius:8,border:"none",background:'var(--accent)',color:"white",fontSize:13,fontWeight:600,cursor:"pointer",transition:"opacity 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >로그인</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav({page,setPage,user}){
  const mainPage=["search","chatbot","mypage","community","proposal"].find(p=>page.startsWith(p))||"search";
  const visibleItems=NAV_ITEMS.filter(n=>n.page!=="mypage"||user);
  return(
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:'var(--header-bg,white)',borderTop:"1px solid #e5e7eb",display:"flex",zIndex:50,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {visibleItems.map(n=>(
        <button key={n.page} onClick={()=>setPage(n.page)} style={{flex:1,padding:"10px 0 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:mainPage===n.page?'var(--accent)':'#718096',transition:"color 0.15s"}}>
          <Icon name={n.icon} size={22} color={mainPage===n.page?'var(--accent)':'#718096'}/>
          <span style={{fontSize:10,fontWeight:mainPage===n.page?700:500}}>{n.label}</span>
          {mainPage===n.page&&<div style={{width:18,height:2.5,background:'var(--accent)',borderRadius:2,marginTop:1}}/>}
        </button>
      ))}
    </nav>
  );
}

// ─── 루트 ─────────────────────────────────────────────────────────────────

const GLOBAL_CSS=`
  .material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;}
  *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body{margin:0;padding:0;height:100%;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  .proposal-onboarding-scroll::-webkit-scrollbar{display:none;}
  input[type=search]::-webkit-search-cancel-button{-webkit-appearance:none;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes floatOrb{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,-14px)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes micRing{0%{box-shadow:0 0 0 0 rgba(220,38,38,0.35)}100%{box-shadow:0 0 0 10px rgba(220,38,38,0)}}
  @keyframes tickerFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  @keyframes guideWiggle{0%,92%,100%{transform:rotate(0deg)}93%{transform:rotate(-6deg)}94.5%{transform:rotate(5deg)}96%{transform:rotate(-4deg)}97.5%{transform:rotate(3deg)}99%{transform:rotate(0deg)}}
  @keyframes pingRing{0%{transform:scale(1);opacity:0.6}75%,100%{transform:scale(1.9);opacity:0}}
`;

export default function App(){
  const [page,setPage]=useState("chatbot");
  const [detailPolicy,setDetailPolicy]=useState(null);
  const [fromPage,setFromPage]=useState("chatbot");
  const [favIds,setFavIds]=useLocalStorage("yoa:favs",new Set());
  const [communitySub,setCommunitySub]=useLocalStorage("yoa:communitySub","후기");
  const [themeKey,setThemeKey]=useLocalStorage("yoa:theme","blue");
  const [fontScale,setFontScale]=useLocalStorage("yoa:fontscale",1);
  const [user,setUser]=useState(null);
  const [sidebarOpen,setSidebarOpenRaw]=useState(true);
  const autoCollapseRef=useRef(null);
  useEffect(()=>{
    autoCollapseRef.current=setTimeout(()=>setSidebarOpenRaw(false),1400);
    return()=>clearTimeout(autoCollapseRef.current);
  },[]);
  const setSidebarOpen=useCallback(updater=>{
    if(autoCollapseRef.current){clearTimeout(autoCollapseRef.current);autoCollapseRef.current=null;}
    setSidebarOpenRaw(updater);
  },[]);
  const bp=useBreakpoint();
  const theme=THEMES.find(t=>t.key===themeKey)||THEMES[0];

  const incFontRaw=useCallback(()=>setFontScale(s=>Math.min(+(s+0.05).toFixed(2),1.2)),[setFontScale]);
  const decFontRaw=useCallback(()=>setFontScale(s=>Math.max(+(s-0.05).toFixed(2),0.85)),[setFontScale]);
  const incFont=ZOOM_SUPPORTED?incFontRaw:undefined;
  const decFont=ZOOM_SUPPORTED?decFontRaw:undefined;

  useEffect(()=>{
    if(!ZOOM_SUPPORTED)return;
    document.documentElement.style.zoom=fontScale;
    document.documentElement.style.setProperty('--font-scale',fontScale);
    return()=>{
      document.documentElement.style.zoom='';
      document.documentElement.style.removeProperty('--font-scale');
    };
  },[fontScale]);

  useEffect(()=>{
    document.body.style.background=theme.bodyBg;
    return()=>{document.body.style.background='';};
  },[theme]);

  const favSyncedRef=useRef(false);
  useEffect(()=>{
    const init=u=>{
      setUser(u);
      if(!u){favSyncedRef.current=false;return;}
      if(favSyncedRef.current)return; // 최초 1회만 동기화
      favSyncedRef.current=true;
      const remote=u.user_metadata?.saved_policies;
      setFavIds(prev=>{
        const merged=Array.isArray(remote)?new Set([...prev,...remote]):prev;
        if(merged.size!==(Array.isArray(remote)?remote.length:0))
          supabase.auth.updateUser({data:{saved_policies:[...merged]}}).catch(()=>{});
        return merged;
      });
    };
    supabase.auth.getSession().then(({data:{session}})=>init(session?.user??null));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>init(session?.user??null));
    return()=>subscription.unsubscribe();
  },[]);

  const handleLogout=useCallback(async()=>{
    await supabase.auth.signOut();
    setUser(null);
  },[]);

  const toggleFav=useCallback(id=>{
    setFavIds(prev=>{
      console.log('[toggleFav] id=',id,'prev has?',prev.has(id),'prev size=',prev.size);
      const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);
      console.log('[toggleFav] next size=',next.size,'has?',next.has(id));
      if(user)supabase.auth.updateUser({data:{saved_policies:[...next]}}).catch(()=>{});
      return next;
    });
  },[setFavIds,user]);

  const goDetail=useCallback(policy=>{
    setFromPage(page);
    setDetailPolicy(policy);
    setPage("detail");
    history.replaceState({},"",`${window.location.pathname}?policy=${policy.id}`);
  },[page]);

  const goBack=useCallback(()=>{
    setDetailPolicy(null);
    setPage(fromPage);
    history.replaceState({},"",window.location.pathname);
  },[fromPage]);

  const goDetailFromDetail=useCallback(policy=>{
    setDetailPolicy(policy);
    window.scrollTo({top:0,behavior:"smooth"});
  },[]);

  const isDetail=page==="detail"&&detailPolicy;

  const [policies,setPolicies]=useState(POLICIES);
  useEffect(()=>{
    loadPolicies()
      .then(data=>{
        const arr=Array.isArray(data)?data:[];
        const mapped=arr.reduce((acc,raw,idx)=>{
          try{acc.push(mapRawPolicy(raw,idx));}catch(e){}
          return acc;
        },[]);
        if(mapped.length>0)setPolicies(mapped);
      })
      .catch(()=>{});
  },[]);

  useEffect(()=>{
    if(policies.length<=12)return;
    const id=new URLSearchParams(window.location.search).get("policy");
    if(!id)return;
    const found=policies.find(p=>p.id===id);
    if(found)goDetail(found);
  },[policies]);

  const viewProps={favIds,onToggleFav:toggleFav,onGoDetail:goDetail,bp,setPage,policies,user};

  // 페이지 전환 시 상세 닫기
  const navigateTo=useCallback(p=>{
    setDetailPolicy(null);
    setPage(p);
  },[]);

  const navigateToTab=useCallback(p=>{
    if(p==="community")setCommunitySub("후기");
    navigateTo(p);
  },[navigateTo,setCommunitySub]);

  const onNotifNavigate=useCallback((linkType,linkId)=>{
    if(linkType==="post"){
      history.replaceState({},"",window.location.pathname+"?post="+linkId);
      navigateTo("community");
    }else if(linkType==="proposal"){
      history.replaceState({},"",window.location.pathname+"?proposal="+linkId);
      navigateTo("proposal");
    }else if(linkType==="policy"){
      const found=policies.find(p=>String(p.id)===String(linkId));
      if(found)goDetail(found);
    }
  },[navigateTo,policies,goDetail]);

  // 로고 클릭: 챗봇 홈으로 이동 + 대화 중이었다면 첫 화면으로 리셋
  const [chatResetKey,setChatResetKey]=useState(0);
  const goHome=useCallback(()=>{
    setDetailPolicy(null);
    setPage("chatbot");
    setChatResetKey(k=>k+1);
  },[]);

  const [adminMode,setAdminMode]=useState(()=>window.location.hash==="#admin");
  useEffect(()=>{
    const onHash=()=>setAdminMode(window.location.hash==="#admin");
    window.addEventListener("hashchange",onHash);
    return ()=>window.removeEventListener("hashchange",onHash);
  },[]);
  if(adminMode){
    const exitAdmin=()=>{
      history.replaceState({},"",window.location.pathname);
      setAdminMode(false);
    };
    return <AdminShell user={user} onExit={exitAdmin}/>;
  }

  if(page==="login"){
    return(
      <>
        <style>{GLOBAL_CSS}</style>
        <ThemeStyle color={theme.color} colorDark={theme.colorDark} colorBg={theme.colorBg} colorBgActive={theme.colorBgActive} colorShadow={theme.colorShadow} orbColor1={theme.orbColor1} orbColor2={theme.orbColor2} headerBg={theme.headerBg} bodyBg={theme.bodyBg}/>
        <LoginPage setPage={navigateTo} bp={bp}/>
      </>
    );
  }

  if(page==="signup"){
    return(
      <>
        <style>{GLOBAL_CSS}</style>
        <ThemeStyle color={theme.color} colorDark={theme.colorDark} colorBg={theme.colorBg} colorBgActive={theme.colorBgActive} colorShadow={theme.colorShadow} orbColor1={theme.orbColor1} orbColor2={theme.orbColor2} headerBg={theme.headerBg} bodyBg={theme.bodyBg}/>
        <SignupPage setPage={navigateTo} bp={bp}/>
      </>
    );
  }

  if(page==="about"){
    return(
      <div style={{height:"calc(100vh / var(--font-scale,1))",overflow:"hidden",display:"flex",flexDirection:"column",fontFamily:"'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif"}}>
        <style>{GLOBAL_CSS}</style>
        <ThemeStyle color={theme.color} colorDark={theme.colorDark} colorBg={theme.colorBg} colorBgActive={theme.colorBgActive} colorShadow={theme.colorShadow} orbColor1={theme.orbColor1} orbColor2={theme.orbColor2} headerBg={theme.headerBg} bodyBg={theme.bodyBg}/>
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <AboutPage onBack={()=>navigateTo("chatbot")} bp={bp}/>
        </div>
      </div>
    );
  }

  if(bp.isDesktop){
    return(
      <div style={{display:"flex",height:"calc(100vh / var(--font-scale, 1))",overflow:"hidden",fontFamily:"'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif"}}>
        <style>{GLOBAL_CSS}</style>
        <ThemeStyle color={theme.color} colorDark={theme.colorDark} colorBg={theme.colorBg} colorBgActive={theme.colorBgActive} colorShadow={theme.colorShadow} orbColor1={theme.orbColor1} orbColor2={theme.orbColor2} headerBg={theme.headerBg} bodyBg={theme.bodyBg}/>
        <Sidebar page={page} setPage={navigateToTab} favIds={favIds} user={user} open={sidebarOpen} setOpen={setSidebarOpen} onLogoClick={goHome}/>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {!isDetail&&(
            <div style={{background:'var(--header-bg,white)',borderBottom:"1px solid #e5e7eb",padding:"0 32px",flexShrink:0}}>
              <div style={{height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:15,fontWeight:700,color:"#111827",display:"flex",alignItems:"center",gap:12}}>
                  {sidebarOpen?(
                    <>
                      {page==="search"&&<><Icon name="search" size={16} color="#111827"/> 검색</>}
                      {page==="chatbot"&&<><Icon name="auto_awesome" size={16} color="#111827"/> AI 챗봇</>}
                      {page==="mypage"&&<><Icon name="person" size={16} color="#111827"/> 마이페이지</>}
                      {page==="community"&&<><Icon name="forum" size={16} color="#111827"/> 커뮤니티</>}
                      {page==="proposal"&&<><Icon name="campaign" size={16} color="#111827"/> 청년정책 제안</>}
                    </>
                  ):(
                    <span onClick={goHome} style={{cursor:"pointer"}}>청년ON</span>
                  )}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {!user&&<FontSizeControl scale={fontScale} onInc={incFont} onDec={decFont}/>}
                  {!user&&<PaletteDots themeKey={themeKey} onChange={setThemeKey}/>}
                  <button onClick={()=>navigateTo("about")} style={{background:"none",border:"1.5px solid #e2e8f0",cursor:"pointer",color:"#6b7280",fontSize:13,fontWeight:600,padding:"5px 10px",borderRadius:8,transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#6b7280";}}
                  >청년ON 알아보기</button>
                  {user?(
                    <>
                      <NotificationBell user={user} favIds={favIds} policies={policies} onNavigate={onNotifNavigate}/>
                      <NavUserDropdown user={user} onLogout={handleLogout} onGoMyPage={()=>navigateTo("mypage")} favCount={favIds.size} fontScale={fontScale} onFontInc={incFont} onFontDec={decFont} themeKey={themeKey} onThemeChange={setThemeKey}/>
                    </>
                  ):(
                    <>
                      <button onClick={()=>navigateTo("signup")} style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#374151",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#374151";}}
                      >회원가입</button>
                      <button onClick={()=>navigateTo("login")} style={{padding:"7px 16px",borderRadius:8,border:"none",background:'var(--accent)',color:"white",fontSize:13,fontWeight:600,cursor:"pointer",transition:"opacity 0.15s"}}
                        onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
                        onMouseLeave={e=>e.currentTarget.style.opacity="1"}
                      >로그인</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {isDetail
              ?<div style={{flex:1,overflowY:"auto"}}><PolicyDetailView policy={detailPolicy} favIds={favIds} onToggle={toggleFav} onBack={goBack} onGoDetail={goDetailFromDetail} bp={bp} policies={policies}/></div>
              :page==="search"    ?<div style={{flex:1,overflow:"hidden"}}><SearchView {...viewProps}/></div>
              :page==="chatbot"   ?<div style={{flex:1,overflow:"hidden"}}><ChatBotView bp={bp.isDesktop?'desktop':bp.isTablet?'tablet':'mobile'} favIds={favIds} onToggleFav={toggleFav} onGoDetail={goDetail} resetSignal={chatResetKey}/></div>
              :page==="mypage"    ?<div style={{flex:1,overflowY:"auto"}}><MyPageContainer supabaseUser={user} onLogout={handleLogout} initialTab="prefs" favIds={favIds} policies={policies} onToggleFav={toggleFav} onGoDetail={goDetail} onNavigate={onNotifNavigate}/></div>
              :page==="community" ?<div style={{flex:1,overflowY:"auto"}}><CommunityView bp={bp} user={user} policies={policies} favIds={favIds} onToggleFav={toggleFav} onGoProposal={()=>navigateTo("proposal")} onGoDetail={goDetail} initialCatFilter={communitySub}/></div>
              :page==="proposal"  ?<div style={{flex:1,overflowY:"auto"}}><PolicyProposalPage bp={bp} user={user} onGoCommunity={()=>{setCommunitySub("Q&A");navigateTo("community");}}/></div>
              :null
            }
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh / var(--font-scale, 1))",overflow:"hidden",fontFamily:"'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif"}}>
      <style>{GLOBAL_CSS}</style>
      <ThemeStyle color={theme.color} colorDark={theme.colorDark} colorBg={theme.colorBg} colorBgActive={theme.colorBgActive} colorShadow={theme.colorShadow} orbColor1={theme.orbColor1} orbColor2={theme.orbColor2} headerBg={theme.headerBg} bodyBg={theme.bodyBg}/>
      {!isDetail&&(
        bp.isTablet
          ?<TopNav page={page} setPage={navigateToTab} favIds={favIds} user={user} onLogout={handleLogout} themeKey={themeKey} onThemeChange={setThemeKey} fontScale={fontScale} onFontInc={incFont} onFontDec={decFont} onLogoClick={goHome}/>
          :(
            <header style={{background:'var(--header-bg,white)',borderBottom:"1px solid #e5e7eb",padding:"0 16px",position:"sticky",top:0,zIndex:50}}>
              <div style={{height:52,display:"flex",alignItems:"center",justifyContent:"space-between",gap:4}}>
                <div style={{display:"flex",alignItems:"center",gap:4,minWidth:0,flexShrink:1}}>
                  <button onClick={goHome} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0}}>
                    <img src={import.meta.env.BASE_URL + 'logo.png'} alt="청년ON" style={{width:30,height:30,borderRadius:9,flexShrink:0}}/>
                    <div style={{fontWeight:900,fontSize:15,color:"#111827",whiteSpace:"nowrap"}}>청년ON</div>
                  </button>
                  <button onClick={()=>navigateTo("about")} style={{background:"none",border:"none",cursor:"pointer",color:"#374151",fontSize:13,fontWeight:700,padding:"6px 8px",borderRadius:8,transition:"all 0.12s",whiteSpace:"nowrap",flexShrink:0}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}
                  >알아보기</button>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                  {!user&&<MobileSettingsMenu fontScale={fontScale} onFontInc={incFont} onFontDec={decFont} themeKey={themeKey} onThemeChange={setThemeKey}/>}
                  <div style={{fontSize:12,color:favIds.size>0?"#b45309":"#9ca3af",fontWeight:600,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap",flexShrink:0}}><Icon name="star" size={13} color={favIds.size>0?"#FFD200":"#9ca3af"}/>{favIds.size}건</div>
                  {user?.user_metadata?.role==="admin"&&(
                    <button onClick={()=>window.location.hash="#admin"} style={{padding:"5px 10px",borderRadius:7,border:"1px solid #fde68a",background:"#fffbeb",color:"#b45309",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",flexShrink:0}}><Icon name="admin_panel_settings" size={15} color="#b45309"/></button>
                  )}
                  {user
                    ?<NavUserDropdown user={user} onLogout={handleLogout} onGoMyPage={()=>navigateTo("mypage")} compact favCount={favIds.size} fontScale={fontScale} onFontInc={incFont} onFontDec={decFont} themeKey={themeKey} onThemeChange={setThemeKey}/>
                    :<button onClick={()=>navigateTo("login")} style={{padding:"5px 12px",borderRadius:7,border:"none",background:'var(--accent)',color:"white",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>로그인</button>
                  }
                </div>
              </div>
            </header>
          )
      )}


      <main style={{flex:1,overflow:"auto",paddingBottom:isDetail?0:"calc(62px + env(safe-area-inset-bottom))"}}>
        {isDetail
          ?<PolicyDetailView policy={detailPolicy} favIds={favIds} onToggle={toggleFav} onBack={goBack} onGoDetail={goDetailFromDetail} bp={bp} policies={policies}/>
          :page==="search"    ?<SearchView {...viewProps}/>
          :page==="chatbot"   ?<ChatBotView bp={bp.isDesktop?'desktop':bp.isTablet?'tablet':'mobile'} favIds={favIds} onToggleFav={toggleFav} onGoDetail={goDetail} resetSignal={chatResetKey}/>
          :page==="mypage"    ?<MyPageContainer supabaseUser={user} onLogout={handleLogout} initialTab="prefs" favIds={favIds} policies={policies} onToggleFav={toggleFav} onGoDetail={goDetail} onNavigate={onNotifNavigate}/>
          :page==="community" ?<CommunityView bp={bp} user={user} policies={policies} favIds={favIds} onToggleFav={toggleFav} onGoProposal={()=>navigateTo("proposal")} onGoDetail={goDetail} initialCatFilter={communitySub}/>
          :page==="proposal"  ?<PolicyProposalPage bp={bp} user={user} onGoCommunity={()=>{setCommunitySub("Q&A");navigateTo("community");}}/>
          :null
        }
      </main>
      {!isDetail&&<BottomNav page={page} setPage={navigateToTab} user={user}/>}
    </div>
  );
}
