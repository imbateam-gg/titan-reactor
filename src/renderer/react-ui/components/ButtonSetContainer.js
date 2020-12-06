import React from "react";

const ButtonSetContainer = ({ children }) => {
  return (
    <div className="flex rounded-lg text-lg" role="group">
      {children}
    </div>
  );
};

export default ButtonSetContainer;
