import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { NotificationItem } from "#services/api";

import { NotificationCard } from "./NotificationCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, values: { title: string }) =>
      `Mark as read: ${values.title}`,
  }),
}));

const notification: NotificationItem = {
  id: "notice-1",
  type: "security",
  severity: "warning",
  title: "Account changed",
  message: "Review your account",
  actionUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  readAt: null,
};

describe("notification native interaction", () => {
  it.each([null, "/account"])(
    "uses one native control for an unread notification with action %s",
    (actionUrl) => {
      const markup = renderToStaticMarkup(
        <MemoryRouter>
          <NotificationCard
            notification={{ ...notification, actionUrl }}
            onRead={vi.fn()}
          />
        </MemoryRouter>,
      );
      expect(markup).toContain("<article");
      expect(markup).toContain('<h3 id="notification-title-notice-1"');
      if (actionUrl) {
        expect(markup).toContain('href="/account"');
        expect(markup).toContain(
          'aria-labelledby="notification-title-notice-1"',
        );
        expect(markup).not.toContain("<button");
      } else {
        expect(markup).toContain('type="button"');
        expect(markup).toContain('aria-label="Mark as read: Account changed"');
        expect(markup).not.toContain("<a ");
      }
      expect(markup).toContain("focus-visible:outline");
    },
  );

  it.each([null, "2026-01-02T00:00:00Z"])(
    "marks only unread notifications during native action activation (%s)",
    (readAt) => {
      const onRead = vi.fn();
      const element = NotificationCard({
        notification: { ...notification, readAt, actionUrl: "/account" },
        onRead,
      }) as ReactElement<{ children: ReactNode[] }>;
      const control = element.props.children.at(-1);
      expect(isValidElement(control)).toBe(true);
      (control as ReactElement<{ onClick: () => void }>).props.onClick();
      expect(onRead).toHaveBeenCalledTimes(readAt ? 0 : 1);
      if (!readAt) {
        expect(onRead).toHaveBeenCalledWith(notification.id);
      }
    },
  );

  it("keeps an already-read notification without an action as static content", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <NotificationCard
          notification={{ ...notification, readAt: "2026-01-02T00:00:00Z" }}
          onRead={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(markup).toContain(notification.title);
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<a ");
  });
});
