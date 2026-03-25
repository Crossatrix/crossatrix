import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const PersistentBackground = () => {
  const frame = useCurrentFrame();
  const shimmer = interpolate(frame % 120, [0, 60, 120], [0, 0.08, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #050d1a 0%, #0a1628 30%, #0d1f3c 70%, #081222 100%)",
        }}
      />
      {/* Subtle golden shimmer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse at 50% 30%, rgba(245,197,24,${shimmer}) 0%, transparent 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};
