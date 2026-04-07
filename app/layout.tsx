import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";

import { AuthProvider } from "@/components/providers/auth-provider";
import { SonnerProvider } from "@/components/providers/sonner-provider";

import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const displayFont = Poppins({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});



export const metadata: Metadata = {
  title: "Kiyani Studio",
  description:
    "CMS and storefront for handcrafted gifts, bokeh decor, knitted pieces, and crochet products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${displayFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
          <SonnerProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
