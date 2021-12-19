import { memo } from "preact/compat";

const ReplayPosition = ({ className }) => (
  <div
    className={`replay-parent flex self-end select-none ${className}`}
    style={{ minWidth: "18vw" }}
  ></div>
);

export default memo(ReplayPosition);
