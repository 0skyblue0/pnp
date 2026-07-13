import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { apiGet } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";

const navItems = [
  { to: "/home", label: "홈" },
  { to: "/daily-log/today", label: "일일 운영" },
  { to: "/sales-analysis", label: "매출 분석" },
  { to: "/response", label: "손님 반응" },
  { to: "/reservation", label: "예약" },
  { to: "/regular-customer", label: "단골손님" },
  { to: "/prepaid-ledger", label: "선결제 장부" },
  { to: "/staff", label: "관리" }
];

function todayLabel() {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(now);
  const dotted = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return `${dotted} (${weekday})`;
}

export function AppLayout() {
  const dateText = todayLabel();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      const envelope = await apiGet<ListEnvelope<{ id: number }>>("/notification?unread=true");
      if (!cancelled && !envelope.error) {
        setUnreadCount(envelope.data.total);
      }
    }

    void loadUnreadCount();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#F8F5EF] text-ink">
      <header className="border-b border-latte bg-white px-5 py-4 lg:px-9 lg:py-0">
        <div className="mx-auto flex w-full flex-col gap-3 lg:h-[68px] lg:flex-row lg:items-center lg:gap-7">
          <NavLink to="/home" className="shrink-0" aria-label="Paul & Paulina 홈" title="홈으로 이동">
            <span className="block font-serif text-[19px] font-bold tracking-[0.01em] text-ink">
              Paul&amp;Paulina
            </span>
            <span className="mt-0.5 block text-[10px] text-muted">운영 시스템</span>
          </NavLink>

          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto lg:justify-center" aria-label="주요 메뉴">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={false}
                className={({ isActive }) =>
                  [
                    "relative shrink-0 rounded-control px-4 py-2 text-[13px] font-semibold transition",
                    isActive
                      ? "from-cocoa bg-bread text-white"
                      : "text-[#5c5548] hover:bg-cream hover:text-ink"
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-start">
            <span className="text-xs text-muted">{dateText}</span>
            <NavLink
              to="/notification"
              className={({ isActive }) =>
                [
                  "relative hidden rounded-control px-3 py-2 text-[13px] font-semibold transition sm:inline-flex",
                  isActive
                    ? "from-cocoa bg-bread text-white"
                    : "text-[#5c5548] hover:bg-cream hover:text-ink"
                ].join(" ")
              }
              title="알림"
            >
              알림
              {unreadCount > 0 ? (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-red px-0.5 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </NavLink>
          </div>
        </div>
      </header>

      <main className="w-full px-5 py-7 lg:px-9">
        <Outlet />
      </main>
    </div>
  );
}
