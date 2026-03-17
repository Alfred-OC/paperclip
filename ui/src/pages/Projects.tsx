import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Hexagon, Plus, Trash2 } from "lucide-react";

export function Projects() {
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Projects" }]);
  }, [setBreadcrumbs]);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id, selectedCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId!) });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={openNewProject}>
          <Plus className="h-4 w-4 mr-1" />
          Add Project
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {projects && projects.length === 0 && (
        <EmptyState
          icon={Hexagon}
          message="No projects yet."
          action="Add Project"
          onAction={openNewProject}
        />
      )}

      {projects && projects.length > 0 && (
        <div className="border border-border">
          {projects.map((project) => (
            <EntityRow
              key={project.id}
              title={project.name}
              subtitle={project.description ?? undefined}
              to={projectUrl(project)}
              trailing={
                <div className="flex items-center gap-3">
                  {project.targetDate && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(project.targetDate)}
                    </span>
                  )}
                  <StatusBadge status={project.status} />
                  <button
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    disabled={deleteMutation.isPending}
                    title="Delete project"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
                      deleteMutation.mutate(project.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
