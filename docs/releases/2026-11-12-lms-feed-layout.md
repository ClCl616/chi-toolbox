# LMS 탭 고정과 상태 알림 정렬

- `/v2/lms`와 과제 화면의 LMS 보기 탭을 스크롤 시 상단에 고정한다. 불투명 배경으로 뒤의 메시지가 겹쳐 보이지 않게 한다.
- 상태 알림은 오른쪽 말풍선과 아이콘으로 배치하고 메타 정보도 오른쪽 정렬한다. 소식은 왼쪽에 유지하며 상태별 경고/복구 색상·내용 접기·읽음 상태를 보존한다.
- 읽음 판정에서 고정 탭 높이를 제외한다. 탭에 가려진 메시지가 보이는 것으로 판정되지 않도록 한다.
- 변경 파일: `features/lms/components/lms-workspace.module.css`, `lms-feed.tsx`. 수집기·API·DB·인증 계약은 변경하지 않는다.

## 검증과 배포

`npm.cmd run check`, `npm.cmd run build:test`, `TEST_BROWSER=msedge npm.cmd run test:lms`, `npm.cmd run test:smoke`, `git diff --check`를 확인했다. 테스트는 격리된 임시 snapshot/read 파일을 사용한다. 운영 데이터 쓰기는 하지 않는다.

LMS 브라우저 회귀에 1440/390/320px의 스크롤 후 탭 고정 위치, 상태 알림 오른쪽/소식 왼쪽 배치, 가로 넘침 없음, 고정 탭으로 과제 화면 전환 검사를 추가했다. PC·모바일 합성 화면 스크린샷도 확인했다.

Windows 웹 앱은 기존 `deploy/windows/deploy.ps1`로 후보 빌드·health 후 릴리스 전환한다. 문제 발생 시 `rollback.ps1`로 이전 웹 릴리스를 복구한다. 별도 LMS 수집기 작업은 재배포하거나 재시작하지 않는다. GitHub origin push는 하지 않는다.

## 운영 적용 결과

- 구현 커밋 a41e031, 운영 릴리스 20261112-133425-359-a41e0314d8ae 적용 완료.
- 첫 전달 명령의 PowerShell stderr 처리에서 빌드 안내 문구를 오류로 처리해 중단됐다. 기존 릴리스가 정상 유지됨을 확인한 뒤 hidden Start-Process로 stdout/stderr를 분리해 재실행하여 배포를 완료했다.
- 운영 주소에서 합성 API 응답을 사용해 PC1440/mobile390의 탭 고정·오른쪽 상태 알림을 확인했다. 실제 개인정보·읽음 상태는 변경하지 않았다. health200, 미로그인 LMS API401 확인.
