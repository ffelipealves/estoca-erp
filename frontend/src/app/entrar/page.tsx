import type { Metadata } from "next"
import { Suspense } from "react"
import { LoginView } from "./login-view"

export const metadata: Metadata = { title: "Entrar" }

export default function EntrarPage() {
  // `?next=` is read on the client; the rest of the page can still prerender.
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  )
}
