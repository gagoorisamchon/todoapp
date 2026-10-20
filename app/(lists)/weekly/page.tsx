import { WeeklyPlanList } from "@/components/weekly/WeeklyPlanList";
import { connectDB } from "@/lib/db";
import { getWeeklyPlansWithProgress } from "@/lib/queries";
import { listGoals } from "@/lib/services/goals";

export const dynamic = "force-dynamic";

// Progress for every plan comes from one aggregate (PLAN 단계 5).
export default async function WeeklyPage() {
  await connectDB();
  const [plans, goals] = await Promise.all([getWeeklyPlansWithProgress(), listGoals()]);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <WeeklyPlanList plans={plans} goals={goals} />
    </main>
  );
}
