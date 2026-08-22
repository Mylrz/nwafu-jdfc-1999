"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import { teamMoments } from "../lib/public-content";
import { AutoGalleryWall } from "./components/AutoGalleryWall";
import { ChampionCarousel } from "./components/ChampionCarousel";
import { ClubHub } from "./components/ClubHub";
import { ClubPulse } from "./components/ClubPulse";
import { CommunitySections } from "./components/CommunitySections";
import { KitMuseum } from "./components/KitMuseum";
import { PublicMediaArchive } from "./components/PublicMediaArchive";
import { RosterArchive } from "./components/RosterArchive";
import { ScrollChapter } from "./components/ScrollChapter";
import { SeasonArchiveStories } from "./components/SeasonArchiveStories";
import { SiteHeader } from "./components/SiteHeader";
import { useMobileViewport } from "./hooks/useMobileViewport";

const gallery = [
  ...teamMoments,
  {
    src: "/team/celebration.jpg",
    alt: "机电学院足球队队员高举冠军奖杯",
    label: "举杯时刻",
    meta: "冠军属于每一个人",
  },
  {
    src: "/team/champions.jpg",
    alt: "机电学院足球队冠军合影",
    label: "并肩作战",
    meta: "蓝色战袍，同一目标",
  },
  {
    src: "/team/night-team.jpg",
    alt: "机电学院足球队夜场夺冠合影",
    label: "灯光之下",
    meta: "终场哨响，故事继续",
  },
  {
    src: "/team/archive.jpg",
    alt: "机电学院足球队历届成员合影",
    label: "一代又一代",
    meta: "名字会更替，热爱不会",
  },
  {
    src: "/team/five-years.jpg",
    alt: "机电学院足球队近五年冠军影像长卷",
    label: "五年征程",
    meta: "每一个赛季都有新的名字",
  },
  {
    src: "/team/seven-cups.jpg",
    alt: "机电学院足球队七座冠军奖杯",
    label: "七冠荣光",
    meta: "奖杯记录结果，合影记住所有人",
  },
  {
    src: "/team/hero.jpg",
    alt: "机电学院足球队赛后共同跃起庆祝",
    label: "一起跃起",
    meta: "终场之后，青春定格",
  },
] as const;

const values = [
  {
    no: "01",
    title: "热爱",
    text: "因为喜欢足球而相遇，也因为这片球场成为真正的队友。",
  },
  {
    no: "02",
    title: "纪律",
    text: "训练、奔跑、补位。把工程人的认真，带进每一次攻防。",
  },
  {
    no: "03",
    title: "传承",
    text: "学长把战袍交给下一届，下一届把故事写得更长。",
  },
] as const;

const championships = [
  { year: "2022", title: "男子五人制", code: "FUTSAL · MEN" },
  { year: "2023", title: "男子五人制", code: "FUTSAL · MEN" },
  { year: "2024", title: "男子五人制", code: "FUTSAL · MEN" },
  { year: "2025", title: "男子五人制", code: "FUTSAL · MEN" },
  { year: "2025", title: "男子十一人制", code: "XI-A-SIDE · MEN" },
  { year: "2025", title: "女子五人制", code: "FUTSAL · WOMEN" },
  { year: "2026", title: "男子五人制", code: "FUTSAL · MEN" },
] as const;

const championArchive = [
  { year: "2022", title: "男子五人制冠军", image: "/team/five-years.jpg", position: "center 0%" },
  { year: "2023", title: "男子五人制冠军", image: "/team/five-years.jpg", position: "center 20%" },
  { year: "2024", title: "男子五人制冠军", image: "/team/five-years.jpg", position: "center 40%" },
  { year: "2025", title: "男子 / 女子五人制冠军", image: "/team/five-years.jpg", position: "center 60%" },
  { year: "2025", title: "男子十一人制冠军", image: "/team/night-team.jpg", position: "center" },
  { year: "2026", title: "男子五人制冠军", image: "/team/five-years.jpg", position: "center 100%" },
] as const;

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const isMobile = useMobileViewport();
  const { scrollYProgress: pageProgress } = useScroll();
  const smoothProgress = useSpring(pageProgress, { stiffness: 90, damping: 28, mass: 0.22 });
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroImageY = useTransform(heroProgress, [0, 1], ["0%", "10%"]);
  const heroImageScale = useTransform(heroProgress, [0, 1], [1, 1.13]);
  const heroCopyY = useTransform(heroProgress, [0, 1], [0, -100]);
  const heroCopyMobileY = useTransform(heroProgress, [0, 1], [0, -42]);
  const heroCopyOpacity = useTransform(heroProgress, [0, 0.72], [1, 0]);

  const viewReveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 42 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.18 },
        transition: { duration: 0.95, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <main className="editorial-site">
      <motion.div className="scroll-progress" style={{ scaleX: smoothProgress }} />
      <SiteHeader />

      <section className="hero" id="top" ref={heroRef}>
        <motion.img
          className="hero-image"
          src="/team/hero.jpg"
          srcSet="/team/hero-mobile.jpg 1280w, /team/hero.jpg 2200w"
          sizes="100vw"
          width={2200}
          height={989}
          alt="机电学院足球队夺冠后共同跃起庆祝"
          fetchPriority="high"
          decoding="async"
          style={reduceMotion || isMobile ? undefined : { y: heroImageY, scale: heroImageScale }}
        />
        <div className="hero-shade" />
        <div className="field-lines" aria-hidden="true" />

        <motion.div
          className="hero-content"
          style={reduceMotion ? undefined : { y: isMobile ? heroCopyMobileY : heroCopyY, opacity: heroCopyOpacity }}
        >
          <p className="eyebrow"><span /> MECHANICAL &amp; ELECTRONIC ENGINEERING</p>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 54, clipPath: "inset(0 0 100% 0)" }}
            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
            transition={{ duration: 1.05, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            机电驱动
            <span>绿茵传承</span>
          </motion.h1>
          <p className="hero-lead">
            从 1999 到今天，一群又一群机电人穿上蓝色战袍，
            把青春、汗水和胜利留在西农的绿茵场。
          </p>
          <a className="hero-link" href="#legacy">
            阅读我们的故事 <span aria-hidden="true">↘</span>
          </a>
        </motion.div>

        <div className="hero-stats" aria-label="球队数据">
          <div>
            <strong>1999</strong>
            <span>球队创办</span>
          </div>
          <div>
            <strong>{new Date().getFullYear() - 1999}</strong>
            <span>年蓝色传承</span>
          </div>
          <div className="hero-stat-accent">
            <strong>7<span>冠</span></strong>
            <span>近五年</span>
          </div>
        </div>

        <div className="scroll-note" aria-hidden="true">SCROLL TO RELIVE <i /></div>
      </section>

      <ScrollChapter index="00" label="ARCHIVE INDEX">
        <ClubHub />
      </ScrollChapter>

      <ScrollChapter index="NOW" label="CURRENT PULSE" className="scroll-chapter--dark">
        <ClubPulse />
      </ScrollChapter>

      <ScrollChapter index="01" label="OUR LEGACY">
        <section className="legacy section" id="legacy">
        <motion.div className="section-head" {...viewReveal}>
          <p className="kicker">01 / OUR LEGACY</p>
          <p className="section-index">1999 — NOW</p>
        </motion.div>

        <motion.div className="legacy-grid" {...viewReveal}>
          <div className="legacy-copy">
            <p className="display-year">1999</p>
            <h2>一支球队，<br />一段仍在书写的青春。</h2>
            <p className="body-copy">
              机电学院足球队创办于 1999 年。这里有前锋的果断、后卫的担当、
              门将的坚守，也有场下每一次加油、每一瓶递来的水和每一张赛后合影。
              足球让不同年级、不同专业的机电人，拥有了共同的名字。
            </p>
            <blockquote>
              “毕业会带走号码，带不走我们一起踢过的球。”
            </blockquote>
          </div>

          <motion.figure
            className="legacy-visual"
            initial={reduceMotion ? false : { clipPath: "inset(0 0 100% 0)", scale: 0.94 }}
            whileInView={{ clipPath: "inset(0 0 0% 0)", scale: 1 }}
            viewport={{ once: true, amount: 0.18 }}
            transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <img src="/team/five-years.jpg" alt="机电学院足球队近年历届冠军合影长卷" loading="lazy" />
            <figcaption>
              <span>历届影像</span>
              <span>五年 · 七冠 · 一代代机电人</span>
            </figcaption>
          </motion.figure>
        </motion.div>
        </section>
      </ScrollChapter>

      <ScrollChapter index="02" label="RECENT HONORS" className="scroll-chapter--dark">
        <section className="honors" id="honors">
        <div className="honors-photo" aria-hidden="true">
          <img src="/team/seven-cups.jpg" alt="" loading="lazy" />
        </div>
        <div className="honors-overlay" />

        <div className="honors-content section">
          <motion.div className="section-head section-head--light" {...viewReveal}>
            <p className="kicker">02 / RECENT HONORS</p>
            <p className="section-index">2022 — 2026</p>
          </motion.div>

          <motion.div className="honors-title" {...viewReveal}>
            <p className="giant-seven">7</p>
            <div>
              <span className="title-mark">SEVEN TITLES</span>
              <h2>近五年<br />七次登顶</h2>
              <p>五年男子五人制五连冠，2025 年男子十一人制与女子五人制再度登顶。</p>
            </div>
          </motion.div>

          <motion.div
            className="trophy-row"
            aria-label="2022至2026年七座冠军奖杯"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.09 } },
            }}
          >
            {championships.map((champion, index) => (
              <motion.article
                className="trophy"
                key={`${champion.year}-${champion.title}`}
                variants={{
                  hidden: reduceMotion ? {} : { opacity: 0, y: 70, rotateX: -12 },
                  visible: { opacity: 1, y: 0, rotateX: 0 },
                }}
                transition={{ duration: 0.68, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="trophy-no">0{index + 1}</span>
                <span className="trophy-icon" aria-hidden="true">♛</span>
                <strong>{champion.year}</strong>
                <h3>{champion.title}</h3>
                <small>{champion.code}</small>
              </motion.article>
            ))}
          </motion.div>
        </div>
        </section>
      </ScrollChapter>

      <ScrollChapter index="03" label="SEVEN TITLES">
        <section className="champion-archive section" id="champion-archive">
        <motion.div className="section-head" {...viewReveal}>
          <p className="kicker">03 / SEVEN TITLES ARCHIVE</p>
          <p className="section-index">不写记不清的数据，只留下真实合影</p>
        </motion.div>

        <motion.div className="archive-heading" {...viewReveal}>
          <h2>七次登顶，<br />六组冠军影像。</h2>
          <p>2025 男、女子五人制双冠并置于同一组影像，以男子五人制夺冠合影作为共同纪念封面；未来取得新的原图后可继续补齐。</p>
        </motion.div>

        <ChampionCarousel items={championArchive} />
        </section>
      </ScrollChapter>

      <ScrollChapter index="04" label="BLUE MEMORIES">
        <section className="moments section" id="moments">
        <motion.div className="section-head" {...viewReveal}>
          <p className="kicker">04 / BLUE MEMORIES</p>
          <p className="section-index">不止于胜负</p>
        </motion.div>

        <motion.div className="moments-intro" {...viewReveal}>
          <h2>那些值得<br />一再回看的瞬间</h2>
          <p>
            比赛会结束，比分会成为数字。但共同训练的夜晚、终场后的拥抱，
            以及镜头里每一张年轻的脸，会一直留在球队的记忆中。
          </p>
        </motion.div>

        <AutoGalleryWall items={gallery} />
        </section>
      </ScrollChapter>

      <ScrollChapter index="05" label="SEASON ARCHIVE" className="scroll-chapter--dark">
        <SeasonArchiveStories />
      </ScrollChapter>
      <ScrollChapter index="06" label="PUBLIC MEDIA" className="scroll-chapter--dark">
        <PublicMediaArchive />
      </ScrollChapter>
      <ScrollChapter index="07" label="KIT ARCHIVE">
        <KitMuseum />
      </ScrollChapter>
      <ScrollChapter index="08" label="PLAYER ARCHIVE" className="scroll-chapter--dark">
        <RosterArchive />
      </ScrollChapter>
      <ScrollChapter index="09" label="ALUMNI & CONTRIBUTION">
        <CommunitySections />
      </ScrollChapter>

      <ScrollChapter index="10" label="WHAT WE PLAY FOR">
        <section className="values section">
        <motion.div className="section-head" {...viewReveal}>
          <p className="kicker">10 / WHAT WE PLAY FOR</p>
          <p className="section-index">同一片场 · 同一颗心</p>
        </motion.div>

        <div className="values-grid">
          {values.map((value, index) => (
            <motion.article
              key={value.no}
              initial={reduceMotion ? false : { opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.75, delay: reduceMotion ? 0 : index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <span>{value.no}</span>
              <h3>{value.title}</h3>
              <p>{value.text}</p>
            </motion.article>
          ))}
        </div>
        </section>
      </ScrollChapter>

      <ScrollChapter index="11" label="THE NEXT CHAPTER" className="scroll-chapter--dark">
        <section className="join" id="join">
        <img src="/team/stadium-pexels.jpg" alt="夜色中的足球场" loading="lazy" />
        <div className="join-overlay" />
        <div className="join-lines" aria-hidden="true" />
        <motion.div className="join-content" {...viewReveal}>
          <p className="eyebrow"><span /> THE NEXT CHAPTER</p>
          <h2>下一次合影，<br />等你入镜。</h2>
          <p>把你的号码，写进机电足球的下一段历史。</p>
          <a href="#footer">关注新学期招新 <span aria-hidden="true">→</span></a>
        </motion.div>
        </section>
      </ScrollChapter>

      <footer className="site-footer" id="footer">
        <div className="footer-brand">
          <img src="/team/logo.jpg" alt="JDFC 队徽" />
          <div>
            <strong>西北农林科技大学<br />机械与电子工程学院足球队</strong>
            <span>JDFC · SINCE 1999</span>
          </div>
        </div>
        <div className="footer-note">
          <p>青春不散场，蓝色永远在场。</p>
          <small>
            球队影像由机电足球队提供 · 球场背景摄影：
            <a href="https://www.pexels.com/photo/illuminated-soccer-stadium-at-night-28827841/" target="_blank" rel="noreferrer">
              Siarhei Nester / Pexels
            </a>
          </small>
          <a className="admin-entry" href="/admin">球队资料管理入口 →</a>
        </div>
      </footer>
    </main>
  );
}
