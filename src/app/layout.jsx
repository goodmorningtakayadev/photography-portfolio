import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Photography Portfolio',
  description: 'A curated collection of photographs exploring light, emotion, and the beauty of everyday life.',
  metadataBase: new URL('https://example.com'),
  openGraph: {
    type: 'website',
    title: 'Photography Portfolio',
    description: 'A curated collection of photographs exploring light, emotion, and the beauty of everyday life.',
    url: 'https://example.com/',
    images: ['/photos/optimized/1-display.webp'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Photography Portfolio',
    description: 'A curated collection of photographs exploring light, emotion, and the beauty of everyday life.',
    images: ['/photos/optimized/1-display.webp'],
  },
  other: {
    'theme-color': '#0b0b0b',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="dns-prefetch" href="https://api.web3forms.com" />
        <link rel="preload" href="/photos/vintage-aesthetics-3.jpg" as="image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "name": "Photography Portfolio",
                  "url": "https://example.com"
                },
                {
                  "@type": "Person",
                  "name": "Takaya",
                  "url": "https://example.com",
                  "description": "Photographer exploring light, emotion, and the beauty of everyday life.",
                  "sameAs": []
                }
              ]
            })
          }}
        />
      </head>
      <body>
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
