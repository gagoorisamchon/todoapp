import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-muted-foreground">주소가 잘못되었거나 이미 삭제된 항목일 수 있습니다.</p>
      <Link href="/" className={buttonVariants()}>
        대시보드로 돌아가기
      </Link>
    </main>
  );
}
