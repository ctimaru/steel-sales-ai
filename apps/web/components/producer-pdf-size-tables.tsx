import type {PdfDimensions,PdfDimensionRow} from "@/lib/network-producer-pdf-dimensions";

const number=new Intl.NumberFormat("it-IT",{maximumFractionDigits:2});
const sizes=(x:PdfDimensionRow)=>x.shape==="CHS"
 ? "Ø "+number.format(x.diameter??0)
 :number.format(x.width??0)+" × "+number.format(x.height??0);
const shapeLabel=(x:PdfDimensionRow)=>x.shape==="CHS"?"Tondo":
 x.shape==="SHS"?"Quadro":"Rettangolare";

export function ProducerPdfSizeTables({data}:{data:PdfDimensions|null}){
 if(data===null)return <section className="rounded-xl border border-[#dfebdf] bg-white p-4 text-xs text-[#6b7c6b]">
  Le singole dimensioni dei PDF sono temporaneamente indisponibili.
 </section>;
 if(!data.total)return null;
 const companies=new Map<string,PdfDimensionRow[]>();
 for(const x of data.rows){
  const xs=companies.get(x.companyId)||[];
  xs.push(x);companies.set(x.companyId,xs);
 }
 return <section className="space-y-3" data-testid="producer-pdf-size-data">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#c3dccb] bg-[linear-gradient(120deg,#e6f5e9,#ffffff)] p-4 sm:p-5">
   <div>
    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#2b7352]">Cataloghi PDF convertiti in dati</p>
    <h2 className="mt-1 text-xl font-extrabold text-[#194831]">Misure estratte dalle tabelle originali</h2>
    <p className="mt-1 max-w-[740px] text-xs leading-5 text-[#607464]">
     Ogni riga è associata alla sua tabella e norma. Gli spessori sono lasciati non indicati
     se non è stata verificata la corrispondenza con la colonna del PDF.
     Nessuna conferma automatica di producibilità.
    </p>
   </div>
   <div className="flex gap-2">
    <span className="rounded-xl bg-white px-3 py-2 text-sm font-extrabold tabular-nums text-[#1e5d40]">{data.total} misure</span>
    <span className="rounded-xl bg-white px-3 py-2 text-sm font-extrabold tabular-nums text-[#1e5d40]">{data.producers} produttori</span>
   </div>
  </div>
  <div className="grid gap-3 xl:grid-cols-2">
   {[...companies].map(([company,rows])=><article key={company} className="overflow-hidden rounded-[18px] border border-[#d9e6dc] bg-white" data-testid="pdf-size-producer-card">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eaf1eb] px-4 py-4">
     <h3 className="text-sm font-extrabold text-[#205037]">{rows[0].companyName}</h3>
     <span className="rounded-full border border-[#e7d6ac] bg-[#fff7e6] px-2.5 py-1 text-[10px] font-bold text-[#78531c]">Da confermare dal produttore</span>
    </div>
    <div className="overflow-x-auto">
     <table className="w-full min-w-[380px] text-left text-xs">
      <thead className="bg-[#f6faf7] text-[#64786b]"><tr>
       <th className="px-3 py-2 font-bold">Norma</th>
       <th className="px-3 py-2 font-bold">Sezione</th>
       <th className="px-3 py-2 font-bold">Misura (mm)</th>
       <th className="px-3 py-2 font-bold">Spessore</th>
      </tr></thead>
      <tbody className="divide-y divide-[#e8efe9]">
       {rows.map(row=><tr key={row.id}>
        <td className="px-3 py-2.5 font-semibold text-[#315a43]">{row.standard}</td>
        <td className="px-3 py-2.5 text-[#41604a]">{shapeLabel(row)}</td>
        <td className="px-3 py-2.5 font-extrabold tabular-nums text-[#1b4b32]">{sizes(row)}</td>
        <td className="px-3 py-2.5 text-[#7c887d]">Da verificare</td>
       </tr>)}
      </tbody>
     </table>
    </div>
    <details className="border-t border-[#edf1ed] px-4 py-3">
     <summary className="cursor-pointer text-[11px] font-bold text-[#2c6e4c]">Origine e pagina del catalogo</summary>
     <div className="mt-2 flex flex-wrap gap-2">
       {[...new Set(rows.map(x=>x.sourcePage))].map(page=><a key={page}
        href={rows[0].sourceUrl+"#page="+page} target="_blank" rel="noopener noreferrer"
        className="text-[11px] font-semibold text-[#266d4b] underline">Pagina {page}</a>)}
     </div>
     <p className="mt-2 text-[10px] text-[#69806e]">Solo misure documentate. Non sono dichiarati gradi abbinati, stock, tempi o produzione garantita.</p>
    </details>
   </article>)}
  </div>
 </section>;
}