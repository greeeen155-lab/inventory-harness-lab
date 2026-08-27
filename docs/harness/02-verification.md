# 02. 검증

> 문서 역할: 현재 Harness의 로컬·CI 변경사항 검증 방법과 실행 순서를 설명한다.
> 기준 원본: [00-ssot.md](./00-ssot.md)
> 요구사항 원본: [../01-requirements.md](../01-requirements.md)
> 아키텍처 원본: [../06-architecture.md](../06-architecture.md)
> 상태: 현재 구현 기준

## 1. 문서 역할과 책임 경계

이 문서는 **한 번의 검증 실행**을 수행하고 그 결과를 판정하는 원본이다.

> 이번 검증 실행은 통과했는가?

이 문서가 담당하는 범위는 다음과 같다.

- 검증 진입 명령
- 검증 단계의 실행 순서와 실행 방법
- 검증 실행 환경
- 단계별 결과와 종료 코드의 해석
- 한 번의 실행에 대한 `PASS` / `FAIL` / `NEEDS_HUMAN` 판정

구현 변경, attempt 수와 최대 반복 횟수, 실패 후 재시도, 세션 재개,
작업 완료·중단 lifecycle은 [03-loop.md](./03-loop.md)의 원본이다.
이 문서는 검증 판정 후의 다음 행동을 결정하지 않는다.

## 2. 한 번의 검증 실행

한 번의 검증 실행은 이 문서의 진입점에서 시작하여 정의된 단계 순서를
따르고, 모든 단계의 결과 또는 중단 결과가 확정될 때까지 수행하는 하나의
검증 실행이다.

검증 실행의 진입점은 다음과 같다.

```bash
npm run verify
```

실행 순서는 다음과 같다.

```text
Protected
→ Prepare
→ Types
→ Lint
→ Architecture Check
→ Test
→ Build
```

이 문서에서 `검증 결과`는 위 실행의 한 번의 결과만 의미한다.
재시도 여부와 attempt 예산은 이 문서에서 판정하지 않는다.

## 3. 검증 결과 판정

### 3.1 `PASS`

정의된 모든 필수 검증 단계가 실행되고 성공했으며, 해당 작업의
기계 검증 기대값을 충족하면 `PASS`다. 필수 단계가 하나라도 실패했거나
필수 검증 조건을 확인하지 못한 경우 `PASS`로 판정하지 않는다.

### 3.2 `FAIL`

검증 실행이 결과를 확정할 수 있는 상태로 종료되었지만, 구현이 Issue의
기대 결과 또는 이 문서에 정의된 검증 조건을 충족하지 못하면 `FAIL`이다.
실패한 단계, 종료 코드, 기대값과 실제 결과를 근거로 기록한다.

### 3.3 `NEEDS_HUMAN`

검증 결과를 AI가 코드 수정만으로 확정하거나 처리해서는 안 되는 경우
`NEEDS_HUMAN`이다. 예시는 다음과 같다.

- protected 경로에 대한 승인 또는 판단이 필요함
- Issue·SSOT·검증 기준 사이의 충돌이 있음
- 수동 확인 결과를 사람이 판단해야 함
- 환경·인프라 문제 또는 flaky 결과로 성공/실패를 확정할 수 없음
- 실행이 중단되어 완료 여부를 확인할 수 없음

`NEEDS_HUMAN`은 검증 결과를 임의로 `FAIL`로 바꾸거나 재시도 가능한
실패로 분류하는 뜻이 아니다.

### 3.4 중단·판정 불가

모든 필수 단계가 끝나기 전에 검증이 중단되고 완료 결과를 복구할
증거가 없으면 `PASS` 또는 `FAIL`로 판정하지 않는다. 이 경우 최종
검증 결과는 `NEEDS_HUMAN`으로 기록한다. 실패했다고 검증 단계를 생략해
성공으로 처리하지 않는다.

## 4. 검증 결과 기록

한 번의 검증 실행 결과에는 다음을 기록한다.

- 실행 명령
- 실행 시점과 branch/current SHA
- 검증 환경 식별자
- 실행된 단계와 단계별 종료 코드
- 통과·실패한 테스트 수
- 실패 단계와 오류 출력
- 최종 판정: `PASS`, `FAIL`, `NEEDS_HUMAN`
- 전체 출력 또는 로그 위치

`attempt ID`, `max-loops`, 사용·잔여 attempt, 다음 구현 변경은 이 문서의
기록 항목이 아니다. 이 값과 검증 판정 이후의 lifecycle은
[03-loop.md](./03-loop.md)가 관리한다.

## 5. 검증 진입점

모든 검증은 다음 명령으로 실행한다.

```bash
npm run verify
```

검증은 아래 순서로 실행되며, 앞 단계가 실패하면 다음 단계로 진행하지 않는다.

```text
Protected
→ Prepare
→ Types
→ Lint
→ Architecture Check
→ Test
→ Build
```

검증 오케스트레이션은 `package.json`의 `verify` 스크립트가 담당한다. 각 단계의 세부 실행 명령은 다음과 같다.

| 단계 | 실행 명령 | 목적 |
|---|---|---|
| Protected | `npm run protected:check` | SSOT 보호 경로의 승인되지 않은 변경 차단 |
| Prepare | `npm run prepare:verify` | 검증용 DB를 초기화하고 마이그레이션·시드로 기준 상태 준비 |
| Types | `npm run typecheck` | TypeScript 오류 검사 |
| Lint | `npm run lint` | ESLint 및 Next.js 규칙 검사 |
| Architecture Check | `npm run architecture:check` | 아키텍처가 정한 재고 변경 경로 준수 검사 |
| Test | `npm test` | 자동 테스트와 도메인 불변식 검사 |
| Build | `npm run build` | Prisma 생성 및 Next.js 프로덕션 빌드 검사 |

## 6. Protected

Protected 검사 구현은 [`scripts/protected-check.ts`](../../scripts/protected-check.ts)다. 보호 경로 목록은 [00-ssot.md](./00-ssot.md)의 `protected-paths` 블록에서 관리한다.

현재 보호 경로:

- `AGENTS.md`
- `CLAUDE.md`

`docs/harness/00-ssot.md` 자체는 사람이 명시적으로 SSOT 정책 갱신을 요청할 수 있으므로 보호 경로에서 제외한다.

보호 경로 변경 자체로는 검증을 실패시키지 않는다. Git diff, commit author, PR author만으로는 사람이 직접 수정했는지 AI가 수정했는지 판별할 수 없기 때문이다. `scripts/ai-provenance.ts`가 신뢰된 AI harness provenance를 받은 경우에만 AI 변경으로 분류하고, provenance에 기록된 명시적 exact 경로 범위 밖의 보호 변경을 `NEEDS_HUMAN`으로 차단한다.

provenance가 없으면 사람의 직접 수정과 정상적인 commit/push/PR 및 CI workflow를 보존하기 위해 통과한다. 현재 저장소에는 provenance를 생성하는 agent 파일 수정 wrapper가 없으므로, 흔적을 남기지 않은 AI 변경은 자동 검출할 수 없다. `PROTECTED_APPROVED`와 `PROTECTED_APPROVER`는 승인 수단으로 사용하지 않는다.

이 정책은 AI 변경을 완전히 판별하는 보장이 아니라, 신뢰된 harness가 제공한 provenance가 있을 때의 선택적 검사다.

## 7. Prepare

Prepare 구현은 [`scripts/prepare-verify.ts`](../../scripts/prepare-verify.ts)다.

- 기본 검증 DB: `prisma/verify.db`
- 개발·시연용 `prisma/dev.db`와 분리
- 검증 DB와 SQLite sidecar(`-journal`, `-wal`, `-shm`)를 매번 제거
- `db:ensure`를 통해 현재 마이그레이션, Prisma Client 생성, `prisma/seed.ts` 실행
- 검증이 매번 동일한 시드 데이터 구조에서 시작하도록 함

검증 DB를 별도로 사용하므로 로컬 개발 DB의 수동 변경이 검증 결과에 영향을 주지 않는다. Prepare는 검증 DB를 파괴적으로 초기화하므로, 실행 중인 검증 DB를 보존해야 하는 경우에는 실행하지 않는다.

## 8. Types와 Lint

### 8.1 Types

```bash
npm run typecheck
```

실행 내용:

```bash
npx tsc --noEmit
```

`tsconfig.json`의 strict TypeScript 설정과 Next.js 타입 정보를 기준으로 검사한다.

### 8.2 Lint

```bash
npm run lint
```

ESLint의 Next.js Core Web Vitals 및 TypeScript 설정을 사용한다. 렌더링 중 실행하면 안 되는 side effect와 프로젝트 코드 스타일 위반 등을 검사한다.

## 9. Architecture Check

검사 구현은 [`scripts/architecture-check.ts`](../../scripts/architecture-check.ts)다. 기준은 [docs/06-architecture.md](../06-architecture.md)의 재고 변경 단일 경로 규칙이다.

```bash
npm run architecture:check
```

검사 규칙:

- 검사 대상은 `src/**/*.ts`, `src/**/*.tsx`다.
- `src/lib/stock.ts`는 승인된 재고 변경 구현 경로다.
- 그 외 경로에서 `lot` 또는 `movement`의 직접 mutation을 금지한다.
- 금지 메서드는 `create`, `createMany`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`다.
- 조회 메서드는 검사하지 않는다.

재고 수량 변경은 `applyMovement()`를 통해야 하며, 취소는 `reverseMovement()`가 만드는 상쇄 기록을 사용한다. 직접 mutation이 발견되면 파일·행·열을 출력하고 실패한다.

## 10. Test

```bash
npm test
```

현재 Vitest는 `tests/**/*.test.ts`를 실행한다.

| 테스트 | 검증 범위 |
|---|---|
| `tests/fefo.test.ts` | FEFO·LEFO 배분, 로트 분할, 부족 수량 |
| `tests/stock-invariant.test.ts` | 재고 부족 롤백, 내부 이동 총량 불변, 취소 후 복원 |
| `tests/popup-settle.test.ts` | 누적 팝업 정산, 시식 초과 거부, 정산 되돌리기 |

## 11. Build

```bash
npm run build
```

Prisma Client를 생성한 뒤 Next.js 프로덕션 빌드를 실행한다.

```text
prisma generate → next build
```

## 12. CI 검증

GitHub Actions workflow는 [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml)이다.

다음 이벤트에서 `npm run verify`를 실행한다.

- 모든 Pull Request
- `main` 브랜치에 대한 push

CI는 다음 환경에서 실행한다.

- `ubuntu-latest`
- Node.js 20
- `npm ci`
- 전체 Git 이력 checkout
- `DATABASE_URL=file:./prisma/verify.db` (Prepare와 이후 테스트가 같은 검증 DB 사용)

CI의 `prepare:verify`는 `prisma/verify.db`를 migration·seed하고, job 환경의 동일한 `DATABASE_URL`이 이후 `npm test`와 build에도 전달된다. 개발용 `prisma/dev.db`는 CI에서 사용하거나 초기화하지 않는다.

로컬에서 `npm run verify`를 실행할 때는 검증 DB를 명시적으로 사용하려면 `DATABASE_URL=file:./prisma/verify.db npm run verify`를 실행한다.

PR에서는 base commit을 Protected 검사에 전달해 PR 변경분을 비교한다. CI는 Git diff만으로 AI 여부를 추론하지 않으며, provenance가 없는 보호 경로 변경은 사람의 정상적인 commit/push/PR을 오인 차단하지 않도록 통과한다. 신뢰된 AI harness provenance가 전달된 경우에만 명시적 작업 범위 밖의 보호 변경을 `NEEDS_HUMAN`으로 실패시킨다.

## 13.1 로컬과 CI의 차이

| 항목 | 로컬 | CI |
|---|---|---|
| 실행 진입점 | `npm run verify` | `npm run verify` |
| 의존성 설치 | 기존 로컬 의존성 | `npm ci` |
| 검증 DB | `prisma/verify.db` | 실행 작업의 검증 환경 |
| Protected 기준 | 작업 트리와 지정 base | PR base SHA 또는 push의 HEAD 기준 |
| 보호 경로 주체 검사 | AI harness provenance가 있을 때만 명시적 exact 범위 검사 | trusted provenance가 있을 때만 검사, 없으면 보호 변경 자체로 실패하지 않음 |

## 14. 원본과 검증의 경계

- 제품 요구사항과 도메인 규칙은 [docs/01-requirements.md](../01-requirements.md)를 따른다.
- 구현 구조와 재고 변경 경로는 [docs/06-architecture.md](../06-architecture.md)를 따른다.
- 보호 경로와 원본 간 충돌 정책은 [00-ssot.md](./00-ssot.md)를 따른다.
- 이 문서는 검증 실행 방법을 설명하며 요구사항·아키텍처의 내용을 대체하지 않는다.
- 검증 규칙의 변경은 이 문서(`docs/harness/02-verification.md`)를 검증 원본으로 삼는 SSOT 선언과 일치해야 한다.
