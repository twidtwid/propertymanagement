import { redirect } from "next/navigation"

// Redirect old maintenance page to new tickets page
export default function MaintenancePage() {
  redirect("/tickets")
}
