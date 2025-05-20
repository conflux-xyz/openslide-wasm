export type OpenSlideT = number;

export type WorkerCommandBase =
  | {type: "init"}
  | {type: "open", payload: {file: File | string}}
  | {type: "close", payload: {osr: OpenSlideT}}
  | {type: "getPropertyNames", payload: {osr: OpenSlideT}}
  | {type: "getPropertyValue", payload: {osr: OpenSlideT, name: string}}
  | {type: "getLevelCount", payload: {osr: OpenSlideT}}
  | {type: "getLevelDimensions", payload: {osr: OpenSlideT, level: number}}
  | {type: "getLevelDownsample", payload: {osr: OpenSlideT, level: number}}
  | {type: "getBestLevelForDownsample", payload: {osr: OpenSlideT, downsample: number}}
  | {type: "readRegion", payload: {osr: OpenSlideT, x: number, y: number, level: number, width: number, height: number}}
export type WorkerCommand = WorkerCommandBase & {id: string};

export type WorkerResponseBase =
  | {type: "error", payload: {message: string}}
  | {type: "ready"}
  | {type: "open", payload: {osr: OpenSlideT}}
  | {type: "close", payload: {osr: OpenSlideT}}
  | {type: "getPropertyNames", payload: {names: string[]}}
  | {type: "getPropertyValue", payload: {value: string | null}}
  | {type: "getLevelCount", payload: {count: number}}
  | {type: "getLevelDimensions", payload: {dimensions: [number, number]}}
  | {type: "getLevelDownsample", payload: {downsample: number}}
  | {type: "getBestLevelForDownsample", payload: {level: number}}
  | {type: "readRegion", payload: {data: Uint8ClampedArray};}

export type WorkerResponse = WorkerResponseBase & {id: string};