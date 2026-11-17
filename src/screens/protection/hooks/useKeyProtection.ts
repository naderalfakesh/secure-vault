import { useEffect, useState } from 'react';

import vault, { type KeyProtection } from '../../../../modules/expo-vault';

/** Where this device keeps the key; null until the vault answers. */
export function useKeyProtection(): KeyProtection | null {
  const [protection, setProtection] = useState<KeyProtection | null>(null);
  useEffect(() => {
    let active = true;
    vault
      .keyProtection()
      .then((value) => {
        if (active) setProtection(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return protection;
}
