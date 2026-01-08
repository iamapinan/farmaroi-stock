
import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/context";
import SWRegister from "@/components/SWRegister";

const notoSansThai = Noto_Sans_Thai({ subsets: ["thai", "latin"] });

export const metadata: Metadata = {
  title: "Farm Aroi Stock",
  description: "Daily Stock & Purchase Order System",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Farm Aroi Stock",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={notoSansThai.className}>
        <AuthProvider>{children}</AuthProvider>
        <SWRegister />
      </body>
    </html>
  );
}
