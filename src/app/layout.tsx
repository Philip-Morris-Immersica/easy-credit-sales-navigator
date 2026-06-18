import type { Metadata } from "next";
import type { Viewport } from "next";
import { Sofia_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RobiButton } from "@/components/navigator/RobiButton";
import { AuthProvider } from "@/components/AuthProvider";
import { TopRightNav } from "@/components/TopRightNav";
import { auth } from "@/auth";
import "./globals.css";

const sofiaSans = Sofia_Sans({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Навигатор за продажбени умения — EasyCredit",
  description: "Интерактивен обучителен навигатор за продажбени умения на EasyCredit. Шрифт: Sofia Sans. Дизайн: Easy Credit Guide (Figma).",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="bg" className={`${sofiaSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider session={session}>
          <TooltipProvider>{children}</TooltipProvider>
          <RobiButton />
          <TopRightNav />
        </AuthProvider>
      </body>
    </html>
  );
}
