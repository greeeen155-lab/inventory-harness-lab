# 03. 구현·검증 루프

> 문서 역할: Issue를 기준으로 구현과 검증을 반복하고, `02-verification.md`의 판정 결과에 따라 다음 행동·종료·사람 인계·세션 재개를 결정하는 원본
>
> 검증 판정 원본: [02-verification.md](./02-verification.md)
>
> 권위 라우팅 원본: [00-ssot.md](./00-ssot.md)
>
> 상태: 초안

---

## 1. 문서 역할

이 문서는 `02-verification.md`의 검증 판정을 입력으로 받아 작업의 다음 lifecycle을 결정한다.

* `02-verification.md`는 **한 번의 검증을 수행하고 `PASS` / `FAIL` / `NEEDS_HUMAN`을 판정**한다.
* `03-loop.md`는 **그 판정 이후 무엇을 할지 결정**한다.
* 구현은 항상 Issue의 범위 안에서만 수행한다.
* 반복 횟수는 `max-loops`로 제한한다.
* 판단할 수 없는 상황에서는 자동 진행하지 않고 `NEEDS_HUMAN`으로 중단한다.

핵심 책임 경계는 다음과 같다.

> **02 = 검증 결과의 판정**
>
> **03 = 판정 이후 lifecycle의 결정**

03은 02의 검증 명령, 단계 순서, 기대값, 판정 기준을 복사하거나 재정의하지 않는다.

---

## 2. 권위 입력 및 시작 조건

작업 시작과 세션 재개 시 다음 정보를 확인한다.

1. GitHub Issue와 canonical URL
2. Issue의 작업 범위와 종료 조건
3. Issue의 `max-loops`
4. [00-ssot.md](./00-ssot.md)의 라우팅 및 충돌 처리 정책
5. [02-verification.md](./02-verification.md)의 검증 절차와 판정
6. 현재 branch, base SHA, current SHA
7. working tree와 staged/unstaged 변경사항
8. 이전 attempt의 durable 기록
9. 마지막 검증 결과와 로그

다음 조건을 만족해야 구현을 시작할 수 있다.

* Issue가 존재한다.
* canonical URL을 확인할 수 있다.
* 작업 범위와 종료 조건이 판단 가능하다.
* `max-loops`가 양의 정수이거나 기본값 `3`을 적용할 수 있다.
* 현재 Git 상태를 확인할 수 있다.
* 기존 변경사항의 귀속을 판단할 수 있다.
* Issue·SSOT 간 unresolved 충돌이 없다.

조건을 만족하지 못하면 attempt를 소비하지 않고 `NEEDS_HUMAN`으로 중단한다.

Issue·SSOT·현재 코드가 충돌하는 경우 AI가 임의로 우선순위를 결정하지 않는다.

---

## 3. 상태 머신

작업은 다음 상태를 따른다.

```text
UNREADY
   ↓ 사전조건 충족
READY
   ↓ 구현 시작
IMPLEMENTING
   ↓ 구현 완료
VERIFYING
   ↓ 02 판정
 ┌───────┼──────────────┐
PASS    FAIL       NEEDS_HUMAN
 ↓       ↓                ↓
DONE   재시도 판단       사람 결정
        │                 ↓
   ┌────┴────┐        RESUMABLE
   │         │
  가능      불가
   │         │
   ↓         ↓
IMPLEMENTING NEEDS_HUMAN
```

### 상태 의미

| 상태             | 의미                         |
| -------------- | -------------------------- |
| `UNREADY`      | 구현을 시작할 수 없는 상태            |
| `READY`        | 구현을 시작할 수 있는 상태            |
| `IMPLEMENTING` | Issue 범위 내 구현 중            |
| `VERIFYING`    | 02의 검증을 실행 중               |
| `DONE`         | 작업 lifecycle이 완료됨          |
| `NEEDS_HUMAN`  | AI가 추가 판단하지 않고 사람의 결정을 기다림 |
| `RESUMABLE`    | 사람의 결정에 따라 작업을 재개할 수 있음    |
| `ABANDONED`    | 사람의 결정으로 작업을 종료함           |

`PASS`와 `DONE`은 동일하지 않다.

* `PASS` = 한 번의 검증 판정
* `DONE` = 전체 작업 lifecycle의 완료 상태

Issue에 사람이 수행해야 하는 종료 조건이 있으면 `PASS` 이후에도 `NEEDS_HUMAN` 상태를 유지한다.

---

## 4. Attempt 및 반복 상한

### 4.1 Attempt 정의

다음 전체 사이클을 1 attempt로 계산한다.

```text
Issue 범위 확인
→ 코드 수정
→ 02-verification 실행
→ 검증 결과 기록
→ PASS / FAIL / NEEDS_HUMAN 판정
```

attempt ID는 증가하는 값으로 관리하며 세션이 변경되어도 초기화하지 않는다.

### 4.2 Attempt를 소비하지 않는 작업

다음 작업은 attempt를 소비하지 않는다.

* Issue·SSOT·Git 상태 확인
* 기존 변경사항 귀속 확인
* 사람 승인 대기
* 로그 재확인
* 동일 코드에 대한 검증 재실행
* 검증 결과 복구를 위한 로그 확인
* 검증 시작 전 작업 중단

같은 코드에 대한 검증을 여러 번 실행해도 새로운 attempt가 아니다.

새 코드 변경을 수행하고 다시 완전한 구현→검증 사이클을 시작할 때 다음 attempt가 된다.

### 4.3 `max-loops`

* Issue에 `max-loops`가 있으면 해당 값을 사용한다.
* 없으면 기본값 `3`을 사용한다.
* AI는 상한을 임의로 증가시키지 않는다.
* `PASS`하면 남은 attempt와 관계없이 종료한다.
* `FAIL` 후 재시도 조건을 만족하고 잔여 attempt가 있을 때만 다음 attempt를 시작한다.
* 상한에 도달하면 추가 attempt를 수행하지 않는다.

---

## 5. 판정별 다음 행동

### 5.1 `PASS`

`02-verification.md`가 `PASS`를 반환하고 Issue의 자동 종료 조건이 충족되면:

```text
PASS → DONE
```

이후 다음 행동을 수행하지 않는다.

* 추가 코드 수정
* 개선 목적의 추가 attempt
* 임의의 추가 검증

최종 attempt와 변경사항, 검증 근거를 기록한다.

Issue에 수동 확인이 필요한 조건이 남아 있으면:

```text
PASS → NEEDS_HUMAN
```

사람의 확인을 AI가 대신하지 않는다.

---

### 5.2 `FAIL`

`FAIL`이라고 해서 자동으로 다시 수정하지 않는다.

다음 조건을 모두 만족할 때만 재시도한다.

* 실패 원인이 Issue 범위 안에 있다.
* 수정 대상과 기대 결과가 명확하다.
* 요구사항이나 검증 기준을 변경하지 않고 수정할 수 있다.
* 잔여 attempt가 있다.
* protected 또는 SSOT 판단이 필요하지 않다.
* 단순 환경 문제나 flaky 결과라고 볼 근거가 부족하지 않다.

조건을 만족하면:

```text
FAIL
→ 원인 확인
→ 최소 수정
→ 다음 attempt
```

조건을 만족하지 않으면:

```text
FAIL → NEEDS_HUMAN
```

FAIL 기록에는 최소한 다음을 남긴다.

* 실패 단계
* 실패 근거
* 원인 분석
* 변경 파일
* 다음 최소 수정
* 사용 attempt
* 잔여 attempt

---

### 5.3 `NEEDS_HUMAN`

다음 상황에서는 자동 진행하지 않는다.

* Issue 요구사항 또는 종료 조건이 충돌한다.
* Issue 범위가 모호하다.
* 작업 범위를 확대해야 한다.
* protected 경로 또는 보호 정책의 판단이 필요하다.
* Issue와 SSOT가 충돌한다.
* 수동 검증 결과의 사람 판단이 필요하다.
* flaky 또는 환경 문제 여부를 확정할 수 없다.
* `max-loops`에 도달했다.
* 세션 재개 시 이전 상태와 현재 Git 상태가 일치하지 않는다.
* 이전 attempt의 완료 여부를 복구할 수 없다.
* 기존 변경사항의 귀속을 판단할 수 없다.
* 필요한 사람의 승인 또는 결정이 없다.

`NEEDS_HUMAN`은 일반적인 재시도 상태가 아니라 **AI의 판단을 중단하는 상태**다.

---

## 6. Protected 및 기존 변경사항

### 6.1 Protected

protected 관련 문제가 발생하면 즉시 `NEEDS_HUMAN`으로 전환한다.

AI는 다음을 수행하지 않는다.

* protected 정책 완화
* 보호 경로 목록 변경
* 승인 조건 완화
* 검증 우회
* protected 변경을 되돌려 검증 통과
* protected 실패를 일반적인 FAIL로 처리하여 자동 재시도

사람에게는 다음을 전달한다.

* 실패한 검사
* 보호 경로
* 현재 변경사항
* 필요한 승인 또는 결정

---

### 6.2 기존 변경사항

작업 시작 시 dirty working tree가 있으면 다음을 확인한다.

* 변경 파일
* staged / unstaged 상태
* branch와 SHA
* 현재 작업과의 관련성

기존 변경의 귀속이 명확하면 보존하고 현재 작업의 사전 변경으로 기록한다.

귀속이 불명확하면 기존 변경을 삭제하거나 정리하지 않고 `NEEDS_HUMAN`으로 중단한다.

AI는 승인 없이 다음 작업을 수행하지 않는다.

* `reset`
* `checkout`
* 기존 변경 삭제
* 기존 변경 임의 정리

---

## 7. 세션 재개 및 영속 기록

### 7.1 세션 재개

세션이 변경되어도 attempt ID와 작업 상태를 초기화하지 않는다.

새 세션에서는 다음을 확인한다.

* Issue와 canonical URL
* branch
* base SHA / current SHA
* working tree
* staged / unstaged 변경
* 마지막 완료 attempt
* 진행 중 attempt
* 마지막 02 판정
* 검증 로그
* `max-loops`
* 사용 / 잔여 attempt
* 다음 작업
* 미해결 `NEEDS_HUMAN` 결정

기록과 현재 Git 상태가 일치하면 기록된 다음 단계부터 재개한다.

다음 중 하나라도 일치하지 않으면 추측으로 진행하지 않고 `NEEDS_HUMAN`으로 전환한다.

* branch 또는 SHA drift
* 기록에 없는 변경 파일
* 검증 완주 여부 불명확
* Issue 범위 변경
* 종료 조건 변경
* `max-loops` 변경
* 필요한 사람 결정 기록 부재

검증 도중 세션이 끊긴 경우 PASS/FAIL을 추측하지 않는다.

durable 기록과 로그로 검증 완주 여부를 확인할 수 있을 때만 판정을 복구한다. 확인할 수 없으면 `NEEDS_HUMAN`으로 둔다.

---

### 7.2 Durable 기록

attempt 상태는 기존 기록을 덮어쓰지 않는 append-only 방식으로 보존한다.

최소 기록 항목은 다음과 같다.

| 항목             | 기록 내용                            |
| -------------- | -------------------------------- |
| Issue          | 번호, canonical URL                |
| Loop           | 현재 상태                            |
| Session        | session ID                       |
| Attempt        | attempt ID                       |
| Budget         | `max-loops`, 사용 횟수, 잔여 횟수        |
| Git            | branch, base SHA, current SHA    |
| Tree           | working tree, staged/unstaged 변경 |
| Implementation | 변경 요약 및 파일                       |
| Verification   | 02 실행 식별자와 환경                    |
| Result         | 단계별 결과 및 로그 위치                   |
| Checkpoint     | 구현 시작, 검증 시작, 판정 완료              |
| Decision       | `PASS` / `FAIL` / `NEEDS_HUMAN`  |
| Human          | 승인·결정 내용과 결정자                    |
| Next           | 다음 작업                            |

기록은 세션 종료 후에도 접근할 수 있어야 한다.

허용되는 예시는 다음과 같다.

* Issue 댓글
* PR 기록
* CI 로그 / artifact
* 전용 상태 저장소

채팅 기록만을 유일한 복구 근거로 사용하지 않는다.

---

## 8. 완료 및 중단 기준

### DONE

다음 조건을 만족하면 `DONE`으로 종료한다.

* 02의 `PASS`
* Issue의 적용 가능한 종료 조건 충족
* 필요한 수동 조건이 모두 확인됨
* 최종 상태와 검증 근거 기록 완료

완료 보고에는 최소한 다음을 포함한다.

* Issue URL
* PASS한 attempt
* `max-loops`
* 최종 branch / SHA
* 변경 파일
* 02 검증 결과
* 수동 조건과 확인 주체
* commit / PR 정보

PASS 이후에는 추가 수정하지 않는다.

---

### NEEDS_HUMAN

다음 정보를 기록하고 사람의 단일 결정을 요청한다.

* Issue URL
* 중단 사유
* 현재 branch / SHA / tree 상태
* `max-loops`
* 사용 / 잔여 attempt
* 회차별 변경 및 검증 결과
* 마지막 검증 결과와 로그 위치
* 충돌 또는 불확실성의 구체적 내용
* protected 관련 내용
* 사람에게 필요한 결정
* 결정 후 같은 attempt를 재개할지 새 attempt를 시작할지

사람의 결정이 기록되면 `RESUMABLE`로 전환할 수 있다.

사람의 결정에 따라:

```text
RESUMABLE
 ├─ 작업 재개 → IMPLEMENTING
 ├─ 검증 재개 → VERIFYING
 └─ 종료 → DONE 또는 ABANDONED
```

---

## 9. 현재 자동화 한계

현재 저장소에 다음 자동화는 존재하지 않는다.

* attempt 상태 저장기
* session 상태 저장소
* resume 명령
* 자동 retry 오케스트레이터
* Issue 종료 조건과 검증 결과의 자동 대응 검사

따라서 이 문서의 attempt 기록, checkpoint, 세션 재개 규칙은 현재 **수동으로 준수해야 하는 normative contract**다.

해당 자동화를 구현하는 작업은 별도 Issue 범위로 다룬다.

---

## 10. 핵심 규칙 요약

```text
02 = 한 번의 검증을 실행하고 판정한다.
03 = 그 판정 이후의 lifecycle을 결정한다.

PASS
 → 종료 조건 충족
 → DONE

PASS
 → 수동 확인 필요
 → NEEDS_HUMAN

FAIL
 → Issue 범위 내 수정 가능
 → 잔여 attempt 있음
 → IMPLEMENTING

FAIL
 → 수정 불가 / 상한 도달 / 판단 불가
 → NEEDS_HUMAN

NEEDS_HUMAN
 → 사람의 명시적 결정
 → RESUMABLE
 → IMPLEMENTING / VERIFYING / DONE / ABANDONED

세션 중단
 → durable 기록 + Git 상태 확인
 → 일치하면 재개
 → 불일치하면 NEEDS_HUMAN
```

이 문서의 핵심 원칙은 **검증 자체를 다시 정의하지 않고, 검증 결과에 대한 다음 행동만 제한하는 것**이다.
