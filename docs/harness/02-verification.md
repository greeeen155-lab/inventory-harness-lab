# 02. 검증

> 문서 역할: 현재 Harness의 로컬·CI 변경사항 검증 방법과 실행 순서를 설명한다.
> 기준 원본: [00-ssot.md](./00-ssot.md)
> 요구사항 원본: [../01-requirements.md](../01-requirements.md)
> 아키텍처 원본: [../06-architecture.md](../06-architecture.md)
> 상태: 현재 구현 기준

## 1. 검증 진입점

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

## 2. Protected

Protected 검사 구현은 [`scripts/protected-check.ts`](../../scripts/protected-check.ts)다. 보호 경로 목록은 [00-ssot.md](./00-ssot.md)의 `protected-paths` 블록에서 관리한다.

현재 보호 경로:

- `AGENTS.md`
- `CLAUDE.md`

`docs/harness/00-ssot.md` 자체는 사람이 명시적으로 SSOT 정책 갱신을 요청할 수 있으므로 보호 경로에서 제외한다.

보호 경로 변경 자체로는 검증을 실패시키지 않는다. Git diff, commit author, PR author만으로는 사람이 직접 수정했는지 AI가 수정했는지 판별할 수 없기 때문이다. `scripts/ai-provenance.ts`가 신뢰된 AI harness provenance를 받은 경우에만 AI 변경으로 분류하고, provenance에 기록된 명시적 exact 경로 범위 밖의 보호 변경을 `NEEDS_HUMAN`으로 차단한다.

provenance가 없으면 사람의 직접 수정과 정상적인 commit/push/PR 및 CI workflow를 보존하기 위해 통과한다. 현재 저장소에는 provenance를 생성하는 agent 파일 수정 wrapper가 없으므로, 흔적을 남기지 않은 AI 변경은 자동 검출할 수 없다. `PROTECTED_APPROVED`와 `PROTECTED_APPROVER`는 승인 수단으로 사용하지 않는다.

이 정책은 AI 변경을 완전히 판별하는 보장이 아니라, 신뢰된 harness가 제공한 provenance가 있을 때의 선택적 검사다.

## 3. Prepare

Prepare 구현은 [`scripts/prepare-verify.ts`](../../scripts/prepare-verify.ts)다.

- 기본 검증 DB: `prisma/verify.db`
- 개발·시연용 `prisma/dev.db`와 분리
- 검증 DB와 SQLite sidecar(`-journal`, `-wal`, `-shm`)를 매번 제거
- `db:ensure`를 통해 현재 마이그레이션, Prisma Client 생성, `prisma/seed.ts` 실행
- 검증이 매번 동일한 시드 데이터 구조에서 시작하도록 함

검증 DB를 별도로 사용하므로 로컬 개발 DB의 수동 변경이 검증 결과에 영향을 주지 않는다. Prepare는 검증 DB를 파괴적으로 초기화하므로, 실행 중인 검증 DB를 보존해야 하는 경우에는 실행하지 않는다.

## 4. Types와 Lint

### 4.1 Types

```bash
npm run typecheck
```

실행 내용:

```bash
npx tsc --noEmit
```

`tsconfig.json`의 strict TypeScript 설정과 Next.js 타입 정보를 기준으로 검사한다.

### 4.2 Lint

```bash
npm run lint
```

ESLint의 Next.js Core Web Vitals 및 TypeScript 설정을 사용한다. 렌더링 중 실행하면 안 되는 side effect와 프로젝트 코드 스타일 위반 등을 검사한다.

## 5. Architecture Check

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

## 6. Test

```bash
npm test
```

현재 Vitest는 `tests/**/*.test.ts`를 실행한다.

| 테스트 | 검증 범위 |
|---|---|
| `tests/fefo.test.ts` | FEFO·LEFO 배분, 로트 분할, 부족 수량 |
| `tests/stock-invariant.test.ts` | 재고 부족 롤백, 내부 이동 총량 불변, 취소 후 복원 |
| `tests/popup-settle.test.ts` | 누적 팝업 정산, 시식 초과 거부, 정산 되돌리기 |

## 7. Build

```bash
npm run build
```

Prisma Client를 생성한 뒤 Next.js 프로덕션 빌드를 실행한다.

```text
prisma generate → next build
```

## 8. CI 검증

GitHub Actions workflow는 [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml)이다.

다음 이벤트에서 `npm run verify`를 실행한다.

- 모든 Pull Request
- `main` 브랜치에 대한 push

CI는 다음 환경에서 실행한다.

- `ubuntu-latest`
- Node.js 20
- `npm ci`
- 전체 Git 이력 checkout

PR에서는 base commit을 Protected 검사에 전달해 PR 변경분을 비교한다. CI는 Git diff만으로 AI 여부를 추론하지 않으며, provenance가 없는 보호 경로 변경은 사람의 정상적인 commit/push/PR을 오인 차단하지 않도록 통과한다. 신뢰된 AI harness provenance가 전달된 경우에만 명시적 작업 범위 밖의 보호 변경을 `NEEDS_HUMAN`으로 실패시킨다.

## 9.1 로컬과 CI의 차이

| 항목 | 로컬 | CI |
|---|---|---|
| 실행 진입점 | `npm run verify` | `npm run verify` |
| 의존성 설치 | 기존 로컬 의존성 | `npm ci` |
| 검증 DB | `prisma/verify.db` | 실행 작업의 검증 환경 |
| Protected 기준 | 작업 트리와 지정 base | PR base SHA 또는 push의 HEAD 기준 |
| 보호 경로 주체 검사 | AI harness provenance가 있을 때만 명시적 exact 범위 검사 | trusted provenance가 있을 때만 검사, 없으면 보호 변경 자체로 실패하지 않음 |

## 10. 원본과 검증의 경계

- 제품 요구사항과 도메인 규칙은 [docs/01-requirements.md](../01-requirements.md)를 따른다.
- 구현 구조와 재고 변경 경로는 [docs/06-architecture.md](../06-architecture.md)를 따른다.
- 보호 경로와 원본 간 충돌 정책은 [00-ssot.md](./00-ssot.md)를 따른다.
- 이 문서는 검증 실행 방법을 설명하며 요구사항·아키텍처의 내용을 대체하지 않는다.
- 검증 규칙의 변경은 이 문서(`docs/harness/02-verification.md`)를 검증 원본으로 삼는 SSOT 선언과 일치해야 한다.
