import Link from "next/link";

export default function ChatIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold text-white">What&apos;s on your mind today?</h1>
      <p className="text-sm text-slate-400">
        Create a new chat to get started.
      </p>
      <Link
        href="#"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector<HTMLButtonElement>("[data-new-chat]")?.click();
        }}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
      >
        + New chat
      </Link>
    </div>
  );
}
