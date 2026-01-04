
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // Use Inter as a standard font, or prompt for something else
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/context";
import SWRegister from "@/components/SWRegister";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        <SWRegister />
      </body>
    </html>
  );
}
