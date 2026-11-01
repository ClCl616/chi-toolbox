# Windows 운영과 전달

논리 프로젝트는 chi-toolbox, 도메인은 https://chitoolbox.com 입니다. Tailscale/SSH는 관리 전용입니다. 운영의 기존 경로·작업·서비스는 `production.psd1`에 호환 배치로 유지합니다. 이름 통일을 위해 환경 파일·인증서·기존 릴리스를 이동하거나 Supabase를 재생성하지 않습니다.

## 기존 운영 배치

| 역할 | 값 |
| --- | --- |
| 소스 | C:/Services/chi-hub |
| runtime | C:/Services/chi-hub-runtime |
| 앱 작업 | CHI-HUB-App / LOCAL SERVICE |
| HTTPS 서비스 | CHI-HUB-Caddy / C:/Services/chi-hub-caddy |
| 정리 작업 | CHI-HUB-Trash / NETWORK SERVICE / 현지 04:00 |
| worker 환경 | C:/Services/chi-hub-maintenance/trash.env |

앱 환경은 소스의 `.env.local`이며 release에 보호 ACL로 복사합니다. worker 환경은 앱과 분리하고 LOCAL SERVICE의 읽기 권한을 허용하지 않습니다. 서버에 이미 설정되어 있으면 재입력·재등록하지 않습니다. 실제 값은 출력하지 않습니다.

## 검증 후 업데이트

개발 PC에서 README의 check/build:test/smoke/browser 검증을 마치고 로컬 커밋합니다. main 외 브랜치는 최종 통합 상태를 먼저 확인합니다.

```powershell
New-Item -ItemType Directory -Force outputs | Out-Null
git bundle create outputs/chi-toolbox-update.bundle main
scp outputs/chi-toolbox-update.bundle chi-server:C:/Services/chi-toolbox-update.bundle
```

서버에서:

```powershell
Set-Location C:/Services/chi-hub
git status -sb
git fetch C:/Services/chi-toolbox-update.bundle main
git merge --ff-only FETCH_HEAD
powershell -NoProfile -ExecutionPolicy Bypass -File deploy/windows/deploy.ps1
```

dirty worktree나 분기가 있으면 강제로 덮어쓰지 않습니다. GitHub push는 별도 승인 없이는 하지 않습니다. deploy는 npm ci → production build → 별도 release → 13000 후보 health → active 전환 → 3000 health 순서입니다. 실패 시 이전 release로 복구하며 기존 파일은 보존합니다. 포트 3000/13000은 공개하지 않습니다. 문서만 바뀌면 source/bundle만 동기화하고 앱을 재시작하지 않습니다.

## 배포 후 확인

### Toolbox LMS (단일 소유 계정)

LMS는 기존 Discord 작업과 독립적이다. 소유자의 서버 검증된 로그인·확인 완료 이메일이 `TOOLBOX_LMS_OWNER_EMAIL`과 일치해야 API를 사용할 수 있다. 다른 계정은 403, 미로그인은 401이다. 설정은 보호된 서버 `.env.local`에만 저장한다. 값 자체를 문서·Git·로그에 남기지 않는다.

```text
TOOLBOX_LMS_ENABLED=1
TOOLBOX_LMS_OWNER_EMAIL=<확인된 소유 계정>
TOOLBOX_LMS_DATA=C:/Services/chi-toolbox-lms/public
```

`TOOLBOX_LMS_LOCAL`은 운영에서 사용하지 않는다. production 모드가 local보다 우선한다. 데이터는 기존 운영 DB 변경 없이 전용 디렉터리에서 보관한다. `private`는 쿠키·기준선 SQLite·변환 상태이며 웹 앱은 읽을 수 없다. `public`도 웹 정적 경로가 아닌 인증 API용 snapshot/read 디렉터리다. 서비스 계정은 worker=NETWORK SERVICE, 웹=LOCAL SERVICE다.

관리자 PowerShell에서 별도 Notifier 소스(검토 revision 89cf44b/schema v5)와 Python+Playwright 환경을 준비하고 다음을 실행한다. 기존 Notifier 저장소와 Discord 쿠키를 복사하지 않는다. 소스는 Git archive로 별도 보관하고 Toolbox 자체 로그인·데이터만 이전한다.

```powershell
./deploy/windows/install-lms-task.ps1 -Python '<기존 Python 환경의 python.exe 절대 경로>' -NotifierSource 'C:/Services/chi-toolbox-lms/source'
Start-ScheduledTask -TaskName CHI-TOOLBOX-LMS
Get-ScheduledTaskInfo -TaskName CHI-TOOLBOX-LMS
```

작업은 30분 간격과 부팅 시 실행되며 중복 실행을 무시한다. 실행 상한은 25분이다. `run-lms.ps1`이 `--once`를 호출하므로 별도의 watch 루프를 중복 실행하지 않는다. 첫 실행의 작업 결과와 snapshot 갱신을 확인한다. `logs/latest.log`에는 고정 상태만 기록한다. 작업 결과 0만으로 LMS 전체 성공을 단정하지 말고 snapshot status도 확인한다.

worker 업데이트 시 실행을 멈춘 뒤 `workers/lms/{worker,projector}.py`를 전용 `worker` 폴더에 복사하고 재개한다. 재설치 스크립트는 기존 작업을 자동 덮어쓰지 않는다. 재로그인은 worker 실행을 중단하고 별도 사용자 브라우저에서 Toolbox용 세션을 만든 뒤 보호된 `private/auth/storage_state.json`에 전달한다. 세션 내용을 출력하지 않는다.

소유자 로그인 후 `/toolbox` 실제 열람 확인은 별도 수행한다. 개인용 연결을 여러 가입자에게 공유하지 않는다. 다른 사용자의 수집 연결은 별도 설계·저장소 분리가 필요하다.

```powershell
Get-Content C:/Services/chi-hub-runtime/active.txt
Get-ScheduledTask -TaskName CHI-HUB-App,CHI-HUB-Trash
Get-Service CHI-HUB-Caddy
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod https://chitoolbox.com/api/health
git bundle create C:/Services/chi-toolbox-windows.bundle main
```

health는 프로세스 생존 확인이며 DB/Auth/Storage 전체 검증은 아닙니다. 미인증 API가 401인지, login/manifest가 정상인지 확인합니다. 실제 사용자 계정 흐름은 별도 확인합니다. 예약 worker를 smoke 목적으로 실행하지 않습니다(만료 자료를 실제 삭제함).

공통 UI 단계의 새 화면은 `/toolbox`, `/toolbox/lms`, `/toolbox/lms/assignments`, `/toolbox/settings`에 있습니다. 이 경로들은 개인 데이터를 제공하지 않는 공개 빈 화면이며 별도 환경 변수나 DB migration이 필요하지 않습니다. 기존 루트 서비스와 로그인은 유지됩니다. `test:toolbox`로 검증한 뒤 같은 앱 릴리스에 포함하고, 배포 후 각 경로의 HTTP 200과 실제 새 화면 문구를 확인합니다.

## 새 PC 인수인계

GitHub가 아직 push 전이면 서버 bundle이 최신 소스입니다.

```powershell
scp chi-server:C:/Services/chi-toolbox-windows.bundle ./chi-toolbox-windows.bundle
git clone -b main ./chi-toolbox-windows.bundle chi-toolbox
Set-Location chi-toolbox
git remote set-url origin https://github.com/ClCl616/chi-toolbox.git
npm.cmd ci
```

환경 파일·SSH/Tailscale 인증은 별도 준비합니다. 이전 chi-hub-windows.bundle이 남아 있더라도 이름만 보고 최신으로 판단하지 않습니다.

## 복구·최초 설치

`rollback.ps1`은 previous.txt의 앱 release를 복구합니다. DB rollback은 아닙니다. 중지는 PID·시작 시각·경로를 검증하는 `stop-app.ps1`을 사용합니다. 소스 파일만 되돌려도 실행 중 release는 바뀌지 않습니다.

새 Windows 서버에서만 관리자 PowerShell로 deploy → install-app-task를 실행합니다. Caddy installer는 checksum과 구성을 검증하고 자동 시작 서비스를 만듭니다. DNS와 공유기 TCP 80/443, 방화벽 설정을 확인한 뒤 서비스를 시작합니다. 기존 운영에서는 설치 스크립트를 반복하지 않습니다. 새로운 배치 경로를 선택하면 production.psd1뿐 아니라 Caddyfile·worker 환경 경로·작업 인수·ACL까지 함께 검토해야 합니다.

Google OAuth 운영 및 localhost/127.0.0.1 `/auth/callback`을 유지합니다. 공인 IP 변경 시 DNS를 갱신해야 하며 자동 갱신은 미구현입니다. 로그와 오래된 릴리스는 운영자가 보관 정책에 따라 관리합니다. 재부팅 복구 검사는 사용자의 작업 중단을 고려해 별도로 예약합니다.

## DB와 maintenance

기존 0001~0005는 운영 테이블에 반영됐으나 migration history에는 없다는 이전 확인 기록이 있습니다. 전체 db push 재적용을 금지합니다. 새 schema만 새 migration으로 추가하고 실제 이력/RLS/권한을 확인합니다.

정리 순서는 Storage API 바이트 삭제 → DB 파일 메타데이터 → 빈 만료 폴더 → 만료 메모입니다. service_role은 서버 worker에만 둡니다. 휴지통은 30일 보관하며 백업을 대신하지 않습니다. tests/database SQL은 명시적인 rollback 조건을 이해한 후에만 수동 실행합니다.
