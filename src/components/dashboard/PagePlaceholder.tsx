interface PagePlaceholderProps {
  title: string;
  description: string;
}

/**
 * Simple dashboard placeholder used during phased implementation.
 */
export const PagePlaceholder = ({ title, description }: PagePlaceholderProps) => {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-slate-600">{description}</p>
    </section>
  );
};
