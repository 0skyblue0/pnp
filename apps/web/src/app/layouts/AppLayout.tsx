import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
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

const navigationGroups = [
  {
    label: "운영",
    items: [
      { to: "/home", label: "홈", icon: Home },
      { to: "/daily-log/today", label: "일일 운영", icon: ClipboardList },
      { to: "/sales-analysis", label: "매출 분석", icon: BarChart3 }
    ]
  },
  {
    label: "고객",
    items: [
      { to: "/response", label: "손님 반응", icon: MessageCircleHeart },
      { to: "/reservation", label: "예약", icon: CalendarDays },
      { to: "/regular-customer", label: "단골손님", icon: Users },
      { to: "/prepaid-ledger", label: "선결제 장부", icon: BookOpen }
    ]
  },
  {
    label: "설정",
    items: [{ to: "/staff", label: "관리", icon: Settings }]
  }
];

function todayLabel() {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(now);
  const dotted = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return `${dotted} (${weekday})`;
}

function useLargeScreen() {
  const query = "(min-width: 1024px)";
  const getMatches = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [isLargeScreen, setIsLargeScreen] = useState(getMatches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setIsLargeScreen(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, []);

  return isLargeScreen;
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <NavLink to="/home" className="inline-block rounded-sm" aria-label="Paul & Paulina 홈" title="홈으로 이동">
      <span className={`block font-serif text-[19px] font-bold tracking-[0.01em] ${inverse ? "text-ref-header" : "text-ref-text"}`}>
        Paul&amp;Paulina
      </span>
      <span className={`mt-0.5 block text-[10px] tracking-[0.16em] ${inverse ? "text-ref-sidebar-muted-soft" : "text-ref-muted"}`}>
        BAKERY OPS
      </span>
    </NavLink>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-2" aria-label="주요 메뉴">
      {navigationGroups.map(({ label: groupLabel, items }) => (
        <section key={groupLabel} aria-label={groupLabel} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-medium tracking-[0.1em] text-ref-sidebar-muted">{groupLabel}</p>
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={false}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "flex min-h-11 items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] font-medium transition-colors motion-reduce:transition-none",
                  isActive
                    ? "bg-ref-gold font-bold text-ref-cocoa"
                    : "text-ref-sidebar-inactive hover:bg-white/10 hover:text-ref-header"
                ].join(" ")
              }
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </section>
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
          "relative flex min-h-11 items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] font-medium transition-colors motion-reduce:transition-none",
          isActive ? "bg-ref-gold font-bold text-ref-cocoa" : "text-ref-sidebar-inactive hover:bg-white/10 hover:text-ref-header"
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
  const isLargeScreen = useLargeScreen();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const didOpenDrawerRef = useRef(false);
  const isDrawerOpen = isMenuOpen && !isLargeScreen;

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

  useEffect(() => {
    if (isLargeScreen) {
      setIsMenuOpen(false);
    }
  }, [isLargeScreen]);

  useEffect(() => {
    if (isDrawerOpen) {
      didOpenDrawerRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (didOpenDrawerRef.current) {
      didOpenDrawerRef.current = false;
      if (!isLargeScreen) {
        menuButtonRef.current?.focus();
      }
    }
  }, [isDrawerOpen, isLargeScreen]);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) {
      return;
    }

    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="min-h-screen bg-ref-canvas text-ref-text lg:flex">
      <aside
        aria-hidden={isDrawerOpen}
        className="hidden w-[210px] shrink-0 bg-ref-cocoa lg:flex lg:min-h-screen lg:flex-col"
      >
        <div className="sticky top-0 flex h-screen w-[210px] flex-col px-3 pb-4 pt-[22px]">
          <div className="border-b border-white/10 px-2.5 pb-4">
            <Brand inverse />
          </div>
          <div className="mt-3.5">
            <Navigation />
          </div>
          <div className="mt-1.5">
            <NotificationLink unreadCount={unreadCount} />
          </div>
          <div className="mt-auto flex items-center gap-2.5 rounded-[10px] bg-white/5 p-2.5">
            <span aria-hidden="true" className="grid h-[30px] w-[30px] place-items-center rounded-full bg-ref-gold text-[13px] font-bold text-ref-cocoa">
              지
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-ref-header">이름</p>
              <p className="mt-0.5 text-[11px] text-ref-sidebar-muted-soft">오픈 근무</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-ref-work-surface">
        <header className="sticky top-0 z-20 border-b border-ref-line bg-ref-header/95 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div aria-label="Paul & Paulina" className="min-w-0">
              <span className="block truncate font-serif text-[19px] font-bold tracking-[0.01em] text-ref-text">Paul&amp;Paulina</span>
              <span className="mt-0.5 block text-[10px] tracking-[0.16em] text-ref-muted">BAKERY OPS</span>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to="/notification"
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-ref-muted transition-colors hover:bg-ref-gold-wash hover:text-ref-text motion-reduce:transition-none"
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
                ref={menuButtonRef}
                aria-controls="mobile-navigation"
                aria-expanded={isDrawerOpen}
                aria-label="메뉴 열기"
                onClick={() => setIsMenuOpen(true)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-ref-muted transition-colors hover:bg-ref-gold-wash hover:text-ref-text motion-reduce:transition-none"
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {isDrawerOpen ? (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button
              type="button"
              aria-label="메뉴 닫기"
              className="absolute inset-0 cursor-default bg-foreground/30"
              onClick={closeMenu}
            />
            <section
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="주요 메뉴"
              ref={drawerRef}
              onKeyDown={handleDrawerKeyDown}
              className="relative flex h-full w-[min(86vw,320px)] flex-col bg-ref-cocoa p-4 shadow-elegant"
            >
              <div className="flex min-h-11 items-center justify-between">
                <Brand inverse />
                <button
                  type="button"
                  ref={closeButtonRef}
                  aria-label="메뉴 닫기"
                  onClick={closeMenu}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-ref-sidebar-inactive transition-colors hover:bg-white/10 hover:text-ref-header motion-reduce:transition-none"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-7">
                <Navigation onNavigate={closeMenu} />
              </div>
              <div className="mt-1.5">
                <NotificationLink unreadCount={unreadCount} onNavigate={closeMenu} />
              </div>
              <p className="mt-auto px-2.5 text-xs text-ref-sidebar-muted-soft">{dateText}</p>
            </section>
          </div>
        ) : null}

        <header className="ref-page-header hidden items-center justify-between lg:flex">
          <p className="text-[13px] font-semibold text-ref-text-secondary">Paul &amp; Paulina 운영 대시보드</p>
          <p className="text-[12px] text-ref-muted">{dateText}</p>
        </header>

        <main className="min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-[26px] lg:py-[18px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
