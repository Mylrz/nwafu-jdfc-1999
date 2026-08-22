"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  { href: "#pulse", label: "球队近况" },
  { href: "#champion-archive", label: "七冠档案" },
  { href: "#kits", label: "历年战袍" },
  { href: "#roster", label: "历届阵容" },
  { href: "#moments", label: "球队影像" },
  { href: "#guestbook", label: "老队员留言" },
  { href: "#contribute", label: "资料投稿" },
] as const;

export function SiteHeader() {
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setSolid(window.scrollY > 84);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <header className={`site-header${solid ? " site-header--solid" : ""}${menuOpen ? " site-header--menu-open" : ""}`}>
        <a className="brand" href="#top" aria-label="返回首页" onClick={close}>
          <img src="/team/logo.jpg" alt="JDFC 机电足球队队徽" />
          <span className="brand-copy">
            <strong>西农机电足球队</strong>
            <small>JDFC · EST. 1999</small>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="主导航">
          {links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
          <a className="nav-cta" href="#player-submit">球员填档</a>
        </nav>

        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={menuOpen ? "关闭导航" : "打开导航"}
          aria-expanded={menuOpen}
          aria-controls="mobile-site-nav"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <div className={`mobile-nav-layer${menuOpen ? " is-open" : ""}`} aria-hidden={!menuOpen}>
        <nav id="mobile-site-nav" aria-label="手机端主导航">
          <p>JDFC · DIGITAL ARCHIVE</p>
          {links.map((link, index) => (
            <a href={link.href} key={link.href} onClick={close} tabIndex={menuOpen ? 0 : -1}>
              <span>0{index + 1}</span>{link.label}
            </a>
          ))}
          <a className="mobile-nav-cta" href="#player-submit" onClick={close} tabIndex={menuOpen ? 0 : -1}>
            提交或修改我的球员档案 <span>→</span>
          </a>
        </nav>
      </div>
    </>
  );
}
