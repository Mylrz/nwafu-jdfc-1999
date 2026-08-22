import { ArrowUpRight, Camera, CheckCircle2, CircleDashed, Shirt } from "lucide-react";
import { kitEvidence } from "../../lib/public-content";

const kitSeasons = [
  { year: "2022", image: "/team/five-years.jpg", position: "center 0%" },
  { year: "2023", image: "/team/five-years.jpg", position: "center 20%" },
  { year: "2024", image: "/team/five-years.jpg", position: "center 40%" },
  { year: "2025", image: "/team/champions.jpg", position: "center" },
  { year: "2026", image: "/team/five-years.jpg", position: "center 100%" },
] as const;

export function KitMuseum() {
  return (
    <section className="kit-museum section" id="kits">
      <div className="section-head">
        <p className="kicker">07 / KIT ARCHIVE</p>
        <p className="section-index">2022 — 2026 · 资料征集中</p>
      </div>

      <div className="kit-museum-intro">
        <div>
          <p><Shirt aria-hidden="true" /> THE SHIRTS WE WORE</p>
          <h2>每年一件新战袍，<br />每个号码一段故事。</h2>
        </div>
        <div>
          <p>球队每年都会购置新球衣。现在先以真实的赛季合影建立索引，等待队员补充球衣正面、背面、号码字体与设计故事。</p>
          <a href="#contribute">提交一件老球衣的照片 <ArrowUpRight aria-hidden="true" /></a>
        </div>
      </div>

      <div className="kit-evidence-grid" aria-label="从球队真实影像中确认的战袍细节">
        {kitEvidence.map((item, index) => (
          <article key={item.image}>
            <figure>
              <img src={item.image} alt={`${item.title}真实影像`} loading="lazy" decoding="async" />
              <figcaption><span>0{index + 1}</span> VISUAL EVIDENCE</figcaption>
            </figure>
            <div>
              <h3>{item.title}</h3>
              <p><CheckCircle2 aria-hidden="true" /><span><strong>影像中可确认</strong>{item.verified}</span></p>
              <p><CircleDashed aria-hidden="true" /><span><strong>仍需当届队员补充</strong>{item.missing}</span></p>
            </div>
          </article>
        ))}
      </div>

      <div className="kit-season-strip" aria-label="2022至2026赛季战袍资料索引">
        {kitSeasons.map((item, index) => (
          <article className="kit-season-card" key={item.year}>
            <div className="kit-season-photo" role="img" aria-label={`${item.year}赛季球队真实合影`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }}>
              <span>0{index + 1}</span>
              <b>{item.year}</b>
            </div>
            <div className="kit-season-copy">
              <span><Camera aria-hidden="true" /> 现有球队合影</span>
              <h3>{item.year} 赛季战袍</h3>
              <p>正、背面与细节资料等待当届队员补充。</p>
              <a href="#contribute" aria-label={`补充${item.year}赛季球衣资料`}>补充这一年 <ArrowUpRight aria-hidden="true" /></a>
            </div>
          </article>
        ))}
      </div>

      <div className="kit-museum-note">
        <Shirt aria-hidden="true" />
        <p><strong>你还保存着当年的球衣吗？</strong><span>拍摄自然光下的正面、背面和队徽细节，投稿时注明赛季与号码，就能帮助球队建立真正的战袍档案。</span></p>
        <a href="#contribute">前往资料投稿 <ArrowUpRight aria-hidden="true" /></a>
      </div>
    </section>
  );
}
