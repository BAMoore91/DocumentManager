import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { cn, formatDate } from "@/lib/utils";

export async function NotificationsCard({ userId }: { userId: string }) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 20,
  });
  if (notifications.length === 0) return null;

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-medium">
          <Bell className="h-4 w-4" />
          Notifications
          {unreadCount > 0 ? (
            <span className="rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--primary-foreground))]">
              {unreadCount} new
            </span>
          ) : null}
        </h2>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all read
            </Button>
          </form>
        ) : null}
      </div>
      <div className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
        {notifications.map((n) => {
          const unread = !n.readAt;
          return (
            <div
              key={n.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 px-3 py-2",
                unread && "bg-[hsl(var(--muted))]/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {n.linkUrl ? (
                    <Link
                      href={n.linkUrl}
                      className={cn(
                        "hover:underline",
                        unread ? "font-medium" : "text-[hsl(var(--muted-foreground))]",
                      )}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        unread ? "font-medium" : "text-[hsl(var(--muted-foreground))]",
                      )}
                    >
                      {n.title}
                    </span>
                  )}
                </div>
                {n.body ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{n.body}</p>
                ) : null}
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatDate(n.createdAt)}
                </p>
              </div>
              {unread ? (
                <form action={markNotificationRead}>
                  <input type="hidden" name="id" value={n.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Mark read
                  </Button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
