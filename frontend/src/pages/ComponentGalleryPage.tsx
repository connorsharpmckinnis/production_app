import { useState } from "react";
import { Link } from "react-router-dom";
import SearchableSelect from "@/components/SearchableSelect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "color", label: "Warm" },
  { value: "footlights", label: "Stage" },
];

const SEARCH_OPTIONS = [
  { value: "hamlet", label: "Hamlet", hint: "Character" },
  { value: "ophelia", label: "Ophelia", hint: "Character" },
  { value: "ghost", label: "Ghost", hint: "Character", keywords: "king" },
  { value: "prop-skull", label: "Yorick's skull", hint: "Prop" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function ComponentGalleryPage() {
  const toast = useToast();
  const { preference, setPreference } = useTheme();
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState(false);
  const [switched, setSwitched] = useState(true);
  const [role, setRole] = useState("actor");
  const [searchValue, setSearchValue] = useState("");
  const [rotation, setRotation] = useState("inherit");

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div>
        <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Component gallery</h1>
        <p className="text-sm text-muted-foreground">
          Scratch page for reviewing core UI primitives across theme modes. Admin-only.
        </p>
      </div>

      <Section title="Theme" description="Switch modes while reviewing controls below.">
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={preference === option.value ? "default" : "outline"}
              onClick={() => setPreference(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button type="button">Default</Button>
          <Button type="button" variant="secondary">
            Secondary
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
          <Button type="button" variant="ghost">
            Ghost
          </Button>
          <Button type="button" variant="success">
            Success
          </Button>
          <Button type="button" variant="destructive">
            Destructive
          </Button>
          <Button type="button" variant="link">
            Link
          </Button>
          <Button type="button" size="sm">
            Small
          </Button>
          <Button type="button" size="lg">
            Large
          </Button>
          <Button type="button" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      <Section title="Alerts" description="Semantic feedback follows the active palette.">
        <div className="space-y-3">
          <Alert variant="info">
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>A neutral message that needs attention.</AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>The changes were saved successfully.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Review this item before continuing.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong and needs correction.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Inputs" description="Text fields, labels, and textareas.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gallery-text">Text</Label>
            <Input
              id="gallery-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type something…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gallery-disabled">Disabled</Label>
            <Input id="gallery-disabled" disabled placeholder="Unavailable" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="gallery-notes">Notes</Label>
            <Textarea
              id="gallery-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Longer text…"
              rows={3}
            />
          </div>
        </div>
      </Section>

      <Section title="Checkbox, Switch & Radio">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-2">
            <Checkbox
              id="gallery-check"
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
            />
            <Label htmlFor="gallery-check">Show completed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-switch"
              checked={switched}
              onCheckedChange={setSwitched}
            />
            <Label htmlFor="gallery-switch">Enable feature</Label>
          </div>
          <RadioGroup
            value={rotation}
            onValueChange={setRotation}
            className="flex flex-wrap items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="inherit" id="gallery-radio-inherit" />
              <Label htmlFor="gallery-radio-inherit" className="font-normal">
                Inherit
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="custom" id="gallery-radio-custom" />
              <Label htmlFor="gallery-radio-custom" className="font-normal">
                Custom
              </Label>
            </div>
          </RadioGroup>
        </div>
      </Section>

      <Section title="Select" description="Radix select for fixed option lists.">
        <div className="max-w-xs space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="director">Director</SelectItem>
              <SelectItem value="actor">Actor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section
        title="SearchableSelect"
        description="Custom combobox used for characters, props, and similar catalogs."
      >
        <div className="max-w-sm space-y-2">
          <Label>Catalog item</Label>
          <SearchableSelect
            options={SEARCH_OPTIONS}
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Search characters or props…"
            clearLabel="Clear selection"
          />
        </div>
      </Section>

      <Section title="Table">
        <div className="rounded-lg border border-border">
          <Table storageKey="component-gallery">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Hamlet</TableCell>
                <TableCell className="text-muted-foreground">Character</TableCell>
                <TableCell>
                  <Badge variant="secondary">Cast</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Yorick's skull</TableCell>
                <TableCell className="text-muted-foreground">Prop</TableCell>
                <TableCell>
                  <Badge variant="outline">Ready</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Dialog & Toast">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sample dialog</DialogTitle>
                <DialogDescription>
                  Dialogs use the shared content shell and footer actions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="gallery-dialog-input">Name</Label>
                <Input id="gallery-dialog-input" placeholder="Example field" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
                <Button type="button">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button type="button" onClick={() => toast.message("Heads up", "Neutral toast")}>
            Toast
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={() => toast.success("Saved", "Changes applied")}
          >
            Success toast
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => toast.error("Failed", "Something went wrong")}
          >
            Error toast
          </Button>
        </div>
      </Section>

      <Section title="Skeleton">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Section>
    </div>
  );
}
