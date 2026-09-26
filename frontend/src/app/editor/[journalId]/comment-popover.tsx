"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Check, Sparkles, Send, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

interface CommentPopoverProps {
  journalId: string;
  blockId: string;
  userRole: string;
  comments: any[];
  onClose: () => void;
}

export default function CommentPopover({
  journalId,
  blockId,
  userRole,
  comments,
  onClose,
}: CommentPopoverProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<string>("comment");
  const [message, setMessage] = useState<string>("");
  const [suggestedText, setSuggestedText] = useState<string>("");

  // 1. Post Comment Mutation
  const postCommentMutation = useMutation({
    mutationFn: (data: any) => api.post("/comments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", journalId] });
      setMessage("");
      setSuggestedText("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to post comment");
    },
  });

  // 2. Accept Suggestion Mutation (Student only)
  const acceptSuggestionMutation = useMutation({
    mutationFn: (commentId: string) => api.post(`/comments/${commentId}/apply-suggestion`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", journalId] });
      queryClient.invalidateQueries({ queryKey: ["comments", journalId] });
      toast.success("Teacher suggestion applied to document block!", { title: "Suggestion Applied" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to apply suggestion");
    },
  });

  const handlePost = () => {
    if (!message.trim()) return;
    const payload: any = {
      journalId,
      blockId,
      type,
      message,
    };
    if (type === "suggestion" && suggestedText.trim()) {
      payload.suggestedContent = { text: suggestedText };
    }
    postCommentMutation.mutate(payload);
  };

  const blockComments = comments.filter((c) => c.blockId === blockId);

  return (
    <div className="absolute right-2 top-2 z-40 w-72 bg-white dark:bg-zinc-900 border border-border rounded-2xl p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 select-none">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <MessageSquare className="size-3.5 text-primary" />
          Block Annotations
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} className="size-6 rounded-full">
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Comment List */}
      <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-1">
        {blockComments.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic text-center py-2">
            No comments on this block.
          </p>
        ) : (
          blockComments.map((c) => (
            <div key={c.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-xs flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-foreground">{c.authorName} ({c.authorRole})</span>
                <span className="uppercase font-bold text-primary">{c.type}</span>
              </div>
              <p className="text-muted-foreground">{c.message}</p>

              {/* Suggestion Card with Accept Button for Student */}
              {c.type === "suggestion" && c.suggestedContent && (
                <div className="mt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    Suggested Replacement:
                  </span>
                  <p className="text-[11px] font-mono text-foreground">
                    {c.suggestedContent.text || JSON.stringify(c.suggestedContent)}
                  </p>
                  {userRole === "student" && c.status === "open" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => acceptSuggestionMutation.mutate(c.id)}
                      disabled={acceptSuggestionMutation.isPending}
                      className="gap-1 text-[10px] h-6 font-bold bg-amber-600 hover:bg-amber-700 text-white border-0 rounded-lg mt-1"
                    >
                      {acceptSuggestionMutation.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      <span>Accept Suggestion</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add New Comment / Suggestion Input */}
      <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
        {userRole === "teacher" && (
          <div className="flex items-center gap-1.5 text-[10px] font-semibold">
            <button
              onClick={() => setType("comment")}
              className={`px-2 py-0.5 rounded-full transition-all ${
                type === "comment" ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
              }`}
            >
              Comment
            </button>
            <button
              onClick={() => setType("suggestion")}
              className={`px-2 py-0.5 rounded-full transition-all ${
                type === "suggestion" ? "bg-amber-500 text-white font-bold" : "bg-muted text-muted-foreground"
              }`}
            >
              Suggestion
            </button>
            <button
              onClick={() => setType("highlight")}
              className={`px-2 py-0.5 rounded-full transition-all ${
                type === "highlight" ? "bg-purple-500 text-white font-bold" : "bg-muted text-muted-foreground"
              }`}
            >
              Highlight
            </button>
          </div>
        )}

        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add feedback message..."
          className="w-full p-2 text-xs bg-background border border-input rounded-xl focus:ring-1 focus:ring-primary focus:outline-none resize-none"
        />

        {type === "suggestion" && userRole === "teacher" && (
          <input
            type="text"
            value={suggestedText}
            onChange={(e) => setSuggestedText(e.target.value)}
            placeholder="Proposed replacement text..."
            className="w-full px-2 py-1 text-xs font-mono bg-background border border-input rounded-xl focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        )}

        <Button
          variant="default"
          size="sm"
          onClick={handlePost}
          disabled={!message.trim() || postCommentMutation.isPending}
          className="w-full gap-1.5 text-xs font-semibold rounded-xl h-7"
        >
          {postCommentMutation.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Send className="size-3" />
          )}
          <span>Post Feedback</span>
        </Button>
      </div>
    </div>
  );
}
