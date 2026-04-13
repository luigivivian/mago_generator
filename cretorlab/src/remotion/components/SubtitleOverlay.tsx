import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { EditorSubtitle } from "../../stores/editor-types";

export const SubtitleOverlay: React.FC<{
  subtitles: EditorSubtitle[];
}> = ({ subtitles }) => {
  const frame = useCurrentFrame();

  const visible = subtitles.filter(
    (s) => frame >= s.startFrame && frame < s.endFrame,
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {visible.map((sub) => (
        <div
          key={sub.id}
          style={{
            position: "absolute",
            left: `${sub.position.x}%`,
            top: `${sub.position.y}%`,
            transform: "translate(-50%, -50%)",
            fontSize: sub.style.fontSize,
            fontFamily: sub.style.fontFamily,
            color: sub.style.color,
            textShadow: `0 0 ${sub.style.shadowSize}px ${sub.style.shadowColor}, 0 0 ${sub.style.shadowSize * 2}px ${sub.style.shadowColor}`,
            textAlign: "center" as const,
            maxWidth: "90%",
            lineHeight: 1.3,
            fontWeight: 700,
          }}
        >
          {sub.text}
        </div>
      ))}
    </AbsoluteFill>
  );
};
