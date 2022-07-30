import create, { GetState, SetState } from "zustand";

import { Settings, SettingsMeta } from "common/types";
import { defaultSettings } from "common/settings";
import { getSettings as invokeGetSettings, saveSettings } from "../ipc";

export type SettingsStore = SettingsMeta & {
  save: (data: Partial<Settings>, source: string) => Promise<SettingsMeta>;
  set: (data: Partial<Settings>, source: string) => Promise<void>;
  load: () => Promise<SettingsMeta>;
};

export const useSettingsStore = create<SettingsStore>((set: SetState<SettingsStore>, get: GetState<SettingsStore>) => ({
  data: { ...defaultSettings },
  phrases: {},
  isCascStorage: false,
  errors: [],
  enabledPlugins: [],
  disabledPlugins: [],
  pluginsMetadata: [],
  set: async (settings) => {
    set((state) => ({ data: { ...state.data, ...settings } }));
  },
  save: async (settings) => {
    await saveSettings({ ...get().data, ...settings });
    return await get().load();
  },
  load: async () => {
    const settings = await invokeGetSettings();
    set(settings);
    return settings;
  },

}));

export default () => useSettingsStore.getState();