import type { Metadata } from "next";
import { Sofia_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RobiButton } from "@/components/navigator/RobiButton";
import "./globals.css";

const sofiaSans = Sofia_Sans({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Навигатор за продажбени умения",
  description: "Обучителен навигатор за продажбени умения — EasyCredit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg" className={`${sofiaSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <RobiButton />
      </body>
    </html>
  );
}
