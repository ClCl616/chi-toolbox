# LMS 메인 팝업으로 인한 갱신 실패 수정

## 원인과 변경

- 저장 세션은 인증된 상태였지만 메인 `#mainPopup .layerPopup`이 학기 선택 메뉴의 포인터 입력을 가로막았다. 공통 수강 목록 탐색이 실패해 전체 수집 범주가 `operation_failed`로 기록됐다. 작업 스케줄러 결과 0은 수집 성공을 뜻하지 않는다.
- `workers/lms/popups.py`가 관측된 `window숫자` 안의 `.header #closeButton숫자`만 닫는다. 겹친 팝업은 해당 닫기 컨트롤의 click 이벤트를 호출하고 실제 사라짐을 확인한다. 내용 링크, 오늘 하루 숨기기, 쿠키 저장, DOM 강제 제거는 사용하지 않는다.
- 로그인 전·후 인증 확인, 메인 재진입, 늦게 표시되어 학기 선택을 가로막는 팝업을 처리한다. 개수는 고정하지 않으며 무한 반복 방지 상한은 20회다. 알 수 없는 구조나 닫히지 않는 창은 `PopupBlocked`로 중단하고 주기 최상위에서 `popup_blocked`를 기록한다. 기존 collector 내부에서 잡히는 오류는 기존 오류 계약을 따른다.
- worker 시작 시 collector를 import하기 전에 Notifier auth 함수의 프로세스 내 어댑터를 설치한다. 별도 Notifier 소스·Discord 작업과 수집/비교 정책은 변경하지 않는다. 외부 Notifier 버전을 바꾸면 import 순서와 팝업 DOM을 재검증한다.

## 검증

```powershell
& '../DJU-LMS-Notifier/.venv/Scripts/python.exe' -B -m unittest discover -s workers/lms/tests -v
npm.cmd run check
git diff --check
```

- Python 21개 통과: 기존 15개와 Edge 합성 화면 6개. 브라우저 요청은 로컬 합성 HTML로 모두 가로채며 실제 LMS나 DB를 사용하지 않는다. Edge가 필요하다.
- 기본 검사 통과: 구조·타입·린트·Node 단위19개. 웹 코드 변경이 없어 웹 production 재빌드는 하지 않았다.
- 서버에서 새 어댑터를 메모리에만 적용해 실제 수강 목록 탐색 성공(9과목)을 확인했다. 본문·첨부를 열거나 쿠키·DB·snapshot을 저장하지 않았다. 후속 정상 예약 실행에서 전체 수집 복구를 확인했다(아래 결과 참고).

## 전달과 복구

이 변경은 웹 앱과 별도 Discord 수집기의 배포가 아니다. `CHI-TOOLBOX-LMS`가 실행 중이면 끝날 때까지 기다린다. 기존 활성 상태를 기록한 후 작업만 잠시 비활성화하고 worker 파일을 백업한다. `workers/lms/{worker,projector,boards,popups}.py` 네 파일을 전용 `C:/Services/chi-toolbox-lms/worker`로 함께 전달한다. 설치 스크립트에도 popups.py를 추가했다.

서버의 실제 Python/Notifier source로 오프라인 테스트·파일 해시·import를 확인한 후 기존 작업 활성 상태를 복원한다. private/public 데이터·환경 파일·세션은 보존한다. 수집을 강제 실행하지 않는다. 실패하면 백업 worker 파일을 복원하고 원래 작업 상태로 되돌린다. GitHub push는 수행하지 않는다.

## 적용 결과

- 구현 커밋 `8c19e37`. 2026-11-12 11:48 KST에 Windows 수집기 적용 완료. 서버 Python21개, 네 파일 해시, 설치 위치의 import/schema v5 및 공통 탐색 함수 연결 검사 통과.
- 이전 worker 파일 백업: `C:/Services/chi-toolbox-lms/backups/popups-20261112-114843`. 작업은 기존 주기가 끝난 뒤 교체했으며 Ready/Enabled로 복원했다. 다음 예정 실행은 같은 날 12:14 KST다.
- 12:14:41 예약 실행이 12:20:34에 healthy/오류 없음으로 완료되어 전체 수집·snapshot 최신화를 확인했다. 웹 앱·Discord·운영 데이터·origin은 변경하지 않았다. 기존 문서 재구성 변경은 커밋에서 제외했다.

후속 수집기는 [탐색 공유·성능 개선](2026-11-12-lms-collection-speed.md)이 최종 구현이다. 현재 설치/전달 파일은 해당 문서의 일곱 파일을 따른다. 이 문서의 네 파일 전달 절차는 팝업 수정 당시 기록이다.
