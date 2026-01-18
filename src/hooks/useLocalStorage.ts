import React, { useState, useEffect } from 'react';
import { encryptData, decryptData } from '@/utils/security';

export function useLocalStorage<T>(key: string, initialValue: T, encrypted: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
  // We need to manage async state for encryption/decryption
  // Since useLocalStorage is synchronous in usage, we'll initialize with initialValue
  // and then load the encrypted data asynchronously
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          if (encrypted) {
            try {
              const decrypted = await decryptData(item);
              // If decryption fails (e.g. invalid key or bad format), it returns null or throws.
              // We fallback to initialValue if null
              if (decrypted !== null) {
                setValue(decrypted);
              }
            } catch (e) {
              console.error(`Failed to decrypt ${key}, falling back to default or unencrypted read`);
              // Fallback attempt: maybe it was not encrypted before?
              try { setValue(JSON.parse(item)); } catch (_) { }
            }
          } else {
            setValue(JSON.parse(item));
          }
        } else {
          setValue(initialValue);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, [key, encrypted]); // Run once on mount per key

  // Save changes
  useEffect(() => {
    if (!isLoaded) return; // Don't overwrite storage until we've loaded existing data

    const saveData = async () => {
      try {
        if (encrypted) {
          const cipherText = await encryptData(value);
          window.localStorage.setItem(key, cipherText);
        } else {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      } catch (error) {
        console.error(error);
      }
    };
    saveData();
  }, [key, value, encrypted, isLoaded]);

  // Listen for custom storage events from same window
  useEffect(() => {
    const handleStorageChange = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.key === key) {
        try {
          const item = window.localStorage.getItem(key);
          if (item) {
            let newValue = initialValue;
            if (encrypted) {
              const d = await decryptData(item);
              if (d !== null) newValue = d;
            } else {
              newValue = JSON.parse(item);
            }
            setValue(newValue);
            console.log(`🔄 useLocalStorage - ${key} updated from custom event`);
          }
        } catch (error) {
          console.error('Error reading from localStorage:', error);
        }
      }
    };

    window.addEventListener('localStorageUpdate', handleStorageChange);
    return () => window.removeEventListener('localStorageUpdate', handleStorageChange);
  }, [key, encrypted]);

  return [value, setValue];
}