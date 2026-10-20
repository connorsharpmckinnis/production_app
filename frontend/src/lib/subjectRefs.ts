/** Shared `character:` / `user:` / `group:` subject encoding for multi-select and pickers. */

export type SubjectRef = {
  character_id?: number | null;
  user_id?: number | null;
  group_id?: number | null;
};

export function encodeSubjectRef(subject: SubjectRef): string {
  if (subject.character_id != null) return `character:${subject.character_id}`;
  if (subject.user_id != null) return `user:${subject.user_id}`;
  if (subject.group_id != null) return `group:${subject.group_id}`;
  return "";
}

export function decodeSubjectRef(value: string): {
  characterId: number | null;
  userId: number | null;
  groupId: number | null;
} {
  if (value.startsWith("character:")) {
    return {
      characterId: Number(value.slice("character:".length)),
      userId: null,
      groupId: null,
    };
  }
  if (value.startsWith("user:")) {
    return {
      characterId: null,
      userId: Number(value.slice("user:".length)),
      groupId: null,
    };
  }
  if (value.startsWith("group:")) {
    return {
      characterId: null,
      userId: null,
      groupId: Number(value.slice("group:".length)),
    };
  }
  return { characterId: null, userId: null, groupId: null };
}

export function decodeSubjectRefs(values: string[]): SubjectRef[] {
  const subjects: SubjectRef[] = [];
  for (const value of values) {
    const decoded = decodeSubjectRef(value);
    if (decoded.characterId != null) {
      subjects.push({ character_id: decoded.characterId });
    } else if (decoded.userId != null) {
      subjects.push({ user_id: decoded.userId });
    } else if (decoded.groupId != null) {
      subjects.push({ group_id: decoded.groupId });
    }
  }
  return subjects;
}
