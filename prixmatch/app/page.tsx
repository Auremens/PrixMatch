// app/page.tsx — Redirection automatique vers /rechercher
import { redirect } from 'next/navigation';

export default function PageRacine() {
  redirect('/rechercher');
}
