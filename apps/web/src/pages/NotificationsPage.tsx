import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, CircleAlert, Info, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreference,
} from "#services/api";

export function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 15_000,
  });
  const preferences = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["notification-unread"] }),
    ]);
  };
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });
  const updatePreference = useMutation({
    mutationFn: ({
      channel,
      enabled,
    }: {
      channel: "email" | "slack" | "sms";
      enabled: boolean;
    }) => updateNotificationPreference(channel, enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      }),
  });

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-400">
            {t("notifications.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            {t("notifications.title")}
          </h2>
          <p className="mt-2 text-slate-300">
            {t("notifications.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          <CheckCheck className="h-4 w-4" />
          {t("notifications.markAllRead")}
        </button>
      </header>

      <section className="rounded-3xl border border-slate-800/90 bg-slate-900/60 p-6">
        <h3 className="font-semibold text-white">
          {t("notifications.preferences")}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {t("notifications.preferencesHint")}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["email", "slack", "sms"] as const).map((channel) => {
            const configured = preferences.data?.find(
              (preference) => preference.channel === channel,
            );
            const enabled = configured?.enabled ?? true;
            return (
              <label
                key={channel}
                className="flex items-center gap-3 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) =>
                    updatePreference.mutate({
                      channel,
                      enabled: event.target.checked,
                    })
                  }
                />
                {t(`notifications.channel.${channel}`)}
              </label>
            );
          })}
        </div>
      </section>

      {notifications.isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : notifications.isError ? (
        <p className="text-rose-300">{t("notifications.error")}</p>
      ) : notifications.data?.length ? (
        <div className="space-y-3">
          {notifications.data.map((notification) => {
            const Icon =
              notification.severity === "critical"
                ? ShieldAlert
                : notification.severity === "warning"
                  ? CircleAlert
                  : Info;
            const content = (
              <>
                <Icon className="mt-1 h-5 w-5 shrink-0 text-sky-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-white">
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
              </>
            );
            return (
              <article
                key={notification.id}
                className={`flex gap-4 rounded-3xl border p-5 ${
                  notification.readAt
                    ? "border-slate-800 bg-slate-900/50"
                    : "border-sky-500/30 bg-sky-500/10"
                }`}
                onClick={() => {
                  if (!notification.readAt) {
                    markRead.mutate(notification.id);
                  }
                }}
              >
                {notification.actionUrl ? (
                  <Link className="contents" to={notification.actionUrl}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          <Bell className="mx-auto mb-4 h-8 w-8" />
          {t("notifications.empty")}
        </div>
      )}
    </section>
  );
}
