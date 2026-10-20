"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Matches DB connection failures. Never render error.message itself: it can contain the connection string.
const DB_ERROR = /MONGODB_URI|ECONNREFUSED|ENOTFOUND|querySrv|Server selection timed out|MongoServerSelectionError/i;
const DB_HINT = "데이터베이스에 연결할 수 없습니다. .env.local의 MONGODB_URI와 Atlas Network Access(IP 허용 목록)를 확인하세요.";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the digest only (the message may contain connection details).
    console.error("Route error", error.digest ?? error.name);
  }, [error]);

  const isDb = DB_ERROR.test(`${error.name} ${error.message}`);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">문제가 발생했습니다</h1>
      {isDb ? (
        <p role="alert" className="text-sm">
          {DB_HINT}
        </p>
      ) : (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p>잠시 후 다시 시도해 주세요. 문제가 계속되면 아래를 확인하세요.</p>
          <ul className="list-disc pl-5 text-left text-muted-foreground">
            <li>.env.local의 MONGODB_URI가 올바른지</li>
            <li>Atlas Network Access(IP 허용 목록)에 현재 IP가 등록되어 있는지</li>
            <li>터미널의 서버 로그에 자세한 오류가 있는지</li>
          </ul>
        </div>
      )}
      {error.digest && <p className="text-xs text-muted-foreground">오류 코드: {error.digest}</p>}
      <Button onClick={() => reset()}>다시 시도</Button>
    </main>
  );
}
