import { useControls, useCreateStore } from "leva";
import { createLevaPanel } from "../../create-leva-panel";
import { mapSingleConfigToLeva } from "@utils/leva-utils";
import { MacroActionPanelProps } from "./macro-action-panel-props";
import { DisplayFieldDefinition } from "common/macros/get-macro-action-condition-field-definition";

export const MacroActionModifyValue = (
  props: MacroActionPanelProps & { config: DisplayFieldDefinition }
) => {
  const { action, config, updateMacroAction } = props;
  const controls = {
    SetField: mapSingleConfigToLeva({ ...config, label: "" }, (value) => {
      updateMacroAction({
        ...action,
        value,
      });
    }),
  };

  const store = useCreateStore();

  useControls(controls, { store }, [action]);
  return createLevaPanel(store);
};
