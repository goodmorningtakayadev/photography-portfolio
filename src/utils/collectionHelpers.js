/**
 * Collection helper utilities for accessing project/collection data.
 * Collections group photos into named projects/series.
 * A photo can belong to multiple collections.
 */

import data from '../data/photos.json';

const { collections, photos } = data;

/** Map photo IDs to photo objects for O(1) lookup. */
const photoMap = new Map(photos.map((p) => [p.id, p]));

/**
 * Get all collections.
 * @returns {Array} All collection objects
 */
export function getCollections() {
  return collections;
}

/**
 * Get a single collection by ID.
 * @param {string} id - Collection ID
 * @returns {Object|undefined} The collection, or undefined if not found
 */
export function getCollectionById(id) {
  return collections.find((c) => c.id === id);
}

/**
 * Get the cover photo object for a collection.
 * Returns null if the coverPhotoId references a non-existent or unpublished photo.
 * Falls back to first published photo in collection if cover is unpublished.
 * @param {Object} collection - Collection object
 * @returns {Object|null} Photo object or null
 */
export function getCollectionCoverPhoto(collection) {
  const photo = photoMap.get(collection.coverPhotoId);
  if (photo && photo.published !== false) return photo;
  // Fallback: first published photo in collection
  const fallback = collection.photoIds
    .map(id => photoMap.get(id))
    .find(p => p && p.published !== false);
  if (!fallback) {
    console.warn(
      `[collectionHelpers] No published cover photo for collection "${collection.id}"`
    );
    return null;
  }
  return fallback;
}

/**
 * Get all published photo objects for a collection, preserving photoIds order.
 * Filters out any IDs that don't match an existing photo or are unpublished.
 * @param {Object} collection - Collection object
 * @returns {Array} Array of published photo objects in photoIds order
 */
export function getCollectionPhotos(collection) {
  return collection.photoIds.reduce((acc, id) => {
    const photo = photoMap.get(id);
    if (photo && photo.published !== false) {
      acc.push(photo);
    }
    return acc;
  }, []);
}
