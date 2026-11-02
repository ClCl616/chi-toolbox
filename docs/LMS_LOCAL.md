# LMS 로컬 실행

`/toolbox`의 LMS 구현이다. 기존 운영 루트와 Discord Notifier는 유지한다. 로컬 preview는 개인 PC용이며, 운영은 확인된 단일 소유 계정의 로그인으로 보호한다. 운영 작업·권한·배포는 [Windows 운영 문서](../deploy/windows/README.md)의 Toolbox LMS 절차를 따른다. 여러 사용자의 각각의 수집 연결은 후속 작업이다.

## 준비와 실행

Node 환경은 루트 README를 따른다. 별도로 `DJU-LMS-Notifier` 소스와 해당 프로젝트의 Python 3.12 이상 가상환경·Playwright가 필요하다. 검토한 소스는 `89cf44b`, SQLite schema v5다. 소스를 무심코 업데이트하지 말고 어댑터 검사를 다시 실행한다. 기본 위치는 이 저장소 옆 `../DJU-LMS-Notifier`이며 기존 수집 코드만 재사용한다.

PowerShell을 `C:/Projects/chi-toolbox`에서 연다. 기본 위치가 다를 때만 다음 환경 변수를 설정한다. 비밀 값은 필요하지 않다.

```powershell
$env:DJU_NOTIFIER_ROOT='C:/path/to/DJU-LMS-Notifier'
$env:TOOLBOX_LMS_PYTHON='C:/path/to/DJU-LMS-Notifier/.venv/Scripts/python.exe'
```

첫 터미널에서 UI를 시작한다. dummy 환경이므로 운영 환경 파일을 읽지 않는다.

```powershell
npm.cmd run build:test
npm.cmd run preview:toolbox
```

http://127.0.0.1:13003/toolbox 에 접속한다. 실제 수집 전에는 미연결·수집 대기이며 예제 데이터를 넣지 않는다.

다른 터미널에서 로그인 후 수집기를 실행한다.

```powershell
npm.cmd run lms:login
npm.cmd run lms:watch
```

- 로그인은 열린 Edge 브라우저에서 직접 한다. 터미널·채팅에 계정 정보를 입력하지 않는다. 10분 이내 로그인하고 세션 재사용 검증이 성공해야 저장된다.
- `lms:watch`는 시작할 때 한 번, 이후 시작 시각 기준 30분마다 실행한다. 수집 중 중복 실행은 잠금으로 막는다. 터미널을 닫으면 자동 수집이 멈춘다. Windows 서비스/예약 작업 등록은 이번 범위가 아니다.
- 세션 만료 시 수집기를 Ctrl+C로 멈추고 `lms:login` → `lms:watch` 순서로 재시작한다. 기존 Discord 세션과 쿠키는 공유하지 않는다.
- 필요 시 개발 진단 명령 `npm.cmd run lms:once`로 1회만 실행할 수 있다. 화면에는 수동 수집 버튼이 없다.
- 사용자 확인에 따라 LMS 날짜는 한국 표준시(UTC+9)로 처리한다. 해석할 수 없는 날짜·제출 상태는 확인 필요로 분류한다.
- UI는 로컬 snapshot을 30초마다 다시 읽는다. 이것은 LMS에 접속하는 30분 수집 주기와 별개다.

## 책임과 저장

| 영역 | 책임 |
| --- | --- |
| `workers/lms/worker.py` | 기존 Python 수집·비교 코드 호출, 30분 루프, 별도 로그인/잠금 |
| `workers/lms/projector.py` | 수집 결과를 피드·과제·장애 이벤트로 변환 |
| `features/lms/server/local-api.ts` | 로컬 snapshot 조회, 읽음 ID의 직렬·원자 저장 |
| `features/lms/model.ts` | API 자료 검증, 과제 분류, 미확인 수치 집계 |
| `features/lms/use-lms.tsx` | 브라우저 조회·읽음 요청·실패 시 이전 정보 보존 |
| `features/lms/components/` | 피드와 과제 화면 |
| `shell/toolbox/toolbox-home.tsx` | LMS 집계를 독립 대시보드에 전달 |

기본 저장 위치는 Git 제외 `work/lms/`다. `auth/storage_state.json`은 민감한 쿠키, `notifier.sqlite3`는 별도 기준선·관측 이력, `worker-state.json`은 변환 상태, `snapshot.json`은 화면 자료, `read.json`은 읽음 ID다. 브라우저에 쿠키·원본 HTML·LMS 이동 URL을 전달하지 않는다. 원본 수집기 데이터 디렉터리 안으로 저장 위치를 지정하는 것을 차단한다. 폴더를 공개하거나 커밋하지 않는다. 기준선을 지우면 다시 최초 수집으로 처리되므로 임의 삭제하지 않는다.

`TOOLBOX_LMS_DATA`를 사용하면 UI와 수집기 모두 동일한 **별도 로컬 폴더**를 지정해야 한다. 테스트는 임시 폴더만 사용하며 실제 계정 자료를 읽지 않는다. Notifier의 Discord 발송 함수는 호출하지 않는다.

## 화면·동작 계약

- 정상 연결 배지에는 대전대학교와 서버 전용 선택 설정 `TOOLBOX_LMS_DISPLAY_NAME`의 계정 표시 이름을 함께 표시한다. 이름을 설정하지 않으면 학교만 표시한다. LMS 내부 두 보기는 주소를 유지하며 전환하고, 직접 접속·새로고침 시 주소에 해당하는 보기로 시작한다.

- 새 소식은 C안의 아이콘·메시지형, 남은 과제는 B안의 PC 3열 카드(중간 너비 2열, 모바일 1열)를 사용한다. 기한 경과·확인 필요는 별도 목록이다. 항목이 0개인 분류는 숨기고 전체가 비면 단일 빈 상태를 표시한다. 본문이 비어 있으면 펼치기 버튼을, 부가 정보가 없으면 해당 자리를 숨긴다. 상태를 모르는 실제 과제 자체는 숨기지 않는다.

- 최초 수집은 과거 등록 소식을 피드에 넣지 않는다. 이후 신규/변경은 기존 항목의 변경까지 표시한다. 최초 과제 목록은 수집한다.
- 새 소식은 아래로 쌓인다. 첫 읽지 않은 메시지로 이동하며 제목 영역이 실제 화면에 0.8초 보이면 읽음으로 저장한다. 본문 펼치기는 필수가 아니다. 대시보드·과제 탭은 읽음 처리하지 않는다.
- 같은 장애가 계속되면 첫 알림만, 장애 원인이 바뀌면 새 알림, 정상 복구 시 한 번만 피드에 기록한다. 실패/복구 모두 상태 알림으로 집계한다.
- 대시보드 새 소식 큰 수치는 일반 미확인 소식만 포함한다. 같은 카드의 작은 빨간 `상태 알림 N`은 별도 집계하며 0이면 문구까지 숨긴다.
- 미제출·기한 전 과제만 남은 과제 수치에 포함한다. 기한순 정렬하며 기한 경과/확인 필요를 분리하고 제출 완료는 숨긴다. 연장은 허용 여부와 유효 기한이 모두 확인돼야 반영한다.
- 과제 수집 전에는 0으로 단정하지 않는다. 실패하거나 목록에서 누락된 기존 과제는 삭제하지 않고 이전 정보로 남긴다. 수강 종료·과목 교체 시 정리 정책은 후속 작업이다.
- `LMS에서 열기`, 수집-now, 채팅 입력 기능은 없다. 본문은 안전한 텍스트로 표시하며 첨부 다운로드/이미지 렌더링은 제공하지 않는다.

## 검증

```powershell
npm.cmd run check
& '../DJU-LMS-Notifier/.venv/Scripts/python.exe' -B -m unittest discover -s workers/lms/tests -v
npm.cmd run build:test
npm.cmd run test:smoke
$env:TEST_BROWSER='msedge'
npm.cmd run test:toolbox
npm.cmd run test:lms
```

Python 검사는 별도 임시 SQLite에서 실제 Notifier 저장·비교 코드를 확인한다. `test:lms`는 임시 폴더의 합성 데이터로 실제 로컬 HTTP API와 화면을 검사하며 LMS에는 접속하지 않는다. 캡처의 `*-test.png`는 테스트 자료이며 실제 사용자 화면 데이터가 아니다.

## 현재 한계

로컬 API는 `TOOLBOX_LMS_LOCAL=1`과 localhost/127.0.0.1 요청에서 활성화된다. preview는 운영 모드를 끈다. 운영 모드(`TOOLBOX_LMS_ENABLED=1`)는 로컬 플래그보다 우선하며 Auth 서버 검증·소유 계정·확인된 이메일을 요구한다. 교차 출처 요청을 차단하고 읽음 저장은 동일 출처를 요구한다. 인증/권한이 사라지면 화면에 남아 있던 데이터도 지운다. 로컬 모드를 프록시로 공개하지 않는다.

전체 피드와 관측 이력은 누적되며 아직 페이지네이션·보관 정책이 없다. 실제 로그인·LMS DOM 변경 대응·장시간 자동 수집은 자동 테스트만으로 보장하지 않는다. 프로세스 종료나 파일 권한 오류로 수집기 자체가 멈추면 새 장애 피드를 쓸 수 없으므로 마지막 성공 시각도 확인한다.
