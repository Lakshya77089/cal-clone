import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type UiState = {
  /** Whether the host-side admin sidebar is collapsed on small screens. */
  sidebarCollapsed: boolean;
  /** Preferred time format on the public booking page. */
  use24h: boolean;
};

const initialState: UiState = {
  sidebarCollapsed: false,
  use24h: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    setUse24h(state, action: PayloadAction<boolean>) {
      state.use24h = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, setUse24h } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
