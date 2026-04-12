// /saves — Story 07 List archetype.
//
// Lists available save slots (SQLite files in ./saves/), lets the
// user create a new slot (copies the current DB), and explains that
// loading a different slot requires a server restart.
//
// Save slots are a persistence affordance — the game auto-saves on
// every mutation (the DB is the save), so this page is for managing
// named checkpoints.

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SectionHeader } from "../components/ui/SectionHeader";
import { createSave, fetchSaves } from "../lib/api";

export const Route = createFileRoute("/saves/")({
  component: SavesList,
});

function SavesList() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["saves"],
    queryFn: fetchSaves,
  });
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => createSave(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saves"] });
      setNewName("");
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <SectionHeader eyebrow="Persistence" title="Save slots" />

      <p className="mt-4 text-sm text-parchment-700">
        Every action auto-saves to the active slot. Create a new slot to snapshot your
        progress. To load a different slot, restart the server with a different{" "}
        <code className="font-mono text-xs text-parchment-900">DATABASE_URL</code>.
      </p>

      {/* Create new */}
      <form
        className="mt-6 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createMutation.mutate(newName.trim());
        }}
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New save name"
          className="flex-1 border border-parchment-400 bg-parchment-50 px-3 py-2 font-sans text-sm text-parchment-900 placeholder:text-parchment-400"
        />
        <button
          type="submit"
          disabled={!newName.trim() || createMutation.isPending}
          className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createMutation.isPending ? "Creating…" : "Create snapshot"}
        </button>
      </form>
      {createMutation.isError && (
        <p className="mt-2 text-sm text-semantic-error">
          Could not create the save. The name may already be in use.
        </p>
      )}
      {createMutation.data && (
        <p className="mt-2 text-sm text-moss-700">
          Save created. To load it, restart with{" "}
          <code className="font-mono text-xs">
            DATABASE_URL=sqlite:./saves/{(createMutation.data as { fileName?: string }).fileName}
          </code>
        </p>
      )}

      {/* List */}
      {query.isPending && <p className="mt-8 text-parchment-600">Loading saves…</p>}
      {query.isError && (
        <p className="mt-8 text-semantic-error">Could not load save slots.</p>
      )}
      {query.data && (
        <section className="mt-8 space-y-2">
          {(query.data as { slots: Array<{ name: string; fileName: string; active: boolean; sizeBytes: number }> }).slots.map(
            (slot) => (
              <div
                key={slot.fileName}
                className={`flex items-center justify-between border px-4 py-3 ${
                  slot.active
                    ? "border-moss-600 bg-parchment-50"
                    : "border-parchment-300 bg-parchment-100"
                }`}
              >
                <div>
                  <div className="font-sans text-sm font-semibold text-parchment-900">
                    {slot.name}
                  </div>
                  <div className="text-xs text-parchment-500">
                    {slot.fileName}
                    {slot.active && (
                      <span className="ml-2 font-semibold uppercase text-moss-600">Active</span>
                    )}
                  </div>
                </div>
                <div className="font-mono text-xs text-parchment-500">
                  {Math.round(slot.sizeBytes / 1024)} KB
                </div>
              </div>
            ),
          )}
          {(query.data as { slots: unknown[] }).slots.length === 0 && (
            <p className="text-sm italic text-parchment-500">No save files found.</p>
          )}
        </section>
      )}
    </div>
  );
}
