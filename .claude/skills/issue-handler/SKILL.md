---
name: issue-handler
description: "사용자가 '이슈 처리해줘'라고 하거나 GitHub Issue 구현을 요청하면, Issue를 확인하고 전용 브랜치를 생성한 뒤 구현, 로컬 검증, Issue 코멘트 작성까지 수행한다."
argument-hint: "[GitHub Issue 번호 또는 URL]"
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# GitHub Issue 처리

사용자가 `이슈 처리해줘`라고 요청하거나 이 스킬을 직접 호출하면 GitHub Issue를 원본으로 삼아 다음 순서를 지킨다.

## 1. 대상 Issue 확인

1. 사용자 메시지와 스킬 인자에서 Issue 번호 또는 canonical GitHub Issue URL을 찾는다.
2. 번호와 URL이 없고 현재 대화에 대상 Issue가 명확하지 않으면 질문하고 중단한다. Issue를 추측하지 않는다.
3. `gh auth status`로 GitHub CLI 인증 상태를 확인한다. 인증되지 않았으면 구현을 시작하지 않고 중단한다.
4. `gh issue view <number> --comments`로 제목, 본문, 상태, 댓글, 수용조건을 확인한다.
5. 대상 저장소가 현재 저장소와 같은지 확인한다. 다른 저장소의 Issue면 중단한다.
6. Issue가 닫혀 있으면 재개/구현 여부를 사용자에게 확인하고 중단한다.
7. Issue 본문·수용조건이 구현 범위와 종료 조건의 원본이다. 요구사항이 모호하거나 서로 충돌하면 질문하고 중단한다.

## 2. 원본 문서와 현재 Git 상태 확인

작업 종류에 맞는 원본만 먼저 읽고, 필요할 때만 범위를 넓힌다.

- 요구사항·재고 도메인: `docs/01-requirements.md`
- 사용자 시나리오·원칙: `docs/03-scenarios.md`
- UI/UX: `docs/05-design.md`
- 아키텍처·코드 구조: `docs/06-architecture.md`
- 원본 관리: `docs/harness/00-ssot.md`
- 검증 실행·판정: `docs/harness/02-verification.md`
- 구현·검증 루프: `docs/harness/03-loop.md`

Next.js 코드를 작성할 때는 저장소 지침에 따라 해당 버전의 `node_modules/next/dist/docs/` 관련 가이드를 먼저 읽는다.

다음 명령으로 상태를 확인한다.

```bash
git status --short --branch
git branch --show-current
git log -1 --oneline
git remote -v
gh repo view --json nameWithOwner,defaultBranchRef
```

- 현재 변경사항을 삭제·reset·clean·stash하지 않는다.
- working tree가 깨끗하지 않으면 기존 변경사항이 대상 Issue와 관련 있는지 확인한다.
- 귀속이 불명확하면 사용자에게 확인하고 중단한다.
- 기본 브랜치에서 직접 구현하지 않는다.
- 사용자가 이미 해당 Issue 전용 브랜치에 있으면 그 브랜치를 계속 사용한다.
- 다른 작업 브랜치에 있으면 현재 작업을 덮어쓰지 말고 사용자에게 확인한다.

## 3. 전용 브랜치 생성

새 브랜치는 다음 형식을 사용한다.

```text
issue/<issue-number>-<short-kebab-title>
```

1. Issue 번호와 제목에서 짧고 안전한 kebab-case 이름을 만든다.
2. 같은 이름의 로컬/원격 브랜치가 이미 있으면 기존 작업과 충돌할 수 있으므로 사용자에게 확인한다.
3. 현재 기준 브랜치에서 전용 브랜치를 만든다.

```bash
git switch -c issue/<issue-number>-<short-kebab-title>
```

4. 브랜치 생성 후 `git branch --show-current`로 확인한다.
5. 사용자가 별도로 요청하지 않는 한 `git commit`, `git push`, `gh pr create`, `gh pr merge`, `git reset`, `git clean`을 실행하지 않는다.

## 4. 구현

1. Issue의 종료 조건을 체크리스트로 정리한다.
2. 관련 코드와 기존 테스트를 먼저 읽는다.
3. 저장소의 기존 함수·컴포넌트·테스트 패턴을 재사용한다.
4. 요청 범위 밖의 리팩터링·문서 정리·의존성 업그레이드를 하지 않는다.
5. 필요한 테스트를 추가하고, Issue 조건 하나당 기계 검증 테스트를 대응시킨다.
6. 재고 수량 변경은 `src/lib/stock.ts`의 승인된 통로를 사용한다.
7. 구현 중 요구사항·SSOT·아키텍처가 충돌하거나 protected 경로 판단이 필요하면 `NEEDS_HUMAN`으로 중단하고 추측하지 않는다.
8. 사람 반려 후 재진입인 경우 `docs/harness/03-loop.md`의 same-PR reopen, attempt reset, PR 원문/Issue 기록 규칙을 따른다.

## 5. 로컬 검증

1. `docs/harness/02-verification.md`의 검증 원본을 읽는다.
2. `docs/harness/03-loop.md`의 attempt 및 재시도 규칙을 따른다.
3. `package.json`의 검증 진입점을 확인한다.
4. 기본 검증은 다음 명령을 사용한다.

```bash
npm run verify
```

5. Issue가 별도 테스트 명령이나 수동 확인을 요구하면 해당 검증도 실행한다.
6. 검증 실패 시 단계, 종료 코드, 핵심 오류, 현재 SHA를 기록한다.
7. 구현 범위 안에서 명확히 고칠 수 있고 `max-loops` 잔여 회차가 있으면 최소 수정 후 전체 검증을 다시 실행한다.
8. 환경·인프라·flaky·범위·권한 문제로 결과를 확정할 수 없으면 `NEEDS_HUMAN`으로 중단한다.
9. 검증 결과를 성공으로 보고하려면 실제 명령이 종료 코드 `0`으로 끝났는지 확인한다.

## 6. Issue 코멘트 작성

로컬 검증이 끝나면 Issue에 append-only 코멘트를 작성한다. 검증 성공 여부와 관계없이 실제 결과를 정확히 기록한다.

댓글에는 다음을 포함한다.

- Issue canonical URL
- 구현 요약
- 변경된 파일 목록
- 현재 브랜치와 current SHA
- 실행한 검증 명령
- 각 검증의 `PASS` / `FAIL` / `NEEDS_HUMAN` / `미실행` 상태
- 테스트 개수와 종료 코드(확인 가능한 경우)
- 실패·미실행 사유
- 사용한 원본 문서와 관련 절
- 다음 단계
- commit/push/PR을 하지 않았다면 그 사실

댓글 게시 전 다음을 다시 확인한다.

```bash
gh repo view --json nameWithOwner
gh issue view <number> --json url,state
 git branch --show-current
git rev-parse HEAD
```

댓글은 임시 파일에 작성한 뒤 다음 방식으로 게시한다.

```bash
gh issue comment <number> --body-file <temporary-comment-file>
```

댓글 게시가 실패하면 게시 성공으로 보고하지 않는다. 구현·검증 결과와 댓글 게시 실패를 분리해서 사용자에게 보고한다.

### 사람 반려 후 재진입 시 추가 기록

반려 후 재진입이라면 반려 사유 원문을 Issue에 복제하지 않는다.

- 반려 원문: PR 코멘트에 보존
- Issue 코멘트: PR URL, 반려 코멘트 URL, 재진입 전이, attempt 사용량 `0` 기록, 새 사이클의 `max-loops`, 다음 attempt와 SHA만 기록
- 기존 PR을 유지하며 새 PR을 만들지 않는다.

## 7. 최종 보고

최종 응답에는 다음을 명확히 구분한다.

- Issue URL
- 사용한 브랜치
- 구현한 내용
- 변경 파일
- 검증 결과
- Issue 댓글 URL과 게시 성공 여부
- commit/push/PR 생성 여부
- 중단 사유와 사람에게 필요한 결정(있는 경우)

## 중단 규칙

다음 경우에는 구현 또는 Issue 댓글 게시를 진행하지 않고 사용자에게 확인한다.

- Issue 번호/URL이 없음
- 대상 저장소가 현재 저장소와 다름
- Issue가 닫혀 있음
- working tree의 기존 변경사항 귀속이 불명확함
- 기본 브랜치에서 작업해야 하는지 불명확함
- 기존 브랜치 작업과 충돌함
- Issue 수용조건이 판정 불가능하거나 SSOT와 충돌함
- 필요한 검증 명령을 결정할 수 없음
- 인증·권한·네트워크 상태를 확인할 수 없음
- 검증 결과가 불확정인데 AI가 원인을 추측해야 함
- 댓글을 게시할 Issue가 변경되었거나 대상 번호가 일치하지 않음

사람의 명시적인 추가 요청 없이는 commit, push, PR 생성, merge를 하지 않는다.
