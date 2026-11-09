"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Info,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  X,
  FileText,
  Loader2,
} from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface AnnouncementAction {
  actionType: "none" | "link" | "modal" | "acknowledge";
  actionLabel?: string | null;
  actionUrl?: string | null;
  modalContent?: string | null;
  requiresAcknowledgment?: boolean;
}

interface ActiveAnnouncement {
  id: string;
  title: string;
  content: string;
  category: "general_info" | "academic_deadline" | "system_alert" | "action_required";
  priority: "low" | "normal" | "high" | "urgent";
  targetRoles: string[];
  action: AnnouncementAction;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
  isAcknowledged: boolean;
}

export function GlobalAnnouncementBanner() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [activeModalContent, setActiveModalContent] = useState<{ title: string; content: string } | null>(null);

  // Load session dismissals
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("ejournal_dismissed_announcements");
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // 1. Fetch active announcements (Cache-backed Bootstrap)
  const { data: announcements, refetch } = useQuery<ActiveAnnouncement[]>({
    queryKey: ["active-announcements"],
    queryFn: () => api.get<ActiveAnnouncement[]>("/announcements/active"),
    staleTime: 30000,
    retry: 1,
  });

  // 2. Real-Time Push Listener (SSE + 45s Heartbeat Protocol)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      eventSource = new EventSource(`${baseUrl}/announcements/stream`);

      eventSource.addEventListener("announcement", (e) => {
        try {
          queryClient.invalidateQueries({ queryKey: ["active-announcements"] });
          refetch();
        } catch {
          // Fallback
        }
      });

      eventSource.onerror = () => {
        // Browser handles reconnection automatically with Last-Event-ID
      };
    } catch {
      // SSE unsupported or network error
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [queryClient, refetch]);

  // Acknowledgment Mutation
  const ackMutation = useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/acknowledge`, {}),
    onSuccess: (_, id) => {
      queryClient.setQueryData<ActiveAnnouncement[]>(["active-announcements"], (old) => {
        if (!old) return [];
        return old.map((a) => (a.id === id ? { ...a, isAcknowledged: true } : a));
      });
    },
  });

  const handleDismiss = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem("ejournal_dismissed_announcements", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  // Find topmost visible announcement
  const visible = announcements?.filter((item) => {
    if (dismissedIds.includes(item.id)) return false;
    // Action-required items that are already acknowledged don't need to block
    if (item.category === "action_required" && item.isAcknowledged) return false;
    return true;
  });

  const current = visible && visible.length > 0 ? visible[0] : null;
  if (!current) return null;

  // Visual Category Semantics
  const getCategoryStyles = () => {
    switch (current.category) {
      case "academic_deadline":
        return {
          bannerBg: "bg-amber-500/10 dark:bg-amber-950/20 border-b border-amber-500/20 text-foreground",
          icon: <Clock className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />,
          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25",
          badgeText: "Academic deadline",
          canDismiss: true,
        };
      case "system_alert":
        return {
          bannerBg: "bg-destructive/10 dark:bg-destructive/20 border-b border-destructive/25 text-foreground",
          icon: <AlertTriangle className="size-3.5 text-destructive shrink-0" />,
          badge: "bg-destructive/15 text-destructive border-destructive/25",
          badgeText: "System alert",
          canDismiss: false, // System alerts are strictly non-dismissible
        };
      case "action_required":
        return {
          bannerBg: "bg-primary/10 border-b border-primary/25 text-foreground",
          icon: <ShieldAlert className="size-3.5 text-primary shrink-0" />,
          badge: "bg-primary/15 text-primary border-primary/25",
          badgeText: "Action required",
          canDismiss: false, // Must acknowledge or complete action
        };
      case "general_info":
      default:
        return {
          bannerBg: "bg-muted/80 border-b border-border text-foreground",
          icon: <Info className="size-3.5 text-foreground shrink-0" />,
          badge: "bg-card text-foreground border-border",
          badgeText: "Campus notice",
          canDismiss: true,
        };
    }
  };

  const styles = getCategoryStyles();
  const action = current.action || { actionType: "none" };

  return (
    <>
      <div
        role="alert"
        aria-live={current.category === "system_alert" ? "assertive" : "polite"}
        className={`w-full min-h-[38px] px-4 py-1.5 transition-colors duration-150 ease-out z-40 flex items-center justify-between gap-3 text-xs ${styles.bannerBg}`}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {styles.icon}
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${styles.badge}`}>
            {styles.badgeText}
          </span>
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold truncate">{current.title}:</span>
            <span className="text-muted-foreground truncate">{current.content}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {action.actionType === "link" && action.actionUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (action.actionUrl?.startsWith("http")) {
                  window.open(action.actionUrl, "_blank");
                } else {
                  router.push(action.actionUrl || "/");
                }
              }}
              className="h-6 px-2 rounded text-[11px] font-semibold gap-1 cursor-pointer"
            >
              <span>{action.actionLabel || "View details"}</span>
              <ArrowRight className="size-3" />
            </Button>
          )}

          {action.actionType === "modal" && action.modalContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setActiveModalContent({
                  title: current.title,
                  content: action.modalContent || current.content,
                })
              }
              className="h-6 px-2 rounded text-[11px] font-semibold gap-1 cursor-pointer"
            >
              <FileText className="size-3" />
              <span>{action.actionLabel || "Read notice"}</span>
            </Button>
          )}

          {action.actionType === "acknowledge" && (
            <Button
              size="sm"
              onClick={() => ackMutation.mutate(current.id)}
              disabled={ackMutation.isPending || current.isAcknowledged}
              className="h-6 px-2.5 rounded text-[11px] font-semibold gap-1 cursor-pointer"
            >
              {ackMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : current.isAcknowledged ? (
                <>
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  <span>Acknowledged</span>
                </>
              ) : (
                <span>{action.actionLabel || "Acknowledge"}</span>
              )}
            </Button>
          )}

          {styles.canDismiss && (
            <button
              onClick={() => handleDismiss(current.id)}
              aria-label="Dismiss Announcement"
              className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal Dialog for in-page Markdown/Text notices */}
      {activeModalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-lg rounded-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{activeModalContent.title}</h3>
              <button
                onClick={() => setActiveModalContent(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {activeModalContent.content}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => setActiveModalContent(null)}
                className="text-xs font-semibold px-4 cursor-pointer"
              >
                Close notice
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

