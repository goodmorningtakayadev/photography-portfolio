import { getAllProjectsAdmin } from "@/db/queries/admin";
import { ProjectList } from "@/components/admin/ProjectList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projects",
};

export default async function ProjectsPage() {
  const projects = await getAllProjectsAdmin();

  return (
    <div
      className="max-w-[var(--max-w)] mx-auto"
      style={{
        padding: "clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 5vw, 5rem)",
        paddingLeft: "clamp(2.5rem, 6vw, 6rem)",
      }}
    >
      <h1
        className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold uppercase tracking-tight leading-none text-[var(--white)]"
        style={{ fontFamily: "var(--f-display)", letterSpacing: "-0.02em", marginBottom: "3rem", animation: "fadeInUp 0.5s var(--ease-out) both" }}
      >
        Projects
      </h1>
      <div
        className="flex items-center justify-start"
        style={{ marginBottom: "3rem", animation: "fadeInUp 0.5s var(--ease-out) 0.1s both" }}
      >
        <a
          href="/admin/projects/new"
          className="mono text-[0.65rem] uppercase tracking-[0.2em] rounded-sm"
          style={{
            background: "var(--ember)",
            color: "var(--black)",
            fontWeight: 600,
            transition: `opacity var(--t-fast) var(--ease-out)`,
            paddingLeft: "1.5rem",
            paddingRight: "1.2rem",
            paddingTop: "0.75rem",
            paddingBottom: "0.75rem",
          }}
        >
          New Project
        </a>
      </div>
      <div style={{ animation: "fadeInUp 0.5s var(--ease-out) 0.2s both" }}>
        <ProjectList projects={projects} />
      </div>
    </div>
  );
}
