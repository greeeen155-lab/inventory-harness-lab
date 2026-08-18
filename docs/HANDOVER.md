# 핸드오버 — 2026-08-18

> 기획 7단계 완료 · 구현 **M1~M6 완료**, M7만 남음
> 이 문서만 읽으면 다음 사람이 이어서 작업할 수 있어야 한다.

---

## 1. 지금 상태

| 마일스톤 | 내용 | 상태 |
|---|---|---|
| M1 | 뼈대 · DB · 시드 | ✅ 완료 |
| M2 | 로그인 · 홈 · 상품 상세 | ✅ 완료 |
| M3 | 입고 · 출고 (FEFO) | ✅ 완료 |
| M4 | 풀필먼트 발송 → 도착 확인 | ✅ 완료 |
| M5 | 풀필먼트 일일 반영 | ✅ 완료 |
| M6 | 팝업 반출 → 정산 | ✅ 완료 |
| **M7** | **유통기한 · 이력 · 설정 · QA** | ⬜ **다음 할 일** |

**동작하는 화면**

| 경로 | 화면 |
|---|---|
| `/login` | 로그인 (계정 2개 시드) |
| `/` | 홈 — 검색 · 재고 목록 · 오늘 할 일 배너 · 거점 필터 · ＋버튼 |
| `/products/[id]` | 상품 상세 — 로트 카드(유통기한순/거점순 토글) |
| `/inbound` | 입고 — 유통기한 6자리 키패드, 한 상품에 기한 여러 개 |
| `/outbound` | 출고 — FEFO 자동 배분, 수동 선택 시 사유 필수 |
| `/transfers` | 배송 중 목록 (7일 초과 지연 표시) |
| `/transfers/new` | 풀필먼트 발송 — 여러 SKU 담기, LEFO 배분 |
| `/transfers/[id]` | 도착 확인 — 수량 다르면 조정 기록 |
| `/fulfillment` | 거점 3곳 · 마지막 반영일 = 그 숫자의 신뢰도 |
| `/fulfillment/[locationId]` | 일일 반영 — 목록에 수량칸만 채운다, FEFO 자동 차감 |
| `/popups` | 팝업 목록 (진행 중 · 종료된 것은 소진율) |
| `/popups/new` | 팝업 생성 + 반출서 (재고는 안 움직인다) |
| `/popups/[id]` | 누적 반출 · 추가 반출 · 정산 진입 / 종료 후엔 리포트 |
| `/popups/[id]/settle` | 정산 ①로트별 잔여·시식 입력 ②문장 확인 → 확정 |

**아직 404 (미구현)** — `/expiry`, `/history`, `/settings`
＋버튼 메뉴에는 이미 링크가 있으므로, 화면만 만들면 바로 연결된다.

**검증 상태**
- `npm test` — 19개 통과 (FEFO 5 · LEFO 3 · 재고 불변식 6 · 팝업 정산 5)
- `npm run build` — 통과
- 브라우저로 입고 → 출고 → 발송 → 도착 확인 → 일일 반영 전 과정 실제 조작 확인
- **팝업 정산도 브라우저에서 확인 완료** — 시드의 성수 팝업(누적 160)에 잔여 42 · 시식 5를 넣어
  `113개를 판매로 기록합니다` 문장 확인 → 확정 → 리포트(소진율 74%) → 되돌리기로 160 복원까지.
  DB에서도 팝업 거점 0 · 복귀 로트 4건의 유통기한 보존 · 총 재고 −118을 확인했다
- 화면 캡처는 `docs/screenshots/` (일일 반영 16~21 · 팝업 22~26)

---

## 2. 바로 이어서 할 일 (M7)

**유통기한 · 이력 · 설정 · QA** — 남은 마일스톤은 이것 하나다.

```
1. src/app/expiry/page.tsx        임박·만료 목록 + 폐기 확정 (홈 배너가 여기로 링크되어 있다)
2. src/actions/adjust.ts          폐기(사유 필수) · 재고 조정
                                  자사창고는 로트별 실사, 풀필먼트는 '수치 반영' (T5 — 성격이 다르다)
3. src/app/history/page.tsx       이력 + 최근 건 취소 (reverseMovement는 이미 있다)
4. src/app/settings/page.tsx      상품(임박 기준일) · 거점 · 계정
5. QA 라운드                       docs/07-plan.md 2절 체크리스트
```

**만료 재고는 자동으로 빠지지 않는다** — 사람이 폐기를 확정해야 재고에서 나간다 (F9).
취소는 `src/lib/stock.ts`의 `reverseMovement()`가 이미 다 한다 (중복 취소 방지 포함).
팝업 정산 되돌리기(`unsettlePopupTx`)가 그 함수를 쓰는 좋은 예다.

---

## 3. 구현하면서 정해진 것 (문서에 반영 완료)

### ① 발송은 LEFO — 출고와 반대 방향
풀필먼트는 도착까지 3~5일, 판매까지 더 걸린다. 임박분을 보내면 팔리기 전에 만료된다.
그래서 **발송만 유통기한이 넉넉한 로트부터** 고른다. 나머지(출고·일일 반영·팝업 반출)는 FEFO.
→ `src/lib/fefo.ts`의 `planAllocation(lots, qty, strategy)` 하나로 처리.
→ 팝업 반출이 FEFO인 것은 실무 확인 완료.

### ② 재고를 바꾸는 통로는 하나뿐
`src/lib/stock.ts`의 `applyMovement()` 외에는 `lot.update()`를 직접 호출하지 않는다.
재고 변경과 이력 기록이 항상 같은 트랜잭션에서 함께 성공하거나 함께 롤백된다.
**새 기능을 만들 때도 이 함수를 통해야 한다.**

### ③ 시드는 앱과 같은 함수를 쓴다
`prisma/seed.ts`는 로트를 손으로 지정하지 않고 `applyMovement` + `allocateLots`를 통과시킨다.
사건은 **시간 순서대로**(95일 전 입고 → 85일 전 발송 → … → 어제 반영) 실행한다.
덕분에 발송 규칙을 LEFO로 바꿨을 때 시드는 코드 한 줄 안 고치고 따라왔다.
풀필먼트의 임박 재고도 "임박한 걸 보냈다"가 아니라 **86일 전 보낼 땐 108일 남았는데 시간이 지난 것**으로 만들어진다.

### ④ 시드는 자동 증가 번호까지 초기화한다
안 하면 `seed:reset` 때마다 ID가 밀려서 로그인 쿠키가 없는 사용자를 가리키고(외래키 오류),
`/products/1`이 404가 된다. 실제로 이 버그가 났고 고쳤다.

### ⑤ 세션은 DB까지 검증한다
`src/lib/auth.ts`의 `requireUser()`가 사용자 존재를 확인하고, 없으면 쿠키를 지운다.
**주의**: 이 파일은 Prisma를 쓰므로 `src/proxy.ts`(미들웨어)에서 import 하면 안 된다.
미들웨어는 JWT 검증만 하는 `src/lib/session.ts`를 쓴다.

### ⑥ 일일 반영은 '출고 0건'도 저장할 수 있다
어제 출고가 없었던 날에도 저장이 돼야 `lastReflectedAt`이 갱신되어 홈 할 일에서 사라진다.
막아 두면 그 거점이 영원히 미반영으로 남는다. 버튼 문구가 `어제 출고 없음으로 반영`으로 바뀐다.
반영 저장은 **입력 → 저장 → 목록 복귀** 한 번에 끝난다 (3사를 이어서 처리하기 위해서다).

### ⑦ 팝업 정산은 로트별 잔여 · 시식은 상품별
어느 유통기한이 시식으로 나갔는지는 아무도 모른다. 그래서 시식은 상품 단위로 받고
**임박한 로트부터** 시식으로 처리한다(FEFO). 잔여 복귀는 반품이 아니라 위치 이동이므로 사유가 없다.
정산 계산은 `src/lib/popup.ts`의 `settlePopupTx()`에 있다 — 액션과 테스트가 같은 함수를 쓴다.

### ⑧ 수량은 숫자로 저장하고 화면에서만 단위를 붙인다
DB `quantity`는 정수. 단위는 `Product.unit`(기본 `개`)에 한 번만 둔다.
표시는 `<Qty>`, 입력은 `<QtyInput>` 컴포넌트를 쓴다.

---

## 4. 알아둘 함정

| 항목 | 내용 |
|---|---|
| **Next.js 16** | `middleware.ts`가 폐기되어 **`src/proxy.ts`**를 쓴다 (export 이름도 `proxy`) |
| **Prisma 7** | 클라이언트를 `@/generated/prisma/client`에서 가져온다. 드라이버 어댑터(`@prisma/adapter-better-sqlite3`) 필수. 설정은 `prisma.config.ts` |
| **`AGENTS.md` / `CLAUDE.md`** | `npm run dev` 시 Next.js가 자동 생성한다. 이 프로젝트에서는 쓰지 않으므로 `.gitignore`에 넣어뒀다 |
| **테스트가 DB를 공유** | `tests/`는 `prisma/dev.db`를 그대로 쓴다. 자기가 만든 데이터만 앞뒤로 지우도록 되어 있으니, 새 테스트도 같은 방식을 지킬 것 |
| **날짜** | 유통기한은 시각 없는 날짜다. 반드시 `lib/date.ts`의 `dateOnly()`를 통과시킨다 (UTC 자정 고정) |

---

## 5. 남은 과제 / 미결

- **M7 미구현** (위 2절 참고)
- **`/expiry`, `/history`, `/settings`** 미구현 — 홈의 할 일 배너가 `/expiry`로 링크되어 있어 지금은 404
- **재고 조정(실사)** — 자사창고는 로트별 실물 카운트, 풀필먼트는 "수치 반영"으로 성격이 다르다 (M7)
- **QA 체크리스트** — `docs/07-plan.md` 2절. 한글 IME, 긴 상품명, 동시 출고 등 미검증

---

## 6. 파일 지도

```
src/
├── lib/
│   ├── constants.ts    거점·이동·사유 코드 (as const + 파생 타입)
│   ├── db.ts           PrismaClient 싱글턴
│   ├── date.ts         유통기한 6자리 파싱 · 남은 기간 문구
│   ├── stock.ts        ★ applyMovement / reverseMovement
│   ├── fefo.ts         ★ planAllocation (FEFO/LEFO) · allocateLots
│   ├── expiry.ts       임박·만료 판정
│   ├── inventory.ts    화면용 조회 (홈 목록 · 할 일 · 상품 상세 · 일일 반영 시트)
│   ├── popup.ts        ★ 팝업 집계 · settlePopupTx(정산 역산) · unsettlePopupTx
│   ├── session.ts      JWT 쿠키 (DB 미사용 — 미들웨어에서 쓴다)
│   └── auth.ts         requireUser (DB 검증)
├── actions/            inbound · outbound · transfer · fulfillment · popup · auth
├── components/         Qty · QtyInput · LotCard · StockRow · ExpiryKeypad
│                       BulkInputRow(다건 입력 — 반영·반출·정산 공용)
│                       FulfillmentSheet · PopupShipOut · SettleForm
│                       SettlementSentence · PopupReport 등
├── app/                화면
└── proxy.ts            로그인 안 하면 /login

prisma/
├── schema.prisma       모델 9개
├── seed.ts             목업 데이터 (시간 순서 · 앱 함수 사용)
└── migrations/

scripts/
├── ensure-db.ts        첫 실행 자동 준비
├── snapshot.ts         거점별 재고 스냅샷 (이동 전후 총량 확인용)
├── verify-m1.ts        시드 상태 검증
└── verify-headline.ts  홈 목록 대표 로트 검증 (회귀 방지)

tests/
├── fefo.test.ts            FEFO 5 + LEFO 3
├── stock-invariant.test.ts 재고 불변식 6
└── popup-settle.test.ts    누적 역산 · 시식 FEFO · 되돌리기 · 초과 입력 거부 5
```

---

## 7. 재개 방법

```bash
cd inventory_poc
npm run dev            # http://localhost:3000
npm test               # 14개 통과 확인
npm run db:studio      # 데이터 눈으로 보기
```

이어서 작업할 때는 **`docs/07-plan.md`의 M7**부터 읽으면 된다.
