"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";

import { ProjectCard } from "@/components/ProjectCard";
import {
  ProjectLens,
  type ProjectFilter,
} from "@/components/ProjectLens";
import type { Project, ProjectCategory } from "@/data/projects";

type WorkGridProps = Readonly<{
  items: readonly Project[];
  featuredOnly?: boolean;
  limit?: number;
  showLens?: boolean;
  className?: string;
}>;

function normalized(value: string) {
  return value.toLocaleLowerCase().trim();
}

export function WorkGrid({
  items,
  featuredOnly = false,
  limit,
  showLens = true,
  className,
}: WorkGridProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeCategory, setActiveCategory] =
    useState<ProjectFilter>("All");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const source = useMemo(
    () =>
      featuredOnly ? items.filter((project) => project.featured) : [...items],
    [featuredOnly, items],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(source.flatMap((project) => project.categories)),
      ) as ProjectCategory[],
    [source],
  );

  const filteredProjects = useMemo(() => {
    const needle = normalized(deferredQuery);
    const filtered = source.filter((project) => {
      const categoryMatch =
        activeCategory === "All" ||
        project.categories.includes(activeCategory);

      if (!categoryMatch) return false;
      if (!needle) return true;

      const searchable = [
        project.title,
        project.eyebrow,
        project.summary,
        project.statement,
        ...project.categories,
        ...project.role,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return searchable.includes(needle);
    });

    return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  }, [activeCategory, deferredQuery, limit, source]);

  const resetLens = () => {
    setActiveCategory("All");
    setQuery("");
  };

  return (
    <div
      className={className ? `work-grid ${className}` : "work-grid"}
      data-filtering={deferredQuery !== query ? "true" : "false"}
    >
      {showLens && (
        <ProjectLens
          categories={categories}
          activeCategory={activeCategory}
          query={query}
          resultCount={filteredProjects.length}
          onCategoryChange={setActiveCategory}
          onQueryChange={setQuery}
          onClear={resetLens}
        />
      )}

      <m.div
        className="work-grid__list"
        layout={!shouldReduceMotion}
        aria-busy={deferredQuery !== query}
      >
        <AnimatePresence initial={false} mode="sync">
          {filteredProjects.map((project, index) => (
            <ProjectCard
              key={project.slug}
              project={project}
              index={index}
              priority={index < 2}
              featured={index === 0 && !showLens}
            />
          ))}
        </AnimatePresence>
      </m.div>

      {filteredProjects.length === 0 && (
        <div className="work-grid__empty">
          <p>No projects match that lens yet.</p>
          <button type="button" className="text-link" onClick={resetLens}>
            Reset the lens
          </button>
        </div>
      )}
    </div>
  );
}
