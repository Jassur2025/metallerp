import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types';
import { settingsService } from '../services/settingsService';

interface UseSettingsReturn {
  settings: AppSettings;
  loading: boolean;
  saveSettings: (newSettings: AppSettings) => Promise<void>;
}

export function useSettings(defaultSettings: AppSettings): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Use localStorage as immediate fallback while Firestore loads
    try {
      const saved = localStorage.getItem('metal_erp_settings');
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(true);

  // Subscribe to Firestore settings (real-time)
  useEffect(() => {
    const unsubscribe = settingsService.subscribe((firestoreSettings) => {
      if (firestoreSettings) {
        // Merge with defaults to ensure new fields are present
        const merged = { ...defaultSettings, ...firestoreSettings };
        setSettings(merged);
        // Keep localStorage in sync as offline cache
        localStorage.setItem('metal_erp_settings', JSON.stringify(merged));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); // defaultSettings is stable (defined outside component)

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    // Optimistic local update
    setSettings(newSettings);
    localStorage.setItem('metal_erp_settings', JSON.stringify(newSettings));

    // Persist to Firestore
    try {
      await settingsService.save(newSettings);
    } catch (error) {
      console.error('Failed to save settings to Firestore:', error);
      // Local state already updated, Firestore will sync when online
    }
  }, []);

  return { settings, loading, saveSettings };
}
