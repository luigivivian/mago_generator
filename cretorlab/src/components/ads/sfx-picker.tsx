"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Hardcoded mirror of backend SFX_CATALOG from src/product_studio/sfx_library.py.
// Keep the 12 ids in sync — backend Pydantic rejects unknown ids.
export const SFX_ENTRIES = [
  { id: "asmr_crunch_01", name: "Cookie Crunch", category: "asmr" },
  { id: "asmr_sizzle_01", name: "Burger Sizzle", category: "asmr" },
  { id: "asmr_pour_01", name: "Chocolate Pour", category: "asmr" },
  { id: "asmr_drop_01", name: "Serum Drop", category: "asmr" },
  { id: "asmr_ice_01", name: "Ice Cubes", category: "asmr" },
  { id: "epic_hit_01", name: "Impact Hit", category: "epic" },
  { id: "epic_riser_01", name: "Build-up Riser", category: "epic" },
  { id: "epic_whoosh_01", name: "Whoosh Pass", category: "epic" },
  { id: "epic_boom_01", name: "Bass Boom", category: "epic" },
  { id: "ambient_warmth_01", name: "Warm Ambient Pad", category: "ambient" },
  { id: "ambient_nature_01", name: "Nature Breeze", category: "ambient" },
  { id: "ambient_urban_01", name: "Urban Cafe", category: "ambient" },
] as const;

interface SFXPickerProps {
  value: string | null;
  onChange: (sfxId: string | null) => void;
}

export function SFXPicker({ value, onChange }: SFXPickerProps) {
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select SFX" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No SFX</SelectItem>
        {SFX_ENTRIES.map((sfx) => (
          <SelectItem key={sfx.id} value={sfx.id}>
            {sfx.category.toUpperCase()}: {sfx.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
