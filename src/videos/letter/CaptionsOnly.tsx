import React from "react";
import { AbsoluteFill } from "remotion";
import { LetterCaptionOverlay } from "./LetterCaptionOverlay";

export const LetterCaptionsOnly: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "transparent" }}>
    <LetterCaptionOverlay />
  </AbsoluteFill>
);
