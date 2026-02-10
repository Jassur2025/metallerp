/**
 * Settings Service - Firebase Firestore
 * Stores AppSettings in Firestore for cross-device sync
 */

import {
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp
} from '../lib/firebase';
import { AppSettings } from '../types';

const SETTINGS_DOC = 'app_settings';
const SETTINGS_COLLECTION = 'settings';

export const settingsService = {
  /**
   * Get settings from Firestore
   */
  async get(): Promise<AppSettings | null> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Remove Firestore metadata fields
        const { updatedAt, createdAt, ...settings } = data;
        return settings as AppSettings;
      }
      return null;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return null;
    }
  },

  /**
   * Save settings to Firestore (merge to avoid overwriting unrelated fields)
   */
  async save(settings: AppSettings): Promise<void> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
      // Clean undefined values
      const data = JSON.parse(JSON.stringify(settings));
      await setDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time settings updates
   */
  subscribe(callback: (settings: AppSettings | null) => void): () => void {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const { updatedAt, createdAt, ...settings } = data;
        callback(settings as AppSettings);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error subscribing to settings:', error);
      callback(null);
    });
  }
};
