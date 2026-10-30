import { useEffect, useState } from "react";
import { readStored, writeStored } from "../utils/storage";

/** useState that remembers its value across visits (validated on read). */
export function usePersistentState<T>(key: string, fallback: T, isValid: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    const stored = readStored<unknown>(key);
    return isValid(stored) ? stored : fallback;
  });
  useEffect(() => writeStored(key, value), [key, value]);
  return [value, setValue] as const;
}
