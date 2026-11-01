# Chi Toolbox 작업 컨텍스트

> 2026-11-02 Asia/Seoul. 실제 Git·코드·운영 상태가 문서보다 우선한다. 비밀 값은 기록하지 않는다.

## 작업 마무리와 서버 확인 (2026-11-02)

- 사용자가 이번 LMS 작업의 GitHub push를 명시적으로 요청했다. 반영 대상은 b46a490(LMS 로컬 기능), a19dd55(메시지/과제 UI·빈 항목 숨김), 4fbac3a(최근 동기화 시각만 표시)와 이 인수인계 기록이다. 이후 push는 별도 요청을 따른다. 미커밋 docs/MVP.md는 그대로 보존한다.
- SSH 읽기 전용 재확인: 서버 소스 main은 4088ac2, dirty 파일 없음. 실제 active release는 20261029-161504-685-1c79a62781ac로 실행 코드 1c79a62다. CHI-HUB-App/Caddy Running, Trash Ready, 로컬 health·toolbox와 공개 health HTTP 200 확인.
- 운영에는 기존 서비스와 `/toolbox` 공통 UI·LMS 빈 화면까지 적용됐다. afd6621 카드 자동 배치와 이번 LMS 데이터 연결·UI 개선은 아직 서버 소스/실행 빌드에 없다. 이번에는 서버 전달·배포·재시작하지 않는다. 공개 LMS 전환 전 사용자별 인증/소유권 연결이 필요하다.

## LMS 로컬 구현 (2026-11-02)

- UI 후속 선택: 새 소식 C안(아이콘·메시지형 피드·첫 미확인 구분선), 과제 B안(PC 카드 그리드·모바일 1열)을 적용했다. 기한 경과/확인 필요는 간결한 목록으로 분리한다. 과제가 없는 분류는 제목·개수까지 숨기며 전체가 비면 안내 하나만 표시한다. 빈 본문/메타데이터/마감일 자리표시자도 숨기되, 실제 과제의 제출 상태·마감 확인 필요 알림은 유지한다. 공통 셸과 수집기·저장 계약은 변경하지 않았다.
- UI 후속 검증: check(구조 129개·단위 16개)·dummy build·HTTP smoke·LMS 브라우저 검사 통과. 320/390/820/1024/1440 너비, 빈 분류/본문 숨김, 전체 빈 상태, 기존 읽음 동작을 확인했고 PC·모바일 합성 자료 캡처를 검토했다. 로컬 preview를 최신 빌드로 재시작했다.

- 사용자 요청에 따라 LMS 기능을 로컬에서 구현했다. 기존 자동 배치 캔버스와 운영 루트는 보존했다. 이번 작업은 로컬만이며 GitHub push·서버 전달·배포를 하지 않는다. 시작 시 미커밋 `docs/MVP.md`는 수정·스테이징하지 않는다.
- `features/lms`는 피드·과제 모델, API 검증, 읽음 훅, 로컬 전용 서버를 소유한다. `shell/toolbox/toolbox-home.tsx`가 LMS 집계를 대시보드에 전달해 기능 간 직접 참조를 피한다.
- `workers/lms`에서 별도 `DJU-LMS-Notifier` 소스(검토: 89cf44b/schema v5)의 수집·비교 코드를 호출한다. 해당 저장소와 Discord 실행·쿠키·데이터는 변경하거나 재사용하지 않는다. Toolbox 전용 데이터는 Git 제외 `work/lms`다.
- 30분 자동 수집, 첫 등록 기준선 무알림·이후 신규/수정 피드, 같은 장애 중복 방지·원인 변화와 복구 알림, 마지막 과제 보존을 구현했다. 2026-11-02 사용자가 과제 시각을 한국 표준시로 해석하는 데 동의했다.
- 피드 최신 항목은 아래, 첫 미확인 위치로 이동, 제목 영역이 실제 보이면 읽음 저장한다. 대시보드·과제 탭은 읽음으로 바꾸지 않는다. 큰 수치는 일반 소식, 작은 빨간 수치는 장애/복구이고 0이면 문구까지 숨긴다. 수동 수집 버튼·LMS 외부 열기·채팅 입력은 없다.
- 남은 과제는 미제출·기한 전만 집계하고 기한순 정렬한다. 기한 경과·상태/시각 불명은 분리, 제출 완료는 숨긴다. 첫 과제 수집 전에는 0으로 단정하지 않는다.
- preview에서만 로컬 API 활성화. 공개 환경에서는 비활성이며 localhost/127.0.0.1·동일 출처를 검사한다. 로컬 한 계정의 자료·읽음 상태이며 공개 다중 사용자 인증/소유권은 아직 구현하지 않았다. 수집기 자체 종료 감시, 이력 페이지네이션, 과목 교체 정리는 후속 사항이다.
- 검증: 구조 경계 128개·타입·lint·단위 16개·Python 합성 DB 검사 4개·dummy build·HTTP smoke 통과. Edge에서 기존 캔버스 8개 크기와 LMS 실제 로컬 API의 출처 차단·동시 읽음 병합·분리 집계·위치 복원·저장 실패·과제 분류·모바일 검사를 통과했다. CI에 합성 자료의 `test:lms`를 추가했다. Python 어댑터 검사는 별도 Notifier 소스가 있는 로컬에서 실행한다.
- 실제 별도 브라우저 로그인 성공 후 첫 수집에서 9개 과목 × 공지·자료·과제·시험·온라인 강의 모두 성공했다. API healthy, 첫 피드 0건, 실제 과제 분류·대시보드 집계·과제 화면을 headless Edge로 검증했다. 개인 내용은 로그·캡처로 출력하지 않았다. 이후 신규/수정의 실시간 발생과 장시간 반복 실행은 아직 관찰하지 않았다.
- 작업 종료 시 로컬 preview(13003)와 `lms:watch`가 실행 중이다. 프로세스 종료·PC 재시작 후에는 자동 재시작되지 않으므로 문서 명령으로 다시 실행한다.
- 실행·로그인·재로그인·검증 명령과 현재 한계는 `docs/LMS_LOCAL.md`를 따른다. `npm run preview:toolbox`는 127.0.0.1:13003, `npm run lms:login`은 별도 수동 로그인, `npm run lms:watch`는 30분 루프다. 로그인 창을 자동으로 다시 열거나 계정 정보를 채팅에 요청하지 않는다.

## 로컬 UI 변경 (2026-11-01)

- 사용자 요청: 자동 카드 배치·고정 높이·연속 가로 스크롤, 최소 문구. 로컬 확인 후 사용자가 GitHub push를 승인했다. 서버 전달·배포는 후속 요청 전까지 하지 않는다.
- `/toolbox`의 카드 편집·숨김/순서 설정·저장 코드를 제거했다. 이전 브라우저 저장값은 사용하지 않으며 삭제도 하지 않는다.
- 카드 수와 화면 크기에 따라 1~2행으로 배치하고 최소 너비 이후는 가로 확장한다. 휠·트랙패드·터치와 링크 키보드 포커스로 이동한다. 페이지 구분/스냅은 없다.
- 새 소식·남은 과제 두 카드에 제목·미연결 값 `—`·상태만 표시한다. 소개 문구와 슬로건을 제거하고 LMS/설정 안내도 줄였다. 데이터·인증 연결은 추가하지 않았다.
- `npm run build:test` → `npm run preview:toolbox`로 http://127.0.0.1:13003/toolbox 확인. dummy 환경이며 운영 환경 파일을 읽지 않는다.
- 로컬 검증: 구조 경계 121개·타입·lint·단위 12개·dummy build·HTTP smoke 통과. 새 브라우저 검사에서 4경로, 8개 화면 크기, 카드 1~16개 배치의 세로 overflow 없음과 가로 휠/포커스 이동, API 요청 0건 확인. PC·모바일 캡처 확인. 기존 카드 편집 전용 단위 검사는 기능 제거와 함께 삭제했다.
- 운영은 아래 2026-10-29 배포 기록 상태다. 카드 편집/저장 관련 과거 기록은 이전 버전의 검증 이력이다.

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

아래는 현재 운영 중인 기존 기능의 계약이다. 새 MVP는 LMS 우선 대시보드이며 기존 전체 기능의 재구현을 전제로 하지 않는다. `/toolbox` 공통 UI 단계의 구조와 후속 범위는 docs/UI_FOUNDATION.md를 따른다. 루트 운영 화면은 아직 교체하지 않는다.

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
- 2026-10-29 공통 UI 실행 빌드: 1c79a62. 실행 릴리스: C:/Services/chi-hub-runtime/releases/20261029-161504-685-1c79a62781ac. 앱 Running, Trash Ready 확인. 기존 운영 루트는 보존하고 `/toolbox`를 추가했다. source와 실행 빌드 사이의 후속 배포 기록 문서 커밋 차이는 정상이다.
- 앱 공개 환경 키: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SITE_URL. 공개 값도 build에 들어가므로 변경 시 재빌드한다.
- worker 전용 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY는 서버 보호 파일에만 둔다. NETWORK SERVICE와 앱 LOCAL SERVICE 권한 분리 유지.
- worker는 서버 소스 scripts/purge-trash.mjs → trash-worker.mjs. 만료 파일 claim → Storage API 삭제 → DB metadata → 빈 만료 폴더 → 만료 메모 정리. 실패 시 재시도하며 SQL로 Storage 바이트를 직접 삭제하지 않는다.
- migration 0001~0005: 기본 자료·Storage/RLS, 수면 제약/500 MiB, 루틴·daily_tasks, 일정, 메모 유형.
- 20260922092822: 파일 휴지통. 20260922101159: 일정 상세/반복과 계층 폴더. 20260929071714: 학습과 메모 휴지통. 20260929084024: 계정 설정.
- 이전 운영 확인상 0001~0005는 테이블에 반영됐으나 migration history에는 없다. 전체 db push 재적용 금지. 새 schema는 새 migration으로 만들고 실제 이력·정책 확인.
- 2026-09-29 Advisor의 유출 비밀번호 보호 비활성화 1건은 과거 기록이며 현재 재조회하지 않았다.

## 검증과 남은 제약

- 새 UI 추가 후 구조 경계 122개·타입·lint·단위 15개·dummy production build·확장 HTTP smoke 통과. Edge에서 기존 전체 회귀와 `/toolbox` 4경로×5너비·히스토리·카드 편집/드래그/저장/취소·손상/차단 저장소 검사 통과. 새 UI의 API 요청 0건 확인, PC·모바일 캡처 확인. 의존성 변경 없이 서버 npm ci에서 취약점 0건 확인.
- 실제 운영 DB 쓰기 테스트와 실제 계정 로그인은 수행하지 않았다. health는 DB/Auth/Storage 전체 검사가 아니다.
- 캘린더 수면/집중 날짜는 timestamp 앞 10자를 사용한다. 현지 날짜 변환 문제는 이번 구조 정비와 분리해 후속 확인한다.
- 메모 200/파일 1000/폴더 5000 조회 상한, 전체 목록 페이지네이션 부족. Supabase 반환 상한도 별도 적용될 수 있다.
- HTML Drag and Drop 기반이므로 모바일 터치 정렬 보장은 없다. 복잡한 Markdown 정규화, Tiptap 큰 chunk와 일부 CSS override는 남아 있다.
- 공인 IP/DNS 자동 갱신, 로그·릴리스 보관 정책, 실제 재부팅 후 복구·사용자 로그인·백업 복구는 추가 확인 필요. 임의 재부팅하지 않는다.
- 새 MVP의 공통 UI·빈 화면 구현과 로컬 검증을 완료했다. 현재 운영 빌드는 위 운영 항목을 기준으로 확인한다. 2026-11-01 GitHub 반영 대상에는 새 캔버스 변경까지 포함되지만 운영은 1c79a62 빌드에 유지한다. GitHub 최신 소스와 서버 bundle·실행 release는 다를 수 있다.
- 새 화면 `/toolbox`는 공개 환경에서 미연결 UI이며, 로컬에서는 위 LMS 구현을 사용한다. 실행 화면에 mock 데이터를 넣지 않는다. 공개 계정별 연결은 아직 없다. 최신 UI는 카드 자동 배치를 유지한다.

## 최근 기록

- 2026-10-29 / 1c79a62: `/toolbox` 대시보드·LMS 탭·설정 빈 화면, PC 왼쪽/모바일 하단 탐색, CSS Module 격리, 카드 편집·브라우저 저장, 공통 로딩·오류 상태와 전용 브라우저 검사를 추가했다. 기존 루트·API·DB는 유지한다. docs/UI_FOUNDATION.md에 진입점과 파일 소유권·한계를 기록했다. Windows 배포 후 새 UI 4경로·login·health 200, 미인증 preferences 401 확인. 작업 시작 시 존재한 미커밋 docs/MVP.md는 그대로 보존했다. origin push 없이 서버 bundle로 전달했다.

- 2026-10-29 / 44fc69a: 기능 중심 구조·개발 검사·문서 체계·의존성 정비, chi-toolbox 이름 및 GitHub 주소 통일. check/단위 12개/build/전체 보호 API smoke/Edge 11화면×5너비 통과. Windows 배포 후 public health/login/manifest/메모·파일·프로필 200, 미인증 설정 GET·PATCH/프로필/메모 휴지통/다운로드 401. 로컬·서버 audit 0건. 후속 문서 커밋까지 source와 양쪽 chi-toolbox-windows.bundle을 동기화하며 앱 재시작은 하지 않는다.
- 2026-09-29~30: 드래그·즐겨찾기·프로필/설정·학식/카드 UI 배포(565f0a6), 인수인계(3b1036a). 상세 과거 이력은 Git log를 따른다.
