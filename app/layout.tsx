import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07131d",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "nwafu-jdfc-1999.mylrz.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "西农机电足球队｜1999 至今",
    description: "西北农林科技大学机械与电子工程学院足球队宣传与纪念网站。1999 年创办，近五年七冠。",
    metadataBase: new URL(origin),
    alternates: {
      canonical: "/",
    },
    icons: {
      icon: "/team/logo.jpg",
      shortcut: "/team/logo.jpg",
    },
    openGraph: {
      title: "西农机电足球队｜机电驱动，绿茵传承",
      description: "1999 年创办，近五年七冠。记录属于每一代机电足球人的蓝色青春。",
      type: "website",
      url: origin,
      locale: "zh_CN",
      images: [{ url: `${origin}/og-v9.png`, width: 1672, height: 941, alt: "JDFC 西农机电足球队数字档案，1999 至今，近五年七冠" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "西农机电足球队｜1999 至今",
      description: "机电驱动，绿茵传承。近五年七冠。",
      images: [`${origin}/og-v9.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
