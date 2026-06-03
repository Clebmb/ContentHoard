import { useCallback, useMemo } from "react";
import { XIcon, PersonIcon, ClockIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDate } from "@renderer/hooks";
import cn from "classnames";

import type { Notification, Badge } from "@types";
import "./notification-item.scss";

const parseNotificationUrl = (notificationUrl: string): string => {
  const url = new URL(notificationUrl, "http://localhost");
  const userId = url.searchParams.get("userId");
  const badgeName = url.searchParams.get("name");
  const gameTitle = url.searchParams.get("title");

  if (url.pathname === "/profile" && userId) {
    return `/profile/${userId}`;
  }

  if (url.pathname === "/badges" && badgeName) {
    return `/badges/${badgeName}`;
  }

  if (url.pathname.startsWith("/game/")) {
    const params = new URLSearchParams();
    if (gameTitle) params.set("title", gameTitle);
    const queryString = params.toString();
    return queryString ? `${url.pathname}?${queryString}` : url.pathname;
  }

  return notificationUrl;
};

interface NotificationItemProps {
  notification: Notification;
  badges: Badge[];
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
}

export function NotificationItem({
  notification,
  badges,
  onDismiss,
  onMarkAsRead,
}: Readonly<NotificationItemProps>) {
  const { t } = useTranslation("notifications_page");
  const { formatDistance } = useDate();
  const navigate = useNavigate();

  const badge = useMemo(() => {
    if (notification.type !== "BADGE_RECEIVED") return null;
    return badges.find((b) => b.name === notification.variables.badgeName);
  }, [notification, badges]);

  const handleClick = useCallback(() => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }

    if (notification.url) {
      navigate(parseNotificationUrl(notification.url));
    }
  }, [notification, onMarkAsRead, navigate]);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss(notification.id);
    },
    [notification.id, onDismiss]
  );

  const getNotificationContent = () => {
    switch (notification.type) {
      case "BADGE_RECEIVED":
        return {
          title: t("badge_received_title"),
          description: badge?.description || notification.variables.badgeName,
        };
      default:
        return {
          title: t("notification"),
          description: "",
        };
    }
  };

  const content = getNotificationContent();
  const isBadge = notification.type === "BADGE_RECEIVED";

  const getIcon = () => {
    if (notification.pictureUrl) {
      return <img src={notification.pictureUrl} alt="" />;
    }

    return <PersonIcon size={24} />;
  };

  return (
    <button
      type="button"
      className={cn("notification-item", {
        "notification-item--unread": !notification.isRead,
      })}
      onClick={handleClick}
    >
      <div
        className={cn("notification-item__picture", {
          "notification-item__badge-picture": isBadge,
        })}
      >
        {getIcon()}
      </div>

      <div className="notification-item__content">
        <span className="notification-item__title">{content.title}</span>
        <span className="notification-item__description">
          {content.description}
        </span>
        <span className="notification-item__time">
          <ClockIcon size={12} />
          {formatDistance(new Date(notification.createdAt), new Date())}
        </span>
      </div>

      <button
        type="button"
        className="notification-item__dismiss"
        onClick={handleDismiss}
        title={t("dismiss")}
      >
        <XIcon size={16} />
      </button>
    </button>
  );
}
