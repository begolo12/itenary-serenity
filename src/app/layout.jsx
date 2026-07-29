import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata = {
  title: "Serenity Itinerary",
  description: "Rencana perjalanan yang rapi, tenang, dan selalu dapat diedit.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${manrope.variable} ${newsreader.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0e3b33" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `if("serviceWorker"in navigator){window.addEventListener("load",async()=>{try{const registration=await navigator.serviceWorker.register("/sw.js");registration.update()}catch{}})}`,
        }} />
      </body>
    </html>
  );
}
