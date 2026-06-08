import type { Metadata } from "next";
import About from "../../../page-components/About";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about the photographer behind the lens — exploring light, emotion, and the beauty of everyday life.",
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: "About",
    description:
      "Learn about the photographer behind the lens — exploring light, emotion, and the beauty of everyday life.",
    url: `${siteUrl}/about`,
  },
};

export default function AboutRoute() {
  return <About />;
}
