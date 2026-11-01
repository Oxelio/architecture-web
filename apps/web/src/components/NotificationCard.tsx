import { CircleAlert, Info, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { NotificationItem } from "#services/api";

export function NotificationCard({
  notification,
  onRead,
}: Readonly<{
  notification: NotificationItem;
  onRead: (id: string) => void;
}>) {
  const { t } = useTranslation();
  const icons: Record<string, typeof Info> = {
    critical: ShieldAlert,
    warning: CircleAlert,
  };
  const Icon = icons[notification.severity] ?? Info;
  const titleId = `notification-title-${notification.id}`;
  const acknowledge = () => {
    if (!notification.readAt) {
      onRead(notification.id);
    }
  };
  let control: ReactNode = null;
  const focus =
    "absolute inset-0 rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400";
  if (notification.actionUrl) {
    control = (
      <Link
        to={notification.actionUrl}
        onClick={acknowledge}
        aria-labelledby={titleId}
        className={focus}
      />
    );
  } else if (!notification.readAt) {
    control = (
      <button
        type="button"
        onClick={acknowledge}
        aria-label={t("notifications.markRead", { title: notification.title })}
        className={focus}
      />
    );
  }

  return (
    <article
      className={`relative flex gap-4 rounded-3xl border p-5 ${notification.readAt ? "border-slate-800 bg-slate-900/50" : "border-sky-500/30 bg-sky-500/10"}`}
    >
      <Icon className="mt-1 h-5 w-5 shrink-0 text-sky-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} className="font-semibold text-white">
            {notification.title}
          </h3>
          <time className="text-xs text-slate-500">
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(notification.createdAt))}
          </time>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {notification.message}
        </p>
      </div>
      {control}
    </article>
  );
}
