import { Spline_Sans, Ubuntu_Mono, Inter, Playfair_Display, Outfit, Roboto_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import React, { Suspense } from "react";

const splineSans = Spline_Sans({
  variable: "--font-spline-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ubuntuMono = Ubuntu_Mono({
  variable: "--font-ubuntu-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediaHoard",
  description: "A cinematic media experience",
  icons: {
    icon: "/mediahoard.png",
    shortcut: "/mediahoard.ico",
  },
};

import { MediaHoardProvider } from "@/providers/MediaHoardProvider";
import { ProfileProvider } from "@/providers/ProfileProvider";
import { Header } from "@/components/header";
import { DesktopPlayerLinkBridge } from "@/components/desktop-player-link-bridge";
import { NavigationLoader } from "@/components/navigation-loader";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AppStartupGate } from "@/components/app-startup-gate";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${splineSans.variable} ${ubuntuMono.variable} ${inter.variable} ${playfair.variable} ${outfit.variable} ${robotoMono.variable} font-sans bg-background text-on-surface min-h-screen w-full relative overflow-x-hidden antialiased flex flex-col`}
      >
        <ProfileProvider>
          <ThemeProvider>
            <MediaHoardProvider>
              <DesktopPlayerLinkBridge />
              <AppStartupGate header={<Header />}>
                <Suspense fallback={null}>
                  <NavigationLoader>
                    {children}
                  </NavigationLoader>
                </Suspense>
              </AppStartupGate>
            </MediaHoardProvider>
          </ThemeProvider>
        </ProfileProvider>
      </body>
    </html>
  );
}
