import {
  Bell,
  CalendarClock,
  ClipboardList,
  Home,
  MessageSquarePlus,
  MessageSquareText,
  Settings
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/home", label: "홈", icon: Home },
  { to: "/response/new", label: "반응 입력", icon: MessageSquarePlus },
  { to: "/response", label: "반응 조회", icon: MessageSquareText },
  { to: "/notification", label: "알림", icon: Bell },
  { to: "/reservation", label: "예약", icon: CalendarClock },
  { to: "/daily-log/today", label: "일일 운영", icon: ClipboardList },
  { to: "/staff", label: "관리", icon: Settings }
];

function formatStoreDateLabel(): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day} ${values.weekday}`;
}

export function AppLayout() {
  const dateLabel = formatStoreDateLabel();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="grid min-h-screen grid-cols-[88px_1fr] lg:grid-cols-[220px_1fr]">
        <aside className="border-r border-stone-200 bg-white">
          <div className="flex h-16 items-center justify-center border-b border-stone-200 px-3 lg:justify-start">
            <div className="grid h-10 w-10 place-items-center rounded-control bg-bread text-base font-bold text-white">
              P
            </div>
            <span className="ml-3 hidden text-lg font-semibold lg:inline">PnP 운영</span>
          </div>
          <nav className="flex flex-col gap-1 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "flex min-h-11 items-center justify-center rounded-control px-3 text-sm font-medium lg:justify-start",
                      isActive
                        ? "bg-stone-900 text-white"
                        : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                    ].join(" ")
                  }
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="ml-3 hidden lg:inline">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4 lg:px-6">
            <div>
              <p className="text-sm text-muted">{dateLabel}</p>
              <h1 className="text-xl font-semibold">오늘 운영</h1>
            </div>
            <NavLink
              to="/notification"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
              title="알림"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </NavLink>
          </header>
          <main className="min-w-0 flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
