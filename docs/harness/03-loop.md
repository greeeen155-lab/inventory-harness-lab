# 03. 구현·검증 루프

> 문서 역할: Issue를 기준으로 구현·검증·재시도·PR 진입·CI 복귀·사람 인계·세션 재개를 결정하는 원본
>
> 검증 판정 원본: [02-verification.md](./02-verification.md)
>
> 권위 라우팅 원본: [00-ssot.md](./00-ssot.md)
>
> 상태: 초안

---

## 1. 문서 역할과 책임 경계

이 문서는 `02-verification.md`의 판정 결과를 입력으로 받아 작업의 다음 행동을 결정한다.

- `02-verification.md`는 **한 번의 검증 실행을 수행하고 `PASS` / `FAIL` / `NEEDS_HUMAN`으로 판정**한다.
- `03-loop.md`는 **그 판정 이후 구현·재시도·PR·CI·종료를 어떻게 진행할지 결정**한다.

`03-loop.md`는 02의 검증 명령, 단계 순서, 기대값, 판정 기준을 복사하거나 재정의하지 않는다. 검증은 항상 [02-verification.md](./02-verification.md)의 원본을 따른다.

```text
03-loop
  ↓ 02-verification 실행 위임
02-verification
  ↓ PASS / FAIL / NEEDS_HUMAN
03-loop의 다음 상태 결정
```

## 2. 권위 입력 및 작업 시작

작업 시작과 세션 재개 시 다음을 확인한다.

1. GitHub Issue와 canonical URL
2. Issue의 작업 범위·종료 조건·검증 절차·보호 범위
3. Issue의 `max-loops` 값
4. [00-ssot.md](./00-ssot.md)의 원본 라우팅 및 충돌 처리 정책
5. [02-verification.md](./02-verification.md)의 검증 절차와 판정
6. 현재 branch, base SHA, current SHA
7. working tree와 staged/unstaged 변경사항
8. 이전 attempt와 PR/CI 상태의 durable 기록
9. 마지막 검증 결과와 로그

구현을 시작하려면 다음 조건이 모두 충족되어야 한다.

- Issue가 존재하고 canonical URL을 확인할 수 있다.
- 작업 범위와 종료 조건이 제3자에게 판정 가능하다.
- `max-loops`가 양의 정수이거나 기본값 `3`을 적용할 수 있다.
- 현재 Git 상태를 확인할 수 있다.
- 기존 변경사항의 Issue 귀속을 판단할 수 있다.
- Issue·SSOT 간 unresolved 충돌이 없다.

조건을 충족하지 못하면 attempt를 소비하지 않고 `NEEDS_HUMAN`으로 중단한다.

### 2.1 기존 변경사항

작업 시작 시 이미 변경사항이 있으면 삭제·checkout·reset하거나 승인 없이 정리하지 않는다. 다음을 기록한다.

- 변경 파일
- staged / unstaged 상태
- branch와 base/current SHA
- 현재 Issue와의 관련성 근거

관련성이 명확하면 현재 작업의 사전 변경으로 보존한다. 귀속이 불명확하면 `NEEDS_HUMAN`으로 중단한다.

## 3. 상태 머신

```text
UNREADY
  ↓ 사전조건 충족
READY
  ↓ 구현 시작
IMPLEMENTING
  ↓ 코드 변경 완료
VERIFYING
  ↓ 02 판정
  ├─ PASS → PR_GATE_CHECK
  ├─ FAIL → FAIL_TRIAGE
  └─ NEEDS_HUMAN → NEEDS_HUMAN

FAIL_TRIAGE
  ├─ Issue 범위 내 수정 가능 + 잔여 attempt 있음 → IMPLEMENTING
  └─ 그 외 → NEEDS_HUMAN

PR_GATE_CHECK
  ├─ 세 조건 모두 충족 → PR_READY
  └─ 하나라도 미충족 → 기존 loop 유지 또는 NEEDS_HUMAN

PR_READY → PR_CREATED → CI_RUNNING
                         ├─ CI_PASS → REVIEW_PENDING
                         └─ CI_FAIL → CI_FAILURE_TRIAGE
                                             ├─ 로컬 재현 성공 → IMPLEMENTING
                                             └─ 로컬 재현 실패 → NEEDS_HUMAN

REVIEW_PENDING
  ├─ 명시적 사람 승인 + merge/close 정책 충족 → DONE
  ├─ unmerged PR CLOSED + 유효한 반려 코멘트 → REVIEW_REJECTED
  ├─ unmerged PR CLOSED + 반려 코멘트 없음/불완전 → NEEDS_HUMAN
  └─ 그 외 결정 불명확 → NEEDS_HUMAN

REVIEW_REJECTED
  ├─ 명시적 재작업/재진입 결정(기존 Issue 범위 내) → RESUMABLE
  ├─ 명시적 종료 결정 → ABANDONED
  └─ 범위 변경 또는 결정 불명확 → NEEDS_HUMAN

RESUMABLE
  ├─ 사람 반려 후 새 구현 사이클 → IMPLEMENTING
  ├─ 검증 재개 → VERIFYING
  ├─ PR/CI 처리 재개 → 해당 상태
  └─ 종료 결정 → ABANDONED

REVIEW_PENDING에서는 사람의 명시적인 승인 또는 재작업/재진입 결정 없이
자동으로 `DONE`이나 `IMPLEMENTING`에 진입하지 않는다. `OPEN + CI PASS`는
항상 `REVIEW_PENDING`으로 유지하며, AI는 임의로 Merge·Issue close·다음
상태 진행을 하지 않는다. Issue 범위·요구사항·검증 기준의 변경이 필요하면
`NEEDS_HUMAN`으로 중단한다.

PR이 닫혔다는 사실만으로 승인·반려·완료를 추측하지 않는다. merge되지 않은
PR의 종료에서 유효한 반려 코멘트를 확인할 수 없으면
`CLOSED_WITHOUT_DECISION → NEEDS_HUMAN`으로 기록한다.

사람 반려는 기존 구현 접근이나 요구 해석이 달라질 수 있는 새 피드백
사이클이다. 유효한 반려와 명시적 재작업 결정이 모두 있을 때만 기존 PR을
reopen한 뒤 구현 루프로 재진입한다.

NEEDS_HUMAN
  ↓ 사람의 명시적 결정
RESUMABLE
  ├─ 작업 재개 → IMPLEMENTING
  ├─ 검증 재개 → VERIFYING
  ├─ PR/CI 처리 재개 → 해당 상태
  └─ 종료 결정 → ABANDONED
```

상태 의미:

| 상태 | 의미 |
|---|---|
| `UNREADY` | 작업 시작 사전조건을 충족하지 못함 |
| `READY` | 구현을 시작할 수 있음 |
| `IMPLEMENTING` | Issue 범위 안에서 코드 변경 중 |
| `VERIFYING` | 02의 한 번의 검증을 실행 중 |
| `FAIL_TRIAGE` | 02 FAIL의 수정 가능성과 남은 예산을 판단 중 |
| `PR_GATE_CHECK` | PR 진입 조건을 확인 중 |
| `PR_READY` | PR 진입 조건 세 가지를 모두 충족함 |
| `PR_CREATED` | 기존 또는 새 PR이 현재 commit을 가리킴 |
| `CI_RUNNING` | PR의 CI 실행·대기 중 |
| `CI_FAILURE_TRIAGE` | CI FAIL의 로컬 재현을 확인 중 |
| `REVIEW_PENDING` | CI PASS 후 사람의 승인·반려 판단을 기다림. `OPEN + CI PASS`에서 AI는 Merge·Issue close·재구현을 하지 않음 |
| `REVIEW_REJECTED` | unmerged PR이 사람의 유효한 반려 코멘트로 거부되었으며, 명시적 재작업/재진입 결정을 기다림 |
| `CLOSED_WITHOUT_DECISION` | unmerged PR이 닫혔으나 유효한 승인·반려 결정 근거를 찾지 못한 사건. 즉시 `NEEDS_HUMAN`으로 전환 |
| `NEEDS_HUMAN` | AI가 추가 판단·수정·우회를 해서는 안 됨 |
| `RESUMABLE` | 사람의 결정에 따라 재개 가능 |
| `DONE` | 기존 review/merge/Issue 완료 정책까지 충족해 lifecycle이 끝남 |
| `ABANDONED` | 사람의 결정으로 작업을 종료함 |

`PASS`는 한 번의 검증 판정이며 `DONE`과 같지 않다.

## 4. Attempt 정의 및 최대 반복 횟수

### 4.1 Attempt 정의

다음 전체 사이클을 1 attempt로 계산한다.

```text
Issue 범위 안의 코드 수정
→ 수정 완료
→ 02-verification에 정의된 검증 실행
→ 검증 결과 기록
→ PASS / FAIL / NEEDS_HUMAN 판정
```

attempt ID는 증가하는 값으로 기록하며 세션 변경이나 PR/CI 단계 진입으로 초기화하지 않는다.

다음은 attempt를 소비하지 않는다.

- Issue·SSOT·Git 상태 확인
- 기존 변경사항 귀속 확인
- 사람 승인 대기
- 로그 재확인
- 동일 코드에 대한 검증 재실행
- 검증 결과 복구를 위한 확인
- PR 생성·갱신
- CI 실행·대기·rerun·로그 조회·결과 기록
- CI FAIL을 로컬에서 재현하기 위한 명령 실행

CI FAIL 뒤 로컬 재현만 하는 것은 기존 attempt를 소비하지 않는다. 로컬 재현 후 실제 코드 변경을 시작하고 그 변경에 대한 02 검증 사이클을 시작할 때만 다음 attempt가 된다.

### 4.2 `max-loops`

- Issue에 `max-loops`가 있으면 해당 양의 정수를 사용한다.
- 없으면 기본값 `3`을 사용한다.
- AI는 상한을 임의로 늘리거나 세션 변경 후 0으로 초기화하지 않는다.
- PASS하면 남은 attempt와 관계없이 PR 게이트로 이동한다.
- `FAIL` 후 수정 가능하고 잔여 attempt가 있을 때만 다음 attempt를 시작한다.
- 사람 반려 후 새 구현 사이클에 재진입하는 경우에만 기존 사이클의 사용 attempt를 `0`으로 기록하고, 동일한 `max-loops`를 새 사이클에 적용한다. 이는 이전 기록을 삭제하는 초기화가 아니다.
- 상한에 도달하면 추가 구현·검증을 하지 않고 `NEEDS_HUMAN`으로 중단한다.

사람 반려에 따른 attempt reset은 세션 재개, PR reopen 자체, CI rerun, 로그 조회,
동일 SHA 검증 재실행에는 적용하지 않는다. 새 사이클에서 실제 코드 변경을 시작할
때 첫 회차를 `attempt 1`로 기록하며, 이전 사이클의 attempt와 검증 결과는 append-only로
보존한다.

예:

```text
사이클 A: attempt 1 → PASS → CI PASS → REVIEW_PENDING
→ 유효한 사람 반려 + 재작업 결정 → 기존 사용 attempt 0 기록
→ 같은 PR reopen → 새 코드 변경 시작 → 사이클 B attempt 1
```

반려 코멘트 확인·반려 사건 기록·재작업 승인 대기·PR reopen은 attempt를 소비하지
않는다. 반려 이후에도 새 `max-loops` 상한을 임의로 늘리지 않는다.

예:

```text
attempt 1 → FAIL → attempt 2 → FAIL → attempt 3 → PASS
```

```text
attempt 1 → PASS → PR → CI FAIL → 로컬 재현 → attempt 2
attempt 2 → PASS → PR/CI → CI FAIL → 로컬 재현 → attempt 3
attempt 3 → PASS → PR/CI → CI FAIL → 로컬 재현
→ 잔여 attempt 없음 → NEEDS_HUMAN
```

CI FAIL 자체는 어느 예에서도 attempt를 증가시키지 않는다. `attempt 4`를 생성하지 않는다.

## 5. 판정별 다음 행동

### 5.1 `PASS`

02가 `PASS`를 반환하면 임의의 추가 개선이나 추가 검증을 하지 않는다. Issue의 종료 조건과 PR 진입 조건을 확인하는 `PR_GATE_CHECK`로 이동한다.

```text
02 PASS → PR_GATE_CHECK
```

### 5.2 `FAIL`

FAIL이면 무조건 수정하지 않는다.

```text
FAIL
→ 실패 원인 확인
→ Issue 범위 안에서 수정 가능한가?
  ├─ 가능 + 잔여 attempt 있음 → 최소 수정 후 다음 attempt
  └─ 불가능 또는 잔여 attempt 없음 → NEEDS_HUMAN
```

재시도는 다음 조건을 모두 만족할 때만 가능하다.

- 실패 원인이 Issue 범위 안에 있다.
- 수정 대상과 기대 결과가 명확하다.
- 요구사항·검증 기준·검증 명령을 바꾸지 않고 수정할 수 있다.
- protected 또는 SSOT 판단이 필요하지 않다.
- flaky·환경 문제로 결과가 불확정하지 않다.
- 잔여 attempt가 있다.

### 5.3 `NEEDS_HUMAN`

다음 상황에서는 AI가 해석·우회·자동 재시도하지 않는다.

- Issue 요구사항·종료 조건·SSOT가 충돌함
- 범위 또는 종료 조건이 모호함
- 작업 범위 확대가 필요함
- protected 경로 또는 보호 정책 판단이 필요함
- 수동 검증 결과를 사람이 판단해야 함
- flaky·환경 문제로 결과를 확정할 수 없음
- 최대 attempt에 도달함
- 세션 재개 시 이전 기록과 현재 Git 상태가 다름
- 이전 attempt의 완료 여부를 복구할 수 없음
- 기존 변경사항의 귀속을 판단할 수 없음

## 6. PR 진입 게이트

PR은 다음 세 조건을 **모두(AND)** 충족한 경우에만 생성하거나 PR 단계로 진입한다.

1. 현재 commit에 대한 로컬 `02-verification.md` 검증 결과가 `PASS`
2. Issue의 종료 조건이 전부 충족됨
3. Issue에 완료 코멘트 작성이 완료됨

순서는 반드시 다음과 같다.

```text
로컬 02 PASS
→ Issue 종료 조건 전부 확인
→ 완료 코멘트 작성
→ PR_READY
→ PR 생성 또는 기존 PR 확인
```

세 조건 중 하나라도 충족하지 않으면 PR을 생성·갱신하지 않고 기존 loop 또는 `NEEDS_HUMAN` 상태를 유지한다.

완료 코멘트 작성은 검증이나 구현이 아니며 attempt를 소비하지 않는다. 완료 코멘트는 append-only로 기록하며, 각 PASS한 완료 attempt마다 새 코멘트를 작성한다. 이전 코멘트를 삭제하거나 덮어쓰지 않는다.

완료 코멘트의 최소 항목:

- Issue canonical URL
- PASS한 attempt ID
- `max-loops`
- 사용·잔여 attempt
- Issue 종료 조건별 결과
- 로컬 02 검증 결과
- branch와 current SHA
- 변경 파일
- 수동 확인 결과와 확인 주체
- PR 진입 가능 상태

## 7. PR·CI lifecycle

`PR_READY` 이후 다음 순서로 이동한다.

```text
PR_READY → PR_CREATED → CI_RUNNING
```

기존 PR이 현재 작업에 연결되어 있으면 새 PR을 만들지 않고 기존 PR을 유지한다. CI FAIL 후 수정한 경우에도 기존 PR에 새 commit을 push하고 CI를 다시 실행한다.

다음 작업은 모두 attempt와 분리된 PR/CI lifecycle 이벤트다.

- PR 생성·갱신
- CI 실행·대기
- CI job/step 확인
- CI 로그 조회·결과 기록
- CI rerun

### 7.1 CI `PASS`

CI PASS는 로컬 02 PASS와 별도의 PR evidence다.

```text
CI_PASS → REVIEW_PENDING
```

CI PASS만으로 다음을 수행하지 않는다.

- PR merge
- 필수 review 대체
- branch protection 우회
- Issue close
- `DONE` 처리

`REVIEW_PENDING` 이후의 merge·review·Issue close 조건은 저장소의 기존 정책과 사람의 결정에 따른다. `OPEN + CI PASS`는 사람의 판단을 기다리는 상태이므로 AI가 임의로 Merge하거나 다음 상태로 진행하지 않는다.

### 7.2 사람 승인·반려와 PR 종료

사람의 승인·반려는 PR 코멘트를 원본으로 기록한다. 자유문을 AI가 추측해
판정하지 않으며, 반려 코멘트는 다음 고정 헤더를 모두 포함해야 한다.

```text
반려 사유: <구체적인 사유>
걸린 종료 조건: <충족하지 못한 Issue 종료 조건>
재작업: 요청
```

`반려 사유:`와 `걸린 종료 조건:` 중 하나라도 없거나 값이 비어 있으면 유효한
반려 코멘트가 아니다. 해당 코멘트가 없거나 불완전한 상태에서 unmerged PR이
CLOSED가 되면 `CLOSED_WITHOUT_DECISION → NEEDS_HUMAN`으로 멈춘다. AI는 PR
제목·diff·다른 코멘트로 반려 사유를 추측하지 않고, 코드를 수정하거나 PR을
reopen하거나 attempt를 소비하지 않는다.

유효한 반려 코멘트가 확인되어도 자동으로 구현을 시작하지 않는다. 사람의
명시적인 재작업/재진입 결정이 있을 때만 다음 순서로 진행한다.

```text
REVIEW_PENDING
→ unmerged PR CLOSED + 유효한 반려 코멘트
→ REVIEW_REJECTED
→ 사람의 재작업/재진입 결정
→ 기존 PR reopen (새 PR 생성 금지)
→ 기존 사이클 attempt 사용량 0 기록
→ RESUMABLE → IMPLEMENTING
→ 코드 변경 시작 시 새 사이클 attempt 1
```

사람이 요구한 변경이 Issue 범위·종료 조건·검증 계약을 벗어나면
`NEEDS_HUMAN`으로 중단한다. 기존 Issue를 조용히 변경하거나 새 PR을 임의로
만들지 않는다. 기존 PR을 reopen할 수 없는 경우에도 `NEEDS_HUMAN`에서 명시적
사람 결정을 기다린다.

반려 사유 원문과 그 URL은 PR에 보존한다. 재진입 사실, 기존 PR/반려 코멘트
URL, attempt 사용량을 `0`으로 기록했다는 사실, 새 사이클의 `max-loops`,
branch/current SHA와 다음 작업은 Issue 코멘트에 append-only로 남긴다. 반려
사유 원문을 Issue에 복제하지 않는다.

### 7.3 `DONE`과 승인 근거

`DONE`은 로컬/CI 검증 통과만으로 결정하지 않는다. 최종 대상 SHA에 대한 명시적
사람 승인과 기존 merge·Issue close 정책이 모두 충족되어야 한다. CI PASS,
PR close, Issue close만으로 승인이나 `DONE`을 추측하지 않는다. 새 SHA가
생기면 이전 승인·반려는 새 결과에 자동으로 적용되지 않는다.

### 7.4 CI `FAIL` 사전 기록

CI FAIL이 발생하면 바로 코드를 수정하지 않는다. 먼저 다음을 기록한다.

- PR URL
- CI run URL
- 실패 job/step
- CI가 실제로 검증한 commit SHA
- 현재 local SHA
- 관련 로그 또는 artifact 위치
- CI/local 환경 정보와 차이
- 현재 attempt와 잔여 attempt

그 다음 **CI가 실제로 검증한 commit SHA를 기준으로** 로컬 재현 가능 여부를 확인한다. 현재 local SHA가 CI 검증 SHA와 다르면, 현재 local SHA에서 같은 증상이 나타난다는 사실만으로 CI 실패가 재현됐다고 판단하지 않는다. CI 검증 SHA를 checkout하거나 해당 SHA의 별도 작업 공간에서 재현해야 하며, 그 SHA를 재현할 수 없으면 `NEEDS_HUMAN`으로 전환한다. 서로 다른 commit의 결과를 같은 결과로 간주하지 않는다.

재현 판정은 다음 규칙만 따른다.

```text
CI FAIL
→ CI가 실제 검증한 commit SHA 확인
→ 해당 SHA를 기준으로 로컬 재현 가능 여부 확인
→ 동일 SHA에서 재현 성공하면 기존 loop 복귀
→ 동일 SHA에서 재현되지 않거나 해당 SHA를 재현할 수 없으면 NEEDS_HUMAN
```

"현재 작업 중인 최신 SHA에서 같은 증상이 발생했다"는 사실만으로는 CI 실패 재현으로 인정하지 않는다.

재현 확인 자체는 attempt를 소비하지 않는다. CI 검증 SHA와 현재 local SHA가 다르면 SHA 차이와 재현 기준을 durable 기록에 남긴다.

### 7.5 CI FAIL + 동일 SHA에서 로컬 재현 성공

```text
CI FAIL
→ CI 검증 SHA 확인
→ 동일 SHA에서 로컬 재현 성공
→ IMPLEMENTING
→ Issue 범위 내 최소 수정
→ 다음 attempt
→ 02-verification 전체 실행
→ PASS
→ Issue 종료 조건 재확인
→ 완료 코멘트 추가 작성
→ 기존 PR 유지
→ 새 commit push
→ CI 재실행
```

여기서 로컬 재현 성공은 CI가 검증한 commit SHA에서 동일한 실패가 확인된
경우만 의미한다. 현재 작업 중인 더 최신 SHA에서만 증상이 나타난 경우는
이 분기에 해당하지 않는다.

규칙:

- 동일 SHA에서의 로컬 재현 확인 자체는 attempt를 소비하지 않는다.
- 실제 코드 변경을 시작할 때 기존 loop의 다음 attempt를 소비한다.
- 기존 PR이 있으면 새 PR을 만들지 않는다.
- 수정 후 로컬 02 PASS와 Issue 종료 조건 전부 충족을 다시 확인한다.
- 각 완료 attempt마다 새 완료 코멘트를 남긴다.
- 기존 PR에 새 commit을 반영하고 CI를 다시 실행한다.
- CI 때문에 `max-loops`를 증가·초기화하지 않는다.

### 7.6 CI FAIL + 로컬 재현 실패

```text
CI FAIL
→ 로컬 재현 실패
→ NEEDS_HUMAN
```

다음은 로컬 재현 실패로 본다.

- 동일 commit에서 CI만 실패함
- CI와 local 환경 차이로 결과를 확정할 수 없음
- runner·secret·network·외부 서비스 문제 가능성이 있음
- flaky 여부를 확정할 수 없음
- CI 로그가 불충분함

이 상태에서 금지한다.

- CI FAIL 무시
- 로컬 PASS만으로 CI FAIL 덮어쓰기
- PR merge
- Issue 완료
- 검증 기준·Issue 요구사항·검증 명령 변경
- 실패 테스트 제외
- CI 환경 차이를 추측한 코드 수정
- 무제한 CI rerun

CI rerun이 필요하면 사람의 명시적인 결정 이후에만 수행한다. 로컬 재현 실패 확인과 `NEEDS_HUMAN` 전환은 attempt를 소비하지 않는다.

## 8. 세션 중단 및 재개

세션이 바뀌어도 attempt ID, `max-loops`, PR 상태를 초기화하지 않는다.

새 세션은 다음을 대조한다.

- Issue와 canonical URL
- branch
- base/current SHA
- working tree와 staged/unstaged 변경
- 마지막 완료 attempt와 진행 중 attempt
- 사용·잔여 attempt
- 마지막 02 판정과 로그
- PR URL과 PR 대상 SHA
- CI run URL과 상태
- 완료 코멘트 URL·작성 여부
- PR 상태와 마지막 대상 SHA
- 반려 코멘트 URL·고정 헤더 검증 결과
- 재진입·attempt reset·PR reopen 기록
- 미해결 `NEEDS_HUMAN` 결정
- 다음 작업

기록과 현재 상태가 일치할 때만 기록된 다음 단계부터 재개한다. branch/SHA drift, 기록에 없는 변경, 검증 완주 여부 불명확, Issue 조건 변경, `max-loops` 변경, 사람 결정 부재가 있으면 `NEEDS_HUMAN`으로 중단한다.

검증·CI 도중 세션이 끊기면 PASS/FAIL을 추측하지 않는다. durable 로그로 완주 여부를 확인할 수 있을 때만 해당 판정을 복구한다. 확인할 수 없으면 `NEEDS_HUMAN`이다.

## 9. 상태 기록 요구사항

현재 저장소에는 attempt 상태 저장기, resume 명령, 자동 retry 오케스트레이터가 없다. 따라서 아래는 현재 수동으로 준수해야 하는 normative contract이며, 이번 문서는 자동화를 구현하지 않는다.

attempt·PR·CI 기록은 기존 기록을 덮어쓰지 않는 append-only 방식으로 세션 밖에 보존한다.

| 영역 | 최소 기록 |
|---|---|
| Issue | 번호, canonical URL |
| Loop | 현재 상태, 다음 작업 |
| Attempt | attempt ID, `max-loops`, 사용·잔여 횟수 |
| Git | branch, base SHA, current SHA, working tree 상태 |
| Implementation | attempt별 변경 요약과 파일 |
| Verification | 02 실행 식별자, 환경, 단계별 결과, 종료 코드, 로그 위치 |
| Completion | 완료 코멘트 URL·시각·작성 주체·대상 SHA |
| PR | PR URL, 생성/갱신 시점, 대상 SHA |
| CI | CI run URL, 대상 SHA, job/step, 결과, 로그 위치 |
| Review | PR 상태 전이, 승인·반려 결정, 반려 코멘트 URL과 고정 헤더 검증 결과, 대상 SHA |
| Human | 결정 내용, 결정자, 결정 시점 |
| Re-entry | 기존 PR URL, reopen event, 기존 attempt 사용량 0 기록, 새 사이클 max-loops·다음 작업 |

허용되는 durable 기록 위치는 Issue 댓글, PR 기록, CI 로그/artifact, 전용 상태 저장소다. 채팅 기록만을 유일한 복구 근거로 사용하지 않는다.

## 10. 완료·중단 보고

### 10.1 PR 진입 보고

- Issue URL
- 로컬 02 PASS attempt
- `max-loops`, 사용·잔여 attempt
- 종료 조건별 결과
- 완료 코멘트 URL
- branch/current SHA
- 변경 파일
- PR URL 또는 PR 생성 예정 상태

### 10.2 CI PASS 보고

- PR URL
- CI run URL
- 검증 대상 SHA
- CI PASS 결과
- `REVIEW_PENDING` 상태
- attempt 수를 변경하지 않았다는 사실

### 10.3 사람 반려·재진입 보고

- Issue URL
- 기존 PR URL과 PR의 종료 상태
- 반려 코멘트 URL (원문은 PR에만 보존)
- 고정 헤더 `반려 사유:`·`걸린 종료 조건:` 검증 결과
- `REVIEW_REJECTED → RESUMABLE → IMPLEMENTING` 전이와 명시적 재작업 결정
- 기존 사이클 attempt 사용량을 `0`으로 기록했다는 사실
- 새 사이클 `max-loops`, 다음 attempt `1`, branch/current SHA
- 같은 PR을 reopen했다는 사실과 새 PR을 만들지 않았다는 사실
- Issue 코멘트에는 반려 사유 원문을 복제하지 않았다는 사실

반려 코멘트가 없거나 헤더가 누락된 경우에는 위 보고 대신
`CLOSED_WITHOUT_DECISION → NEEDS_HUMAN` 보고를 작성하며, reopen·코드 변경·attempt
소비를 하지 않는다.

### 10.4 CI FAIL·로컬 재현 성공 보고

- PR/CI URL
- 실패 job/step·로그
- CI SHA와 local SHA
- 로컬 재현 명령·결과
- CI 실행은 attempt에 포함되지 않았다는 사실
- 기존 PR 유지 여부
- 다음 attempt ID와 다음 단계

### 10.5 CI FAIL·로컬 재현 실패 보고

- PR/CI URL
- 실패 job/step·로그
- CI/local 환경 비교
- 재현 명령·재현되지 않은 결과
- 사용·잔여 attempt(변경 없음)
- `NEEDS_HUMAN` 사유
- 사람에게 필요한 단일 결정
- 결정 전 merge·Issue 완료·추가 자동 수정 금지

### 10.6 DONE

`DONE`은 다음을 모두 충족하고, 기존 review·merge·Issue close 정책과 사람의 결정이 완료된 경우에만 기록한다.

- 로컬 02 PASS
- Issue 종료 조건 전부 충족
- 필요한 수동 조건 확인
- 완료 코멘트 기록
- PR CI PASS (최종 대상 SHA)
- 최종 대상 SHA에 대한 명시적 사람 승인
- 필요한 review/merge/Issue close 절차 완료
- 최종 상태와 근거의 durable 기록 완료

CI PASS만으로 `DONE` 처리하지 않는다.

### 10.7 중단

`NEEDS_HUMAN` 또는 세션 중단 보고에는 다음을 포함한다.

- Issue URL
- 현재 상태와 중단 사유
- branch/SHA/tree 상태
- `max-loops`, 사용·잔여 attempt
- 회차별 변경·검증 결과
- PR/CI URL과 로그
- 충돌·불확실성·protected 관련 내용
- 사람에게 필요한 단일 결정
- 결정 후 같은 attempt를 재개할지 새 attempt인지

## 11. 금지 규칙 요약

```text
로컬 02 PASS
→ Issue 종료 조건 전부 충족
→ 완료 코멘트 작성
→ PR_READY
→ PR 생성 또는 기존 PR 유지
→ CI 실행 (attempt 비소비)

CI PASS
→ REVIEW_PENDING
→ CI PASS만으로 DONE/merge/Issue close 금지

CI FAIL
→ 먼저 기록
→ 로컬 재현
  ├─ 재현 성공 → 기존 loop IMPLEMENTING 복귀
  │              → 코드 변경 시에만 다음 attempt
  │              → 기존 PR에 새 commit
  └─ 재현 실패 → NEEDS_HUMAN

세션 중단
→ durable 기록 + Git/Issue/PR/CI 상태 대조
→ 일치하면 재개
→ 불일치하면 NEEDS_HUMAN
```

다음 행동은 항상 금지한다.

- 검증 통과를 위한 Issue 요구사항·종료 조건 변경
- 검증 명령·단계·판정 기준 변경 또는 생략
- 실패 테스트 제외
- `max-loops` 증가 또는 초기화
- CI FAIL 무시
- 로컬 재현 실패 원인을 추측한 코드 수정
- protected 정책·보호 경로·SSOT 정책 변경
- 사람 판단을 AI가 대신함
