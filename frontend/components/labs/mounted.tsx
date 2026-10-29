import { useEffect, useRef } from "react";
import { mountJourney } from "../../../public/journey-view.mjs";
import { mountSuctionLab } from "../../../public/suction-view.mjs";
// React owns the containers; the validated drawing modules own what is inside
// them. Each wrapper mounts once per host and hands its handle to the lab
// controller, which drives it exactly as the original controller did.
export type JourneyHandle = ReturnType<typeof mountJourney>;
export type SuctionHandle = ReturnType<typeof mountSuctionLab>;
export function JourneyView({
  register,
  plotFocus,
}: {
  register: (handle: JourneyHandle | null) => void;
  plotFocus: string;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const handle = mountJourney(element);
    register(handle);
    return () => {
      register(null);
      handle.destroy();
      element.replaceChildren();
      element.hidden = true;
    };
  }, [register]);
  return (
    <section
      id="journey"
      className="journey"
      ref={root}
      hidden
      data-plot-focus={plotFocus}
    />
  );
}
export function SuctionLabView({
  register,
}: {
  register: (handle: SuctionHandle | null) => void;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const handle = mountSuctionLab(element);
    register(handle);
    return () => {
      register(null);
      handle.stop();
      element.replaceChildren();
      element.hidden = true;
    };
  }, [register]);
  return <section id="suction-lab" ref={root} hidden />;
}
