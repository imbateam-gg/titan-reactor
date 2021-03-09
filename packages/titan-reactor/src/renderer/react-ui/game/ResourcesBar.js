import React from "react";
import PlayerResources from "./PlayerResources";
import useSettingsStore from "../../stores/settingsStore";
import useGameStore from "../../stores/gameStore";
import { incFontSize } from "titan-reactor-shared/utils/changeFontSize";

const _playerScoreCache = {};

const ResourcesBar = ({ fitToContent, className = "", style = {} }) => {
  const textSize = useSettingsStore((state) =>
    state.data.esportsHud
      ? incFontSize(state.data.hudFontSize)
      : state.data.hudFontSize
  );

  const { players, onTogglePlayerPov } = useGameStore((state) => ({
    players: state.game.players,
    onTogglePlayerPov: state.onTogglePlayerPov,
  }));

  const smallIconFontSize = textSize === "xs" ? "0.75rem" : "0.9rem";

  const cacheKey = players
    .map(({ name }) => name)
    .sort()
    .join(".");
  if (!_playerScoreCache[cacheKey]) {
    _playerScoreCache[cacheKey] = {};
  }

  return (
    <div className={`select-none ${className}`} style={style}>
      <div className="resources-parent">
        <div
          className="rounded mx-1 my-1 flex"
          style={{ backgroundColor: "#1a202ce6" }}
        >
          <table className="table-auto flex-1 ">
            <tbody>
              {players.map((player, i) => (
                <PlayerResources
                  key={player.name}
                  index={i}
                  textSize={textSize}
                  {...player}
                  fitToContent={fitToContent}
                  playerScoreCache={_playerScoreCache}
                />
              ))}
            </tbody>
          </table>

          <aside className="flex flex-col justify-around mx-2">
            <i
              onClick={() => onTogglePlayerPov(0)}
              className={`material-icons rounded cursor-pointer hover:text-yellow-500 ${
                players[0].showPov ? "text-yellow-700" : "text-gray-700 "
              }`}
              style={{ fontSize: smallIconFontSize }}
              data-tip={`${players[0].name} First Person`}
            >
              slideshow
            </i>
            <i
              onClick={() => onTogglePlayerPov(1)}
              className={`material-icons hover:text-yellow-500 rounded cursor-pointer ${
                players[1].showPov ? "text-yellow-700" : "text-gray-700 "
              }`}
              style={{ fontSize: smallIconFontSize }}
              data-tip={`${players[1].name} First Person`}
            >
              slideshow
            </i>
          </aside>
          {/* <aside className="flex flex-col justify-between ml-2 b">
            <i
              onClick={() => onTogglePlayerActions && onTogglePlayerActions(0)}
              className={`material-icons hover:text-yellow-500 rounded cursor-pointer ${
                players[0].showActions ? "text-yellow-700" : "text-gray-700 "
              }`}
              style={{ fontSize: smallIconFontSize }}
              title="resources"
            >
              room
            </i>

            <i
              onClick={() => onTogglePlayerActions && onTogglePlayerActions(1)}
              className={`material-icons hover:text-yellow-500 rounded cursor-pointer ${
                players[1].showActions ? "text-yellow-700" : "text-gray-700 "
              }`}
              style={{ fontSize: smallIconFontSize }}
              title="resources"
            >
              room
            </i>
          </aside> */}
        </div>
      </div>
    </div>
  );
};

export default ResourcesBar;
