import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Home,
  Menu,
  MessageCircleHeart,
  Settings,
  Users,
  X
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { apiGet } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";

const navItems = [
  { to: "/home", label: "홈", icon: Home },
  { to: "/daily-log/today", label: "일일 운영", icon: ClipboardList },
  { to: "/sales-analysis", label: "매출 분석", icon: BarChart3 },
  { to: "/response", label: "손님 반응", icon: MessageCircleHeart },
  { to: "/reservation", label: "예약", icon: CalendarDays },
  { to: "/regular-customer", label: "단골손님", icon: Users },
  { to: "/prepaid-ledger", label: "선결제 장부", icon: BookOpen },
  { to: "/staff", label: "관리", icon: Settings }
];

function todayLabel() {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(now);
  const dotted = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return `${dotted} (${weekday})`;
}

function Brand() {
  return (
    <NavLink to="/home" className="inline-block rounded-sm" aria-label="Paul & Paulina 홈" title="홈으로 이동">
      <span className="block font-serif text-[19px] font-bold tracking-[0.01em] text-ink">Paul&amp;Paulina</span>
      <span className="mt-0.5 block text-[10px] text-muted">운영 시스템</span>
    </NavLink>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="grid gap-1" aria-label="주요 메뉴">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={false}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              "flex min-h-11 items-center gap-3 rounded-control px-3 text-[13px] font-semibold transition motion-reduce:transition-none",
              isActive
                ? "from-cocoa bg-brand text-white shadow-control"
                : "text-[#5c5548] hover:bg-surface-muted hover:text-foreground"
            ].join(" ")
          }
        >
          <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function NotificationLink({ unreadCount, onNavigate }: { unreadCount: number; onNavigate?: () => void }) {
  return (
    <NavLink
      to="/notification"
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "relative flex min-h-11 items-center gap-3 rounded-control px-3 text-[13px] font-semibold transition motion-reduce:transition-none",
          isActive ? "from-cocoa bg-brand text-white shadow-control" : "text-[#5c5548] hover:bg-surface-muted hover:text-foreground"
        ].join(" ")
      }
    >
      <Bell aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span>알림</span>
      {unreadCount > 0 ? (
        <span
          aria-label={`${unreadCount}개의 읽지 않은 알림`}
          className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </NavLink>
  );
}

export function AppLayout() {
  const dateText = todayLabel();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas text-foreground lg:flex">
      <aside
        aria-hidden={isMenuOpen}
        className="hidden w-[210px] shrink-0 border-r border-border bg-surface lg:flex lg:min-h-screen lg:flex-col"
      >
        <div className="sticky top-0 flex h-screen w-[210px] flex-col p-4">
          <Brand />
          <p className="mt-7 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-subtle">메뉴</p>
          <div className="mt-2">
            <Navigation />
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <NotificationLink unreadCount={unreadCount} />
          </div>
          <div className="mt-auto rounded-panel border border-border bg-surface-muted p-3">
            <p className="text-xs font-semibold text-foreground">Paul &amp; Paulina</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-subtle">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
              운영 중
            </p>
            <p className="mt-3 text-[11px] text-subtle">{dateText}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div aria-label="Paul & Paulina" className="min-w-0">
              <span className="block truncate font-serif text-[19px] font-bold tracking-[0.01em] text-ink">Paul&amp;Paulina</span>
              <span className="mt-0.5 block text-[10px] text-muted">운영 시스템</span>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to="/notification"
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-foreground motion-reduce:transition-none"
                aria-label="알림"
              >
                <Bell aria-hidden="true" className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-0.5 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </NavLink>
              <button
                type="button"
                aria-controls="mobile-navigation"
                aria-expanded={isMenuOpen}
                aria-label="메뉴 열기"
                onClick={() => setIsMenuOpen(true)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-foreground motion-reduce:transition-none"
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {isMenuOpen ? (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button
              type="button"
              aria-label="메뉴 닫기"
              className="absolute inset-0 cursor-default bg-foreground/30"
              onClick={() => setIsMenuOpen(false)}
            />
            <section
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="주요 메뉴"
              className="relative flex h-full w-[min(86vw,320px)] flex-col bg-surface p-4 shadow-elegant"
            >
              <div className="flex min-h-11 items-center justify-between">
                <Brand />
                <button
                  type="button"
                  aria-label="메뉴 닫기"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-foreground motion-reduce:transition-none"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-7">
                <Navigation onNavigate={() => setIsMenuOpen(false)} />
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <NotificationLink unreadCount={unreadCount} onNavigate={() => setIsMenuOpen(false)} />
              </div>
              <p className="mt-auto px-3 text-xs text-subtle">{dateText}</p>
            </section>
          </div>
        ) : null}

        <main className="min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
