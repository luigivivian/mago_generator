// Frontend mirror of backend CATEGORY_CONFIGS + camera/transition enums.
// Keep in sync with src/product_studio/config.py on the backend.

export const CATEGORIES = [
  { key: "food_cookies", label: "Cookies & Biscoitos" },
  { key: "food_chocolate", label: "Chocolates & Confeitaria" },
  { key: "food_burger", label: "Hamburgueres & Fast Food" },
  { key: "beauty_skincare", label: "Cosmeticos & Skincare" },
  { key: "fashion_shoes", label: "Tenis & Calcados" },
  { key: "tech_electronics", label: "Eletronicos & Tech" },
  { key: "beverage", label: "Bebidas & Drinks" },
] as const;

export const CAMERA_MOVES = [
  { key: "dolly", label: "Dolly push-in" },
  { key: "orbit", label: "Orbit around" },
  { key: "macro_zoom", label: "Macro zoom" },
  { key: "static", label: "Static shot" },
  { key: "crane", label: "Crane sweep" },
] as const;

export const TRANSITIONS = [
  { key: "dissolve", label: "Dissolve" },
  { key: "cut", label: "Hard cut" },
  { key: "fade", label: "Fade" },
  { key: "fadeblack", label: "Fade to black" },
  { key: "wipeleft", label: "Wipe left (whip pan)" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export type CameraMove = (typeof CAMERA_MOVES)[number]["key"];
export type Transition = (typeof TRANSITIONS)[number]["key"];

export interface TakeConfig {
  id: string;
  order: number;
  prompt: string;
  camera_move: CameraMove;
  duration: number;
  transition_type: Transition;
  sfx_id: string | null;
  thumbnail_url: string | null;
}
