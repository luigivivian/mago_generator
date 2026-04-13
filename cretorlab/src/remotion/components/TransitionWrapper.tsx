import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import type { EditorScene } from "../../stores/editor-types";

type TransitionType = EditorScene["transition"]["type"];

/**
 * Wraps a scene with enter/exit transition effects.
 * Uses interpolate() on the first/last N frames to create the effect.
 */
export function TransitionWrapper({
  children,
  enterType,
  enterDuration,
  exitType,
  exitDuration,
  totalDuration,
}: {
  children: React.ReactNode;
  enterType: TransitionType;
  enterDuration: number;
  exitType: TransitionType;
  exitDuration: number;
  totalDuration: number;
}) {
  const frame = useCurrentFrame();

  // No transitions at all
  if (enterType === "none" && exitType === "none") {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  // Calculate enter progress (0→1 over enterDuration frames)
  const enterProgress = enterDuration > 0 && enterType !== "none"
    ? interpolate(frame, [0, enterDuration], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  // Calculate exit progress (1→0 over exitDuration frames at the end)
  const exitStart = totalDuration - exitDuration;
  const exitProgress = exitDuration > 0 && exitType !== "none"
    ? interpolate(frame, [exitStart, totalDuration], [1, 0], { extrapolateLeft: "clamp" })
    : 1;

  // Combine: use the minimum (either entering or exiting)
  const enterStyle = getTransitionStyle(enterType, enterProgress, "enter");
  const exitStyle = getTransitionStyle(exitType, exitProgress, "exit");

  // Merge styles — use the active one based on which phase we're in
  const isEntering = frame < enterDuration && enterType !== "none";
  const isExiting = frame >= exitStart && exitType !== "none";
  const style: React.CSSProperties = isExiting ? exitStyle : isEntering ? enterStyle : {};

  return (
    <AbsoluteFill style={style}>
      {children}
    </AbsoluteFill>
  );
}

function getTransitionStyle(
  type: TransitionType,
  progress: number, // 0→1 for enter, 1→0 for exit
  _direction: "enter" | "exit",
): React.CSSProperties {
  switch (type) {
    case "fade":
      return { opacity: progress };

    case "slide":
      // Slide in from right, slide out to left
      const slideOffset = (1 - progress) * 100;
      return { transform: `translateX(${_direction === "enter" ? slideOffset : -slideOffset}%)` };

    case "wipe":
      // Wipe using clip-path
      const wipePercent = progress * 100;
      return { clipPath: `inset(0 ${100 - wipePercent}% 0 0)` };

    case "flip":
      // 3D flip
      const flipAngle = (1 - progress) * 90;
      return {
        transform: `perspective(1200px) rotateY(${_direction === "enter" ? flipAngle : -flipAngle}deg)`,
        backfaceVisibility: "hidden",
      };

    case "iris":
      // Circle reveal from center
      const radius = progress * 150; // 150% to cover corners
      return { clipPath: `circle(${radius}% at 50% 50%)` };

    case "clock-wipe":
      // Conic gradient mask (approximated with clip-path polygon)
      const angle = progress * 360;
      return { clipPath: conicClipPath(angle) };

    case "none":
    default:
      return {};
  }
}

/** Generate a polygon clip-path that approximates a clock wipe */
function conicClipPath(angleDeg: number): string {
  if (angleDeg >= 360) return "none";
  if (angleDeg <= 0) return "polygon(50% 50%, 50% 50%)";

  const cx = 50, cy = 50;
  const points: string[] = [`${cx}% ${cy}%`, `${cx}% 0%`]; // center + 12 o'clock

  // Add corner points as the angle sweeps
  const corners = [
    { angle: 45, point: "100% 0%" },
    { angle: 135, point: "100% 100%" },
    { angle: 225, point: "0% 100%" },
    { angle: 315, point: "0% 0%" },
    { angle: 360, point: `${cx}% 0%` },
  ];

  for (const c of corners) {
    if (angleDeg >= c.angle) {
      points.push(c.point);
    }
  }

  // Add the final point on the sweep edge
  const rad = (angleDeg - 90) * (Math.PI / 180);
  const r = 100; // extend well beyond the box
  const ex = cx + r * Math.cos(rad);
  const ey = cy + r * Math.sin(rad);
  points.push(`${ex}% ${ey}%`);

  return `polygon(${points.join(", ")})`;
}
