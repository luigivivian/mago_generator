"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CAMERA_MOVES,
  TRANSITIONS,
  type TakeConfig,
} from "./category-config";
import { SFXPicker } from "./sfx-picker";

interface TakeCardProps {
  take: TakeConfig;
  onChange: (take: TakeConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function TakeCard({ take, onChange, onRemove, canRemove }: TakeCardProps) {
  const update = <K extends keyof TakeConfig>(key: K, value: TakeConfig[K]) => {
    onChange({ ...take, [key]: value });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Take {take.order + 1}</span>
        {canRemove && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      {take.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={take.thumbnail_url}
          alt={`Take ${take.order + 1}`}
          className="w-full rounded"
        />
      )}

      <div>
        <label className="text-xs text-muted-foreground">Action description</label>
        <Textarea
          value={take.prompt}
          onChange={(e) => update("prompt", e.target.value.slice(0, 463))}
          rows={3}
          maxLength={463}
          placeholder="Describe the action for this take..."
        />
        <span className="text-xs text-muted-foreground">
          {take.prompt.length}/463
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Camera move</label>
          <Select
            value={take.camera_move}
            onValueChange={(v) => update("camera_move", v as TakeConfig["camera_move"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMERA_MOVES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Transition</label>
          <Select
            value={take.transition_type}
            onValueChange={(v) =>
              update("transition_type", v as TakeConfig["transition_type"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSITIONS.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">
          Duration: {take.duration}s
        </label>
        {/* Native range input — no Slider primitive in cretorlab/src/components/ui yet. */}
        <input
          type="range"
          min={3}
          max={10}
          step={1}
          value={take.duration}
          onChange={(e) => update("duration", Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">SFX</label>
        <SFXPicker value={take.sfx_id} onChange={(id) => update("sfx_id", id)} />
      </div>
    </Card>
  );
}
