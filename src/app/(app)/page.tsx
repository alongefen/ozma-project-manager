import { redirect } from 'next/navigation';

/** The index route leads to the projects page, which is the home screen. */
export default function IndexPage() {
  redirect('/projects');
}
