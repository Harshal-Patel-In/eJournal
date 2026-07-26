"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, Loader2, MailOpen } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Fetch user notifications
  const { data: response, isLoading } = useQuery<any>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
    refetchInterval: 15000, // Poll notifications every 15s to feel instant
  });

  const notifications = response?.data || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  // 2. Mark single notification as read mutation
  const readMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 3. Mark all as read mutation
  const readAllMutation = useMutation({
    mutationFn: () => api.post("/notifications/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      readMutation.mutate(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer focus:outline-none"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 rounded-2xl border border-border bg-card shadow-lg z-50 overflow-hidden transform origin-top-right transition-all">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <span className="text-xs font-bold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending}
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Check className="size-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border/60">
            {isLoading ? (
              <div className="p-6 flex items-center justify-center text-muted-foreground text-xs gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Syncing inbox...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-muted-foreground/60 text-center gap-2">
                <MailOpen className="size-6 text-muted-foreground/45" />
                <span className="text-xs">No notifications yet</span>
              </div>
            ) : (
              notifications.map((notif: any) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full p-4 text-left hover:bg-muted/30 transition-all flex items-start gap-3 border-0 cursor-pointer ${
                    !notif.isRead ? "bg-primary/5 hover:bg-primary/10" : ""
                  }`}
                >
                  {/* Alert type dot */}
                  <div
                    className={`size-2 rounded-full shrink-0 mt-1.5 ${
                      !notif.isRead ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold text-foreground truncate">{notif.title}</span>
                    <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2">
                      {notif.message}
                    </p>
                    <span className="text-[9px] text-muted-foreground/50 mt-1 font-medium">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
