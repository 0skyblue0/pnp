import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet, apiPatch } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";


type NotificationDto = {
  id: number;
  type: string;
  title: string;
  body?: string;
  link?: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

function severityClasses(severity: NotificationDto["severity"]) {
  if (severity === "CRITICAL") {
    return "bg-red/10 text-red";
  }
  if (severity === "WARN") {
    return "bg-amber/10 text-amber";
  }
  return "bg-blue/10 text-blue";
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function NotificationPage() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    setIsLoading(true);
    setError(null);

    const envelope = await apiGet<ListEnvelope<NotificationDto>>("/notification");
    setIsLoading(false);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setNotifications(envelope.data.items);
  }

  async function markAllRead() {
    setError(null);
    const envelope = await apiPatch<{ updated: number }, Record<string, never>>(
      "/notification/read-all",
      {}
    );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    await loadNotifications();
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  return (
    <section className="app-page grid gap-4">
      <PageHeader title="알림" description="운영 중 확인이 필요한 상태를 모아 봅니다." actions={<>
        <button
          className="ref-secondary-action text-[12.5px]"
          disabled={isLoading}
          type="button"
          onClick={() => void markAllRead()}
        >
          전체 읽음 처리
        </button>
      </>} />

      {error ? (
        <div role="alert" className="mb-4 rounded-control border border-red/30 bg-[#fff5f4] px-3 py-2 text-sm font-semibold text-red">
          {error}
        </div>
      ) : null}

      <div className="app-card px-[22px] py-1" aria-label="알림 상태 목록">
        {notifications.map((notification) => {
          const content = (
            <>
              <span className={["app-status px-2.5 py-1 text-[10px] font-bold", severityClasses(notification.severity)].join(" ")}>{notification.severity}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{notification.title}</span>
              <span className="shrink-0 text-[11px] text-muted">{formatCreatedAt(notification.createdAt)}</span>
              <span className={["w-11 shrink-0 text-right text-[11px] font-semibold", notification.isRead ? "text-muted" : "text-red"].join(" ")}>{notification.isRead ? "읽음" : "안읽음"}</span>
            </>
          );

          if (notification.link) {
            return (
              <Link
                key={notification.id}
                className={[
                  "flex items-center gap-3 border-b border-[#F1EAE0] py-3.5 opacity-100 last:border-b-0 hover:bg-[#fdf8ec]",
                  notification.isRead ? "" : "bg-[#fdf8ec]"
                ].join(" ")}
                to={notification.link}
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={notification.id}
              className={[
                "flex items-center gap-3 border-b border-[#F1EAE0] py-3.5 opacity-100 last:border-b-0",
                notification.isRead ? "" : "bg-[#fdf8ec]"
              ].join(" ")}
            >
              {content}
            </div>
          );
        })}
        {!isLoading && notifications.length === 0 ? (
          <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
            알림 없음
          </div>
        ) : null}
      </div>
    </section>
  );
}
