"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/board", label: "보드" },
  { href: "/weekly", label: "주간" },
  { href: "/goals", label: "목표" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="border-b">
      <ul className="mx-auto flex max-w-6xl gap-1 px-4 py-2">
        {LINKS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm hover:bg-muted",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
