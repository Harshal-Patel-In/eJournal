"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Clock,
  RotateCcw,
  X,
  Archive,
  AlertTriangle,
  Maximize2,
  Eye,
  FileImage,
} from "lucide-react";
import { useDocumentStore } from "../use-document-store";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface ImageItem {
  url: string;
  caption?: string;
}

interface TrashedAsset {
  id: string;
  url: string;
  filename: string;
  size: number;
  deletedAt: string;
  expiresAt: string;
  remainingSeconds: number;
  daysRemaining: number;
}

interface ImageBlockProps {
  id: string;
  content: {
    url?: string;
    caption?: string;
    images?: ImageItem[];
    mainCaption?: string;
  };
  previewMode: boolean;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function ImageBlock({ id, content, previewMode }: ImageBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Recycle Bin state
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashedAsset[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [permanentlyDeletingId, setPermanentlyDeletingId] = useState<string | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<TrashedAsset | null>(null);
  const [quickLookItem, setQuickLookItem] = useState<TrashedAsset | null>(null);

  // Ensure portal target is mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and prevent keyboard leaks when modal/drawer is open
  useEffect(() => {
    const shouldLock = isRecycleBinOpen || !!assetToDelete || !!quickLookItem;
    if (shouldLock) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (quickLookItem) {
          setQuickLookItem(null);
        } else if (assetToDelete) {
          setAssetToDelete(null);
        } else if (isRecycleBinOpen) {
          setIsRecycleBinOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRecycleBinOpen, assetToDelete, quickLookItem]);

  // Normalize legacy vs multi-image payload structure
  let images: ImageItem[] = [];
  if (Array.isArray(content.images) && content.images.length > 0) {
    images = content.images;
  } else if (content.url) {
    images = [{ url: content.url, caption: content.caption || "" }];
  }

  const mainCaption = content.mainCaption || (content.images ? content.caption || "" : "");

  // Fetch Recycle Bin items whenever the drawer opens
  useEffect(() => {
    if (isRecycleBinOpen) {
      fetchTrash();
    }
  }, [isRecycleBinOpen]);

  const fetchTrash = async () => {
    setLoadingTrash(true);
    try {
      const data = await api.get<TrashedAsset[]>("/uploads/trash");
      setTrashItems(Array.isArray(data) ? data : []);
    } catch {
      setTrashItems([]);
    } finally {
      setLoadingTrash(false);
    }
  };

  const handleMultipleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Client-side validation: Max 5MB per file
    const oversized = files.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) {
      setErrorMsg(`File "${oversized.name}" exceeds 5MB limit`);
      return;
    }

    setUploading(true);
    setErrorMsg(null);

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        const clientToken =
          typeof document !== "undefined"
            ? document.cookie.match(/(?:^|; )access_token=([^;]*)/)?.[1]
            : null;
        const headers: Record<string, string> = {};
        if (clientToken) {
          headers["Authorization"] = `Bearer ${decodeURIComponent(clientToken)}`;
        }

        const response = await fetch(`${API_BASE_URL}/uploads/images`, {
          method: "POST",
          headers,
          body: formData,
          credentials: "include",
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || `Upload failed for ${file.name}`);
        }

        return { url: data.data.url as string, caption: "" };
      });

      const newUploadedImages = await Promise.all(uploadPromises);
      const updatedImages = [...images, ...newUploadedImages];

      updateBlock(id, {
        images: updatedImages,
        url: updatedImages[0]?.url || "",
        caption: mainCaption,
      });
      toast.success(
        files.length === 1
          ? "Image added to figure gallery"
          : `${files.length} images added to figure gallery`
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload image(s). Please try again.");
      toast.error("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const updateSubCaption = (index: number, captionValue: string) => {
    const nextImages = images.map((item, idx) =>
      idx === index ? { ...item, caption: captionValue } : item
    );
    updateBlock(id, { images: nextImages });
  };

  const removeImage = async (index: number) => {
    const targetImage = images[index];
    const nextImages = images.filter((_, idx) => idx !== index);

    if (nextImages.length === 0) {
      updateBlock(id, { images: [], url: "", caption: "" });
    } else {
      updateBlock(id, {
        images: nextImages,
        url: nextImages[0].url,
        caption: mainCaption,
      });
    }

    // Move to recycle bin on backend
    if (targetImage?.url) {
      try {
        await api.post("/uploads/trash", { url: targetImage.url });
        toast.info("Image moved to Recycle Bin (kept for 3 days)");
      } catch (err) {
        console.warn("Could not register image in recycle bin:", err);
      }
    }
  };

  const updateMainCaption = (val: string) => {
    updateBlock(id, { mainCaption: val, caption: val });
  };

  // Restore image from recycle bin into current block
  const handleRestoreImage = async (item: TrashedAsset) => {
    try {
      await api.post(`/uploads/trash/${item.id}/restore`);
      const updatedImages = [...images, { url: item.url, caption: item.filename || "" }];
      updateBlock(id, {
        images: updatedImages,
        url: updatedImages[0]?.url || "",
        caption: mainCaption,
      });
      setTrashItems((prev) => prev.filter((t) => t.id !== item.id));
      if (quickLookItem?.id === item.id) {
        setQuickLookItem(null);
      }
      toast.success("Image restored to document");
    } catch {
      toast.error("Failed to restore image. Retention period may have expired.");
    }
  };

  // Confirm and execute permanent deletion
  const handleConfirmPermanentDelete = async () => {
    if (!assetToDelete) return;
    const targetId = assetToDelete.id;
    setPermanentlyDeletingId(targetId);

    try {
      await api.delete(`/uploads/trash/${targetId}/permanent`);
      setTrashItems((prev) => prev.filter((t) => t.id !== targetId));
      if (quickLookItem?.id === targetId) {
        setQuickLookItem(null);
      }
      setAssetToDelete(null);
      toast.success("Image permanently deleted");
    } catch {
      toast.error("Failed to permanently delete image. Please try again.");
    } finally {
      setPermanentlyDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper for responsive grid layout columns
  const getGridColsClass = (count: number) => {
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 sm:grid-cols-2";
    if (count === 3) return "grid-cols-1 sm:grid-cols-3";
    return "grid-cols-1 sm:grid-cols-2";
  };

  // --- PREVIEW MODE ---
  if (previewMode) {
    if (images.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-xl my-4 text-muted-foreground/60 italic text-xs">
          No image uploaded
        </div>
      );
    }

    return (
      <figure className="flex flex-col items-center justify-center my-6 gap-3 w-full">
        {/* Multi-Image Side-by-Side Responsive Grid */}
        <div className={`grid ${getGridColsClass(images.length)} gap-4 w-full items-start`}>
          {images.map((img, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5 w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption || `Figure item ${idx + 1}`}
                className="w-full max-h-[700px] object-contain rounded-lg border border-border/60 shadow-xs"
              />
              {img.caption && (
                <span className="text-[11px] text-muted-foreground font-medium text-center italic leading-tight px-1">
                  ({String.fromCharCode(97 + idx)}) {img.caption}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Main Overall Figure Group Caption */}
        {mainCaption && (
          <figcaption className="text-xs text-muted-foreground/90 font-semibold text-center max-w-[90%] mt-1">
            {mainCaption}
          </figcaption>
        )}
      </figure>
    );
  }

  // --- EDIT MODE: EMPTY STATE (DROPZONE) ---
  if (images.length === 0) {
    return (
      <div className="flex flex-col gap-2 w-full p-4 border border-border rounded-xl bg-card shadow-sm select-none">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="size-3.5" /> Figure / Multi-Image Gallery
          </span>
          <button
            onClick={() => setIsRecycleBinOpen(true)}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <Archive className="size-3.5" />
            <span>Recycle Bin</span>
          </button>
        </div>
        <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl cursor-pointer transition-all">
          <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-2 text-muted-foreground">
            {uploading ? (
              <>
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs font-semibold">Uploading figure images...</span>
              </>
            ) : (
              <>
                <Upload className="size-6 text-muted-foreground/60" />
                <span className="text-xs font-semibold">Click or drag images here to add to gallery</span>
                <span className="text-[10px] text-muted-foreground/50">Supports selecting multiple PNG, JPG, SVG files (up to 5MB each)</span>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={handleMultipleFilesUpload}
            className="hidden"
          />
        </label>
        {errorMsg && <p className="text-[11px] text-destructive font-medium mt-1">{errorMsg}</p>}

        {/* Portal-Mounted Recycle Bin Drawer, Quick Look & Deletion Modals */}
        {renderRecycleBinPortal()}
        {renderQuickLookPortal()}
        {renderPermanentDeletePortal()}
      </div>
    );
  }

  // --- EDIT MODE: GALLERY WITH INDIVIDUAL & MAIN CAPTIONS ---
  return (
    <div className="flex flex-col gap-4 w-full border border-border p-4 rounded-xl bg-card shadow-sm">
      {/* Header bar with Add Image and Recycle Bin button */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="size-3.5" /> Multi-Image Gallery ({images.length} {images.length === 1 ? "Image" : "Images"})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRecycleBinOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg border border-border/60 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <Archive className="size-3.5" />
            <span>Recycle Bin</span>
          </button>
          <label className="cursor-pointer">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 transition-all">
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>Add Images</span>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={handleMultipleFilesUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Side-by-side Image Cards Grid */}
      <div className={`grid ${getGridColsClass(images.length)} gap-4 w-full`}>
        {images.map((img, idx) => (
          <div
            key={idx}
            className="group relative flex flex-col gap-2 p-2 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all"
          >
            {/* Delete sub-image button overlay (moves to recycle bin) */}
            <button
              onClick={() => removeImage(idx)}
              title="Move image to Recycle Bin"
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-md"
            >
              <Trash2 className="size-3.5" />
            </button>

            {/* Sub-image preview */}
            <div className="relative w-full overflow-hidden rounded-lg bg-background flex items-center justify-center border border-border/40 min-h-[160px] max-h-[400px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption || `Sub-image ${idx + 1}`}
                className="w-full h-full max-h-[380px] object-contain rounded-lg"
              />
            </div>

            {/* Individual Sub-Caption Input */}
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[11px] font-bold text-muted-foreground/70 shrink-0">
                ({String.fromCharCode(97 + idx)})
              </span>
              <input
                type="text"
                value={img.caption || ""}
                onChange={(e) => updateSubCaption(idx, e.target.value)}
                placeholder={`Sub-caption for image (${String.fromCharCode(97 + idx)})...`}
                className="w-full text-xs font-medium bg-transparent border-0 border-b border-border/40 hover:border-border focus:border-primary focus:ring-0 focus:outline-none py-0.5 transition-all placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        ))}
      </div>

      {errorMsg && <p className="text-[11px] text-destructive font-medium">{errorMsg}</p>}

      {/* Main Overall Figure Group Caption Input */}
      <div className="pt-2 border-t border-border/50 flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted-foreground">Main Figure Title / Overall Caption</label>
        <input
          type="text"
          value={mainCaption}
          onChange={(e) => updateMainCaption(e.target.value)}
          placeholder="e.g. Figure 1: Circuit diagram, oscilloscope waveforms, and multimeter readings..."
          className="w-full text-xs font-medium bg-muted/30 hover:bg-muted/50 focus:bg-background border border-border/60 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Portal-Mounted Recycle Bin Drawer, Quick Look & Deletion Modals */}
      {renderRecycleBinPortal()}
      {renderQuickLookPortal()}
      {renderPermanentDeletePortal()}
    </div>
  );

  // --- RECYCLE BIN FLOATING STUDIO SHEET (PORTAL-MOUNTED) ---
  function renderRecycleBinPortal() {
    if (!isRecycleBinOpen || !mounted || typeof document === "undefined") return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[999] flex items-center justify-end p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none"
        onClick={() => setIsRecycleBinOpen(false)}
      >
        <div
          className="w-full max-w-xl sm:max-w-2xl h-[calc(100vh-24px)] sm:h-[calc(100vh-32px)] md:h-[calc(100vh-48px)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200/90 dark:border-zinc-800/90 ring-1 ring-black/10 dark:ring-white/10 shadow-2xl rounded-3xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="px-6 py-4 border-b border-border/70 bg-zinc-50/80 dark:bg-zinc-850/80 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Archive className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground tracking-tight">Recycle Bin</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-muted text-muted-foreground border border-border/60">
                    {trashItems.length} {trashItems.length === 1 ? "asset" : "assets"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Images removed from document blocks
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRecycleBinOpen(false)}
              className="size-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Retention Information Banner */}
          <div className="mx-6 mt-4 px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300 shrink-0">
            <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="leading-snug">
              Deleted images are automatically purged permanently after <strong className="font-bold">3 days</strong>. You can restore images back into your document at any time.
            </span>
          </div>

          {/* Body Content: Generous Media Cards */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
            {loadingTrash ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <Loader2 className="size-7 animate-spin text-primary" />
                <span className="text-xs font-semibold">Synchronizing recycle bin...</span>
              </div>
            ) : trashItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3.5 text-center text-muted-foreground">
                <div className="p-4 rounded-3xl bg-muted/30 border border-border/60">
                  <Archive className="size-8 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">Recycle bin is empty</p>
                  <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                    Any figures or photos you remove from figure blocks will be retained here for 3 days before automatic cleanup.
                  </p>
                </div>
              </div>
            ) : (
              trashItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex items-center gap-4 p-3 rounded-2xl border border-border/70 bg-card hover:bg-muted/30 hover:border-border transition-all shadow-xs"
                >
                  {/* Generous Aspect-Adaptive Thumbnail with Quick Look Trigger */}
                  <div
                    onClick={() => setQuickLookItem(item)}
                    title="Click for full-screen Quick Look"
                    className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-border/60 overflow-hidden relative group/thumb cursor-pointer flex items-center justify-center p-1.5 transition-all hover:ring-2 hover:ring-primary/40 shadow-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.filename || "Deleted asset"}
                      className="max-h-full max-w-full object-contain rounded-xl transition-transform duration-200 group-hover/thumb:scale-105"
                    />

                    {/* Quick Look Hover Pill */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all">
                      <span className="px-2 py-1 rounded-lg bg-white/90 dark:bg-zinc-900/90 text-[10px] font-bold text-foreground shadow-sm flex items-center gap-1">
                        <Eye className="size-3" /> Quick Look
                      </span>
                    </div>
                  </div>

                  {/* Metadata & Details */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate max-w-[240px]">
                        {item.filename || "Uploaded Image"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                        <Clock className="size-2.5" />
                        {item.daysRemaining === 1 ? "1 day left" : `${item.daysRemaining} days left`}
                      </span>

                      {item.size > 0 && (
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <FileImage className="size-3 text-muted-foreground/60" />
                          {formatFileSize(item.size)}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      Click thumbnail to inspect full-size diagram
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => handleRestoreImage(item)}
                      title="Restore to current document"
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Restore</span>
                    </button>

                    <button
                      onClick={() => setAssetToDelete(item)}
                      title="Delete permanently"
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="size-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-4 border-t border-border/70 bg-zinc-50/80 dark:bg-zinc-850/80 backdrop-blur-md flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-foreground">
              {trashItems.length > 0
                ? "Restored images are inserted at the end of the figure block."
                : "No items pending deletion."}
            </span>
            <button
              onClick={() => setIsRecycleBinOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-border bg-background hover:bg-muted transition-all cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // --- 1-CLICK QUICK LOOK FULL-SCREEN LIGHTBOX (PORTAL-MOUNTED) ---
  function renderQuickLookPortal() {
    if (!quickLookItem || !mounted || typeof document === "undefined") return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[1050] flex flex-col items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 select-none"
        onClick={() => setQuickLookItem(null)}
      >
        {/* Lightbox Top Header */}
        <div
          className="w-full max-w-4xl flex items-center justify-between pb-3 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Maximize2 className="size-4 text-primary" />
            <span className="text-sm font-bold truncate max-w-[300px] sm:max-w-md">
              {quickLookItem.filename || "Figure Preview"}
            </span>
            {quickLookItem.size > 0 && (
              <span className="text-xs text-zinc-400">
                ({formatFileSize(quickLookItem.size)})
              </span>
            )}
          </div>
          <button
            onClick={() => setQuickLookItem(null)}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Lightbox Centered Image */}
        <div
          className="relative max-h-[75vh] max-w-[90vw] flex items-center justify-center overflow-hidden rounded-3xl bg-zinc-950/80 border border-white/10 shadow-2xl p-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={quickLookItem.url}
            alt={quickLookItem.filename || "Full preview"}
            className="max-h-[72vh] max-w-full object-contain rounded-2xl"
          />
        </div>

        {/* Bottom Action Bar */}
        <div
          className="w-full max-w-4xl flex items-center justify-between pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Clock className="size-3.5 text-amber-400" />
            <span>Expires in {quickLookItem.daysRemaining} days</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setQuickLookItem(null);
                setAssetToDelete(quickLookItem);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>Delete Permanently</span>
            </button>
            <button
              onClick={() => handleRestoreImage(quickLookItem)}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Restore to Document</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // --- PERMANENT DELETION MODAL (APPLE LIQUID GLASS & VENDOR-AGNOSTIC, PORTAL-MOUNTED) ---
  function renderPermanentDeletePortal() {
    if (!assetToDelete || !mounted || typeof document === "undefined") return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200 select-none"
        onClick={() => setAssetToDelete(null)}
      >
        <div
          className="w-full max-w-sm rounded-3xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 backdrop-blur-xl ring-1 ring-black/10 dark:ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Warning Icon & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Permanently Delete Image?
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">This action cannot be undone</p>
            </div>
          </div>

          {/* 100% Vendor-Agnostic Body Text */}
          <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-2">
            <p>
              This image will be permanently deleted and cannot be recovered. Any blocks in your journals using this image will no longer display it.
            </p>
          </div>

          {/* Image Thumbnail Preview */}
          <div className="w-full h-28 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetToDelete.url}
              alt="Preview"
              className="max-h-full max-w-full object-contain rounded-xl"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              onClick={() => setAssetToDelete(null)}
              disabled={permanentlyDeletingId !== null}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPermanentDelete}
              disabled={permanentlyDeletingId !== null}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {permanentlyDeletingId ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Delete Permanently</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }
}
