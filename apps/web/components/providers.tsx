"use client";
import { Suspense } from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
import { NavigationProgress } from "@/components/navigation-progress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {children}
    </Provider>
  );
}
