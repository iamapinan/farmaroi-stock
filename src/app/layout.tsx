
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Use Inter as a standard font, or prompt for something else
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Farm Aroi Stock",
  description: "Daily Stock & Purchase Order System",
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
      </body>
    </html>
  );
}
