import { EventDispatcher } from "three";
import { KeyboardKeyHold } from "./hold-event";
import { range } from "ramda";
import InputEvents from "./InputEvents";

const KeyCode = {
  W: 87,
  A: 65,
  S: 83,
  D: 68,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
};

const keyNumbers = range(48, 59);
const keyPadNumbers = range(96, 107);

class KeyboardShortcuts extends EventDispatcher {
  constructor(domElement) {
    super();
    this.domElement = domElement;
    this.enabled = true;
    this._keyPressDelay = 500;

    const dispatch = (type, message) => this.dispatchEvent({ type, message });

    this.keyDownListener = (e) => {
      if (!this.enabled || this._keyPressTimeout) return;

      [
        ["KeyP", InputEvents.TogglePlay],
        ["KeyG", InputEvents.ToggleGrid],
        ["KeyA", InputEvents.AzimuthLeft],
        ["KeyD", InputEvents.AzimuthRight],
        ["KeyW", InputEvents.PolarUp],
        ["KeyS", InputEvents.PolarDown],
        ["KeyC", InputEvents.PolarDown],
        ["KeyE", InputEvents.ToggleElevation],
        // ["KeyE", k.ToggleReplayPosition],
        // ["KeyW", k.ToggleUnitSelection],
        // ["KeyQ", k.ToggleMinimap],
        // ["KeyR", k.ToggleProduction],
        // ["KeyT", k.ToggleResources],
        // ["KeyA", k.ToggleAll],
        ["KeyI", InputEvents.ToggleUnitInformation],
        ["F10", InputEvents.ToggleMenu],
        ["Escape", InputEvents.ToggleMenu],
      ].forEach(([key, event]) => e.code === key && dispatch(event));

      this._keyPressTimeout = setTimeout(() => {
        this._keyPressTimeout = null;
      }, this._keyPressDelay);
    };

    this.holdEvents = [
      [KeyCode.ArrowUp, InputEvents.MoveForward],
      [KeyCode.ArrowLeft, InputEvents.TruckLeft],
      [KeyCode.ArrowDown, InputEvents.MoveBackward],
      [KeyCode.ArrowRight, InputEvents.TruckRight],
    ].map(([keyCode, eventType]) => {
      const key = new KeyboardKeyHold(keyCode, 20);
      const listener = (event) => {
        dispatch(eventType, event.deltaTime);
      };
      key.addEventListener("holding", listener);
      return {
        update: (delta) => key.update(delta),
        dispose: () => key.removeEventListener("holding", listener),
      };
    });

    document.addEventListener("keydown", this.keyDownListener, {
      passive: true,
      capture: true,
    });
  }

  update(delta) {
    for (const key of this.holdEvents) {
      key.update(delta);
    }
  }

  dispose() {
    document.removeEventListener("keydown", this.keyDownListener);
    this.holdEvents.forEach((event) => event.dispose());
  }
}

export default KeyboardShortcuts;
