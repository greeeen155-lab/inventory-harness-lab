<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 작업 지침

## 문서 원본 라우팅

작업을 시작할 때 저장소의 모든 문서를 한꺼번에 읽지 않는다. 질문이나 작업의 종류를 먼저 판단하고, 아래 표에서 해당하는 원본 문서만 읽는다.

| 질문·작업 종류 | 먼저 읽을 원본 |
|---|---|
| 요구사항·제품 범위·재고 도메인 | `docs/01-requirements.md` |
| 원칙·사용자 시나리오 | `docs/03-scenarios.md` |
| 아키텍처·기술 선택·코드 구조·데이터 흐름 | `docs/06-architecture.md` |
| UI/UX·컴포넌트·반응형·접근성 | `docs/05-design.md` |
| 개별 작업의 범위·수용조건·상태 | 해당 GitHub Issue. 원본 연결 규칙은 `docs/harness/00-ssot.md`를 따른다. |
| 검증 기준·QA 계획 | `docs/07-plan.md` |
| 현재 구현 상태·인수인계 | `docs/HANDOVER.md` (현재 상태가 필요한 경우에만) |

원본 문서의 권위와 영역은 `docs/harness/00-ssot.md`를 따른다. 원본이 없는 영역은 임의의 문서를 기준으로 삼지 않는다.

## 단계적 탐색 규칙

1. 먼저 질문에 직접 연결된 원본 문서만 읽고 판단한다.
2. 여러 영역이 작업 범위에 명시적으로 포함된 경우에만 각 영역의 원본을 함께 읽는다.
3. 라우팅된 원본만으로 판단할 수 없을 때에만 탐색 범위를 넓힌다.
4. 범위를 넓힐 때는 먼저 관련 참고 문서와 현재 상태 문서를 확인하고, 그 뒤에도 부족할 때만 코드·설정 등 구현 자료를 조사한다.
5. 판단에 사용한 원본과 추가로 읽은 자료를 작업 결과에 명시한다.
6. 원본과 사본이 다르면 등록된 원본을 기준으로 판단하고 사본을 수정한다. 원본의 내용은 임의로 수정하지 않는다.

## 구현 전 확인

코드를 작성하기 전에는 라우팅된 원본의 관련 절과 `docs/harness/00-ssot.md`의 원본 관리 원칙을 확인한다. Next.js 관련 코드를 작성할 때는 위의 Next.js 지침에 따라 해당 버전의 가이드를 먼저 읽는다.

## 변경 범위

요청에 포함되지 않은 문서나 코드를 일괄적으로 정리하거나 갱신하지 않는다. 원본이 아직 정해지지 않은 영역에 대해서는 기준을 임의로 만들지 말고, 필요한 경우 사용자에게 확인한다.
