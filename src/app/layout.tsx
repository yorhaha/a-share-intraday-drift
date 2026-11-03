import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A股日内分布与漂移",
  description:
    "输入任意 A 股，查看开盘、最高、最低、振幅等六项日内指标的分布，并检测最近几个周期的分布漂移。",
};

const themeScript = `
(function () {
  try {
    var t = localStorage.getItem("market-dist-theme");
    if (t === "dark" || t === "light") {
      document.documentElement.dataset.theme = t;
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
