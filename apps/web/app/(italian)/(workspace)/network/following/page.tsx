import { redirect } from "next/navigation";

/** NET-UX LOT1 — founder decision (2 Nov 2026): the only relationship with a
 * Network company is "Connetti". Saved/followed lists and the followed-company
 * activity feed are retired from the interface; old links land on the search. */
export default function RetiredNetworkListPage() {
  redirect("/network");
}
