# Chi Toolbox 구조와 개발 기준

## 진단과 선택

2026-10-29 기준, 기존 구조의 문제는 프레임워크 자체보다 책임 배치에 있었다.

| 기존 근거 | 문제 | 적용한 결정 |
| --- | --- | --- |
| `components/*-workspace.tsx`, `hooks/`, `lib/`, `app/api/` | 같은 기능을 수정할 때 네 디렉터리를 오가야 했다. | 기능의 화면·훅·모델·서버 처리를 `features/<name>/`에 모았다. |
| `hooks/use-api.ts`의 `/api/calendar` 분기 | 공통 조회 훅이 캘린더와 루틴·수면·집중의 관계를 알았다. | `features/calendar/use-calendar-data.ts`가 갱신 관계를 소유한다. |
| API별 `getAuthContext`, 401, try/catch 반복 | 인증 누락·오류 응답 차이의 위험과 변경 비용. | `shared/server/with-auth.ts`에서 공통 경계를 관리한다. 도메인 검증과 RLS는 유지한다. |
| AppShell navigation과 DashboardWorkspace 수동 탭 목록 | 기능 등록·순서가 중복됐다. | `shell/workspaces.ts`가 이름·아이콘·순서·화면의 단일 등록점이다. |
| `FeatureLayout` 및 도달 불가능한 UI 스캐폴드 | 사용하지 않는 코드가 실제 구현처럼 보였고 의존성을 늘렸다. | 사용 중인 DataNotice만 분리하고, import 그래프에서 도달하지 않는 파일 56개를 제거했다. |
| DriveFileCard의 StoredFile, 편집 훅의 Note 타입 | 모델 계약이 특정 UI 구현에 종속됐다. | 기능별 `types.ts`, 업로드 훅, 폴더 탐색 순수 함수를 분리했다. |
| 여러 문서의 린트 8건/2건, 임시 npm 경로 | 실행 방법과 현재 상태가 혼재했다. | README는 시작점, 이 문서는 설계, Windows 문서는 운영, CODEX_CONTEXT는 현재 상태로 역할을 정했다. |

잘 작동하는 RLS/RPC, 직렬화된 메모 저장, 낙관적 설정 복구, 반복 일정 계산, keepMounted, URL과 데이터 계약은 보존한다. ORM·DI 컨테이너·전역 상태 라이브러리·범용 repository 계층은 현재 규모에서 추가 이점이 없어 도입하지 않는다.

## 디렉터리와 의존 방향

```text
app/                    URL·메타데이터·레이아웃 및 얇은 API export
shell/                  화면 조합, 탐색, 단축키, 연결 상태, PWA 등록
features/
  auth/ calendar/ files/ focus/ meals/ notes/ preferences/
  profile/ routines/ settings/ sleep/ study/ workouts/
    components/         해당 기능 UI
    hooks/              독립적인 상태·작업 수명주기(필요할 때만)
    server/             서버 전용 HTTP 처리·Supabase 조회
    types.ts            여러 구현이 공유하는 기능 계약(필요할 때만)
shared/
  components/ ui/       공통 표시 요소와 실제 사용 중인 Base UI 원시 요소
  hooks/ lib/           도메인을 모르는 조회·드래그·날짜·유틸리티
  preferences/          여러 기능이 공유하는 계정 설정 계약과 provider
  server/               Supabase 쿠키 클라이언트·인증 HTTP 경계
styles/                 전역 토큰·셸·컬렉션·기기·편집기·상호작용 스타일
tests/unit/             네트워크 없이 실행하는 로직 및 mock worker 검사
tests/browser/          로컬 production 서버 + API mock 회귀
tests/database/         수동 트랜잭션 검사; 기본 테스트에 포함하지 않음
scripts/                빌드·실행·검증·유지보수 실행 파일
workers/lms/            별도 Notifier 소스를 호출하는 로컬 Python 수집 어댑터
supabase/migrations/    불변 migration 이력
deploy/windows/         production 릴리스 전환·복구·작업 설치
```

`app → shell/features → shared` 방향을 지킨다. 서로 다른 feature를 직접 import하지 않는다. 진짜 공통 날짜/설정 계약만 shared로 승격한다. 캘린더 서버의 다른 기록 조회는 의도된 통합 기능이며 다른 기능의 UI를 import하지 않는다. shared는 app/shell/features를 알지 않는다. 클라이언트에서 server 모듈에 도달하는 경로를 금지한다. `npm run check:architecture`가 정적·동적 import와 전이 경로를 검사한다.

파일·디렉터리는 kebab-case, React 컴포넌트·타입은 PascalCase, 함수는 camelCase, 훅은 use 접두사다. `morning` 같은 URL과 DB snake_case는 외부 계약이므로 이름 규칙을 이유로 바꾸지 않는다. barrel export를 남발하지 않고 실제 소유 파일을 import한다.

## 새 기능·변경 절차

새 MVP 공통 UI는 기존 서비스 교체 전 `/toolbox`에 분리한다. 이 경로는 `shell/toolbox`, `features/dashboard`, `features/lms`를 사용하며 기존 `shell/workspaces.ts`에 중복 등록하지 않는다. 세부 경계와 브라우저 설정 계약은 [UI 기반](UI_FOUNDATION.md)을 따른다. 신규 스타일은 기능 옆 CSS Module로 격리한다.

1. 기능 소유 디렉터리에서 시작한다. 기존 서비스 기능은 `features/<name>`과 `shell/workspaces.ts`에 등록한다. 기존 첫 9개 위치는 Alt+1~9 계약이다. 새 MVP는 `app/toolbox` 진입점과 `shell/toolbox` 탐색에 연결한다.
2. `app/api/.../route.ts`에는 HTTP export와 프레임워크 설정만 둔다. 인증 API는 withAuth, 기능 검증·쿼리는 feature server에 둔다. 로그인·콜백·공개 학식·health는 예외다.

   `/api/toolbox/lms`는 공개 계정 API가 아닌 opt-in 로컬 실험 경계다. 기본 비활성이며 loopback Host·출처 검사를 `features/lms/server`에서 수행한다. 공개 전환 전 사용자 인증·소유권 적용이 필수다. 수집·브라우저 로그인은 Node 요청 수명주기와 분리한 `workers/lms`가 담당한다. 실행 조건과 외부 소스 의존성은 [LMS 로컬 실행](LMS_LOCAL.md)을 따른다.
3. 기능 UI가 커지면 독립적인 수명주기(업로드, 편집 저장) 또는 표시 단위를 분리한다. 모든 상태를 담는 거대한 범용 컨트롤러를 만들지 않는다.
4. 순수 로직은 unit, 사용자 흐름은 browser, 인증·URL·프록시는 HTTP smoke로 확인한다. 새 회귀를 방지할 테스트만 추가한다.
5. `npm run check`, `npm run build:test`, `npm run test:smoke`, `npm run test:browser` 후 문서 갱신·로컬 커밋·bundle 배포한다. CI는 검증만 하며 배포하지 않는다.

## CSS와 의존성

CSS 순서는 `globals → shell → collections → desktop → mobile → editors → interaction`이다. 기존 cascade와 820px 전환을 보존했다. 이 순서를 임의로 바꾸지 않는다. 전역 파일을 늘리는 대신 실제 관련 영역에 추가하고 390/820/1440px 이상에서 확인한다. 기존 일부 override는 호환성을 위해 남겼다.

React 19.2.8 / Vinext 1.0.0 / Vite 8.3.5 / TS 5.9.3 / Tailwind 4.2.1. Next.js 방식의 API를 Vinext가 구현한다. `next` 패키지를 별도로 설치하지 않는다. 잠금파일을 커밋하고 `npm ci`로 복원한다. Supabase 버전도 정확히 고정했다.

shadcn CLI 전체를 CSS 때문에 설치하던 의존성을 제거하고 실제 사용하는 Base UI 상태 variant만 `styles/ui-variants.css`에 정의했다. `components.json`은 추가 UI 생성 시 경로 참고용이다. 생성 후 사용하지 않는 코드는 커밋하지 않는다.

`ipaddr.js`는 Vinext standalone의 런타임 외부 참조를 루트에서 확실히 해석하기 위해 직접 고정했다. `fflate: 0.7.5` override는 satori의 0.7.3 고정 간접 의존성을 보완한다. upstream이 수정되면 override 제거를 검토한다. 강제 audit downgrade는 하지 않는다.

## 호환성 식별자

- 논리 프로젝트·패키지·저장소는 `chi-toolbox`, 브랜드는 `Chi Toolbox`다. 로고의 대문자 CHI TOOLBOX는 시각 표기다.
- `chi-hub-focus-timer-v2`, sidebar/university 저장 키·이벤트·drag MIME은 기존 브라우저 상태를 보존한다.
- Windows 기존 경로·계정·작업 이름은 `deploy/windows/production.psd1`에 명시한 호환 배치다. 인증서·환경 파일·릴리스·작업을 자동 이동하거나 재등록하지 않는다.
- 도메인, Supabase 프로젝트, DB·Storage 이름, 기존 migration 내용은 변경하지 않는다.
- 현재 개발 폴더는 `C:/Projects/chi-toolbox`다. 운영의 `chi-hub` 경로는 변경하지 않는다.
