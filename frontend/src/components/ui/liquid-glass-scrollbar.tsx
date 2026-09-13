"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

export function LiquidGlassScrollbar() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbTop, setThumbTop] = useState(12);
  const [thumbHeight, setThumbHeight] = useState(60);

  const dragStartRef = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const updateScrollMetrics = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
    const clientHeight = window.innerHeight;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 8) {
      setVisible(false);
      return;
    }

    setVisible(true);

    // Calculate proportional thumb height
    const verticalPadding = 24; // 12px top and 12px bottom
    const trackHeight = clientHeight - verticalPadding;
    const computedHeight = Math.max(48, Math.min(trackHeight * 0.7, (clientHeight / scrollHeight) * trackHeight));
    setThumbHeight(computedHeight);

    // Calculate thumb top offset
    const availableTrack = trackHeight - computedHeight;
    const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollRatio = Math.min(1, Math.max(0, currentScroll / maxScroll));
    const newTop = 12 + scrollRatio * availableTrack;

    setThumbTop(newTop);
  }, []);

  // Update on scroll & handle auto-fade
  useEffect(() => {
    setMounted(true);
    updateScrollMetrics();

    const handleScroll = () => {
      setIsScrolling(true);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(updateScrollMetrics);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1400);
    };

    const handleResize = () => {
      updateScrollMetrics();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    const observer = new ResizeObserver(() => {
      updateScrollMetrics();
    });
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [updateScrollMetrics]);

  // Pointer drag events on the glass thumb
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    document.body.style.userSelect = "none";
    document.body.classList.add("is-dragging-block");

    setIsDragging(true);
    dragStartRef.current = {
      startY: e.clientY,
      startScrollTop: window.scrollY || document.documentElement.scrollTop || 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaY = e.clientY - dragStartRef.current.startY;
    const clientHeight = window.innerHeight;
    const verticalPadding = 24;
    const availableTrack = clientHeight - verticalPadding - thumbHeight;

    if (availableTrack <= 0) return;

    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const maxScroll = scrollHeight - clientHeight;
    const scrollDelta = (deltaY / availableTrack) * maxScroll;

    window.scrollTo({
      top: dragStartRef.current.startScrollTop + scrollDelta,
      behavior: "instant",
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    dragStartRef.current = null;
    document.body.style.userSelect = "";
    document.body.classList.remove("is-dragging-block");
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Click on track to jump
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;

    const clickY = e.clientY;
    const clientHeight = window.innerHeight;
    const verticalPadding = 24;
    const availableTrack = clientHeight - verticalPadding - thumbHeight;

    if (availableTrack <= 0) return;

    const relativeY = Math.max(0, Math.min(availableTrack, clickY - 12 - thumbHeight / 2));
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const maxScroll = scrollHeight - clientHeight;
    const targetScroll = (relativeY / availableTrack) * maxScroll;

    window.scrollTo({
      top: targetScroll,
      behavior: "smooth",
    });
  };

  if (!mounted || !visible) return null;

  const isActiveOrInteracting = isScrolling || isHovered || isDragging;

  return (
    <div
      className="fixed top-0 right-0 bottom-0 w-5 z-50 select-none print:hidden"
      onClick={handleTrackClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: "default",
      }}
      aria-hidden="true"
    >
      {/* Floating Liquid Glass Scrollbar Knob */}
      <div
        role="scrollbar"
        aria-controls="main-content"
        aria-valuenow={Math.round(
          ((window.scrollY || 0) /
            (Math.max(document.body.scrollHeight, window.innerHeight) - window.innerHeight || 1)) *
            100
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute right-1.5 rounded-full transition-[width,opacity] duration-200 ease-out cursor-grab active:cursor-grabbing ${
          isActiveOrInteracting ? "w-2 opacity-100" : "w-1.5 opacity-55 hover:opacity-100"
        } ${isDragging ? "cursor-grabbing" : ""}`}
        style={{
          top: 0,
          height: `${thumbHeight}px`,
          transform: `translate3d(0, ${thumbTop}px, 0)`,
          willChange: "transform",
        }}
      >
        {/* Optical Glass Core */}
        <div
          className={`w-full h-full rounded-full liquid-glass-knob ${
            isDragging ? "is-active-drag" : ""
          }`}
        />
      </div>
    </div>
  );
}
