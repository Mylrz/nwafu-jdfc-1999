"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { type ReactNode, useRef } from "react";
import { useMobileViewport } from "../hooks/useMobileViewport";

type ScrollChapterProps = {
  children: ReactNode;
  index: string;
  label: string;
  className?: string;
};

export function ScrollChapter({ children, index, label, className = "" }: ScrollChapterProps) {
  const chapterRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const isMobile = useMobileViewport();
  const { scrollYProgress } = useScroll({
    target: chapterRef,
    offset: ["start 92%", "end 8%"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 105,
    damping: 30,
    mass: 0.24,
  });
  const desktopY = useTransform(progress, [0, 0.16, 0.82, 1], [54, 0, 0, -34]);
  const desktopScale = useTransform(progress, [0, 0.16, 0.82, 1], [0.986, 1, 1, 0.992]);
  const desktopOpacity = useTransform(progress, [0, 0.12, 0.88, 1], [0.58, 1, 1, 0.72]);
  const mobileY = useTransform(progress, [0, 0.16, 0.84, 1], [18, 0, 0, -10]);
  const mobileOpacity = useTransform(progress, [0, 0.12, 0.9, 1], [0.86, 1, 1, 0.9]);
  const chapterStyle = reduceMotion
    ? undefined
    : isMobile
      ? { y: mobileY, opacity: mobileOpacity }
      : { y: desktopY, scale: desktopScale, opacity: desktopOpacity };

  return (
    <motion.div
      ref={chapterRef}
      className={`scroll-chapter ${className}`.trim()}
      style={chapterStyle}
      data-chapter={index}
      data-mobile-motion={isMobile ? "true" : "false"}
    >
      <div className="scroll-chapter-indicator" aria-hidden="true">
        <span>{index}</span>
        <b>{label}</b>
        <motion.i style={reduceMotion ? undefined : { scaleX: progress }} />
      </div>
      {children}
    </motion.div>
  );
}
