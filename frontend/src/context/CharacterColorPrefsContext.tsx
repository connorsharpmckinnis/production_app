import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  readCharacterColorMap,
  withCharacterColor,
  writeCharacterColorMap,
  type CharacterColorMap,
  type CharacterColorPreset,
} from "@/lib/characterColorPrefs";

interface CharacterColorPrefsContextValue {
  colors: CharacterColorMap;
  setCharacterColor: (
    characterId: number,
    preset: CharacterColorPreset | null,
  ) => void;
}

const CharacterColorPrefsContext =
  createContext<CharacterColorPrefsContextValue | null>(null);

export function CharacterColorPrefsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const productionId = id != null ? Number(id) : NaN;
  const userId = user?.id;
  const hasScope =
    userId != null && Number.isFinite(productionId) && productionId > 0;

  const [colors, setColors] = useState<CharacterColorMap>(() =>
    hasScope ? readCharacterColorMap(productionId, userId) : {},
  );

  useEffect(() => {
    if (!hasScope || userId == null) {
      setColors({});
      return;
    }
    setColors(readCharacterColorMap(productionId, userId));
  }, [hasScope, productionId, userId]);

  const setCharacterColor = useCallback(
    (characterId: number, preset: CharacterColorPreset | null) => {
      if (!hasScope || userId == null) return;
      setColors((prev) => {
        const next = withCharacterColor(prev, characterId, preset);
        writeCharacterColorMap(productionId, userId, next);
        return next;
      });
    },
    [hasScope, productionId, userId],
  );

  const value = useMemo(
    () => ({ colors, setCharacterColor }),
    [colors, setCharacterColor],
  );

  return (
    <CharacterColorPrefsContext.Provider value={value}>
      {children}
    </CharacterColorPrefsContext.Provider>
  );
}

export function useCharacterColorPrefs(): CharacterColorPrefsContextValue {
  const context = useContext(CharacterColorPrefsContext);
  if (!context) {
    throw new Error(
      "useCharacterColorPrefs must be used within CharacterColorPrefsProvider",
    );
  }
  return context;
}

/** Safe outside a production route — returns empty colors / no-op setter. */
export function useOptionalCharacterColorPrefs(): CharacterColorPrefsContextValue {
  const context = useContext(CharacterColorPrefsContext);
  return (
    context ?? {
      colors: {},
      setCharacterColor: () => undefined,
    }
  );
}
