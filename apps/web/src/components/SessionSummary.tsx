import { Clock3, Globe2, MonitorSmartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AdministeredUserSession,
  CurrentUserSession,
} from "#services/api";

interface SessionSummaryProps {
  session: CurrentUserSession | AdministeredUserSession;
  compact?: boolean;
}

export function SessionSummary({
  session,
  compact = false,
}: Readonly<SessionSummaryProps>) {
  const { t, i18n } = useTranslation();
  const formatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const clientName = session.client.name ?? t("sessions.unknownClient");
  const version = session.client.version ? ` ${session.client.version}` : "";
  const osName =
    session.client.operatingSystem?.name ?? t("sessions.unknownSystem");
  const location = session.network.location
    ? [
        session.network.location.city,
        session.network.location.region,
        session.network.location.country,
      ]
        .filter(Boolean)
        .join(", ")
    : t("sessions.locationUnavailable");

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-200">
          {clientName}
          {version} {t("sessions.onSystem", { system: osName })}
        </p>
        {"isCurrent" in session && session.isCurrent ? (
          <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            {t("sessions.current")}
          </span>
        ) : null}
      </div>
      <div
        className={`mt-2 grid gap-1 text-xs text-slate-500 ${
          compact ? "" : "sm:grid-cols-2"
        }`}
      >
        <p className="flex items-center gap-1.5">
          <MonitorSmartphone className="h-3.5 w-3.5" />
          {t(`sessions.device.${session.client.deviceType}`)}
        </p>
        <p className="flex items-center gap-1.5">
          <Globe2 className="h-3.5 w-3.5" />
          {location}
          {session.network.ipAddress
            ? ` · ${session.network.ipAddress}`
            : ` · ${t("sessions.unknownIp")}`}
        </p>
        <p className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {t("sessions.lastActivity", {
            date: formatter.format(new Date(session.lastActivityAt)),
          })}
        </p>
        <p>
          {t("sessions.createdAt", {
            date: formatter.format(new Date(session.createdAt)),
          })}
        </p>
        <p>
          {t("sessions.expiresAt", {
            date: formatter.format(new Date(session.expiresAt)),
          })}
        </p>
      </div>
      <p className="mt-1 truncate font-mono text-[10px] text-slate-700">
        {session.sessionId}
      </p>
    </div>
  );
}
