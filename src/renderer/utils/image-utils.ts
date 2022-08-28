import { BwDAT, GltfAtlas, ImageDAT, ImageStruct } from "common/types";
import { ImageFlags, drawFunctions } from "common/enums";

export const imageIsShadow = (image: ImageStruct, bwDat: BwDAT) => {
  return (
    bwDat.images[image.typeId].drawFunction ===
    drawFunctions.rleShadow
  );
}

export const imageIsFlipped = (image: ImageStruct) => {
  return (image.flags & ImageFlags.Flipped) !== 0;
}

export const imageIsHidden = (image: ImageStruct) => {
  return (image.flags & ImageFlags.Hidden) !== 0;
}

export const imageIsFrozen = (image: ImageStruct) => {
  return (image.flags & ImageFlags.Frozen) !== 0;
}

export const imageNeedsRedraw = (image: ImageStruct) => {
  return !!(image.flags & ImageFlags.Redraw);
}

export const imageHasDirectionalFrames = (image: ImageStruct) => {
  return image.flags & ImageFlags.Directional;
}

export const imageIsClickable = (image: ImageStruct) => {
  return image.flags & ImageFlags.Clickable;
}

export const imageIsDoodad = (dat: ImageDAT) => {
  return dat.iscript === 336 || dat.iscript === 337;
}

export const isGltfAtlas = (obj: any): obj is GltfAtlas => obj !== undefined && "model" in obj;
