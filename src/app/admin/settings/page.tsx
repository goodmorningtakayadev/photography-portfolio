import type { Metadata } from "next";
import { getSiteSettings } from "@/db/queries/settings";
import { getAllPhotosAdmin } from "@/db/queries/admin";
import { HeroSettingsEditor } from "@/components/admin/HeroSettingsEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

export default async function SettingsPage() {
  const [settings, ready] = await Promise.all([
    getSiteSettings(),
    getAllPhotosAdmin({ status: "ready", limit: 200 }),
  ]);

  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL ?? "";
  const photos = ready.photos.map((p) => ({
    id: p.id,
    caption: p.caption,
    thumbUrl: p.thumbStorageKey ? `${cdnUrl}/${p.thumbStorageKey}` : null,
    fullUrl: `${cdnUrl}/${p.storageKey}`,
  }));

  return (
    <HeroSettingsEditor
      initial={{
        heroPhotoId: settings.heroPhotoId,
        heroFocalX: settings.heroFocalX,
        heroFocalY: settings.heroFocalY,
      }}
      photos={photos}
    />
  );
}
