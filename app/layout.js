import { Barlow_Condensed, Outfit } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata = {
  title: "TNT Releases",
  description: "Floor board for incoming releases at TNT Music Edmonds.",
  applicationName: "TNT Releases",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "TNT Releases",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#010E10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
