import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StakeFriends — Multiplayer Gambling",
  description: "Real-time P2P multiplayer gambling game. Create a room, share the code, play 8 casino games with friends.",
  keywords: ["StakeFriends", "multiplayer", "gambling", "casino", "P2P"],
  authors: [{ name: "StakeFriends" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground casino-bg min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
