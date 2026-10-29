import { suctionAssumptions } from "../../../public/suction.mjs";
import { flightAssumptions } from "../../../public/flight.mjs";
import { motionAssumptions } from "../../../public/motion.mjs";
import {
  t,
  say,
  motionProfileOptions,
  flightProfileOptions,
} from "./physicsCopy";
import type { Settings } from "./physicsController";
import type { View } from "./view";

function Select({
  id,
  labelId,
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  id: string;
  labelId: string;
  label: string;
  value: string;
  disabled: boolean;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span id={labelId}>{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MotionSettings({ view }: { view: View }) {
  const { s, c, lang } = view;
  const copy = t(lang),
    zh = lang === "zh",
    motion = c.motionMode(),
    flight = c.flightMode(),
    suction = c.suctionMode(),
    late = ["transfer", "complete"].includes(s.session?.phase ?? ""),
    active = c.autoActive(),
    locked = s.busy || Boolean(s.session) || active,
    v = s.settings;
  const assumptions = suction
    ? suctionAssumptions[lang]
    : s.session?.assumptions ||
      (flight ? flightAssumptions : motionAssumptions)[lang];
  const field = (
    id: string,
    key: keyof Settings,
    label: string,
    options: [string, string][],
  ) => (
    <Select
      id={id}
      labelId={`${id}-label`}
      label={label}
      value={v[key]}
      disabled={locked}
      options={options}
      onChange={(value) => c.setSetting(key, value)}
    />
  );
  return (
    <>
      <nav
        id="vehicle-stages"
        className="vehicle-stages"
        aria-label={zh ? "汽车实验阶段" : "Vehicle stages"}
        hidden={!(motion || flight)}
      >
        <button
          type="button"
          id="vehicle-acceleration"
          className="example"
          aria-pressed={motion}
          disabled={s.busy || active}
          onClick={() => c.chooseVehicleStage("acceleration")}
        >
          {copy["vehicle-acceleration"]}
        </button>
        <button
          type="button"
          id="vehicle-flight"
          className="example"
          aria-pressed={flight}
          disabled={s.busy || active}
          onClick={() => c.chooseVehicleStage("flight")}
        >
          {copy["vehicle-flight"]}
        </button>
        <span id="vehicle-stage-note" className="fine">
          {copy["vehicle-stage-note"]}
        </span>
      </nav>
      <details
        id="flight-settings"
        className="motion-settings"
        aria-labelledby="flight-settings-heading"
        hidden={!flight || late}
      >
        <summary id="flight-settings-heading">
          {copy["flight-settings-heading"]}
        </summary>
        <div className="motion-inputs">
          {field("flight-mass", "flightMass", copy["flight-mass-label"], [
            ["1200", "1200 kg"],
            ["2000", "2000 kg"],
            ["2800", "2800 kg"],
          ])}
          {field("flight-time", "flightTime", copy["flight-time-label"], [
            ["1", "1 s"],
            ["1.5", "1.5 s"],
            ["2", "2 s"],
          ])}
          {field("flight-radius", "flightRadius", copy["flight-radius-label"], [
            ["0.6", "0.6 m"],
            ["0.9", "0.9 m"],
            ["1.2", "1.2 m"],
          ])}
          {field(
            "flight-separation",
            "flightSeparation",
            copy["flight-separation-label"],
            [
              ["0.5", "0.5 m"],
              ["1", "1 m"],
              ["1.5", "1.5 m"],
            ],
          )}
          {field("flight-stop", "flightStop", copy["flight-stop-label"], [
            ["0.05", "0.05 s"],
            ["0.15", "0.15 s"],
            ["0.3", "0.3 s"],
            ["0.6", "0.6 s"],
          ])}
          {field(
            "flight-profile",
            "flightProfile",
            copy["flight-profile-label"],
            flightProfileOptions.map(([value, en, zhText]) => [
              value,
              say(lang, en, zhText),
            ]),
          )}
        </div>
        <p id="flight-setting-note" className="fine">
          {copy["flight-setting-note"]}
        </p>
      </details>
      <details
        id="motion-settings"
        className="motion-settings"
        aria-labelledby="motion-settings-heading"
        hidden={!motion || late}
      >
        <summary id="motion-settings-heading">
          {copy["motion-settings-heading"]}
        </summary>
        <div className="motion-inputs">
          {field("motion-speed", "motionSpeed", copy["motion-speed-label"], [
            ["30", "30 mph"],
            ["60", "60 mph"],
            ["90", "90 mph"],
          ])}
          {field(
            "motion-duration",
            "motionDuration",
            copy["motion-duration-label"],
            [
              ["1", "1 s"],
              ["2", "2 s"],
              ["3", "3 s"],
              ["5", "5 s"],
              ["8", "8 s"],
            ],
          )}
          {field(
            "motion-profile",
            "motionProfile",
            copy["motion-profile-label"],
            [
              motionProfileOptions[2],
              motionProfileOptions[0],
              motionProfileOptions[1],
            ].map(([value, en, zhText]) => [value, say(lang, en, zhText)]),
          )}
          {field("motion-mass", "motionMass", copy["motion-mass-label"], [
            ["1200", "1200 kg"],
            ["2000", "2000 kg"],
            ["2800", "2800 kg"],
          ])}
          {field("motion-grip", "motionGrip", copy["motion-grip-label"], [
            ["0.6", "0.6"],
            ["1", "1.0"],
            ["1.5", "1.5"],
          ])}
          {field("motion-power", "motionPower", copy["motion-power-label"], [
            ["300", "300 kW"],
            ["600", "600 kW"],
            ["1200", "1200 kW"],
          ])}
        </div>
        <p id="motion-setting-note" className="fine">
          {copy["motion-setting-note"]}
        </p>
      </details>
      <details
        id="motion-assumptions"
        className="motion-assumptions"
        aria-labelledby="motion-assumptions-heading"
        hidden={!(motion || flight || suction)}
      >
        <summary id="motion-assumptions-heading">
          {copy["motion-assumptions-heading"]}
        </summary>
        <p id="motion-assumptions-text">{assumptions}</p>
      </details>
    </>
  );
}
