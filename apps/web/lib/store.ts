import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import { calApi } from "./api/calApi";
import { uiReducer } from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    [calApi.reducerPath]: calApi.reducer,
    ui: uiReducer,
  },
  middleware: (getDefault) => getDefault().concat(calApi.middleware),
});

setupListeners(store.dispatch);

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
