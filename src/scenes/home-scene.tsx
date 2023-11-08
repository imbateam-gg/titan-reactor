import { TRScene, TRSceneID } from "./scene";
import { HomeSceneUI } from "./home/home-scene-ui";
import { createWraithScene, getWraithSurface } from "./home/space-scene";
import { music } from "@audio/music";
import { useSettingsStore } from "@stores/settings-store";

export class HomeScene implements TRScene {
    id: TRSceneID = "@home";

    async load() {
        const wraithScene = await createWraithScene();
        return {
            component: <HomeSceneUI />,
            surface: getWraithSurface().canvas,
            dispose: () => {
                wraithScene.dispose();
            }
        }
    }
}
