"use client";

import { useState, useCallback } from "react";

const MIN_PIXELS_PER_FRAME = 0.5;
const MAX_PIXELS_PER_FRAME = 20;
const ZOOM_FACTOR = 1.5;

export function useTimelineZoom() {
  const [pixelsPerFrame, setPixelsPerFrame] = useState(3);
  const [scrollLeft, setScrollLeft] = useState(0);

  const zoomIn = useCallback(() => {
    setPixelsPerFrame((prev) =>
      Math.min(prev * ZOOM_FACTOR, MAX_PIXELS_PER_FRAME),
    );
  }, []);

  const zoomOut = useCallback(() => {
    setPixelsPerFrame((prev) =>
      Math.max(prev / ZOOM_FACTOR, MIN_PIXELS_PER_FRAME),
    );
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setPixelsPerFrame((prev) =>
            Math.min(prev * ZOOM_FACTOR, MAX_PIXELS_PER_FRAME),
          );
        } else {
          setPixelsPerFrame((prev) =>
            Math.max(prev / ZOOM_FACTOR, MIN_PIXELS_PER_FRAME),
          );
        }
      } else {
        setScrollLeft((prev) => Math.max(0, prev + e.deltaX + e.deltaY));
      }
    },
    [],
  );

  return { pixelsPerFrame, scrollLeft, setScrollLeft, zoomIn, zoomOut, handleWheel };
}
