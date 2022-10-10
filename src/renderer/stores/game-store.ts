import create from "zustand";
import { MinimapDimensions } from "@render/minimap-dimensions";
import { Assets } from "@image/assets";


export type GameStore = {
  assets: Assets | null;
  dimensions: MinimapDimensions;
  setAssets: (assets: Assets | null) => void;
  setDimensions: (dimensions: MinimapDimensions) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  assets: null,
  dimensions: {
    matrix: [],
    minimapWidth: 0,
    minimapHeight: 0
  },
  setAssets: (assets: Assets | null) => set({ assets }),
  setDimensions: (dimensions: MinimapDimensions) => set({ dimensions }),
}));

export default () => useGameStore.getState();

