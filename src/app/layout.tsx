import type { Metadata, Viewport } from "next";
import { Jua } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// 점프점프와 같은 번들 폰트 1종 (빌드 때 내려받아 같이 배포된다. 외부 요청 없음)
const jua = Jua({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-jua" });

export const metadata: Metadata = {
  title: "숫자 던전",
  description: "나보다 작은 숫자를 흡수하며 보스를 잡는 퍼즐 게임",
  applicationName: "숫자 던전",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff4f8",
};

/** 모션 줄이기 설정을 첫 그리기 전에 적용 (고정 문자열 스크립트, 사용자 입력 없음) */
const EARLY_MOTION_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("number-dungeon.settings")||"{}");if(s&&s.reduceMotion===true)document.documentElement.dataset.motion="reduce"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={jua.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_MOTION_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
