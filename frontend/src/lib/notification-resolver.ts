/**
 * Centralized Notification Route Resolver & Pedagogical Category Meta
 *
 * Dynamically reconstructs deep-link URLs and rich category metadata at runtime
 * from lean entity references (entityType, entityId, subEntityId, classroomId, category),
 * eliminating database link staleness and hardcoded frontend routing paths.
 */

export type NotificationCategory =
  | "question"
  | "suggestion"
  | "warning"
  | "comment"
  | "revision"
  | "approval"
  | "submission"
  | "late_submission"
  | "assignment"
  | "announcement"
  | "system";

export interface NotificationEntityRef {
  id?: string;
  userId?: string;
  title?: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  entityType?: "journal" | "assignment" | "classroom" | string | null;
  entityId?: string | null;
  subEntityId?: string | null;
  classroomId?: string | null;
  category?: string | null;
  createdAt?: string;
}

/**
 * Resolves the precise category for a notification from explicit category
 * or smart fallback inspection.
 */
export function resolveNotificationCategory(notif: NotificationEntityRef): NotificationCategory {
  const metaCategory = typeof notif.metadata?.category === "string" ? notif.metadata.category : "";
  const rawCat = (notif.category || metaCategory || "").toLowerCase().trim();
  if (rawCat === "question") return "question";
  if (rawCat === "suggestion") return "suggestion";
  if (rawCat === "warning") return "warning";
  if (rawCat === "comment") return "comment";
  if (rawCat === "revision" || rawCat === "changes_requested") return "revision";
  if (rawCat === "approval" || rawCat === "graded") return "approval";
  if (rawCat === "late_submission") return "late_submission";
  if (rawCat === "submission") return "submission";
  if (rawCat === "assignment") return "assignment";
  if (rawCat === "announcement") return "announcement";

  const type = (notif.type || "").toLowerCase().trim();
  const title = (notif.title || "").toLowerCase();
  const msg = (notif.message || "").toLowerCase();

  if (type === "announcement" || title.includes("announcement")) return "announcement";
  if (type === "assignment" || title.includes("assignment")) return "assignment";

  const isLate = msg.includes("late") || title.includes("late");
  if (isLate && (type === "submission" || title.includes("submission") || msg.includes("handed in"))) {
    return "late_submission";
  }
  if (type === "submission" || title.includes("submission") || msg.includes("handed in")) {
    return "submission";
  }

  if (type === "changes_requested" || type === "revision" || title.includes("changes requested") || title.includes("revision") || msg.includes("requested revisions")) {
    return "revision";
  }

  if (type === "approval" || title.includes("approved") || title.includes("graded")) {
    return "approval";
  }

  if (type === "comment" || type === "annotation" || title.includes("comment") || title.includes("annotation")) {
    if (title.includes("question") || msg.includes("question")) return "question";
    if (title.includes("suggestion") || msg.includes("suggestion")) return "suggestion";
    if (title.includes("warning") || msg.includes("warning")) return "warning";
    if (title.includes("approval")) return "approval";
    return "comment";
  }

  return "system";
}

/**
 * Resolves target relative route URL dynamically from entity pointers.
 */
export function resolveNotificationTarget(
  notif: NotificationEntityRef,
  options?: {
    isTeacher?: boolean;
    studentJournalId?: string | null;
  }
): string {
  const category = resolveNotificationCategory(notif);
  const isTeacher = !!options?.isTeacher;
  const studentJournalId = options?.studentJournalId;

  const meta = notif.metadata;
  const metaEntityType = typeof meta?.entityType === "string" ? meta.entityType : undefined;
  const metaJournalId = typeof meta?.journalId === "string" ? meta.journalId : undefined;
  const metaEntityId = typeof meta?.entityId === "string" ? meta.entityId : undefined;
  const metaBlockId = typeof meta?.blockId === "string" ? meta.blockId : undefined;
  const metaClassroomId = typeof meta?.classroomId === "string" ? meta.classroomId : undefined;
  const metaAssignmentId = typeof meta?.assignmentId === "string" ? meta.assignmentId : undefined;

  // 1. Primary Entity Resolution: Journal Documents
  const isJournalEntity =
    notif.entityType === "journal" ||
    metaEntityType === "journal" ||
    metaEntityType === "journals" ||
    [
      "question",
      "suggestion",
      "warning",
      "comment",
      "revision",
      "approval",
      "submission",
      "late_submission",
    ].includes(category);

  if (isJournalEntity) {
    const journalId =
      notif.entityId ||
      metaJournalId ||
      (metaEntityType === "journals" ? metaEntityId : null) ||
      (category === "submission" || category === "late_submission" ? metaEntityId : null) ||
      studentJournalId;

    if (journalId) {
      const blockId = notif.subEntityId || metaBlockId;
      const blockQuery = blockId ? `?blockId=${encodeURIComponent(blockId)}` : "";
      return `/editor/${journalId}${blockQuery}`;
    }
  }

  // 2. Primary Entity Resolution: Lab Assignments
  if (category === "assignment" || notif.entityType === "assignment") {
    // If student already has an instantiated journal for this assignment, deep link straight into it!
    if (!isTeacher && studentJournalId) {
      return `/editor/${studentJournalId}`;
    }

    const classroomId = notif.classroomId || metaClassroomId;
    const assignmentId = notif.entityId || metaAssignmentId;

    if (classroomId && assignmentId) {
      return `/classrooms/${classroomId}?tab=assignments&assignmentId=${assignmentId}`;
    }
    if (classroomId) {
      return `/classrooms/${classroomId}?tab=assignments`;
    }
  }

  // 3. Primary Entity Resolution: Classroom & Announcements
  if (category === "announcement" || notif.entityType === "classroom") {
    const classroomId = notif.entityId || notif.classroomId || metaClassroomId;
    if (classroomId) {
      return `/classrooms/${classroomId}?tab=announcements`;
    }
  }

  // 4. Fallback to existing link or actionUrl
  if (notif.link && notif.link.trim()) {
    return notif.link.trim();
  }
  if (notif.metadata?.actionUrl && typeof notif.metadata.actionUrl === "string") {
    return notif.metadata.actionUrl.trim();
  }

  return "/dashboard";
}

export interface CategoryDisplayMeta {
  category: string;
  badgeText: string;
  actionLabel: string;
  iconType:
    | "book"
    | "clock-alert"
    | "file-check"
    | "file-edit"
    | "graduation"
    | "sparkles"
    | "help-circle"
    | "alert-triangle"
    | "message-square"
    | "megaphone"
    | "bell";
  avatarBg: string;
  badgeClass: string;
  cardHoverBtn: string;
  directHoverBtn: string;
}

/**
 * Returns visual styling, badge labels, and action text corresponding to each category.
 */
export function getCategoryDisplayMeta(
  category: NotificationCategory,
  isTeacher: boolean = true,
  hasJournal: boolean = false
): CategoryDisplayMeta {
  switch (category) {
    case "question":
      return {
        category: "Question",
        badgeText: "Question",
        actionLabel: isTeacher ? "View Question" : "Answer Question",
        iconType: "help-circle",
        avatarBg: "bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/25 dark:border-purple-500/35",
        badgeClass: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30 font-semibold",
        cardHoverBtn: "group-hover:bg-purple-500/10 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:border-purple-500/30",
        directHoverBtn: "hover:!bg-purple-600 hover:!text-white hover:!border-purple-600 hover:shadow-[0_2px_8px_rgba(168,85,247,0.4)]",
      };

    case "suggestion":
      return {
        category: "Suggestion",
        badgeText: "Suggestion",
        actionLabel: isTeacher ? "View Suggestion" : "Review Suggestion",
        iconType: "sparkles",
        avatarBg: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/25 dark:border-amber-500/35",
        badgeClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 font-semibold",
        cardHoverBtn: "group-hover:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:border-amber-500/30",
        directHoverBtn: "hover:!bg-amber-500 hover:!text-white hover:!border-amber-500 hover:shadow-[0_2px_8px_rgba(245,158,11,0.4)]",
      };

    case "warning":
      return {
        category: "Warning",
        badgeText: "Warning",
        actionLabel: isTeacher ? "Review Warning" : "Fix Warning",
        iconType: "alert-triangle",
        avatarBg: "bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/25 dark:border-rose-500/35",
        badgeClass: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 font-bold",
        cardHoverBtn: "group-hover:bg-rose-500/10 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:border-rose-500/30",
        directHoverBtn: "hover:!bg-rose-600 hover:!text-white hover:!border-rose-600 hover:shadow-[0_2px_8px_rgba(225,29,72,0.4)]",
      };

    case "comment":
      return {
        category: "Comment",
        badgeText: "Comment",
        actionLabel: isTeacher ? "View Comment" : "Reply to Comment",
        iconType: "message-square",
        avatarBg: "bg-sky-500/10 dark:bg-sky-500/20 border-sky-500/25 dark:border-sky-500/35",
        badgeClass: "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30 font-medium",
        cardHoverBtn: "group-hover:bg-sky-500/10 group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:border-sky-500/30",
        directHoverBtn: "hover:!bg-sky-600 hover:!text-white hover:!border-sky-600 hover:shadow-[0_2px_8px_rgba(14,165,233,0.4)]",
      };

    case "late_submission":
      return {
        category: "Late Submission",
        badgeText: "Late Submission",
        actionLabel: isTeacher ? "Review Journal" : "Open Journal",
        iconType: "clock-alert",
        avatarBg: "bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/25 dark:border-rose-500/35",
        badgeClass: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 font-extrabold",
        cardHoverBtn: "group-hover:bg-rose-500/10 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:border-rose-500/30",
        directHoverBtn: "hover:!bg-rose-500 hover:!text-white hover:!border-rose-500 hover:shadow-[0_2px_8px_rgba(244,63,94,0.4)]",
      };

    case "submission":
      return {
        category: "Submission",
        badgeText: "Submitted",
        actionLabel: isTeacher ? "Review Journal" : "Open Journal",
        iconType: "file-check",
        avatarBg: "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/25 dark:border-emerald-500/35",
        badgeClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30",
        cardHoverBtn: "group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30",
        directHoverBtn: "hover:!bg-emerald-600 hover:!text-white hover:!border-emerald-600 hover:shadow-[0_2px_8px_rgba(16,185,129,0.4)]",
      };

    case "revision":
      return {
        category: "Revision",
        badgeText: "Changes Requested",
        actionLabel: isTeacher ? "Review Changes" : "Revise Journal",
        iconType: "file-edit",
        avatarBg: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/25 dark:border-amber-500/35",
        badgeClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 font-extrabold",
        cardHoverBtn: "group-hover:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:border-amber-500/30",
        directHoverBtn: "hover:!bg-amber-500 hover:!text-white hover:!border-amber-500 hover:shadow-[0_2px_8px_rgba(245,158,11,0.4)]",
      };

    case "approval":
      return {
        category: "Graded",
        badgeText: "Approved & Graded",
        actionLabel: isTeacher ? "View Graded Journal" : "View Graded Journal",
        iconType: "graduation",
        avatarBg: "bg-teal-500/10 dark:bg-teal-500/20 border-teal-500/25 dark:border-teal-500/35",
        badgeClass: "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30",
        cardHoverBtn: "group-hover:bg-teal-500/10 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:border-teal-500/30",
        directHoverBtn: "hover:!bg-teal-600 hover:!text-white hover:!border-teal-600 hover:shadow-[0_2px_8px_rgba(20,184,166,0.4)]",
      };

    case "assignment":
      return {
        category: "Assignment",
        badgeText: "Assignment",
        actionLabel: isTeacher ? "View Assignment" : (hasJournal ? "Open Journal" : "Start Journal"),
        iconType: "book",
        avatarBg: "bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/25 dark:border-indigo-500/35",
        badgeClass: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30",
        cardHoverBtn: "group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:border-indigo-500/30",
        directHoverBtn: "hover:!bg-indigo-600 hover:!text-white hover:!border-indigo-600 hover:shadow-[0_2px_8px_rgba(99,102,241,0.4)]",
      };

    case "announcement":
      return {
        category: "Announcement",
        badgeText: "Announcement",
        actionLabel: "View Announcement",
        iconType: "megaphone",
        avatarBg: "bg-cyan-500/10 dark:bg-cyan-500/20 border-cyan-500/25 dark:border-cyan-500/35",
        badgeClass: "bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30",
        cardHoverBtn: "group-hover:bg-cyan-500/10 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:border-cyan-500/30",
        directHoverBtn: "hover:!bg-cyan-600 hover:!text-white hover:!border-cyan-600 hover:shadow-[0_2px_8px_rgba(6,182,212,0.4)]",
      };

    default:
      return {
        category: "System",
        badgeText: "Notification",
        actionLabel: "Open Details",
        iconType: "bell",
        avatarBg: "bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30",
        badgeClass: "bg-primary/10 dark:bg-primary/15 text-primary border-primary/20 dark:border-primary/30",
        cardHoverBtn: "group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/30",
        directHoverBtn: "hover:!bg-primary hover:!text-primary-foreground hover:!border-primary hover:shadow-[0_2px_8px_rgba(99,102,241,0.4)]",
      };
  }
}
