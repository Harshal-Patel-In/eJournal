"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Send,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Info,
  Link as LinkIcon,
  FileText,
  Check,
  Loader2,
  Users,
  Eye,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();

  // Composer Form States
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"general_info" | "academic_deadline" | "system_alert" | "action_required">("general_info");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [targetRoles, setTargetRoles] = useState<string[]>(["all"]);
  const [actionType, setActionType] = useState<"none" | "link" | "modal" | "acknowledge">("none");
  const [actionLabel, setActionLabel] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(24);

  // Fetch all historical and active broadcasts
  const { data: announcements, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => api.get<any[]>("/announcements/admin/list"),
  });

  // Mutation: Dispatch Broadcast
  const broadcastMutation = useMutation({
    mutationFn: (payload: any) => api.post("/announcements/broadcast", payload),
    onSuccess: () => {
      toast.success("Broadcast dispatched in real-time across active campus sessions!");
      setTitle("");
      setContent("");
      setActionLabel("");
      setActionUrl("");
      setModalContent("");
      setActionType("none");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["active-announcements"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to broadcast announcement");
    },
  });

  // Mutation: Delete Broadcast
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      toast.info("Announcement deactivated and removed from active displays.");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["active-announcements"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove announcement");
    },
  });

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Announcement title and message content are required.");
      return;
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      category,
      priority,
      targetRoles,
      action: {
        actionType,
        actionLabel: actionLabel.trim() || null,
        actionUrl: actionUrl.trim() || null,
        modalContent: modalContent.trim() || null,
        requiresAcknowledgment: actionType === "acknowledge",
      },
      expiresInHours: Number(expiresInHours),
    };

    broadcastMutation.mutate(payload);
  };

  const toggleRole = (role: string) => {
    if (role === "all") {
      setTargetRoles(["all"]);
      return;
    }
    const currentWithoutAll = targetRoles.filter((r) => r !== "all");
    if (currentWithoutAll.includes(role)) {
      const next = currentWithoutAll.filter((r) => r !== role);
      setTargetRoles(next.length === 0 ? ["all"] : next);
    } else {
      setTargetRoles([...currentWithoutAll, role]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Campus Broadcast Announcements</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instantaneous dual-layer campus communication (Server-Sent Events push + persistent database cache)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Broadcast Composer */}
        <div className="lg:col-span-5 rounded-3xl bg-card border border-border p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/70">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Megaphone className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Dispatch New Broadcast</h2>
              <p className="text-[11px] text-muted-foreground">Pushed to all live browser sessions in &lt; 15ms</p>
            </div>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-4 text-xs">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Notice Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Campus Network Maintenance at 5 PM"
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-card text-xs text-foreground focus:outline-none focus:border-primary font-medium"
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Notice Message</label>
              <textarea
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Brief summary displayed directly inside the global top banner..."
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-card text-xs text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Category & Priority Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs focus:outline-none focus:border-primary"
                >
                  <option value="general_info">General Info (Blue)</option>
                  <option value="academic_deadline">Academic Deadline (Amber)</option>
                  <option value="system_alert">System Alert (Red - Locked)</option>
                  <option value="action_required">Action Required (Violet)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Priority</label>
                <select
                  value={priority}
                  onChange={(e: any) => setPriority(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs focus:outline-none focus:border-primary"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Target Audience Roles */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Target Audience</label>
              <div className="flex gap-2">
                {[
                  { id: "all", label: "All Users" },
                  { id: "student", label: "Students" },
                  { id: "teacher", label: "Teachers" },
                ].map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={`flex-1 py-1.5 px-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                      targetRoles.includes(role.id)
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Action Handler */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border border-border">
              <label className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                Interactive Action Handler
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "none", label: "None" },
                  { id: "link", label: "Deep Link" },
                  { id: "modal", label: "In-Page Modal" },
                  { id: "acknowledge", label: "Acknowledge" },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionType(act.id as any)}
                    className={`py-1 rounded-lg border text-[10px] font-bold transition-colors cursor-pointer ${
                      actionType === act.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              {actionType === "link" && (
                <div className="space-y-2 pt-2 animate-in fade-in">
                  <input
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="Button Label (e.g. View Classroom &rarr;)"
                    className="w-full px-3 py-1.5 rounded-lg border border-input bg-card text-xs focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="Destination URL (e.g. /classrooms/123)"
                    className="w-full px-3 py-1.5 rounded-lg border border-input bg-card text-xs font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {actionType === "modal" && (
                <div className="space-y-2 pt-2 animate-in fade-in">
                  <input
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="Modal Trigger Label (e.g. Read Circular)"
                    className="w-full px-3 py-1.5 rounded-lg border border-input bg-card text-xs focus:outline-none focus:border-primary"
                  />
                  <textarea
                    rows={3}
                    value={modalContent}
                    onChange={(e) => setModalContent(e.target.value)}
                    placeholder="Detailed notice body to display in dialog overlay..."
                    className="w-full px-3 py-1.5 rounded-lg border border-input bg-card text-xs focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              )}

              {actionType === "acknowledge" && (
                <div className="pt-2 animate-in fade-in">
                  <input
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="Acknowledge Label (Default: 'I Acknowledge')"
                    className="w-full px-3 py-1.5 rounded-lg border border-input bg-card text-xs focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Logged to the university compliance ledger with student timestamp.
                  </p>
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Active Duration</label>
              <select
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs focus:outline-none focus:border-primary"
              >
                <option value={6}>6 Hours</option>
                <option value={24}>24 Hours (1 Day)</option>
                <option value={72}>72 Hours (3 Days)</option>
                <option value={168}>7 Days (1 Week)</option>
                <option value={720}>30 Days (Entire Month)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={broadcastMutation.isPending}
              className="w-full rounded-xl text-xs font-bold gap-2 cursor-pointer shadow-sm mt-2"
            >
              {broadcastMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span>Broadcast Notice Now</span>
            </Button>
          </form>
        </div>

        {/* Right Column: Active & Historical Broadcasts Registry */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Active & Recent Broadcasts</h2>
            <span className="text-xs text-muted-foreground">
              {announcements?.length || 0} notices tracked
            </span>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-3xl">
                <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                Loading broadcast ledger...
              </div>
            ) : !announcements || announcements.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-3xl">
                <Megaphone className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-semibold text-xs">No broadcast announcements published yet.</p>
                <p className="text-[11px] mt-0.5">Use the composer on the left to dispatch a notice.</p>
              </div>
            ) : (
              announcements.map((item) => {
                const isExpired = new Date(item.expiresAt) < new Date();
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-3xl border transition-all ${
                      item.isActive && !isExpired
                        ? "bg-card border-border/90 shadow-2xs"
                        : "bg-muted/20 border-border/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              item.category === "system_alert"
                                ? "bg-rose-500/10 text-rose-600"
                                : item.category === "academic_deadline"
                                ? "bg-amber-500/10 text-amber-600"
                                : item.category === "action_required"
                                ? "bg-violet-500/10 text-violet-600"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {item.category.replace("_", " ")}
                          </span>

                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Priority: {item.priority}
                          </span>

                          <span className="text-[10px] text-muted-foreground">
                            Audience: {item.targetRoles?.join(", ")}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.content}</p>

                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="size-3 text-muted-foreground" />
                            Expires: {new Date(item.expiresAt).toLocaleDateString()}
                          </span>

                          {item.action?.actionType === "acknowledge" && (
                            <span className="flex items-center gap-1 text-emerald-600 font-semibold font-mono">
                              <CheckCircle2 className="size-3" />
                              {item.acknowledgedCount} students acknowledged
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
                        title="Deactivate Announcement"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

