import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ImportActionType,
  ImportProfileDefinition,
  ImportRule,
  ImportRulePredicates,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type PredicateKey = Exclude<keyof ImportRulePredicates, "case_sensitive">;

const PREDICATES: Array<{ key: PredicateKey; label: string; kind: "text" | "number" | "boolean" | "range" }> = [
  { key: "regex_match", label: "Text matches pattern (regex)", kind: "text" },
  { key: "text_equals", label: "Exact text", kind: "text" },
  { key: "text_starts_with", label: "Text starts with", kind: "text" },
  { key: "text_contains", label: "Text contains", kind: "text" },
  { key: "is_all_caps", label: "ALL CAPS text", kind: "boolean" },
  { key: "is_wrapped_in_parens", label: "Entirely in (parentheses)", kind: "boolean" },
  { key: "word_count_lte", label: "At most N words", kind: "number" },
  { key: "char_count_lte", label: "At most N characters", kind: "number" },
  { key: "x0_lte", label: "On or left of column (x0 ≤)", kind: "number" },
  { key: "x0_gte", label: "On or right of column (x0 ≥)", kind: "number" },
  { key: "x0_between", label: "Between columns (x0 min, max)", kind: "range" },
  { key: "indent_gte", label: "Indent at least", kind: "number" },
  { key: "font_size_gte", label: "Font size at least", kind: "number" },
  { key: "font_size_lte", label: "Font size at most", kind: "number" },
  { key: "is_bold", label: "Bold text", kind: "boolean" },
  { key: "is_italic", label: "Italic text", kind: "boolean" },
  { key: "inside_song_block", label: "Only while a song is open", kind: "boolean" },
  {
    key: "inside_parenthetical_block",
    label: "Only while continuing a (parenthetical)",
    kind: "boolean",
  },
  { key: "page_gte", label: "From page", kind: "number" },
  { key: "page_lte", label: "Through page", kind: "number" },
  { key: "previous_was", label: "Previous line was (comma-separated types)", kind: "text" },
];

const ACTIONS: Array<{ value: ImportActionType; label: string }> = [
  { value: "ignore", label: "Ignore (skip this line)" },
  { value: "set_act", label: "Start / set Act" },
  { value: "set_scene", label: "Start / set Scene" },
  { value: "stage_direction", label: "Stage direction" },
  { value: "speaker", label: "Character name (sets who speaks next)" },
  { value: "dialogue", label: "Dialogue line" },
  { value: "song_header", label: "Song title / header" },
  { value: "song_attribution", label: "Song performer label" },
  { value: "lyric", label: "Lyric line" },
  { value: "continue_previous", label: "Append to previous moment" },
  { value: "inline_dialogue", label: "Inline “NAME: dialogue” on one line" },
];

function defaultPredicateValue(key: PredicateKey): unknown {
  const definition = PREDICATES.find((item) => item.key === key);
  if (definition?.kind === "boolean") return true;
  if (definition?.kind === "number") return 0;
  if (definition?.kind === "range") return [0, 100];
  if (key === "previous_was") return ["dialogue"];
  return "";
}

function predicateDisplayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return value == null ? "" : String(value);
}

function parsePredicateValue(
  key: PredicateKey,
  raw: string,
): unknown {
  const definition = PREDICATES.find((item) => item.key === key);
  if (definition?.kind === "boolean") return raw === "true";
  if (definition?.kind === "number") return Number(raw);
  if (definition?.kind === "range") {
    const [lower, upper] = raw.split(",").map((item) => Number(item.trim()));
    return [lower, upper];
  }
  if (key === "previous_was") {
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return raw;
}

function newRule(): ImportRule {
  return {
    id: crypto.randomUUID(),
    name: "New rule",
    priority: 0,
    enabled: true,
    scope: "line",
    match: { text_contains: "" },
    action: { type: "ignore" },
  };
}

function truncateHint(text: string, max = 28): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** Short summary of the first meaningful predicate for collapsed rule rows. */
function primaryPredicateHint(match: ImportRulePredicates): string | null {
  const preferred: PredicateKey[] = [
    "x0_lte",
    "x0_gte",
    "x0_between",
    "regex_match",
    "text_equals",
    "text_starts_with",
    "text_contains",
    "indent_gte",
    "font_size_gte",
    "font_size_lte",
    "is_all_caps",
    "is_italic",
    "is_bold",
    "is_wrapped_in_parens",
    "word_count_lte",
    "char_count_lte",
    "inside_song_block",
    "inside_parenthetical_block",
    "page_gte",
    "page_lte",
    "previous_was",
  ];
  for (const key of preferred) {
    const value = match[key];
    if (value == null || value === "") continue;
    switch (key) {
      case "x0_lte":
        return `x0 ≤ ${value}`;
      case "x0_gte":
        return `x0 ≥ ${value}`;
      case "x0_between":
        return Array.isArray(value)
          ? `x0 ${value[0]}–${value[1]}`
          : `x0 ${value}`;
      case "regex_match":
        return `/${truncateHint(String(value))}/`;
      case "text_equals":
        return `= “${truncateHint(String(value))}”`;
      case "text_starts_with":
        return `starts “${truncateHint(String(value))}”`;
      case "text_contains":
        return `contains “${truncateHint(String(value))}”`;
      case "indent_gte":
        return `indent ≥ ${value}`;
      case "font_size_gte":
        return `size ≥ ${value}`;
      case "font_size_lte":
        return `size ≤ ${value}`;
      case "is_all_caps":
        return value ? "ALL CAPS" : "not ALL CAPS";
      case "is_italic":
        return value ? "italic" : "not italic";
      case "is_bold":
        return value ? "bold" : "not bold";
      case "is_wrapped_in_parens":
        return value ? "in (parens)" : "not in parens";
      case "word_count_lte":
        return `≤ ${value} words`;
      case "char_count_lte":
        return `≤ ${value} chars`;
      case "inside_song_block":
        return value ? "in song" : "not in song";
      case "inside_parenthetical_block":
        return value ? "in parenthetical" : "not in parenthetical";
      case "page_gte":
        return `from p.${value}`;
      case "page_lte":
        return `through p.${value}`;
      case "previous_was":
        return `after ${truncateHint(predicateDisplayValue(value))}`;
      default:
        return truncateHint(predicateDisplayValue(value));
    }
  }
  return null;
}

function actionLabel(type: ImportActionType): string {
  return ACTIONS.find((action) => action.value === type)?.label ?? type;
}

interface ImportProfileEditorProps {
  profile: ImportProfileDefinition;
  onChange: (profile: ImportProfileDefinition) => void;
}

export function ImportProfileEditor({
  profile,
  onChange,
}: ImportProfileEditorProps) {
  // Start collapsed so settled rules stay out of the way while tuning.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function patchProfile(patch: Partial<ImportProfileDefinition>) {
    onChange({ ...profile, ...patch });
  }

  function replaceRule(index: number, rule: ImportRule) {
    const rules = [...profile.rules];
    rules[index] = rule;
    patchProfile({ rules });
  }

  function moveRule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= profile.rules.length) return;
    const rules = [...profile.rules];
    [rules[index], rules[target]] = [rules[target], rules[index]];
    patchProfile({ rules });
  }

  function setPredicate(
    ruleIndex: number,
    oldKey: PredicateKey,
    newKey: PredicateKey,
  ) {
    const rule = profile.rules[ruleIndex];
    const match = { ...rule.match };
    delete match[oldKey];
    match[newKey] = defaultPredicateValue(newKey) as never;
    replaceRule(ruleIndex, { ...rule, match });
  }

  function toggleExpanded(ruleId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  }

  function addRule() {
    const rule = newRule();
    patchProfile({ rules: [...profile.rules, rule] });
    setExpandedIds((current) => new Set(current).add(rule.id));
  }

  function expandAll() {
    setExpandedIds(new Set(profile.rules.map((rule) => rule.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">Import profile draft</h2>
        <p className="text-sm text-muted-foreground">
          Rules are checked highest-priority first; the first match wins. Column
          positions use PDF <span className="font-medium">x0</span> (distance from
          the left of the page). Refresh preview after edits — saving is optional.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Profile name</Label>
          <Input
            id="profile-name"
            value={profile.name}
            onChange={(event) => patchProfile({ name: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start-page">Start page</Label>
            <Input
              id="start-page"
              type="number"
              min={1}
              value={profile.pdf.start_page}
              onChange={(event) =>
                patchProfile({
                  pdf: { ...profile.pdf, start_page: Number(event.target.value) || 1 },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-page">End page (optional)</Label>
            <Input
              id="end-page"
              type="number"
              min={1}
              value={profile.pdf.end_page ?? ""}
              onChange={(event) =>
                patchProfile({
                  pdf: {
                    ...profile.pdf,
                    end_page: event.target.value ? Number(event.target.value) : null,
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-description">Description</Label>
        <Textarea
          id="profile-description"
          rows={2}
          value={profile.description ?? ""}
          onChange={(event) => patchProfile({ description: event.target.value || null })}
        />
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={profile.speakers.require_all_caps}
            onCheckedChange={(checked) =>
              patchProfile({
                speakers: {
                  ...profile.speakers,
                  require_all_caps: checked === true,
                },
              })
            }
          />
          Require ALL CAPS character names
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={profile.speakers.allow_parentheses}
            onCheckedChange={(checked) =>
              patchProfile({
                speakers: {
                  ...profile.speakers,
                  allow_parentheses: checked === true,
                },
              })
            }
          />
          Allow names like “Carolers (A)”
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Classification rules</h3>
            <p className="text-xs text-muted-foreground">
              Think “when this looks like X, treat it as Y.” Priority number is the
              tie-breaker (higher runs first). Collapse settled rules to save space.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile.rules.length > 0 && (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={expandAll}>
                  Expand all
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={collapseAll}>
                  Collapse all
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addRule}>
              <Plus /> Add rule
            </Button>
          </div>
        </div>

        {profile.rules.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            This draft has no rules yet. Add one or load a starter profile.
          </p>
        )}

        {profile.rules.map((rule, ruleIndex) => {
          const expanded = expandedIds.has(rule.id);
          const predicateHint = primaryPredicateHint(rule.match);
          return (
          <article
            key={rule.id}
            className={cn(
              "rounded-md border p-3",
              expanded ? "space-y-3" : undefined,
              !rule.enabled && "opacity-60",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-expanded={expanded}
                aria-label={expanded ? `Collapse ${rule.name}` : `Expand ${rule.name}`}
                onClick={() => toggleExpanded(rule.id)}
              >
                {expanded ? <ChevronDown /> : <ChevronRight />}
              </Button>
              <Checkbox
                checked={rule.enabled}
                aria-label={`Enable ${rule.name}`}
                onCheckedChange={(checked) =>
                  replaceRule(ruleIndex, { ...rule, enabled: checked === true })
                }
              />
              {expanded ? (
                <Input
                  className="min-w-48 flex-1"
                  value={rule.name}
                  aria-label="Rule name"
                  onChange={(event) =>
                    replaceRule(ruleIndex, { ...rule, name: event.target.value })
                  }
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                  onClick={() => toggleExpanded(rule.id)}
                >
                  {rule.name || "Untitled rule"}
                </button>
              )}
              {expanded ? (
                <>
              <Input
                className="w-24"
                type="number"
                value={rule.priority}
                aria-label="Priority (higher runs first)"
                title="Priority — higher runs first"
                onChange={(event) =>
                  replaceRule(ruleIndex, {
                    ...rule,
                    priority: Number(event.target.value),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move rule up"
                disabled={ruleIndex === 0}
                onClick={() => moveRule(ruleIndex, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move rule down"
                disabled={ruleIndex === profile.rules.length - 1}
                onClick={() => moveRule(ruleIndex, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete rule"
                onClick={() =>
                  patchProfile({
                    rules: profile.rules.filter((_, index) => index !== ruleIndex),
                  })
                }
              >
                <Trash2 />
              </Button>
                </>
              ) : (
                <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
                  {actionLabel(rule.action.type)}
                  {predicateHint ? ` · ${predicateHint}` : ""}
                  <span className="font-mono"> · pri {rule.priority}</span>
                </span>
              )}
            </div>

            {expanded && (
            <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Look at</Label>
                <Select
                  value={rule.scope}
                  onValueChange={(scope: "line" | "span") =>
                    replaceRule(ruleIndex, { ...rule, scope })
                  }
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Whole line (merged text)</SelectItem>
                    <SelectItem value="span">
                      Each PDF piece (e.g. name vs dialogue)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Treat matching text as</Label>
                <Select
                  value={rule.action.type}
                  onValueChange={(type: ImportActionType) =>
                    replaceRule(ruleIndex, {
                      ...rule,
                      action: { ...rule.action, type },
                    })
                  }
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>When all of these are true</Label>
              {Object.entries(rule.match)
                .filter(([key, value]) => key !== "case_sensitive" && value != null)
                .map(([rawKey, value]) => {
                  const key = rawKey as PredicateKey;
                  const definition = PREDICATES.find((item) => item.key === key);
                  if (!definition) return null;
                  return (
                    <div key={key} className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_auto]">
                      <Select
                        value={key}
                        onValueChange={(newKey: PredicateKey) =>
                          setPredicate(ruleIndex, key, newKey)
                        }
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PREDICATES.map((predicate) => (
                            <SelectItem key={predicate.key} value={predicate.key}>
                              {predicate.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {definition.kind === "boolean" ? (
                        <Select
                          value={String(value)}
                          onValueChange={(raw) =>
                            replaceRule(ruleIndex, {
                              ...rule,
                              match: {
                                ...rule.match,
                                [key]: parsePredicateValue(key, raw),
                              },
                            })
                          }
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={definition.kind === "number" ? "number" : "text"}
                          value={predicateDisplayValue(value)}
                          placeholder={definition.kind === "range" ? "72, 160" : undefined}
                          onChange={(event) =>
                            replaceRule(ruleIndex, {
                              ...rule,
                              match: {
                                ...rule.match,
                                [key]: parsePredicateValue(key, event.target.value),
                              },
                            })
                          }
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${definition.label}`}
                        onClick={() => {
                          const match = { ...rule.match };
                          delete match[key];
                          replaceRule(ruleIndex, { ...rule, match });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
              <Select
                value=""
                onValueChange={(key: PredicateKey) => {
                  const match = { ...rule.match };
                  match[key] = defaultPredicateValue(key) as never;
                  replaceRule(ruleIndex, { ...rule, match });
                }}
              >
                <SelectTrigger size="sm"><SelectValue placeholder="Add condition" /></SelectTrigger>
                <SelectContent>
                  {PREDICATES.filter(({ key }) => rule.match[key] == null).map(
                    (predicate) => (
                      <SelectItem key={predicate.key} value={predicate.key}>
                        {predicate.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(rule.action.type === "set_act" || rule.action.type === "set_scene") && (
                <div className="space-y-1.5">
                  <Label>Regex group for the number</Label>
                  <Input
                    value={rule.action.number_capture ?? ""}
                    placeholder="number or 1"
                    onChange={(event) =>
                      replaceRule(ruleIndex, {
                        ...rule,
                        action: {
                          ...rule.action,
                          number_capture: event.target.value || null,
                        },
                      })
                    }
                  />
                </div>
              )}
              {rule.action.type === "set_scene" && (
                <div className="space-y-1.5">
                  <Label>Regex group for the title</Label>
                  <Input
                    value={rule.action.title_capture ?? ""}
                    placeholder="title or 2"
                    onChange={(event) =>
                      replaceRule(ruleIndex, {
                        ...rule,
                        action: {
                          ...rule.action,
                          title_capture: event.target.value || null,
                        },
                      })
                    }
                  />
                </div>
              )}
              {["speaker", "dialogue", "stage_direction", "song_header", "song_attribution", "lyric"].includes(rule.action.type) && (
                <div className="space-y-1.5">
                  <Label>Regex group for the text (optional)</Label>
                  <Input
                    value={rule.action.text_capture ?? ""}
                    placeholder="title, text, or 1"
                    onChange={(event) =>
                      replaceRule(ruleIndex, {
                        ...rule,
                        action: {
                          ...rule.action,
                          text_capture: event.target.value || null,
                        },
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={rule.match.case_sensitive ?? false}
                  onCheckedChange={(checked) =>
                    replaceRule(ruleIndex, {
                      ...rule,
                      match: {
                        ...rule.match,
                        case_sensitive: checked === true,
                      },
                    })
                  }
                />
                Case-sensitive text matching
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={rule.action.strip_outer_parens ?? false}
                  onCheckedChange={(checked) =>
                    replaceRule(ruleIndex, {
                      ...rule,
                      action: {
                        ...rule.action,
                        strip_outer_parens: checked === true,
                      },
                    })
                  }
                />
                Strip outer parentheses
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={rule.action.end_song_block ?? false}
                  onCheckedChange={(checked) =>
                    replaceRule(ruleIndex, {
                      ...rule,
                      action: {
                        ...rule.action,
                        end_song_block: checked === true,
                      },
                    })
                  }
                />
                End the open song after this match
              </label>
            </div>
            </>
            )}
          </article>
          );
        })}
      </div>
    </section>
  );
}

