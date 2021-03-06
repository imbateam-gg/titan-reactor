import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  criticalError: false,
  replay: null,
  map: null,
  processes: {
    map: {},
    replay: {},
    init: {},
    preload: {},
    chk: {},
  },
  total: 0,
  progress: 0,
  gameTick: 0,
};

const titanReactorReducer = createSlice({
  name: "titan",
  initialState,
  reducers: {
    loading: {
      reducer: (state, action) => {
        const { name, total } = action.payload;
        state.processes[name] = {
          completed: false,
          started: true,
          total,
          current: 0,
          error: null,
        };
        state.total = state.total + total;
      },
      prepare: (name, total = 1) => ({ payload: { name, total } }),
    },
    loadingProgress: (state, action) => {
      const process = state.processes[action.payload];
      if (process.completed) {
        throw new Error("process already completed");
      }
      if (process.error) {
        throw new Error("process has errored out");
      }
      process.current = process.current + 1;
      state.progress = state.progress + 1;

      if (process.current === process.total) {
        state.progress = state.progress - process.current;
        state.total = state.total - process.total;
        process.completed = true;
        process.started = false;
      }
    },
    loadingError: {
      reducer: (state, action) => {
        const { name, error } = action.payload;
        const process = state.processes[name];
        process.error = error;
        process.started = false;
        state.progress = state.progress - process.current;
        state.total = state.total - process.total;
      },
      prepare: (name, error) => ({ payload: { name, error } }),
    },
    mapFileReady: (state, action) => ({
      ...state,
      map: action.map,
    }),
    replayFileReady: (state, action) => ({
      ...state,
      replay: action.replay,
    }),

    criticalErrorOccurred: (state) => {
      return {
        ...state,
        criticalError: true,
      };
    },
    onGameTick: (state) => {
      return {
        ...state,
        gameTick: state.gameTick + 1,
      };
    },
  },
});

export const {
  loading,
  loadingProgress,
  loadingError,
  criticalErrorOccurred,
  onGameTick,
} = titanReactorReducer.actions;

export default titanReactorReducer.reducer;
