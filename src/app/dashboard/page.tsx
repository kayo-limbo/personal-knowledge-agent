import Link from "next/link";

const actions = [
  {
    title: "AI Chat",
    href: "/dashboard/chat",
    desc: "Start a conversation with AI.",
  },
  {
    title: "Knowledge",
    href: "/dashboard/knowledge",
    desc: "Manage your knowledge base.",
  },
  {
    title: "Prompt",
    href: "/dashboard/prompts",
    desc: "Organize reusable prompts.",
  },
  {
    title: "History",
    href: "/dashboard/history",
    desc: "Review previous conversations.",
  },
]
export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-600">
         Welcome Back 👋
        </h1>

        <p className="mt-2 text-gray-500">
          Manage your AI knowledge workspace from here.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border-gray-500 text-gray-500 p-6 transition hover:-translate-y-1 hover:shadow-lg"
          >
            <h2 className="text-lg font-semibold">
              {item.title}
            </h2>

            <p className="mt-2 text-sm text-gray-800">
              {item.desc}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}