import { getAllCategories } from "@/db/queries/admin";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Categories",
};

export default async function CategoriesPage() {
  const categories = await getAllCategories();

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
        Categories
      </h1>

      <div style={{ animation: "fadeInUp 0.5s var(--ease-out) 0.1s both" }}>
        <CategoryManager initialCategories={categories} />
      </div>
    </div>
  );
}
