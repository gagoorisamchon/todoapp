# 할 일 관리 앱

1년 목표 → 주간 계획 → 일일 할 일을 연결하고, 칸반 보드로 상태를 관리하며, 진행률을 자동으로 계산하는 개인용 웹앱입니다.

> **로컬 전용 — 인증이 없으므로 배포하지 마세요.**
> 로그인이 없어서 Server Actions가 누구에게나 열린 엔드포인트가 됩니다. 인터넷에 배포하기 전에 반드시 인증을 추가해야 합니다.

## 기능 요약

- **대시보드(`/`)**: 오늘 할 일, 이번 주 계획, 올해 목표 진행률, 확인이 필요한 항목(지난주 미완료 이월 등)
- **칸반 보드(`/board`)**: 할 일 / 진행 중 / 완료 3개 컬럼, 드래그(마우스·키보드)로 상태 변경, 일·주·월·년 보기
- **주간 계획(`/weekly`)**: 월~일 한 주 단위 계획, 목표 연결, 진행률, 미완료 할 일 다음 주로 이월
- **1년 목표(`/goals`)**: 연도별 목표와 연결된 주간 계획의 평균 진행률
- 진행률은 DB에 저장하지 않고 조회할 때 계산합니다. "오늘"은 `Asia/Seoul` 기준입니다.

## 기술 스택

| 구분 | 사용 |
|---|---|
| 프레임워크 | Next.js 16.4.2 (App Router), React 19.3.0, TypeScript (strict) |
| DB | MongoDB Atlas + Mongoose 8.24.5 |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), dnd-kit 6.3.1, sonner |
| 검증·날짜 | zod 4.6.7, date-fns 4.4.0 |
| 테스트 | Vitest 5 (mongodb-memory-server), Playwright |
| 패키지 관리 | npm |

## 사전 준비 (MongoDB Atlas)

1. [MongoDB Atlas](https://www.atlas.mongodb.com)에서 **M0(무료) 클러스터**를 만듭니다. 리전은 서울 근처(`ap-northeast-2`)를 권장합니다.
2. **Database Access**에서 DB 사용자를 만듭니다. 권한은 `readWrite`를 `todo_app_dev`, `todo_app_e2e` 두 DB로만 제한하는 것을 권장합니다 (Specific Privileges).
3. **Network Access**에서 현재 IP를 허용 목록에 추가합니다. 네트워크가 바뀌면 다시 등록해야 합니다.
4. **Connect → Drivers**에서 접속 문자열(`mongodb+srv://...`)을 복사합니다.
5. 프로젝트 루트에 `.env.local`을 만듭니다 (`.env.example` 참고). 이 파일은 커밋하지 않습니다.

```bash
# .env.local
MONGODB_URI=mongodb+srv://<사용자>:<비밀번호>@<클러스터>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=todo_app_dev
```

## 실행

```bash
npm install
npm run db:ping   # Atlas 연결 확인
npm run dev       # http://localhost:3000
```

`db:ping`이 실패하면 접속 문자열, DB 사용자 권한, Atlas Network Access(IP 허용 목록)를 확인하세요.

## 테스트

```bash
npm test                        # 단위·통합 테스트 (메모리 MongoDB, Atlas 불필요)
npx playwright install chromium # E2E용 브라우저 (최초 1회)
npm run test:e2e                # E2E
```

- E2E는 Atlas의 **`todo_app_e2e`** DB를 사용하며 테스트마다 비웁니다. DB 이름이 `_e2e`로 끝나지 않으면 실행되지 않습니다.
- Next 16은 같은 폴더에서 `next dev`를 두 개 띄우지 못합니다. 같은 폴더에서 `npm run dev`가 실행 중이면 E2E가 시작되지 않으니, dev 서버를 끄거나 폴더를 복사해서 실행하세요.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run typecheck` | `next typegen` 후 `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (단위·통합) |
| `npm run test:e2e` | Playwright E2E (`todo_app_e2e`) |
| `npm run db:ping` | Atlas 연결 확인 |
| `npm run db:check-orphans` | 고아 참조(없는 계획·목표를 가리키는 문서) 개수 확인 |

## 폴더 구조

```
app/            페이지(대시보드, board, weekly, goals), Server Actions(app/actions), loading/error/not-found
components/     화면 컴포넌트 (kanban, forms, dashboard, weekly, goals, ui)
lib/            도메인 로직: date, progress, validation, queries, db
lib/models/     Mongoose 모델 (Goal, WeeklyPlan, Todo)
lib/services/   데이터 변경 로직 (트랜잭션, 불변식 검사)
scripts/        db-ping, db-check-orphans
tests/          unit, integration, e2e
docs/           PRD.md, PLAN.md
```

## 문서

- [docs/PRD.md](docs/PRD.md) — 제품 요구사항
- [docs/PLAN.md](docs/PLAN.md) — 구현 계획, 도메인 규칙, 수용 기준
