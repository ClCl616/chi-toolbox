# LMS 비식별 실패 진단 · 2026-11-13

## 변경

- 기존 `temporary_failure`는 Playwright 시간 초과와 LMS HTTP 5xx를 합쳐 저장해 원인 구분이 불가능했다. 수집 정책·재시도·공개 snapshot 계약은 유지하고 private 진단만 추가한다.
- `metrics.json`의 `diagnostics`에 setup/collect/recovery 단계, 범주, 실행 내 순번(scopeIndex), timeout/http_5xx/other 구분, 소요 초, 허용된 코드 파일명·행 번호를 기록한다. `httpStatuses`는 관찰한 LMS HTTP 4xx/5xx 상태별 개수다. 같은 구간의 응답 관찰이며 해당 응답이 실패를 유발했다는 의미는 아니다.
- 예외 문자열, 전체 traceback, 소스 줄, 변수, URL, 요청/응답 본문, 쿠키, 계정·과목 식별자는 저장하지 않는다. scopeIndex는 해당 실행의 처리 순번이며 지속적인 사용자 식별자가 아니다.
- private `diagnostics-history.json`은 최근 100회 측정을 원자적으로 보관한다. 실행당 오류 기록도 최대 100개다. 웹 API에는 노출하지 않는다. 기존 안전한 작업 로그에도 동일 측정이 포함된다.

## 검증·운영

- 로컬 Python 38개 및 기본 검사(구조·타입·린트·JS 단위19개) 통과. 합성 예외/URL의 비밀 문자열 미출력, 예외 재전파, 정상 실행, 진단 개수 제한 및 private 이력 보관을 검증한다.
- 웹 앱과 별도 Discord Notifier는 변경 대상이 아니다. 운영 worker의 session.py, collection.py, worker.py만 백업 후 교체한다. 실행 중인 작업은 중단하지 않고 예약 활성 상태를 보존한다.
- 복구는 위 세 파일의 백업 복원이다. private/public 데이터와 세션을 되돌리거나 지우지 않는다. GitHub origin push는 하지 않는다.
- 적용 시각·예약 수집 결과는 확인 후 아래에 기록한다.
