"use client";

import { Expand } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

type GalleryItem = {
  src: string;
  alt: string;
  label: string;
  meta: string;
  className: string;
};

export function MemoryGallery({ items }: { items: readonly GalleryItem[] }) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(-1);
  const slides = items.map((item) => ({
    src: item.src,
    alt: item.alt,
    title: item.label,
    description: item.meta,
  }));

  return (
    <>
      <div className="gallery-grid">
        {items.map((item, index) => (
          <motion.figure
            className={item.className}
            key={item.src}
            initial={reduceMotion ? false : { opacity: 0, y: 80, clipPath: "inset(12% 0 0 0)" }}
            whileInView={{ opacity: 1, y: 0, clipPath: "inset(0% 0 0 0)" }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.9, delay: reduceMotion ? 0 : (index % 2) * 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <button type="button" onClick={() => setActiveIndex(index)} aria-label={`全屏查看：${item.label}`}>
              <img src={item.src} alt={item.alt} loading="lazy" />
              <span className="gallery-expand"><Expand aria-hidden="true" /> 查看大图</span>
              <figcaption>
                <span>{item.label}</span>
                <small>{item.meta}</small>
              </figcaption>
            </button>
          </motion.figure>
        ))}
      </div>

      <Lightbox
        open={activeIndex >= 0}
        close={() => setActiveIndex(-1)}
        index={Math.max(activeIndex, 0)}
        slides={slides}
        plugins={[Captions, Fullscreen, Zoom]}
        carousel={{ finite: items.length < 2 }}
        controller={{ closeOnBackdropClick: true }}
      />
    </>
  );
}
