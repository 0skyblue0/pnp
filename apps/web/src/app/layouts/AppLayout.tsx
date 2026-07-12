import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { apiGet } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";

const navItems = [
  { to: "/home", label: "홈" },
  { to: "/daily-log/today", label: "일일 운영" },
  { to: "/response", label: "손님 반응" },
  { to: "/reservation", label: "예약" },
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
    <div className="pnp-page-shell min-h-screen text-ink">
      <header className="pnp-topbar px-5 py-4 text-[#fff8ef] lg:px-9 lg:py-0">
        <div className="mx-auto flex w-full flex-col gap-3 lg:h-[74px] lg:flex-row lg:items-center lg:gap-7">
          <NavLink
            to="/home"
            className="group flex shrink-0 items-center gap-3"
            aria-label="Paul & Paulina 홈"
            title="홈으로 이동"
          >
            <span className="pnp-logo-mark grid h-[42px] w-[42px] place-items-center rounded-[7px] text-[18px] font-serif text-[#fff8ef]">
              P
            </span>
            <span className="block">
              <span className="pnp-logo-type block text-[21px] font-semibold leading-none text-[#fff8ef]">
                Paul &amp; Paulina
              </span>
              <span className="pnp-brand-rule mt-1.5 block h-px w-full" aria-hidden="true" />
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ecd8c5]">
                Daily Bread · 운영 시스템
              </span>
            </span>
          </NavLink>

          <nav
            className="flex min-w-0 flex-1 flex-wrap gap-1 lg:flex-nowrap lg:justify-center lg:overflow-x-auto"
            aria-label="주요 메뉴"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={false}
                className={({ isActive }) =>
                  [
                    "relative shrink-0 rounded-control px-3 py-2 text-[13px] font-semibold transition sm:px-4",
                    isActive
                      ? "from-cocoa bg-[#fff8ef] text-cocoa shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
                      : "text-[#f3dfce] hover:bg-white/10 hover:text-white"
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-start">
            <span className="text-xs font-semibold text-[#efdcca]">{dateText}</span>
            <NavLink
              to="/notification"
              className={({ isActive }) =>
                [
                  "relative hidden rounded-control px-3 py-2 text-[13px] font-semibold transition sm:inline-flex",
                  isActive
                    ? "bg-[#fff8ef] text-cocoa"
                    : "text-[#f3dfce] hover:bg-white/10 hover:text-white"
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
            <NavLink
              to="/notification"
              className="relative grid h-8 w-8 place-items-center rounded-full bg-[#fff8ef] text-xs font-bold text-cocoa transition hover:bg-[#f3dfce]"
              title="알림"
            >
              <Bell className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">김</span>
              {unreadCount > 0 ? (
                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-red sm:hidden" />
              ) : null}
            </NavLink>
          </div>
        </div>
      </header>

      <main className="w-full px-5 py-7 lg:px-9">
        <div className="pnp-brick-wash pointer-events-none fixed left-0 top-[74px] hidden h-[calc(100vh-74px)] w-[18px] border-r border-latte/70 opacity-70 lg:block" />
        <Outlet />
      </main>
    </div>
  );
}
