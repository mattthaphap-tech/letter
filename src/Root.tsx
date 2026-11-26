import React from "react";
import { Composition, Folder } from "remotion";
import {
  DemoShort,
  DemoShortWithCaptions,
  DemoFrames,
} from "./videos/demo/Bridge";
import { DemoCaptionOverlay } from "./videos/demo/DemoCaptionOverlay";
import { DemoCaptionsOnly } from "./videos/demo/CaptionsOnly";
import {
  AnakShort,
  AnakShortWithCaptions,
  AnakFrames,
} from "./videos/anakpungut/Bridge";
import { AnakCaptionOverlay } from "./videos/anakpungut/AnakCaptionOverlay";
import { AnakCaptionsOnly } from "./videos/anakpungut/CaptionsOnly";
import {
  LustigShort,
  LustigShortWithCaptions,
  LustigFrames,
} from "./videos/lustig/Bridge";
import { LustigCaptionOverlay } from "./videos/lustig/LustigCaptionOverlay";
import { LustigCaptionsOnly } from "./videos/lustig/CaptionsOnly";
import {
  LetterShort,
  LetterShortWithCaptions,
  LetterFrames,
} from "./videos/letter/Bridge";
import { LetterCaptionOverlay } from "./videos/letter/LetterCaptionOverlay";
import { LetterCaptionsOnly } from "./videos/letter/CaptionsOnly";

export const Root: React.FC = () => {
  return (
    <>
      <Folder name="Demo">
        <Composition
          id="DemoShort"
          component={DemoShort}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoShortWithCaptions"
          component={DemoShortWithCaptions}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoCaptionOverlay"
          component={DemoCaptionOverlay}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoCaptionGreenScreen"
          component={() => <DemoCaptionOverlay bg="#00FF00" />}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoCaptions"
          component={DemoCaptionsOnly}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
      </Folder>
      <Folder name="AnakPungut">
        <Composition id="AnakShort" component={AnakShort} durationInFrames={AnakFrames} fps={30} width={1080} height={1920} />
        <Composition id="AnakShortWithCaptions" component={AnakShortWithCaptions} durationInFrames={AnakFrames} fps={30} width={1080} height={1920} />
        <Composition id="AnakCaptionOverlay" component={AnakCaptionOverlay} durationInFrames={AnakFrames} fps={30} width={1080} height={1920} />
        <Composition id="AnakCaptionGreenScreen" component={() => <AnakCaptionOverlay bg="#00FF00" />} durationInFrames={AnakFrames} fps={30} width={1080} height={1920} />
        <Composition id="AnakCaptions" component={AnakCaptionsOnly} durationInFrames={AnakFrames} fps={30} width={1080} height={1920} />
      </Folder>
      <Folder name="LustigEiffel">
        <Composition id="LustigShort" component={LustigShort} durationInFrames={LustigFrames} fps={30} width={1080} height={1920} />
        <Composition id="LustigShortWithCaptions" component={LustigShortWithCaptions} durationInFrames={LustigFrames} fps={30} width={1080} height={1920} />
        <Composition id="LustigCaptionOverlay" component={LustigCaptionOverlay} durationInFrames={LustigFrames} fps={30} width={1080} height={1920} />
        <Composition id="LustigCaptionGreenScreen" component={() => <LustigCaptionOverlay bg="#00FF00" />} durationInFrames={LustigFrames} fps={30} width={1080} height={1920} />
        <Composition id="LustigCaptions" component={LustigCaptionsOnly} durationInFrames={LustigFrames} fps={30} width={1080} height={1920} />
      </Folder>
      <Folder name="LetterFortyYears">
        <Composition id="LetterShort" component={LetterShort} durationInFrames={LetterFrames} fps={30} width={1080} height={1920} />
        <Composition id="LetterShortWithCaptions" component={LetterShortWithCaptions} durationInFrames={LetterFrames} fps={30} width={1080} height={1920} />
        <Composition id="LetterCaptionOverlay" component={LetterCaptionOverlay} durationInFrames={LetterFrames} fps={30} width={1080} height={1920} />
        <Composition id="LetterCaptionGreenScreen" component={() => <LetterCaptionOverlay bg="#00FF00" />} durationInFrames={LetterFrames} fps={30} width={1080} height={1920} />
        <Composition id="LetterCaptions" component={LetterCaptionsOnly} durationInFrames={LetterFrames} fps={30} width={1080} height={1920} />
      </Folder>
    </>
  );
};
