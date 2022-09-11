import settingsStore from "@stores/settings-store";
import { getSessionLevaConfig } from "common/get-app-settings-leva-config";
import React from "react";

interface Props {
  onChange: (evt: React.ChangeEvent<HTMLSelectElement>) => void;
  value: string;
  disabled?: boolean;
}
export const SessionSettingsDropDown = ({
  onChange,
  value,
  disabled,
}: Props) => {
  const settings = settingsStore();
  const config = getSessionLevaConfig(settings.data, settings.enabledPlugins);

  return (
    <select onChange={onChange} value={value} disabled={disabled}>
      {Object.keys(config).map((key) => {
        const field = config[key as keyof typeof config];
        const val = [field.path, key].join(".");
        return (
          <option key={val} value={val}>
            {field.folder} &gt; {field.label.replace("(Default)", "")}
          </option>
        );
      })}
    </select>
  );
};
