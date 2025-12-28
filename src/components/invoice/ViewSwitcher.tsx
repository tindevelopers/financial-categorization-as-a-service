"use client";

import React from "react";
import {
  Squares2X2Icon,
  RectangleGroupIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import {
  Squares2X2Icon as Squares2X2IconSolid,
  RectangleGroupIcon as RectangleGroupIconSolid,
  TableCellsIcon as TableCellsIconSolid,
} from "@heroicons/react/24/solid";

export type ViewType = "card" | "split" | "table";

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const VIEW_STORAGE_KEY = "invoice-review-view-preference";

export function getStoredViewPreference(): ViewType {
  if (typeof window === "undefined") return "table";
  const stored = localStorage.getItem(VIEW_STORAGE_KEY);
  if (stored === "card" || stored === "split" || stored === "table") {
    return stored;
  }
  return "table"; // Default
}

export function setStoredViewPreference(view: ViewType): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEW_STORAGE_KEY, view);
}

export default function ViewSwitcher({
  currentView,
  onViewChange,
}: ViewSwitcherProps) {
  const views: Array<{
    id: ViewType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconSolid: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: "card",
      label: "Card Grid",
      icon: Squares2X2Icon,
      iconSolid: Squares2X2IconSolid,
    },
    {
      id: "split",
      label: "Split View",
      icon: RectangleGroupIcon,
      iconSolid: RectangleGroupIconSolid,
    },
    {
      id: "table",
      label: "Table",
      icon: TableCellsIcon,
      iconSolid: TableCellsIconSolid,
    },
  ];

  const handleViewChange = (view: ViewType) => {
    setStoredViewPreference(view);
    onViewChange(view);
  };

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
      {views.map((view) => {
        const isActive = currentView === view.id;
        const IconComponent = isActive ? view.iconSolid : view.icon;

        return (
          <button
            key={view.id}
            onClick={() => handleViewChange(view.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }
            `}
            title={view.label}
          >
            <IconComponent className="h-5 w-5" />
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

