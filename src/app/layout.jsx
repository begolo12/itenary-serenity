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
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${manrope.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
