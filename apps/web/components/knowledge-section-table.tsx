import type { KnowledgeEditorialTable } from "@/lib/public-knowledge";

/**
 * SEO-STANDARD1: sourced data table attached to a Scuola editorial section.
 * Shared by grade and standard detail pages; renders nothing when the
 * section carries no usable table.
 */
export function KnowledgeSectionTable({ table }: { table?: KnowledgeEditorialTable }) {
  if (!table?.columns?.length || !table.rows?.length) return null;

  return (
    <>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-[#dce2df]">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          {table.caption ? <caption className="sr-only">{table.caption}</caption> : null}
          <thead className="bg-[#f6f8f7] text-xs font-bold uppercase tracking-[0.08em] text-[#465c4f]">
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8eeeb] bg-white">
            {table.rows.map((row, rowIndex) => (
              <tr key={row.join("|") + rowIndex}>
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th key={cellIndex} scope="row" className="px-4 py-3 font-semibold text-[#1d2824]">{cell}</th>
                  ) : (
                    <td key={cellIndex} className="px-4 py-3 tabular-nums text-[#465c4f]">{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note ? (
        <p className="mt-3 max-w-[74ch] text-xs leading-5 text-[#66736e]">{table.note}</p>
      ) : null}
    </>
  );
}
