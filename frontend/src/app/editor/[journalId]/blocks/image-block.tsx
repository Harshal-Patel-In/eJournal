"use client";

import React, { useState } from "react";
import { Image as ImageIcon, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useDocumentStore } from "../use-document-store";
import { Button } from "@/components/ui/button";

interface ImageItem {
  url: string;
  caption?: string;
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

  // Normalize legacy vs multi-image payload structure
  let images: ImageItem[] = [];
  if (Array.isArray(content.images) && content.images.length > 0) {
    images = content.images;
  } else if (content.url) {
    images = [{ url: content.url, caption: content.caption || "" }];
  }

  const mainCaption = content.mainCaption || (content.images ? content.caption || "" : "");

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

        const response = await fetch(`${API_BASE_URL}/uploads/images`, {
          method: "POST",
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
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload image(s). Please try again.");
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

  const removeImage = (index: number) => {
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
  };

  const updateMainCaption = (val: string) => {
    updateBlock(id, { mainCaption: val, caption: val });
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
      </div>
    );
  }

  // --- EDIT MODE: GALLERY WITH INDIVIDUAL & MAIN CAPTIONS ---
  return (
    <div className="flex flex-col gap-4 w-full border border-border p-4 rounded-xl bg-card shadow-sm">
      {/* Header bar with Add Image button */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="size-3.5" /> Multi-Image Gallery ({images.length} {images.length === 1 ? "Image" : "Images"})
        </span>
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

      {/* Side-by-side Image Cards Grid */}
      <div className={`grid ${getGridColsClass(images.length)} gap-4 w-full`}>
        {images.map((img, idx) => (
          <div
            key={idx}
            className="group relative flex flex-col gap-2 p-2 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all"
          >
            {/* Delete sub-image button overlay */}
            <button
              onClick={() => removeImage(idx)}
              title="Remove this image from gallery"
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
    </div>
  );
}
