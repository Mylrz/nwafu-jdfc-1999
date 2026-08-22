"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

export type ChampionArchiveItem = {
  year: string;
  title: string;
  image: string;
  position: string;
};

export function ChampionCarousel({ items }: { items: readonly ChampionArchiveItem[] }) {
  const reduceMotion = useReducedMotion();
  const [viewportRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const updateState = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setScrollSnaps(emblaApi.scrollSnapList());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const frame = window.requestAnimationFrame(updateState);
    emblaApi.on("select", updateState).on("reInit", updateState);
    return () => {
      window.cancelAnimationFrame(frame);
      emblaApi.off("select", updateState).off("reInit", updateState);
    };
  }, [emblaApi, updateState]);

  return (
    <div className="champion-carousel" aria-roledescription="轮播图" aria-label="七冠影像档案">
      <div className="champion-carousel-viewport" ref={viewportRef}>
        <div className="champion-photo-grid">
          {items.map((item, index) => (
            <motion.article
              className="champion-photo-card"
              key={`${item.year}-${item.title}`}
              initial={reduceMotion ? false : { opacity: 0, y: 54, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.72, delay: reduceMotion ? 0 : (index % 3) * 0.07, ease: [0.16, 1, 0.3, 1] }}
              aria-label={`${item.year}年${item.title}夺冠后合影，第${index + 1}组，共${items.length}组`}
            >
              <div
                className="champion-photo"
                role="img"
                aria-label={`${item.year}年${item.title}夺冠后合影`}
                style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }}
              >
                <span>0{index + 1}</span>
              </div>
              <footer>
                <strong>{item.year}</strong>
                <div>
                  <h3>{item.title}</h3>
                  <small>{item.title.includes("男子 / 女子") ? "双冠合档 · DOUBLE CHAMPIONS" : "夺冠后留影 · CHAMPION MEMORY"}</small>
                </div>
              </footer>
            </motion.article>
          ))}
        </div>
      </div>

      <div className="carousel-footer">
        <div className="carousel-progress" aria-label={`当前第 ${selectedIndex + 1} 组，共 ${items.length} 组`}>
          {scrollSnaps.map((_, index) => (
            <button
              type="button"
              className={index === selectedIndex ? "is-active" : ""}
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`查看第 ${index + 1} 组冠军影像`}
              aria-current={index === selectedIndex ? "true" : undefined}
              key={index}
            />
          ))}
        </div>
        <p><strong>{String(selectedIndex + 1).padStart(2, "0")}</strong> / {String(items.length).padStart(2, "0")} · 拖动或滑动切换</p>
        <div className="carousel-actions">
          <button type="button" onClick={() => emblaApi?.scrollPrev()} disabled={!canScrollPrev} aria-label="上一组冠军影像">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => emblaApi?.scrollNext()} disabled={!canScrollNext} aria-label="下一组冠军影像">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
