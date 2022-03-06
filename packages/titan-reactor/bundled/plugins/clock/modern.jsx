import React from "react";
import { useStore } from "titan-reactor";

const _mapSelector = (store) => store.world.map;

export default ({ userConfig, time, styles }) => {
  const map = useStore(_mapSelector);

  return (
    <>
      <div
        style={{
          color: styles.textGray,
          background: styles.bevelGray800,
          fontWeight: "bold",
          fontSize: userConfig.fontSize.value,
          paddingLeft: "0.2rem",
          paddingBottom: "0.2rem",
          width: "var(--minimap-width)",
        }}
      >
        <span style={{ display: "inline" }}>{time}</span>
      </div>

      <span style={{ display: "flex" }}>
        <span
          style={{
            color: styles.textGray400,
            background: styles.bgGray700,
            paddingLeft: "0.2rem",
            paddingRight: "0.2rem",
            textTransform: "uppercase",
            textOverflow: "ellipsis",
            flexGrow: 1,
          }}
        >
          <p
            style={{
              opacity: 0.8,
              whiteSpace: "nowrap",
              maxWidth: "calc(var(--minimap-width) - 30px)",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {map.title}
          </p>
        </span>
        <span
          style={{
            background: styles.bevelGray700,
            width: "100%",
            alignSelf: "stretch",
          }}
        ></span>
      </span>
    </>
  );
};
