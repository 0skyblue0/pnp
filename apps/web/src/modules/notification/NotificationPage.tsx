import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet, apiPatch } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { Button } from "../../shared/ui/Button.js";

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
    <section className="panel mx-auto max-w-4xl">
      <div className="panel-heading">
        <div>
          <p className="text-sm text-muted">M13</p>
          <h2 className="section-title">알림 센터</h2>
        </div>
        <Button
          disabled={isLoading}
          icon={CheckCheck}
          type="button"
          onClick={() => void markAllRead()}
        >
          모두 읽음
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {notifications.map((notification) => {
          const content = (
            <>
              <span
                className={[
                  "grid h-10 w-10 place-items-center rounded-control",
                  severityClasses(notification.severity)
                ].join(" ")}
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{notification.title}</span>
                <span className="block truncate text-sm text-muted">
                  {notification.body ?? notification.type} ·{" "}
                  {formatCreatedAt(notification.createdAt)}
                </span>
              </span>
              <span
                className={[
                  "rounded-control px-2 py-1 text-xs font-semibold",
                  notification.isRead ? "bg-stone-100 text-muted" : "bg-blue/10 text-blue"
                ].join(" ")}
              >
                {notification.isRead ? "읽음" : "신규"}
              </span>
            </>
          );

          if (notification.link) {
            return (
              <Link
                key={notification.id}
                className="grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3 hover:bg-stone-50"
                to={notification.link}
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={notification.id}
              className="grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3"
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
