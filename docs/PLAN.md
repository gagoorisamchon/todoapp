# 할 일 관리 앱 — 구현 계획

- **상태:** pending approval — Critic 승인(3차), 실행 승인 대기
- **작성일:** 2026-10-20
- **근거 문서:** `docs/PRD.md` (본문의 `PRD.md:N`은 이 파일의 줄 번호)
- **범위:** 로컬에서 혼자 쓰는 단일 사용자 앱, 로그인 없음. 인증 없이 배포하지 않음 (§6, §10)

---

## 0. 기술 스택

### 사용자 확정
| 항목 | 결정 |
|---|---|
| 프레임워크 | Next.js (App Router), 15 이상(React 19, `useOptimistic` 필요) — 설치할 때의 최신 안정 메이저로 `package.json`에 고정. Next 16이 설치되면 `cacheComponents`는 끈 상태로 둠 (`export const dynamic`과 함께 쓸 수 없음) |
| 언어 | TypeScript (strict) |
| DB | MongoDB |
| ODM | Mongoose 8 |
| 개발 DB | MongoDB Atlas (처음부터 사용) |

### 그에 따라 정한 항목
| 항목 | 결정 | 이유 |
|---|---|---|
| Atlas 구성 | 클러스터 1개(M0, 서울 근처 리전 `ap-northeast-2`), DB를 `todo_app_dev`와 `todo_app_e2e`로 분리 | Atlas는 기본이 replica set이라 트랜잭션을 바로 쓸 수 있음. E2E가 개발 데이터를 건드리지 않음 |
| 단위·통합 테스트 DB | `mongodb-memory-server`의 `MongoMemoryReplSet` | 네트워크 없이 빠르고 격리됨, 트랜잭션 지원 |
| 서버 처리 | Server Actions (얇은 래퍼) → `lib/services/*` (도메인 로직) | 서비스는 Next 런타임 없이 테스트할 수 있음 |
| 드래그앤드롭 | `@dnd-kit/core` | 키보드 접근성 |
| UI | Tailwind CSS + shadcn/ui | |
| 검증 | zod (입력, 실제 존재하는 날짜인지 확인) + Mongoose schema (저장, `runValidators` 전역 활성화) | |
| 날짜 | date-fns + `@date-fns/tz` (`Asia/Seoul`) | 서버가 UTC여도 "오늘"을 정확히 계산 |
| 테스트 | Vitest, Playwright (`workers: 1`) | |
| 패키지 매니저 | npm (pnpm 미설치로 변경, 2026-10-20) | 본문의 `pnpm X`는 `npm run X`로 읽음 |
| 비밀값 검사 | gitleaks (pre-commit hook) | |

### 주요 설계 결정과 대안
| 결정 | 채택 | 기각한 대안 | 기각 이유 |
|---|---|---|---|
| 진행률 | 조회할 때 aggregate로 계산 | 주간 계획에 `doneCount/total` 카운터 저장 | 갱신 경로 5가지(PRD.md:49)를 모두 동기화해야 해서 누락 위험이 큼. 데이터 규모(개인 사용)에서는 계산 비용이 무시할 만함 |
| 문서 구조 | 컬렉션 3개, 자식이 부모 id 참조 | 할 일을 주간 계획 안에 임베드 | 연결이 선택 사항(PRD.md:26)이고, 미연결 할 일·연결 변경·이월이 잦음 |
| 날짜 저장 | `YYYY-MM-DD` 문자열 | `Date`(UTC 자정) | 문자열 비교만으로 범위 검사, 시간대 오류 없음. 단점(날짜 연산)은 `lib/date.ts`에 모아 처리 |
| 서버 API | Server Actions | Route Handlers(REST) | 다른 클라이언트가 붙을 계획이 없음. 나중에 필요하면 같은 서비스 계층을 REST로 노출 |
| 같은 주 여러 계획 | 허용 | 주당 1개로 제한 | 목표별로 주간 계획을 따로 두는 사용 방식(PRD.md:44 N:1)을 막지 않기 위해 |
| 무결성 | 트랜잭션 + 부모 문서 가드 쓰기 (§2.1) | 트랜잭션 없이 "연결 해제 → 삭제" 순서만 지키기 | 동시 요청(두 탭 등)에서 할 일이 기간 밖에 남거나 고아 참조가 생기는 것을 막지 못함 |

---

## 1. 도메인 규칙

PRD에 없는 부분은 아래처럼 정했습니다. (사용자 확정: R1, R4, R6)

- **R1 주(週):** 월요일에 시작. `endDate`는 서버에서 항상 `startDate + 6일`로 계산하고 클라이언트가 보낸 값은 무시. 월요일이 아닌 시작일은 거부
- **R2 중복:** 같은 주에 주간 계획 여러 개 허용
- **R3 연도:** 목표에 연결된 주간 계획은 `startDate`의 연도가 목표의 `year`와 같아야 함
- **R4 주간 계획 기간 변경:** 연결된 할 일이 새 기간 밖으로 나가면 **저장을 거부**하고 충돌하는 할 일 목록을 반환
- **R5 할 일 날짜와 연결 변경:** `date`나 `weeklyPlanId`가 바뀌면 **바뀐 뒤의 상태**(새 날짜 + 새 계획, 또는 기존 계획)로 PRD.md:45 범위 검사를 다시 함. 연결된 할 일의 날짜만 계획 기간 밖으로 바꿔도 거부
- **R6 목표 진행률:** 연결된 주간 계획들의 진행률(반올림 전 값)을 평균 낸 뒤 **마지막에 한 번만 반올림**. 할 일 0개인 계획도 0으로 포함, 연결된 계획이 없으면 0
- **R7 이월:** 대상은 원래 계획의 `todo`/`doing` 할 일. 날짜는 +7일
  - 다음 주(원래 `startDate + 7일`)에 시작하는 주간 계획 목록을 보여 주고 **사용자가 대상을 고름**. 원래 계획과 같은 목표에 연결된 계획을 맨 위에 추천
  - 다음 주 계획이 없으면 "다음 주 계획 만들기"를 제안. 원래 계획의 목표와 연도가 같으면 그 목표에 연결하고, 연도가 바뀌면(연말) **목표 없이** 만든 뒤 사용자가 나중에 다음 해 목표에 연결
  - 원래 계획에 목표가 없어도 같은 방식으로 처리 (추천 순서만 없음)
- **R8 목표 연도 변경:** 연결된 주간 계획 중 연도가 다른 것이 생기면 **저장을 거부**하고 충돌 목록을 반환 (R4와 같은 방식)
- **R9 칸반 정렬:** 날짜 오름차순 → 생성일 오름차순. 컬럼 안 수동 순서 변경은 범위 밖
- **R10 "오늘":** 기준 시간대 `Asia/Seoul`

---

## 2. 데이터 모델 (Mongoose, `lib/models/*.ts`)

```ts
// 공통: mongoose.set('runValidators', true) — updateOne/findOneAndUpdate에도 스키마 검증 적용
const dateKey = { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ };

// Goal
{ title: { type: String, required: true, trim: true },
  year:  { type: Number, required: true, min: 2000, max: 2100 },
  rev:   { type: Number, default: 0 } }            // 가드 쓰기용
// index: { year: 1 }

// WeeklyPlan
{ title: { type: String, required: true, trim: true },
  startDate: dateKey, endDate: dateKey,
  goalId: { type: ObjectId, ref: 'Goal', default: null },
  rev:   { type: Number, default: 0 } }
// index: { goalId: 1 }, { startDate: 1 }

// Todo
{ title: { type: String, required: true, trim: true },
  date: dateKey,
  status: { type: String, enum: ['todo','doing','done'], default: 'todo' },
  weeklyPlanId: { type: ObjectId, ref: 'WeeklyPlan', default: null } }
// index: { weeklyPlanId: 1, status: 1 }, { date: 1 }
// 모두 { timestamps: true }, 등록은 models.X ?? model('X', schema)
```

### 2.1 무결성 패턴 (가드 쓰기)

부모의 상태에 기대는 쓰기는 모두 `session.withTransaction()` 안에서 **부모에게 조건부 쓰기**를 함께 해서, 동시에 실행되는 삭제나 수정과 쓰기 충돌을 일으키도록 합니다.

| 작업 | 트랜잭션 안의 가드 쓰기 | 실패 조건 |
|---|---|---|
| 할 일 생성/수정 (계획 연결 있음) | `WeeklyPlan.updateOne({ _id, startDate: { $lte: date }, endDate: { $gte: date } }, { $inc: { rev: 1 } })` | `matchedCount === 0` → 계획이 없거나 범위 밖 |
| 주간 계획 생성/수정 (목표 연결 있음) | `Goal.updateOne({ _id, year }, { $inc: { rev: 1 } })` | 목표가 없거나 연도가 다름 |
| 주간 계획 기간 변경 (R4) | 계획 문서 자체를 `$inc rev`로 갱신 + 범위 밖 할 일 조회 | 충돌 1개 이상 → abort |
| 목표 연도 변경 (R8) | 목표 문서 `$inc rev` + 연도가 다른 계획 조회 | 충돌 1개 이상 → abort |
| 목표 삭제 | `WeeklyPlan.updateMany({ goalId }, { goalId: null })` → `Goal.deleteOne` | |
| 주간 계획 삭제 | `Todo.updateMany({ weeklyPlanId }, { weeklyPlanId: null })` → `deleteOne` | |
| 이월 (R7) | 대상 계획 가드 쓰기 + 할 일 `bulkWrite`(할 일마다 `date + 7`이 달라 `updateMany` 한 번으로는 불가) | 가드 `matchedCount === 0`, 이동 `matchedCount`가 읽은 수와 다름 |
| 상태 변경 (`updateStatus`) | 트랜잭션 없음 (다른 문서의 상태에 기대지 않음) | 할 일이 없으면 실패 |

규칙:
- **중단 방법:** 가드 쓰기가 맞지 않거나(`matchedCount === 0`) 충돌이 하나라도 있으면 콜백 안에서 `throw new DomainError(code, { conflicts })`로 트랜잭션을 되돌립니다. 결과를 그냥 `return`하면 앞서 한 `$inc`·`$set`까지 커밋되므로 금지합니다. `withTransaction` 바깥에서 `DomainError`를 잡아 `{ ok:false, error: code, conflicts }`로 바꿉니다.
- **일시적 오류:** `TransientTransactionError`·`UnknownTransactionCommitResult` 레이블이 붙은 오류는 드라이버가 재시도합니다. 재시도 후에도 실패하면 `{ ok:false, error:'conflict' }`를 반환합니다. 그 밖의 오류는 그대로 다시 던집니다.
- **트랜잭션 옵션:** `withTransaction(fn, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } })`
- 트랜잭션 안의 모든 쿼리에 `{ session }`을 넘깁니다. 문서를 만들 때는 배열 형태 `Model.create([doc], { session })`를 씁니다.
- `withTransaction` 콜백은 재시도될 수 있으므로 부수 효과를 넣지 않습니다. `revalidatePath`는 콜백이 끝난 **뒤에** 호출합니다.
- **주간 계획 수정이 여러 가지를 한꺼번에 바꿀 때**(기간 + 목표 연결 등): 기존 값과 새 값을 먼저 합친 상태를 만들고, 같은 트랜잭션 안에서 ① 목표 가드(R3, `goalId`가 있을 때) ② R4 범위 충돌 검사를 차례로 실행합니다. 계획 자체의 `$set`과 `$inc rev`는 한 번의 `updateOne`으로 처리합니다.
- **이월 가드 조건:** `WeeklyPlan.updateOne({ _id: target, startDate: { $lte: 옮길 날짜 중 가장 이른 날 }, endDate: { $gte: 옮길 날짜 중 가장 늦은 날 } }, { $inc: { rev: 1 } })`. "다음 주 계획 만들기"와 할 일 이동은 **같은 트랜잭션**에서 처리합니다.

---

## 3. 디렉터리 구조 (예정)

```
app/
  layout.tsx, error.tsx, loading.tsx
  page.tsx                  # 대시보드 (첫 화면, 단계 7)
  board/page.tsx            # 칸반 보드
  weekly/page.tsx, weekly/[id]/page.tsx
  goals/page.tsx,  goals/[id]/page.tsx
  actions/todos.ts, weekly-plans.ts, goals.ts   # zod 파싱 → service 호출 → revalidatePath
components/
  kanban/Board.tsx, Column.tsx, TodoCard.tsx
  forms/TodoForm.tsx, WeeklyPlanForm.tsx, GoalForm.tsx
  ConfirmDialog.tsx, ConflictList.tsx, ProgressBar.tsx
  ViewSwitcher.tsx, CarryOverDialog.tsx          # P1
  dashboard/TodayCard.tsx, WeekCard.tsx, GoalsCard.tsx, AttentionCard.tsx
  Nav.tsx                   # 대시보드 / 보드 / 주간 / 목표
lib/
  db.ts                     # 연결 캐시 (globalThis), dbName 지정
  models/Goal.ts, WeeklyPlan.ts, Todo.ts
  services/todos.ts, weeklyPlans.ts, goals.ts, carryOver.ts  # 트랜잭션·가드 쓰기, Next 의존 없음
  queries.ts                # 진행률 포함 조회 (aggregate), getDashboardSummary
  dto.ts                    # ObjectId → string
  date.ts                   # dateKey, 주 계산, todayKey(Asia/Seoul)
  progress.ts               # 순수 함수
  validation.ts             # zod
scripts/
  db-ping.ts                # Atlas 연결 확인
  db-check-orphans.ts       # 없는 부모를 가리키는 참조 검사
.env.example, .env.local(git 제외)
tests/
  setup/mongo.ts            # MongoMemoryReplSet
  unit/  integration/  e2e/
```

---

## 4. 구현 단계

### 단계 1 — 프로젝트 세팅
- **사용자 작업 (먼저 필요):** Atlas M0 클러스터 생성(`ap-northeast-2`), `readWrite` 권한 DB 사용자 생성, Network Access에 개발 PC IP 등록, `mongodb+srv://` 접속 문자열 발급
- `pnpm create next-app` (TS, App Router, Tailwind, ESLint), `git init`, gitleaks pre-commit hook
- 의존성: `mongoose zod date-fns @date-fns/tz @dnd-kit/core @dnd-kit/utilities`, shadcn/ui 초기화
- `.env.example`: `MONGODB_URI=`, `MONGODB_DB=todo_app_dev`. `.gitignore`에 `.env*.local` 포함 확인
- `lib/db.ts`: `connect(uri, { dbName, serverSelectionTimeoutMS: 5000 })`, `globalThis` 캐시, `mongoose.set('runValidators', true)`. 환경 변수 검사는 import할 때가 아니라 **처음 연결할 때** 함 (`pnpm build`가 Atlas 없이도 통과하도록)
- `lib/models/Goal.ts`, `WeeklyPlan.ts`, `Todo.ts` 작성 (§2 스키마 — 아래 `runValidators` 확인에 필요)
- DB를 읽는 모든 페이지에 `export const dynamic = 'force-dynamic'` (빌드할 때 정적으로 미리 만들어져 진행률이 멈춰 있지 않도록)
- Vitest: `tests/setup/mongo.ts`에서 `MongoMemoryReplSet` 시작, `vi.mock('next/cache')`
- Playwright: `workers: 1`, `MONGODB_DB=todo_app_e2e`, 각 테스트 전에 컬렉션 초기화 (DB 이름이 `_e2e`로 끝나지 않으면 초기화 거부)
- 스크립트: `dev build typecheck lint test test:e2e db:ping db:check-orphans`
- **완료 기준:** `pnpm db:ping` 성공 / `MONGODB_URI` 없이도 `pnpm build` 통과 / 샘플 통합 테스트가 메모리 replica set에서 트랜잭션 커밋 / `runValidators` 전역 설정이 실제로 동작함(`updateOne`으로 잘못된 `status`를 넣으면 ValidationError — 동작하지 않으면 스키마 `pre('updateOne')` 훅으로 대체) / 비밀값을 넣은 더미 파일 커밋이 gitleaks에 막힘

### 단계 2 — 도메인 순수 함수 (TDD)
- `lib/date.ts`: `todayKey()`(Asia/Seoul), `isValidDateKey`(실제 존재하는 날짜인지, `2026-02-30` 거부), `isMonday`, `weekEnd`, `addDaysKey`, `isWithin`
- `lib/progress.ts`: `weeklyRaw({total, done})` → `total===0 ? 0 : done/total*100`, `toPercent(raw)` → `Math.round`, `goalPercent(raws[])` → `Math.round(mean)`, 빈 배열이면 0
- `lib/validation.ts`: zod 스키마 (`isValidDateKey` refine, ObjectId 형식 `/^[a-f\d]{24}$/i`)
- **완료 기준:** 단위 테스트
  - 진행률: 0/0=0, 3/3=100, 1/3=33, 2/3=67
  - 목표 진행률: [33.33, 66.67]=50, 빈 배열=0, 그리고 반올림 시점이 결과를 바꾸는 경우 — 계획 A(1/8=12.5), 계획 B(할 일 0개=0) → **6** (먼저 반올림해 [13, 0]을 평균 내면 7이 나오므로 이 값이 아님)
  - 날짜: 주 첫날·마지막날·하루 밖, 월요일 아닌 시작일 거부, 연말·연초에 걸친 주(2026-12-28 → 2027-01-03), `2026-02-30` 거부
  - KST 00:30을 UTC 서버에서 실행해도 `todayKey`가 KST 날짜를 반환

### 단계 3 — 서비스 계층 + Server Actions
- `lib/services/*`에 §2.1의 패턴을 구현. 반환 타입 `{ ok:true, data } | { ok:false, error, fieldErrors?, conflicts? }`
- `app/actions/*`: zod 파싱 → 서비스 호출 → 성공하면 `revalidatePath` → DTO 반환
- `revalidatePath` 범위: **모든 변경 작업 후 `revalidatePath('/', 'layout')`**. 상태 하나만 바뀌어도 `/weekly`, `/goals`, `/goals/[id]`, `?view=week|year`의 진행률이 함께 바뀌기 때문 (PRD.md:49, 53)
- **완료 기준:** 통합 테스트 AC2, AC2a, AC6~AC6f, AC7~AC10, AC9a, AC9b 통과 (AC14 단위 부분은 단계 2에서)

### 단계 4 — 칸반 보드 UI (P0)
- `app/board/page.tsx`: 단계 6 전까지는 **모든 할 일**을 보여 줌. 단계 6에서 기본 뷰를 "오늘(일일)"로 바꿈
- `app/page.tsx`: 단계 7(대시보드) 전까지는 `redirect('/board')` (단계 7에서 대시보드로 바뀜)
- `Nav`(layout에 배치): 대시보드 / 보드 / 주간 / 목표
- `Board`: dnd-kit `DndContext`, 컬럼 3개 `useDroppable`(`aria-label` = 상태 이름), 카드 `useDraggable`, 한국어 안내 문구
  - `KeyboardSensor`에 **컬럼 단위로 이동하는 `coordinateGetter`**를 직접 구현 (←/→ = 이웃 컬럼으로). 기본값은 픽셀 단위로 움직여서 컬럼을 넘어가는 동작이 일정하지 않음
  - 드롭하면 `useOptimistic`으로 바로 이동 → `updateStatus` 호출 → 실패하면 원위치 + 토스트
  - 같은 컬럼에 드롭하면 호출하지 않음
- `TodoForm`: 제목·날짜 필수, 주간 계획은 고른 날짜를 포함하는 것만 보여 줌. 서버가 거부하면 필드 오류로 표시
- `ConfirmDialog`(삭제), `ConflictList`(R4·R8 충돌 표시)
- **완료 기준:** E2E AC1, AC2a, AC3, AC4, AC5, AC18 통과 (주간 계획 화면은 단계 5에서 만들므로, AC2a에 필요한 주간 계획은 E2E 준비 단계에서 서비스 계층으로 직접 만들어 둠)

### 단계 5 — 주간 계획 / 1년 목표 화면
- `/weekly`: 목록 + `ProgressBar` + 연결된 목표, CRUD (진행률은 aggregate 한 번으로 계산)
- `/weekly/[id]`: 해당 계획의 할 일 칸반 (`Board` 재사용) + 진행률
- `/goals`, `/goals/[id]`: CRUD + 연결된 계획 목록과 각 진행률
- `[id]`가 ObjectId 형식이 아니거나 문서가 없으면 `notFound()`
- **완료 기준:** E2E AC6b, AC11, AC12, AC13, AC20 통과

### 단계 6 — P1 기능
1. 목표 진행률 표시 (R6)
2. 미연결 할 일 섹션 (`weeklyPlanId: null`)
3. `ViewSwitcher` — `/board?view=all|day|week|year&date=YYYY-MM-DD` (view가 없거나 잘못되면 `all`, date가 없거나 잘못되면 `todayKey()`). 탭 순서: 전체 / 일간 / 주간 / 연간
   - **all (기본, `/board`):** 날짜와 관계없이 모든 할 일의 칸반(R9 정렬) + 모든 미연결 할 일. 이전/다음 화살표 없음, 범위 표시는 "전체 할 일". 날짜 선택과 "오늘"은 그 날짜의 day 보기로 이동
   - **day:** `date`가 그날인 할 일의 칸반
   - **week:** `date`가 속한 월~일 범위의 할 일 칸반 + 그 주에 시작하는 주간 계획 목록과 진행률
   - **year:** `date`의 연도에 해당하는 목표 → 연결된 주간 계획 → 진행률 트리
4. 이월 — `CarryOverDialog` + `services/carryOver.ts` (R7)
5. 저장 알림 (v7) — 할 일을 만들거나 고치면 토스트("할 일을 추가했습니다" / "할 일을 수정했습니다"). 저장한 날짜가 지금 보기(day·week)의 범위 밖이면 "`<날짜>` 날짜에 저장되어 지금 화면에는 보이지 않습니다." 설명과 그 날짜의 day 보기로 가는 "보기" 버튼을 함께 보여 줌. 새로 만든 카드는 약 2초 강조(`data-highlighted`)되고 화면에 보이도록 스크롤
- **완료 기준:** AC14(통합), AC15, AC16, AC17, AC17a, AC17b, AC23 통과, AC20을 목표 진행률 %까지 확인하도록 다시 실행

### 단계 7 — 대시보드 (첫 화면 `/`)
- `lib/queries.ts`의 `getDashboardSummary(todayKey)`: 집계 쿼리 3~4개를 `Promise.all`로 실행, 진행률 계산은 `lib/progress.ts` 재사용
- `app/page.tsx`의 redirect를 지우고 카드 4개로 구성 (차트 라이브러리 없이 숫자와 `ProgressBar`만 사용)

| 카드 | 보여 주는 것 | 데이터 기준 | 누르면 |
|---|---|---|---|
| 오늘 | todo·doing·done 개수, 오늘 할 일 목록(최대 5개) | `date === todayKey()` | `/board?view=day` |
| 이번 주 | 이번 주 주간 계획별 진행률 | `startDate === 이번 주 월요일` | `/weekly/[id]` |
| 올해 목표 | 목표별 진행률(R6), 연결된 주간 계획 수 | `year === 올해` | `/goals/[id]` |
| 확인 필요 | 미연결 할 일 수, 지난주 미완료 할 일 수 + 이월 버튼 | `weeklyPlanId: null` / 지난주 월요일에 시작한 계획의 `todo`·`doing` | 전체 보기의 미연결 섹션(`/board#unlinked-heading`) / `CarryOverDialog` |

- 데이터가 하나도 없을 때는 "1년 목표 만들기"부터 안내 (PRD.md:14 User Flow 순서)
- **완료 기준:** AC21, AC22 통과

### 단계 8 — 마무리
- 빈 상태, 로딩, `error.tsx`(DB 연결 실패 안내)
- `README.md`: Atlas 준비 절차, `.env.local`, 테스트 실행, "로컬 전용 / 인증 없이 배포 금지" 안내
- `pnpm db:check-orphans`로 고아 참조 0개 확인

---

## 5. 수용 기준 (Acceptance Criteria)

| # | 기준 | 검증 |
|---|---|---|
| **할 일** | | |
| AC1 | 제목이나 날짜 없이 생성하면 해당 필드에 오류가 표시되고 DB 문서 수는 그대로 | 단위(zod) + E2E |
| AC2 | 새 할 일의 `status`는 `todo` | 통합 |
| AC2a | 할 일의 제목·날짜·연결 계획을 수정하면 DB와 화면에 새 값이 반영됨 (PRD.md:27) | 통합 + E2E |
| AC3 | 카드를 다른 컬럼에 드롭하면 DB의 `status`가 바뀜 (테스트에서 DB를 최대 3초 polling), 새로고침해도 유지 | E2E |
| AC4 | 상태 저장이 실패하면 카드가 원래 컬럼으로 돌아가고 토스트가 뜸. 실패는 Playwright `page.route`로 `Next-Action` 헤더가 붙은 POST를 500으로 바꿔서 재현 | E2E |
| AC5 | 삭제 확인 다이얼로그에서 취소하면 문서가 남고, 확인하면 삭제됨 | E2E |
| **불변식** | | |
| AC6 | 계획 기간 밖 날짜로 할 일을 만들거나 연결하면 `{ok:false}`, 문서 변화 없음 | 통합 |
| AC6a | 연결된 할 일의 **날짜만** 계획 기간 밖으로 바꾸면 거부됨 (R5) | 통합 |
| AC6b | 주간 계획의 `startDate`를 바꿔서 연결된 할 일이 기간 밖으로 나가면 `{ok:false, conflicts:[해당 할 일]}`, 계획 문서는 바뀌지 않음. 화면에 충돌 목록이 표시됨 (R4) | 통합 + E2E |
| AC6c | 목표의 `year`를 바꿔서 연결된 계획의 연도와 어긋나면 `{ok:false, conflicts}`, 목표는 바뀌지 않음 (R8) | 통합 |
| AC6d | 다른 연도의 목표에 주간 계획을 연결하면 거부됨 (R3) | 통합 |
| AC6e | 목표에 연결된 주간 계획의 `startDate`를 다른 연도로 옮기면 거부됨 (R3) | 통합 |
| AC6f | 서비스에 월요일이 아닌 `startDate`를 넣으면 거부되고, 클라이언트가 보낸 `endDate`는 무시되어 저장된 값이 `startDate + 6일`임 (R1) | 통합 |
| AC7 | 주간 계획을 삭제해도 연결된 할 일은 남고 `weeklyPlanId === null` | 통합 |
| AC8 | 목표를 삭제해도 연결된 계획은 남고 `goalId === null` | 통합 |
| AC9 | 삭제 중 실패하면 전체 롤백됨. `deleteOne`을 `vi.spyOn`으로 throw하게 만든 뒤, 자식의 참조가 그대로 남아 있는지 확인 | 통합 |
| AC9a | **동시성:** 할 일 생성(계획 A 연결)과 계획 A 삭제가 겹쳐도 고아 참조가 0개. 순서를 강제해서 재현: 트랜잭션 1(할 일 생성)을 열고 가드 쓰기까지 실행 → 트랜잭션 2(A 삭제)를 실행하면 WriteConflict가 나는지 확인 → 1을 커밋 → 2를 재시도한 뒤 최종 상태가 "A 삭제됨 + 할 일은 미연결"인지 확인 | 통합 (세션 2개를 직접 제어) |
| AC9b | **동시성:** 같은 방식으로 순서를 강제해서, 할 일 날짜 변경(트랜잭션 1)과 계획 기간 변경(트랜잭션 2)이 겹쳐도 최종적으로 둘 중 하나는 거부되고 할 일이 계획 기간 밖에 남지 않음 | 통합 (세션 2개를 직접 제어) |
| **진행률** | | |
| AC10 | 다음 경우마다 주간 진행률이 기대값과 같음: 생성, 제목·날짜 수정, 삭제, 상태 변경, **연결 해제**(A 감소), **다른 계획으로 재연결**(A 감소, B 증가) | 통합 (경우별 1개) |
| AC11 | 연결된 할 일이 0개인 계획은 `/weekly`에 0%로 표시됨 | 단위 + E2E |
| AC12 | 주간 계획과 목표를 각각 만들고 이름을 바꾸고 삭제하면, 목록 화면에 바로 반영됨 (만들면 나타나고, 바꾸면 새 제목이 보이고, 지우면 사라짐) | E2E |
| AC13 | 잘못된 형식이거나 없는 id로 `/weekly/[id]`·`/goals/[id]`에 접근하면 404 | E2E |
| **P1** | | |
| AC14 | 목표 진행률 = R6 공식. 통합: 목표에 계획 A(할 일 8개 중 done 1개)와 계획 B(할 일 0개)를 연결하면 aggregate 결과가 **6%**. 계획 C(done 3/3)를 더하면 (12.5+0+100)/3=37.5 → **38%** | 단위 + 통합 |
| AC15 | 계획 없이 만든 할 일은 "미연결" 섹션에만 나타나고 어떤 계획의 보드에도 나타나지 않음 (`/board`의 칸반은 기간 안의 모든 할 일을 보여 주므로, "계획의 보드" = `/weekly/[id]`로 해석) | E2E |
| AC16 | 파라미터가 없거나 `view`가 잘못되면 `all`(모든 할 일), `view=day`는 그날 할 일만, `week`는 월~일 할 일과 그 주의 계획, `year`는 그 해 목표 트리를 보여 줌. 잘못된 `date`는 오늘로 처리. 새로고침해도 URL과 화면이 유지됨 | 통합 + E2E |
| AC17 | 이월: todo 2·doing 1·done 1 중 3개만 고른 계획으로 옮겨지고 날짜가 +7일, 두 계획의 진행률이 다시 계산됨 | 통합 |
| AC17a | 다음 주 계획이 없으면 만들기를 제안하는 다이얼로그가 뜸. 같은 해면 원래 목표에 연결되고, 연말(2026-12-28 주 → 2027-01-04 주)이면 목표 없이 만들어짐. 계획 생성과 할 일 이동은 한 트랜잭션이라, 이동 중 실패하면 새 계획도 남지 않음 (실패는 `vi.spyOn`으로 할 일 이동 호출 `Todo.bulkWrite`가 throw하게 만들어 재현) | 통합 + E2E |
| AC17b | 다음 주 계획이 여러 개면 목록에서 고를 수 있고, 같은 목표의 계획이 맨 위에 표시됨 | E2E |
| **공통** | | |
| AC18 | 키보드만으로(Tab → Space → 방향키 → Space) 카드 상태를 바꿀 수 있음 | E2E |
| AC19 | `npm run typecheck`, `lint`, `test`, `test:e2e`, `build` 모두 통과, `db:check-orphans` 결과 0개 | 로컬 |
| AC20 | **다른 화면 진행률 갱신:** `/board`에서 카드를 done으로 드래그한 뒤 `/weekly`와 `/goals/[id]`로 이동하면 바뀐 %가 표시됨 (새로고침 없이 이동만으로). 단계 5에서는 주간 계획 %를, 단계 6에서는 목표 %까지 확인 | E2E |
| AC21 | **대시보드 숫자:** 고정 데이터(오늘 할 일 todo 2·doing 1·done 1, 이번 주 계획 2개, 올해 목표 1개, 미연결 할 일 3개, 지난주 미완료 2개)를 넣으면 네 카드가 각각 2/1/1, 계획 2개의 진행률, 목표 진행률(R6), 3과 2를 표시. 데이터가 없으면 "1년 목표 만들기" 안내가 보임 | 통합(`getDashboardSummary`) + E2E |
| AC22 | `/board`에서 오늘 할 일을 done으로 드래그한 뒤 `/`로 이동하면 오늘 카드의 done 개수와 이번 주 진행률이 바뀌어 있음 | E2E |
| AC23 | 보드 기본 화면은 전체 보기이고 날짜가 달라도 모든 할 일이 보인다; 현재 범위 밖 날짜로 저장하면 '보기' 링크가 있는 알림이 뜬다 (전체 보기에서 만들면 "할 일을 추가했습니다" 알림과 함께 새 카드가 강조됨) | 통합(`getBoardData("all")`) + E2E |

### PRD 추적표
| PRD | 단계 | AC |
|---|---|---|
| L25-28 할 일 CRUD | 3, 4 | AC1, AC2a, AC5 |
| L29-32 상태 (기본값 todo, 1개만) | 3 | AC2, AC3 |
| L33-36 드래그앤드롭 | 4 | AC3, AC4, AC18 |
| L37-41 기간 구조 / CRUD | 2, 3, 5 | AC6f, AC12, AC13 |
| L42-44 N:1 연결 | 3 | AC6c, AC6d, AC6e, AC10 |
| L45 날짜 범위 불변식 | 2, 3 | AC6, AC6a, AC6b, AC9b |
| L46 상위 삭제 시 연결 해제 | 3 | AC7, AC8, AC9, AC9a |
| L47-50 주간 진행률 | 2, 3, 5 | AC10, AC11, AC20 |
| L53 목표 진행률 | 6.1 | AC14, AC20 |
| L54 미연결 할 일 | 6.2 | AC15 |
| L55 뷰 전환 | 6.3 | AC16, AC23 |
| L56 이월 | 6.4 | AC17, AC17a, AC17b |
| L20 진척 확인 (대시보드, 사용자 추가 요청) | 7 | AC21, AC22 |

---

## 6. 위험 요소와 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 동시 요청에서 불변식이 깨짐 (write skew) | 할 일이 기간 밖에 남거나 고아 참조 발생 | §2.1 가드 쓰기, AC9a·AC9b 테스트, `db:check-orphans` |
| `withTransaction` 콜백 재시도 때 부수 효과가 반복됨 | 캐시 무효화가 중복되거나 시점이 틀림 | 콜백 안에는 DB 작업만, `revalidatePath`는 콜백이 끝난 뒤 |
| Mongoose update가 스키마 검증을 건너뜀 | 잘못된 status·날짜 저장 | `runValidators` 전역 활성화 + zod로 먼저 검증 |
| 서버(UTC)와 사용자(KST)의 "오늘"이 다름 | 00:00~09:00 KST에 하루 전 날짜가 표시됨 | `todayKey()`를 `Asia/Seoul` 기준으로, 단위 테스트 포함 |
| Server Action 단위 테스트에서 `revalidatePath`가 throw | 테스트 불가 | 로직을 `lib/services`로 분리, `next/cache` 모킹 |
| Atlas 연결 실패 (IP 미등록, 네트워크 변경) | 개발·E2E가 시작되지 않음 | `serverSelectionTimeoutMS: 5000`, `pnpm db:ping`, README에 절차 |
| 접속 문자열 유출 | DB 무단 접근 | `.env.local`만 사용, `readWrite` 최소 권한, gitleaks pre-commit |
| 인증이 없어 Server Actions가 공개 엔드포인트가 됨 | 배포하면 누구나 데이터 수정 가능 | 범위를 로컬 실행으로 한정, 배포 전에 인증 추가(§10) |
| E2E가 공유 Atlas DB에서 불안정 | 테스트끼리 데이터 충돌 | `workers: 1`, `_e2e` DB만 사용, 테스트마다 초기화 |
| E2E가 개발 데이터를 지움 | 데이터 손실 | 초기화 코드가 DB 이름이 `_e2e`로 끝나는지 확인 |
| Atlas 왕복 지연 | 드래그 후 반영이 느리게 느껴짐 | 낙관적 업데이트, 서울 근처 리전 |
| 개발 모드 HMR 때 연결 누수·모델 재정의 오류 | `OverwriteModelError` | `globalThis` 캐시, `models.X ?? model()` |
| ObjectId를 클라이언트 컴포넌트로 그대로 넘김 | 직렬화 오류 | `.lean()` + `lib/dto.ts` |

---

## 7. 검증 단계

1. `pnpm typecheck && pnpm lint` — 오류 0개
2. `pnpm test` — 단위·통합 전부 통과, `lib/progress.ts`·`lib/date.ts`·`lib/validation.ts`·`lib/services/*` 라인 커버리지 90% 이상
3. `pnpm test:e2e` (Atlas `todo_app_e2e`, `workers: 1`) — §5에서 E2E로 표시한 AC 전부
4. `pnpm build` 성공
5. `pnpm db:check-orphans` → 0개
6. 직접 확인: 목표 1개 → 주간 계획 2개 → 할 일 5개를 만들고 PRD.md:13-20 User Flow 7단계를 끝까지 진행하며 진행률 숫자 확인

---

## 8. 확정된 결정 (2026-10-20, 사용자)

- ODM: **Mongoose** / 개발 DB: **처음부터 Atlas** / 주 시작: **월요일**
- 주간 계획 기간 충돌 시: **저장 거부** / 목표 진행률 평균: **할 일 0개인 계획 포함**
- 실행 전에 계획 검토(Architect + Critic)부터 진행

---

## 9. ADR

- **결정:** Next.js App Router + TypeScript + Mongoose/Atlas. 진행률은 조회할 때 계산, 날짜는 `dateKey` 문자열, 무결성은 서비스 계층의 트랜잭션 + 부모 가드 쓰기로 보장
- **동인:** ① PRD.md:45-46, 49의 불변식과 자동 갱신을 빠짐없이 지키기 ② 사용자가 정한 MongoDB(FK 없음)에서 관계 무결성 확보 ③ 혼자 쓰는 앱에 맞는 단순함
- **고려한 대안:** 진행률 카운터 저장, 할 일 임베드, `Date` 타입, Route Handlers, 주당 계획 1개, 트랜잭션 없는 순차 처리 (§0 표)
- **채택 이유:** 갱신 경로가 많은 값은 저장하지 않는 편이 누락이 없고, 가드 쓰기는 비용이 작으면서 동시성 문제를 막아 줌
- **결과:** 모든 구조 변경이 트랜잭션을 거쳐 Atlas 왕복이 1~2회 늘어남. 테스트에 replica set이 필요함. 서비스 계층이 하나 더 생김
- **후속 작업:** §10

## 10. 후속 작업 (이번 범위 밖)
- 배포하려면 인증 추가(예: Auth.js) + 문서에 `userId` 추가
- 할 일이 많아지면 진행률 카운터 캐시를 다시 검토
- 컬럼 안 수동 순서 변경

---

## 변경 이력
- **v7 (사용자 버그 신고, 2026-10-20):** 할 일 5개 중 다른 날짜(10-22, 10-23)로 저장한 3개가 기본 화면(오늘의 day 보기)에서 아무 알림 없이 사라져 "2개만 추가된다"처럼 보임. `/board`에 전체(`all`) 보기를 추가해 기본으로 하고(단계 6.3), 저장 후 토스트와 범위 밖 날짜 안내·"보기" 버튼, 새 카드 강조를 추가(단계 6.5). 대시보드 미연결 링크는 전체 보기로. AC16 수정, AC23 추가
- **v6 (사용자 요청: 대시보드):** 첫 화면 `/`를 대시보드로, 칸반은 `/board`로 이동. 단계 7 대시보드(카드 4개) 추가, 마무리는 단계 8로. `Nav` 추가, AC21·AC22 추가, 추적표 보완
- **v5 (Critic 3차 승인, 사소한 지적 반영):** 모델 작성을 단계 1로 이동, AC2a E2E용 주간 계획은 서비스 계층으로 미리 생성, AC17a 실패 재현 방법, AC20을 단계 5(주간 %)와 단계 6(목표 %)으로 나눔, Next 16의 `cacheComponents` 비활성화
- **v4 (검토 2차 반영)**
  - 공통(Architect·Critic): 모든 변경 후 `revalidatePath('/', 'layout')`, DB를 읽는 페이지 `force-dynamic`, 환경 변수는 처음 연결할 때 검사(Atlas 없이 빌드 가능), 다른 화면 진행률 갱신 E2E 테스트 AC20
  - Architect: `DomainError`를 던져 트랜잭션을 되돌리는 방법, 트랜잭션 옵션(snapshot/majority), 여러 값을 한꺼번에 바꾸는 계획 수정 순서, 이월 가드 조건과 같은 트랜잭션에서 계획 생성, `create([doc])` 배열 형태, AC9a·b를 순서를 강제한 테스트로 변경
  - Critic: 단계별 완료 기준을 AC 번호로 명시, 추적표에 AC6c 등 보완, AC6e(계획 연도 이동)·AC6f(월요일·`endDate` 서비스 검증) 추가, AC14 숫자로 구체화, AC17a 원자성, 키보드 `coordinateGetter`, Next.js 15 이상 고정, `runValidators` 전역 설정 동작 확인
- **v3 (검토 1차 반영)**
  - Architect: 동시성 가드 쓰기(§2.1), 목표 연도 변경 규칙 R8, 날짜·연결 변경 시 재검증 R5, 이월 규칙 구체화 R7(목표 없음·후보 여러 개·연말), 고아 참조 처리 변경 + `db:check-orphans`, `runValidators`·실제 날짜 검증, `revalidatePath` 호출 시점, Asia/Seoul 기준 "오늘", 목표 진행률 반올림 규칙, `workers:1`, AC4 모킹 방법, 로컬 전용 범위 명시, `revalidatePath` 범위 축소
  - Critic: PRD 추적표, AC2a·AC6a~d·AC9a·b·AC17a·b 추가, AC10에 연결 해제·재연결 추가, 서비스 계층 분리(`next/cache` 모킹), AC9 오류 주입 방법, 뷰 정의, 단계 6 전 보드 표시 범위, `endDate`는 서버에서 계산, 표 깨짐 수정, 대안 표, gitleaks, AC12·AC15 구체화, AC14 통합 테스트, AC3 시간 기준 완화
- v2: 개발 DB를 Atlas로 변경, 사용자 결정 반영
- v1: 초안
