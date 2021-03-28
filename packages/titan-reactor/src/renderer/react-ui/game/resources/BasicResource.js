import React, { useEffect, useRef } from "react";
import useResourcesStore from "../../../stores/realtime/resourcesStore";

export default ({ image, scaledTextSize, selector }) => {
  const numberRef = useRef();

  const setDom = (value) => {
    if (!numberRef.current) return;
    numberRef.current.textContent = value;
  };

  useEffect(() => {
    setDom(selector(useResourcesStore.getState()));

    return useResourcesStore.subscribe((item) => {
      setDom(item);
    }, selector);
  }, []);

  return (
    <div className="flex items-center">
      {image}
      <span
        ref={numberRef}
        className={`ml-2 text-gray-200 text-${scaledTextSize}`}
      ></span>
    </div>
  );
};
