import { createContext, useContext } from 'react';

/** Studio-owned command: tools can open the library without using global events. */
export const SavedLibraryContext = createContext<((id?: string) => void) | null>(null);
export function useSavedLibrary() {
  return useContext(SavedLibraryContext);
}
