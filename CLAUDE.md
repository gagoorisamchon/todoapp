# 할 일 관리 앱

1년 목표 → 주간 계획 → 일일 할 일을 연결하고, 칸반 보드로 상태를 관리하며, 진행률을 자동으로 계산하는 개인용 웹앱.

# 참고 문서
- PRD: docs/PRD.md
- 구현계획: docs/PLAN.md

작업전에 반드시 위 문서를 읽고 시작할 것

# 기술 스택
Next.js (App Router, 15 이상) + TypeScript(strict), MongoDB Atlas + Mongoose 8, dnd-kit, Tailwind + shadcn/ui, zod, date-fns, Vitest + Playwright, npm

# 핵심 규칙 (자세한 내용은 docs/PLAN.md §1, §2.1)
- 진행률은 DB에 저장하지 않고 조회할 때 `lib/progress.ts`로 계산한다.
- 날짜는 `YYYY-MM-DD` 문자열(dateKey)로 저장하고, 날짜 변환은 `lib/date.ts`에서만 한다. "오늘"은 `Asia/Seoul` 기준이다.
- 데이터 변경 로직은 `lib/services/*`에 두고, `app/actions/*`는 zod 파싱 → 서비스 호출 → `revalidatePath('/', 'layout')`만 한다.
- 부모 문서의 상태에 기대는 쓰기는 트랜잭션 안에서 부모에 가드 쓰기(`$inc rev`)를 함께 한다. 실패하면 `DomainError`를 throw해서 트랜잭션을 되돌린다.
- 상위 항목을 삭제하면 하위 항목은 지우지 않고 연결만 해제한다.
- 도메인 규칙(R1~R10)이나 데이터 모델을 바꾸면 docs/PLAN.md도 함께 고친다.

# 명령어 (npm 사용)
- `npm run dev` / `npm run build`
- `npm run typecheck && npm run lint`
- `npm test` — 단위·통합 테스트 (메모리 MongoDB)
- `npm run test:e2e` — E2E (Atlas `todo_app_e2e` DB)
- `npm run db:ping` / `npm run db:check-orphans`

# 주의
- Atlas 접속 문자열은 `.env.local`에만 둔다. 커밋하지 않는다.
- E2E는 `_e2e`로 끝나는 DB에서만 실행한다.
- 로컬 전용 앱이다. 인증 없이 배포하지 않는다.
