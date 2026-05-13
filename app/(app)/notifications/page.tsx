import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { formatDateTime, titleCaseEnum } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <>
      <PageHeader description={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`} title="Notifications" />
      <form action={markAllNotificationsReadAction} className="mb-4">
        <Button disabled={unreadCount === 0} type="submit" variant="outline">
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </form>
      {notifications.length ? (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card className={notification.readAt ? "bg-white" : "border-primary/30 bg-primary/5"} key={notification.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{notification.title}</div>
                    <span className="text-xs text-muted-foreground">{titleCaseEnum(notification.type)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notification.actor?.name ?? "System"} | {formatDateTime(notification.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {notification.href ? (
                    <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={notification.href}>
                      Open
                    </Link>
                  ) : null}
                  {!notification.readAt ? (
                    <form action={markNotificationReadAction}>
                      <input name="id" type="hidden" value={notification.id} />
                      <Button size="sm" type="submit">
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No notifications" description="Assignment, comment, and diary notifications will appear here." />
      )}
    </>
  );
}
