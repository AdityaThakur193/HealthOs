import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import CoachChatFAB from "@/components/CoachChatFAB";
import SplashWrapper from "@/components/SplashWrapper";
import NotificationScheduler from "@/components/NotificationScheduler";

import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "Health OS — Personal Intelligence Engine",
  description: "An AI-powered personal health operating system that reduces manual tracking and makes active health decisions.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "Health OS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth antialiased dark">
      <body className="min-h-full flex flex-col bg-[#0c0f0d] text-white">
        {/* Main layout container with maximum width to simulate a mobile app layout on desktop */}
        <SplashWrapper>
          <div className="flex-1 w-full max-w-lg mx-auto relative flex flex-col min-h-dvh">
            <main className="flex-1 w-full relative">
              {children}
            </main>
            <BottomNav />
            <CoachChatFAB />
            <NotificationScheduler />
          </div>
        </SplashWrapper>
      </body>
    </html>
  );
}
