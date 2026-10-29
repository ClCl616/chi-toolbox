# Chi Toolbox

한국어 개인용 PWA. 타이머, 루틴·할 일, 캘린더, 메모, 복습·학습, 수면, 운동, 비공개 드라이브, 대전대학교 학식과 프로필·설정을 제공합니다.

## 시작

Node 24 LTS (`>=24.13.0 <25`), npm, Git이 필요합니다.

```powershell
git clone https://github.com/ClCl616/chi-toolbox.git
Set-Location chi-toolbox
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

기존 `.env.local`은 덮어쓰지 않습니다. `.env.example`의 공개 Supabase URL/anon key/site URL을 설정합니다. 앱에 service_role/secret key를 넣지 않습니다. 로컬도 운영 DB에 연결되므로 CRUD는 실제 데이터를 변경합니다.

## 구조

- `app/`: URL 진입점·레이아웃·얇은 API export
- `shell/`: 화면 조합과 탐색; 새 화면 등록은 `workspaces.ts`
- `features/`: 기능별 화면·훅·모델·서버 로직
- `shared/`: 기능 독립 공통 UI·훅·유틸리티·서버 인증
- `styles/`, `tests/`, `scripts/`, `supabase/migrations/`, `deploy/windows/`

의존 방향, 이름 규칙, 기능 추가 절차와 설계 근거는 [아키텍처](docs/ARCHITECTURE.md)를 읽습니다. React + Vinext/Vite 기반이며 Next.js 방식의 라우트를 사용합니다.

## 데이터에 쓰지 않는 검증

```powershell
npm.cmd run check
npm.cmd run build:test
npm.cmd run test:smoke
$env:TEST_BROWSER='msedge'
npm.cmd run test:browser
npm.cmd audit
git diff --check
```

`check`는 구조 경계·타입·lint·단위 테스트를 실행합니다. 테스트 빌드는 dummy 환경을 사용합니다. 브라우저 검사는 로컬 서버를 자동 시작/종료하고 API를 mock합니다. Edge가 없으면 `npx.cmd playwright install chromium` 후 TEST_BROWSER를 `chromium`으로 설정합니다. 캡처는 Git 제외 `work/qa/`에 남습니다. DB SQL 검사는 기본 검사에 포함하지 않습니다.

실제 설정의 production 빌드·실행은 `npm.cmd run build`, `npm.cmd start`입니다. 앱은 loopback만 수신합니다. 테스트 산출물을 운영에 복사하지 않습니다.

## 운영과 인수인계

- 운영 주소: https://chitoolbox.com — Windows + Caddy HTTPS.
- [운영 배포·복구](deploy/windows/README.md)
- [현재 상태·남은 확인](CODEX_CONTEXT.md)
- [보안·모바일 확장](docs/SECURITY_AND_APPS.md)
- [작업 규칙](AGENTS.md)

GitHub 저장소 이름 변경은 완료했습니다. 이번 구조 개편 커밋은 **별도 push 승인 전까지 로컬/서버 bundle에만 있습니다**. GitHub clone이 최신 배포와 같은지 커밋을 대조하고, 필요하면 서버 bundle로 복원합니다. GitHub push는 명시적 요청 시에만 수행합니다.
