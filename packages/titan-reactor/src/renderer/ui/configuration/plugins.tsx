import { InitializedPluginPackage } from "common/types";
import { useControls } from "leva";

interface PluginConfigurationProps {
  pluginConfig: InitializedPluginPackage;
  onChange: (key: string, value: any) => void;
}
const PluginConfigurationUI = ({
  pluginConfig,
  onChange,
}: PluginConfigurationProps) => {
  const userConfig = pluginConfig.config ?? {
    "N/A": {
      value: "This plugin has no user configuration.",
      editable: false,
    },
  };

  Object.keys(userConfig).forEach((key) => {
    userConfig[key].onChange = (value: any) => {
      if (userConfig[key].value !== value) {
        console.log("diff", userConfig[key].value, value);
        onChange(key, value);
      }
    };
  });
  useControls(userConfig, [userConfig]);
  return null;
};

export default PluginConfigurationUI;
