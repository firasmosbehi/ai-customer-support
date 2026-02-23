interface HeaderProps {
  organizationName: string;
  userEmail: string;
}

/**
 * Dashboard header with organization context and sign-out control.
 */
export const Header = ({ organizationName, userEmail }: HeaderProps) => {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <p className="text-sm text-slate-500">Organization</p>
        <h1 className="text-lg font-semibold text-slate-900">{organizationName}</h1>
      </div>

      <div className="flex items-center gap-4">
        <p className="hidden text-sm text-slate-600 md:block">{userEmail}</p>
        <form action="/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
};
