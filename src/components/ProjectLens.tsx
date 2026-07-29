"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import type { ProjectCategory } from "@/data/projects";

export type ProjectFilter = "All" | ProjectCategory;

type ProjectLensProps = Readonly<{
  categories: readonly ProjectCategory[];
  activeCategory: ProjectFilter;
  query: string;
  resultCount: number;
  onCategoryChange: (category: ProjectFilter) => void;
  onQueryChange: (query: string) => void;
  onClear: () => void;
}>;

export function ProjectLens({
  categories,
  activeCategory,
  query,
  resultCount,
  onCategoryChange,
  onQueryChange,
  onClear,
}: ProjectLensProps) {
  const searchId = useId();
  const hasFilters = activeCategory !== "All" || query.length > 0;

  return (
    <div className="project-lens" aria-label="Project lens">
      <div className="project-lens__topline">
        <div className="project-lens__search">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor={searchId}>
            Search projects
          </label>
          <input
            id={searchId}
            type="search"
            inputMode="search"
            autoComplete="off"
            value={query}
            placeholder="Search the archive"
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query && (
            <button
              className="project-lens__search-clear"
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="project-lens__count" aria-live="polite">
          <span>{resultCount}</span>{" "}
          {resultCount === 1 ? "project in focus" : "projects in focus"}
        </p>
      </div>

      <div className="project-lens__filter-row">
        <div
          className="project-lens__filters"
          role="group"
          aria-label="Filter projects by category"
        >
          {(["All", ...categories] as ProjectFilter[]).map((category) => (
            <button
              className="project-lens__filter"
              data-active={activeCategory === category ? "true" : "false"}
              type="button"
              key={category}
              aria-pressed={activeCategory === category}
              onClick={() => onCategoryChange(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            className="project-lens__clear"
            type="button"
            onClick={onClear}
          >
            Reset lens
            <X aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

