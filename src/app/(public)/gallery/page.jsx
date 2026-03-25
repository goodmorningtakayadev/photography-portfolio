'use client';

import { Suspense } from 'react';
import GalleryPage from '../../../page-components/GalleryPage';

export default function GalleryRoute() {
  return (
    <Suspense fallback={null}>
      <GalleryPage />
    </Suspense>
  );
}
