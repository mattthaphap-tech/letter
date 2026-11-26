import React from "react";
import { AbsoluteFill } from "remotion";
import { AnakCaptionOverlay } from "./AnakCaptionOverlay";

export const AnakCaptionsOnly: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "transparent" }}>
    <AnakCaptionOverlay />
  </AbsoluteFill>
);
