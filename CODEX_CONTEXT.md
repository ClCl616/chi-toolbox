# Chi Toolbox 작업 컨텍스트

## 현재 상태 (2026-11-03)

- 기본 주소 `/`는 기존 도구 모음이고, 새 대시보드는 `/toolbox`다. 사용자는 기능을 더 개발한 뒤 기본 진입점을 전환하기로 했다.
- 11월 3일 Windows 배포 릴리스는 `20261103-162738-061-14eb28892d7c`이며 실행 코드 커밋은 `14eb288`이다. 운영 도메인의 새 로그인 검증 경로는 `/dev/login`, 기본 복귀 경로는 `/dev/dashboard`다. 기존 `/login`과 `/toolbox`도 제공한다.
- 로컬 브라우저에서 PC·모바일 배치, 필드 오류와 포커스, 요청 실패 후 재시도, 이메일 성공 시 복귀를 검사했다. 배포 후 Google 인증 시작·취소 복귀와 미인증 LMS API의 401을 확인했다. 사용자가 실제 계정으로 로그인한 뒤 테스트 대시보드에서 본인의 LMS 집계를 확인했다.
- 새 대시보드는 화면 크기와 카드 수에 맞춰 자동 배치한다. PC 카드 최대 크기는 360×240px이다. 예전 수동 편집·숨김·순서 저장은 자동 배치로 대체됐다.
- 두 카드는 `/toolbox/lms`에서 각각 새 소식·남은 과제 탭을 연다. 내부 탭 전환 시 URL을 유지하고 기존 과제 직접 주소도 지원한다.

## LMS 구현·운영

- 운영 API는 인증된 본인 계정에만 수집 자료와 읽음 상태를 제공한다. 별도 Notifier의 수집·비교 코드를 사용하는 전용 Windows 작업이 30분마다 실행된다. Discord 프로젝트는 별도로 운영한다.
- 서버의 `C:/Services/chi-toolbox-lms`에서 private(쿠키·SQLite·변환 상태)와 public(인증 API용 스냅샷·읽음 상태)을 분리한다. 웹 서비스 계정의 private 접근을 차단한다. NETWORK SERVICE 작업은 부팅/30분 트리거, 중복 실행 무시, 25분 상한으로 구성한다.
- 최초 수집은 기존 소식의 기준선과 과제 목록을 만든다. 이후 피드는 새 항목·변경·장애·복구를 기록한다. 제목의 표시 여부로 읽음을 저장하고 일반 소식과 상태 알림을 따로 집계한다. 제출은 학교 LMS에서 한다. 현재 툴박스에는 원본 열기 버튼이 없다.
- 11월 2일 검증 기록에서 첫 수집 성공, 소유 계정의 운영 과제 열람, 미인증 접근 차단, 웹 서비스 계정의 파일 권한 분리를 확인했다. 당시 구조·타입·린트·단위 검사, Python 수집 검사, 빌드·HTTP·브라우저 검사를 통과했다. 실행·재로그인 절차는 [LMS 문서](docs/LMS_LOCAL.md), 서버 작업은 [Windows 운영 문서](deploy/windows/README.md)를 따른다.

## 다음 작업과 확인 시점

- **다음 개발 순서** 로그인 화면의 실계정 검증을 마쳤다. 다음은 회원가입 화면의 입력·오류·확인 메일 안내 흐름을 정하는 작업이며, 그다음은 설정 화면이다. 화면별 완료 기준은 [MVP 범위](docs/MVP.md)에 기록했다.
- **세 화면 완료 후** 삼성 헬스 연동과 가계부의 우선순위를 다시 논의한다.
- **실제 새 소식·과제 변경 발생 시** 대시보드 집계, 피드·기한 반영, 읽음 저장과 재방문 위치를 확인한다.
- **실제 세션 만료 또는 예정된 재부팅 시** 재로그인 후 수집 복구와 예약 작업 자동 시작을 확인한다. 누적 이력 보관·페이지네이션과 과목 교체 시 정리 정책은 후속 사항이다.
- **추가 개발 후** 기본 진입점 전환을 진행한다.

## 주요 변경 이력

| 시점 | 변경 |
| --- | --- |
| 10월 29일 | 기능별 구조 개편 후 `/toolbox`에 공통 UI·빈 화면과 수동 카드 편집을 도입했다. |
| 11월 1일 | `afd6621`에서 자동 배치와 가로 스크롤을 도입했다. |
| 11월 2일 | LMS 수집·피드·과제 화면에 이어 `bf924bc`에서 운영 소유권 검증과 Windows 수집 작업을 추가했다. `94b14fd`에서 카드 크기와 LMS 탭 이동·연결 헤더를 조정했다. |

## 시작 순서와 문서 역할

1. AGENTS.md와 이 문서를 끝까지 읽고 git status -sb / git log -7 --oneline을 확인한다. 기존 dirty 변경은 보존한다.
2. README.md는 설치·검증 시작점, docs/ARCHITECTURE.md는 구조·기능 추가 기준, deploy/windows/README.md는 운영 절차다.
3. Node 24 LTS >=24.13.0 <25와 npm/Git을 준비하고 npm.cmd ci로 복원한다. 현재 개발 PC 경로는 C:/Projects/chi-toolbox다. 이전 확인 런타임은 Node 24.20.0 / npm 11.19.0이다.
4. 실제 앱에는 별도 .env.local이 필요하다. 현재 개발 PC에는 없다. 운영 Supabase를 설정하면 로컬 CRUD도 실데이터 변경이다.
5. SSH/Tailscale 및 chi-server 별칭·인증은 저장소로 복원되지 않는다. 서버의 환경 파일과 worker 키는 이미 준비되어 있으며 재입력하지 않는다.

## 이번 구조 개편

- 기능별 features, 기능 독립 shared, 조합 shell, 얇은 app 라우트로 분리했다. 자세한 진단·규칙은 ARCHITECTURE.md 참조.
- 공통 인증/오류 경계 withAuth, 캘린더 전용 데이터 갱신 훅, 단일 화면 registry, 독립 업로드 훅·폴더 경로 함수·기능 타입을 적용했다.
- 미사용 UI·브라우저 Supabase 클라이언트 56개와 사용되지 않는 FeatureLayout을 제거했다. 사용 중인 DataNotice와 UI는 보존했다.
- tests/unit, tests/browser, tests/database로 검사 목적을 분리했다. npm run check가 구조 경계·타입·lint·단위 검사를 수행한다. CI는 Windows에서 dummy build/smoke/browser까지 검사하고 배포는 하지 않는다.
- React 19.2.8, Vinext 1.0.0, Vite 8.3.5, TS 5.9.3, Tailwind 4.2.1. Tiptap 3.31.3, Playwright 1.62.1 유지. Supabase 버전 고정. shadcn CLI와 미사용 UI 의존성 제거, oxfmt 0.75.0, fast-uri 보안 패치, fflate 0.7.5 override. ipaddr.js는 standalone 해석을 위해 직접 고정했다.
- 로그인 useSearchParams의 Suspense 경계를 추가했다. 전체 파일 lint 무시를 줄이고 routines/daily-tasks의 무분별한 객체 문자열 변환을 입력 타입 검사로 바꿨다.
- DB migration·사용자 자료·Storage·URL·OAuth 계약은 변경하지 않았다. 이름 변경을 이유로 운영 리소스를 새로 만들거나 삭제하지 않았다.

## 이름과 GitHub

- 프로젝트/패키지/저장소: chi-toolbox. 브랜드: Chi Toolbox(로고의 대문자 표기는 유지).
- 사용자가 GitHub 이름 변경을 수행했고 연결 API에서 ClCl616/chi-toolbox를 확인했다. 주소는 https://github.com/ClCl616/chi-toolbox.git.
- 2026-11-01 사용자가 검증된 캔버스 변경과 선행 로컬 커밋의 origin/main push를 승인했다. 이후 push는 계속 명시적 요청이 필요하며, 운영 배포는 별도다.
- 최신 전달 bundle은 chi-toolbox-windows.bundle, 업데이트 bundle은 chi-toolbox-update.bundle을 사용한다. 복원 명령은 Windows README 참조.
- 로컬 폴더는 C:/Projects/chi-toolbox로 이동됐다. 운영 소스/runtime/Caddy/maintenance 경로와 작업 이름은 호환 식별자로 유지한다. production.psd1에 기존 배치를 명시했다. 운영 경로는 자동 이동하지 않는다.
- 브라우저 chi-hub-* 저장 키·이벤트·drag MIME은 기존 저장 상태와 열린 화면 호환을 위해 유지한다. 과거 migration은 수정하지 않는다.

## 유지할 제품 결정과 데이터 흐름

아래는 기존 서비스의 기능 계약이다. 새 대시보드의 파일 구성은 docs/UI_FOUNDATION.md, 현재 제품 범위는 docs/MVP.md를 따른다.

- 한국어 개인용 PWA, 9개 기능 및 프로필·설정. 같은 URL에서 820px 기준 PC/모바일 UI를 분리하고 저장 상태를 공유한다. 밝은 배경/검정/라임, C 아이콘 유지.
- 한 번에 선택 화면 하나만 표시하며 keepMounted로 타이머·메모 상태를 유지한다. 기본 focus, ?view=focus|morning|calendar|notes|study|sleep|workouts|files|meals|profile|settings, 기존 개별 URL redirect와 뒤로 가기 유지.
- 화면 → shared API 훅 → app route → features server → Supabase. 인증은 getUser/cookie이며 RLS와 소유권 조건을 유지한다. 공개 학식·health 및 auth 진입점은 별도다.
- Google OAuth와 이메일 로그인 지원. localhost/127.0.0.1과 운영 /auth/callback 등록을 모두 유지한다. 실제 로그인 성공은 mock 검사로 확정하지 않는다.
- 계정 설정은 workspace_preferences의 키별 배열/version. 낙관적 UI 실패 복구와 409 충돌 처리. 다른 기기는 재조회 때 반영되며 realtime 구독은 없다.
- 타이머는 종료 시각을 localStorage에 저장하며 숨긴 탭에서도 완료 팝업을 표시한다. OS 백그라운드 알림 보장은 별도 문제다.
- 캘린더는 일정·루틴·할 일·수면·집중을 통합한다. 반복은 규칙 계산, 편집/삭제는 전체 시리즈, 없는 월말/윤일은 건너뛴다. 다일 일정·회차 예외·알림·외부 캘린더 동기화는 없다.
- 메모는 Markdown, Tiptap 서식/원문/읽기, 필기/스티커, 800ms 직렬 자동 저장·UUID 재사용·미저장 이탈 보호·50,000자 초과 거부. raw HTML 실행 차단. 복잡한 비지원 문법은 원문 유지 권장.
- 메모와 파일 삭제는 카드 우클릭/터치 길게 누르기에서 확인창 없이 30일 휴지통으로 이동. 만료 복원 및 삭제 후 저장은 DB/API에서 차단한다.
- 메모 폴더는 category 기반 평면 구조, 추가/빈 폴더 유지/드래그 순서·이동. 폴더 이름 변경/삭제 UI는 없고 새 메모 기본 분류는 개인이다.
- 드라이브는 중첩 폴더, 현재 폴더 업로드, 파일당 500 MiB, private-files 비공개 bucket/사용자 경로. 미리보기 서명 5분·목록 갱신 4분, 다운로드는 로그인·소유권 확인 후 60초 서명으로 서버 스트리밍·원본 UTF-8 이름 보존.
- 폴더 삭제는 하위 활성 항목을 원자적으로 휴지통 이동. 기존 별도 삭제 시각은 보존. 복원은 부모부터, 삭제된 부모는 루트 복원. 폴더 이동 UI/로컬 디렉터리 통째 업로드는 없다.
- 학습은 오늘/전체/보관, 30개 페이지, again/good/easy, 1→3→7→14→30→60일. RPC row lock·예상 횟수·요청 UUID, 수정 updated_at 비교로 중복/오래된 화면을 방어한다. 영구 삭제 UI·외부 학습 서비스·알림은 없다.
- 학식 UI는 대전대학교만 제공한다. 조식/중식/석식 열과 날짜·식당 선택, 외부 HTML 파싱·5분/30분/stale 24시간 캐시. 기존 다른 학교 서버 처리는 외부 API 호환을 위해 유지하고 UI는 복원하지 않는다.
- 단축키 안내는 설정에 모은다. Ctrl+K, F1, Alt+1~9, Ctrl+Shift+F, Alt+N. IME/AltGr/입력 요소·메뉴 충돌 방어 유지.
- 삼성/Notion/Google Drive는 UI 참고 대상이며 데이터 연동은 아니다. 네이티브 모바일·워치 앱과 완전한 오프라인 편집은 없다.

## 운영·DB

- 운영은 집 Windows, chitoolbox.com, loopback 127.0.0.1:3000 + Caddy HTTPS. Tailscale/SSH는 관리 전용. Sites는 사용하지 않는다.
- 앱 공개 환경 키: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SITE_URL. 공개 값도 build에 들어가므로 변경 시 재빌드한다.
- worker 전용 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY는 서버 보호 파일에만 둔다. NETWORK SERVICE와 앱 LOCAL SERVICE 권한 분리 유지.
- worker는 서버 소스 scripts/purge-trash.mjs → trash-worker.mjs. 만료 파일 claim → Storage API 삭제 → DB metadata → 빈 만료 폴더 → 만료 메모 정리. 실패 시 재시도하며 SQL로 Storage 바이트를 직접 삭제하지 않는다.
- migration 0001~0005: 기본 자료·Storage/RLS, 수면 제약/500 MiB, 루틴·daily_tasks, 일정, 메모 유형.
- 20260922092822: 파일 휴지통. 20260922101159: 일정 상세/반복과 계층 폴더. 20260929071714: 학습과 메모 휴지통. 20260929084024: 계정 설정.
- 이전 운영 확인상 0001~0005는 테이블에 반영됐으나 migration history에는 없다. 전체 db push 재적용 금지. 새 schema는 새 migration으로 만들고 실제 이력·정책 확인.
- 2026-09-29 Advisor의 유출 비밀번호 보호 비활성화 1건은 과거 기록이며 현재 재조회하지 않았다.

## 기존 서비스의 남은 제약

- 캘린더 수면/집중 날짜는 timestamp 앞 10자를 사용한다. 현지 날짜 변환 문제는 이번 구조 정비와 분리해 후속 확인한다.
- 메모 200/파일 1000/폴더 5000 조회 상한, 전체 목록 페이지네이션 부족. Supabase 반환 상한도 별도 적용될 수 있다.
- HTML Drag and Drop 기반이므로 모바일 터치 정렬 보장은 없다. 복잡한 Markdown 정규화, Tiptap 큰 chunk와 일부 CSS override는 남아 있다.
- 공인 IP/DNS 자동 갱신, 로그·릴리스 보관 정책, 실제 재부팅 후 복구·사용자 로그인·백업 복구는 추가 확인 필요. 임의 재부팅하지 않는다.
