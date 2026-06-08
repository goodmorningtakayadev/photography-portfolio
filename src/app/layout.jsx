import { Archivo, Inter } from 'next/font/google';
import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Archivo — variable grotesque driving both display and body.
// wdth axis is loaded so display type can run expanded (~112%); wght axis
// (full range) is loaded by default so headlines can run heavy (800).
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});

// Inter — metadata / label role: small, uppercase, wide-tracked.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  title: 'Photography Portfolio',
  description: 'A curated collection of photographs exploring light, emotion, and the beauty of everyday life.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    title: 'Photography Portfolio',
    description: 'A curated collection of photographs exploring light, emotion, and the beauty of everyday life.',
    url: siteUrl,
    images: ['/photos/optimized/1-display.webp'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Photography Portfolio',
    description: 'A curated collection of photographs exploring light, emotion, and the beauty of everyday life.',
    images: ['/photos/optimized/1-display.webp'],
  },
  other: {
    'theme-color': '#0a0a0b',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="dns-prefetch" href="https://api.web3forms.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "name": "Photography Portfolio",
                  "url": siteUrl
                },
                {
                  "@type": "Person",
                  "name": "Takaya",
                  "url": siteUrl,
                  "description": "Photographer exploring light, emotion, and the beauty of everyday life.",
                  "sameAs": []
                }
              ]
            })
          }}
        />
      </head>
      <body className={`${archivo.variable} ${inter.variable}`}>
        <div className="app">
          <Header />
          <main className="main-content">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
