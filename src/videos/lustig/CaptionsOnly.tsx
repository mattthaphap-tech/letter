import React from "react";
import { AbsoluteFill } from "remotion";
import { LustigCaptionOverlay } from "./LustigCaptionOverlay";

export const LustigCaptionsOnly: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "transparent" }}>
    <LustigCaptionOverlay />
  </AbsoluteFill>
);
