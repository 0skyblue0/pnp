import {
  Bell,
  CalendarClock,
  ClipboardList,
  Home,
  MessageSquarePlus,
  Settings
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/home", label: "홈", icon: Home },
  { to: "/daily-log/today", label: "일일 운영", icon: ClipboardList },
  { to: "/response", label: "손님 반응", icon: MessageSquarePlus },
  { to: "/reservation", label: "예약", icon: CalendarClock },
  { to: "/staff", label: "관리", icon: Settings }
];

export function AppLayout() {
  return (
    <div className="h-screen overflow-hidden bg-paper text-ink">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[232px_1fr]">
        <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-cream/95 shadow-[0_-12px_36px_rgba(80,52,31,0.16)] backdrop-blur-xl lg:static lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-t-0 lg:bg-cream/90 lg:shadow-[18px_0_48px_rgba(80,52,31,0.10)]">
          <div className="hidden h-[72px] items-center justify-center border-b border-latte/70 px-3 lg:flex lg:justify-start lg:px-4">
            <div className="grid h-11 w-11 place-items-center rounded-control bg-gradient-to-br from-cocoa via-bread to-amber text-base font-bold text-white shadow-elegant ring-1 ring-white/40">
              P
            </div>
            <span className="ml-3 hidden text-lg font-bold tracking-[-0.025em] text-cocoa lg:inline">
              PnP 운영
            </span>
          </div>
          <nav className="grid grid-cols-5 gap-1 p-1.5 lg:flex lg:flex-col lg:gap-2 lg:p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={false}
                  className={({ isActive }) =>
                    [
                      "flex min-h-12 min-w-0 flex-col items-center justify-center rounded-control px-1 text-[11px] font-bold transition lg:min-h-11 lg:flex-row lg:justify-start lg:px-3 lg:text-sm",
                      isActive
                        ? "bg-gradient-to-r from-cocoa to-bread text-white shadow-elegant ring-1 ring-white/30"
                        : "text-cocoa/80 hover:bg-white/90 hover:text-cocoa hover:shadow-control"
                    ].join(" ")
                  }
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="mt-1 truncate lg:ml-3 lg:mt-0">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#4d2c1a]/50 bg-gradient-to-r from-[#5f3822] via-[#7a4a2c] to-[#5a321d] px-4 shadow-sm lg:h-[72px] lg:px-7">
            <div className="min-w-0 truncate font-serif text-2xl font-normal tracking-[-0.01em] text-white drop-shadow-sm sm:text-3xl">
              Paul &amp; Paulina
            </div>
            <NavLink
              to="/notification"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-latte/80 bg-white/95 text-cocoa shadow-control transition hover:-translate-y-0.5 hover:border-bread/50 hover:bg-white hover:shadow-elegant"
              title="알림"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </NavLink>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-4 lg:p-7">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
